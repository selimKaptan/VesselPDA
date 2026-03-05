import { useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Wand2, Upload, Loader2, Users, Wrench, Clock, Handshake,
  Package, Anchor, CreditCard, FileText, FileEdit, Timer, Pin,
  Ship, MapPin, Calendar, Hash, AlertTriangle, CheckCircle, Edit3,
  X, ChevronRight,
} from "lucide-react";

type DetectedEvent =
  | "crew_change" | "spare_part" | "eta_update" | "nomination"
  | "cargo_info" | "port_call" | "invoice" | "nor_tendered"
  | "sof_update" | "laytime_notice" | "general_note";

const EVENT_ICONS: Record<DetectedEvent, any> = {
  crew_change: Users,
  spare_part: Wrench,
  eta_update: Clock,
  nomination: Handshake,
  cargo_info: Package,
  port_call: Anchor,
  invoice: CreditCard,
  nor_tendered: FileText,
  sof_update: FileEdit,
  laytime_notice: Timer,
  general_note: Pin,
};

const EVENT_LABELS: Record<DetectedEvent, string> = {
  crew_change: "Crew Change",
  spare_part: "Spare Part",
  eta_update: "ETA Update",
  nomination: "Nomination",
  cargo_info: "Cargo Info",
  port_call: "Port Call",
  invoice: "Invoice",
  nor_tendered: "NOR Tendered",
  sof_update: "SOF Update",
  laytime_notice: "Laytime Notice",
  general_note: "General Note",
};

interface AnalysisResult {
  detected_event: DetectedEvent;
  confidence: number;
  vessel_name: string | null;
  imo_number: string | null;
  port_name: string | null;
  date: string | null;
  summary: string;
  details: Record<string, any>;
  action_required: string;
  suggested_action: string;
  raw_entities: {
    emails: string[];
    phone_numbers: string[];
    dates: string[];
    amounts: string[];
  };
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  if (pct >= 80)
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{pct}% confident</Badge>;
  if (pct >= 50)
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">{pct}% confident</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{pct}% confident</Badge>;
}

interface AiAnalysisModalProps {
  open: boolean;
  onClose: () => void;
  analysis: AnalysisResult;
  historyId?: number;
}

export function AiAnalysisModal({ open, onClose, analysis, historyId }: AiAnalysisModalProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [edited, setEdited] = useState({
    vessel_name: analysis.vessel_name || "",
    port_name: analysis.port_name || "",
    date: analysis.date || "",
    summary: analysis.summary || "",
  });

  const EventIcon = EVENT_ICONS[analysis.detected_event] || Pin;
  const eventLabel = EVENT_LABELS[analysis.detected_event] || analysis.detected_event;
  const confidence = analysis.confidence || 0;

  const executeMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/ai/execute-action", body),
    onSuccess: async (res: any) => {
      const data = await res.json();
      if (data.redirect) {
        onClose();
        navigate(data.redirect);
      } else {
        toast({ title: "Action completed", description: data.message });
        queryClient.invalidateQueries({ queryKey: ["/api/ai/history"] });
        onClose();
      }
    },
    onError: () => {
      toast({ title: "Action failed", description: "Could not process the action.", variant: "destructive" });
    },
  });

  function handleConfirm() {
    const details = {
      ...analysis,
      vessel_name: edited.vessel_name || analysis.vessel_name,
      port_name: edited.port_name || analysis.port_name,
      date: edited.date || analysis.date,
      summary: edited.summary || analysis.summary,
    };
    executeMutation.mutate({
      type: analysis.suggested_action,
      vesselName: edited.vessel_name || analysis.vessel_name,
      details,
      historyId,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900/95 backdrop-blur-xl border-slate-700/50 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Wand2 className="w-5 h-5 text-sky-400" />
            <span>AI Analysis Result</span>
            <ConfidenceBadge value={confidence} />
          </DialogTitle>
        </DialogHeader>

        {confidence < 0.5 && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Low confidence — please review and edit before processing.
          </div>
        )}

        <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 flex items-start gap-3">
          <EventIcon className="w-6 h-6 text-sky-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sky-300 font-semibold text-sm mb-1">{eventLabel}</div>
            <div className="text-white/80 text-sm">
              {editMode ? (
                <Input
                  value={edited.summary}
                  onChange={(e) => setEdited((p) => ({ ...p, summary: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white text-sm h-8"
                  data-testid="input-summary"
                />
              ) : (
                edited.summary || analysis.summary
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Ship, label: "Vessel", field: "vessel_name" as const },
            { icon: MapPin, label: "Port", field: "port_name" as const },
            { icon: Calendar, label: "Date", field: "date" as const },
            { icon: Hash, label: "IMO", field: null, value: analysis.imo_number },
          ].map(({ icon: Icon, label, field, value }) => {
            const val = field ? (edited[field] || analysis[field]) : value;
            if (!val && !editMode) return null;
            return (
              <div key={label} className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-3">
                <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-400">{label}</div>
                  {editMode && field ? (
                    <Input
                      value={edited[field]}
                      onChange={(e) => setEdited((p) => ({ ...p, [field]: e.target.value }))}
                      className="bg-slate-700 border-slate-600 text-white text-sm h-7 mt-0.5"
                      data-testid={`input-${field}`}
                    />
                  ) : (
                    <div className="text-white text-sm truncate">{val || "—"}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {Object.keys(analysis.details || {}).length > 0 && (
          <div className="bg-slate-800/40 rounded-xl p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Event Details</div>
            <div className="space-y-1">
              {Object.entries(analysis.details).map(([k, v]) => (
                <div key={k} className="flex items-start gap-2 text-sm">
                  <span className="text-slate-400 capitalize shrink-0">{k.replace(/_/g, " ")}:</span>
                  <span className="text-white/80 break-words">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis.action_required && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
            <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-1">Action Required</div>
            <div className="text-white/80 text-sm">{analysis.action_required}</div>
          </div>
        )}

        {(analysis.raw_entities?.emails?.length > 0 ||
          analysis.raw_entities?.dates?.length > 0 ||
          analysis.raw_entities?.amounts?.length > 0) && (
          <div>
            <div className="text-xs text-slate-400 mb-2">Extracted Entities</div>
            <div className="flex flex-wrap gap-1.5">
              {analysis.raw_entities.emails?.map((e, i) => (
                <span key={i} className="text-xs bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-full">📧 {e}</span>
              ))}
              {analysis.raw_entities.dates?.map((d, i) => (
                <span key={i} className="text-xs bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-full">📅 {d}</span>
              ))}
              {analysis.raw_entities.amounts?.map((a, i) => (
                <span key={i} className="text-xs bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-full">💰 {a}</span>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
            data-testid="button-cancel-analysis"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => setEditMode((p) => !p)}
            className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
            data-testid="button-edit-analysis"
          >
            <Edit3 className="w-4 h-4 mr-1.5" />
            {editMode ? "Done Editing" : "Edit"}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={executeMutation.isPending}
            className="ml-auto bg-sky-600 hover:bg-sky-500 text-white font-semibold px-6"
            data-testid="button-confirm-analysis"
          >
            {executeMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            Confirm & Process
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface AiSmartDropProps {
  mini?: boolean;
  className?: string;
}

export function AiSmartDrop({ mini = false, className = "" }: AiSmartDropProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [result, setResult] = useState<{ analysis: AnalysisResult; historyId: number } | null>(null);

  const parseMutation = useMutation({
    mutationFn: (body: { content: string; fileType: string; fileName: string }) =>
      apiRequest("POST", "/api/ai/parse-document", body).then((r) => r.json()),
    onError: () => {
      toast({ title: "Analysis failed", description: "Could not analyze the document.", variant: "destructive" });
    },
  });

  const processFile = useCallback(
    async (file: File) => {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File too large", description: "Maximum file size is 5MB.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = (e.target?.result as string) || "";
        const data = await parseMutation.mutateAsync({
          content,
          fileType: file.type || "text/plain",
          fileName: file.name,
        });
        if (data?.analysis) {
          setResult({ analysis: data.analysis, historyId: data.historyId });
        }
      };
      reader.readAsText(file);
    },
    [parseMutation, toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handlePasteSubmit = async () => {
    if (!pasteText.trim()) return;
    const data = await parseMutation.mutateAsync({
      content: pasteText,
      fileType: "text/plain",
      fileName: "pasted-text.txt",
    });
    if (data?.analysis) {
      setResult({ analysis: data.analysis, historyId: data.historyId });
      setPasteOpen(false);
      setPasteText("");
    }
  };

  const isLoading = parseMutation.isPending;

  return (
    <>
      <div
        className={`
          relative glass-panel rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer select-none
          ${dragging
            ? "border-sky-400 bg-sky-500/10 shadow-lg shadow-sky-500/20 scale-[1.02]"
            : "border-slate-700/50 bg-slate-900/40 hover:border-slate-500/70 hover:bg-slate-800/30"
          }
          ${mini ? "p-5" : "p-8"}
          ${className}
        `}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        data-testid="dropzone-ai-smart-drop"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".eml,.txt,.pdf,.msg"
          className="hidden"
          onChange={handleFileChange}
          data-testid="input-file-upload"
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className={`animate-spin text-sky-400 ${mini ? "w-8 h-8" : "w-12 h-12"}`} />
            <p className="text-sky-300 text-sm font-medium">AI is analyzing your document...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className={`rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center ${mini ? "w-12 h-12" : "w-16 h-16"}`}>
              <Wand2 className={`text-sky-400 ${mini ? "w-6 h-6" : "w-8 h-8"}`} />
            </div>
            <div>
              <h3 className={`font-semibold text-white ${mini ? "text-sm" : "text-base"}`}>AI Smart Drop</h3>
              {!mini && (
                <p className="text-slate-400 text-sm mt-1">Drop an email, PDF or text file for instant AI analysis</p>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap justify-center">
              {[".eml", ".txt", ".pdf", ".msg"].map((ext) => (
                <span key={ext} className="text-xs bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-full border border-slate-600/50">
                  {ext}
                </span>
              ))}
            </div>
            {!mini && (
              <Button
                variant="ghost"
                size="sm"
                className="text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 text-xs"
                onClick={(e) => { e.stopPropagation(); setPasteOpen(true); }}
                data-testid="button-paste-text"
              >
                Or paste text directly <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        )}

        {dragging && (
          <div className="absolute inset-0 rounded-2xl bg-sky-500/5 flex items-center justify-center pointer-events-none">
            <div className="text-sky-300 font-semibold text-lg">Drop to analyze</div>
          </div>
        )}
      </div>

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="bg-slate-900/95 backdrop-blur-xl border-slate-700/50 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-sky-400" />
              Paste Text for Analysis
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste your email, note or document text here..."
            className="bg-slate-800 border-slate-600 text-white min-h-[200px] resize-none"
            data-testid="textarea-paste-text"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setPasteOpen(false)} className="text-slate-400">
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim() || isLoading}
              className="bg-sky-600 hover:bg-sky-500 text-white"
              data-testid="button-submit-paste"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
              Analyze
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {result && (
        <AiAnalysisModal
          open={true}
          onClose={() => setResult(null)}
          analysis={result.analysis}
          historyId={result.historyId}
        />
      )}
    </>
  );
}

export function AiSmartDropMini({ className = "" }: { className?: string }) {
  return <AiSmartDrop mini className={className} />;
}

export default AiSmartDrop;
