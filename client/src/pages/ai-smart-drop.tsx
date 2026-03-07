import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Wand2, Clock, FileText, ChevronRight, RotateCcw } from "lucide-react";
import { PlanGate } from "@/components/plan-gate";
import { AiSmartDrop, AiAnalysisModal } from "@/components/ai-smart-drop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import type { AiAnalysisEntry } from "@shared/schema";
import { fmtDateTime } from "@/lib/formatDate";

const EVENT_COLORS: Record<string, string> = {
  crew_change: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  spare_part: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  eta_update: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  nomination: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  cargo_info: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  port_call: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  invoice: "bg-green-500/20 text-green-300 border-green-500/30",
  nor_tendered: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  sof_update: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  laytime_notice: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  general_note: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

function ConfidenceDot({ value }: { value: number }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400";
  return <span className={`text-xs font-medium ${color}`}>{pct}%</span>;
}

function HistoryCard({ entry, onReopen }: { entry: AiAnalysisEntry; onReopen: (e: AiAnalysisEntry) => void }) {
  const eventClass = EVENT_COLORS[entry.detectedEvent || "general_note"] || EVENT_COLORS.general_note;
  const date = entry.createdAt ? fmtDateTime(entry.createdAt) : "—";

  return (
    <div
      className="glass-panel rounded-xl p-4 flex items-start gap-3 hover:bg-slate-800/40 transition-colors"
      data-testid={`card-ai-history-${entry.id}`}
    >
      <div className="bg-sky-500/10 rounded-lg p-2 shrink-0">
        <FileText className="w-4 h-4 text-sky-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white text-sm font-medium truncate max-w-[180px]">
            {entry.fileName || "Unknown file"}
          </span>
          <Badge className={`text-xs border ${eventClass}`}>
            {(entry.detectedEvent || "general_note").replace(/_/g, " ")}
          </Badge>
          {entry.actionTaken && (
            <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              {entry.actionTaken}
            </Badge>
          )}
        </div>
        <p className="text-slate-400 text-xs mt-0.5 truncate">{entry.summary || "No summary"}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Clock className="w-3 h-3" /> {date}
          </span>
          <ConfidenceDot value={entry.confidence || 0} />
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onReopen(entry)}
        className="text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 shrink-0"
        data-testid={`button-reopen-${entry.id}`}
      >
        <RotateCcw className="w-3.5 h-3.5 mr-1" />
        Reopen
      </Button>
    </div>
  );
}

export default function AiSmartDropPage() {
  const [reopenEntry, setReopenEntry] = useState<AiAnalysisEntry | null>(null);

  const { data, isLoading } = useQuery<{ history: AiAnalysisEntry[] }>({
    queryKey: ["/api/ai/history"],
  });

  const history = data?.history || [];

  return (
    <PlanGate requiredPlan="standard" feature="AI Smart Drop">
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wand2 className="w-6 h-6 text-sky-400" />
            AI Smart Drop
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Drop documents for instant AI analysis — emails, PDFs, text files
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <AiSmartDrop className="min-h-[320px] flex flex-col justify-center" />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-sm">Recent Analyses</h2>
            <span className="text-slate-500 text-xs">{history.length} entries</span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl bg-slate-800/50" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="glass-panel rounded-xl p-8 text-center">
              <Wand2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No analyses yet</p>
              <p className="text-slate-600 text-xs mt-1">Drop a file to get started</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {history.map((entry) => (
                <HistoryCard
                  key={entry.id}
                  entry={entry}
                  onReopen={setReopenEntry}
                />
              ))}
            </div>
          )}

          {history.length > 0 && (
            <Link href="/ai-smart-drop">
              <a className="text-sky-400 text-xs flex items-center gap-1 hover:text-sky-300 transition-colors">
                View all <ChevronRight className="w-3 h-3" />
              </a>
            </Link>
          )}
        </div>
      </div>

      {reopenEntry && reopenEntry.fullAnalysis && (
        <AiAnalysisModal
          open={true}
          onClose={() => setReopenEntry(null)}
          analysis={reopenEntry.fullAnalysis as any}
          historyId={reopenEntry.id}
        />
      )}
    </div>
    </PlanGate>
  );
}
