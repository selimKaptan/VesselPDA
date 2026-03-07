import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Scale, Calculator, Clock, Plus, X, RotateCcw, List,
  TrendingUp, TrendingDown, CheckCircle2, Info, Save, FolderOpen,
  Trash2, FilePlus, Download, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageMeta } from "@/components/page-meta";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

type ToCount = 100 | 50 | 0;

interface SofEvent {
  id: string;
  dateTime: string;
  description: string;
  toCount: ToCount;
}

interface Terms {
  allowedDays: string;
  allowedHours: string;
  demurrageRate: string;
  despatchRate: string;
  laytimeTerms: string;
  currency: string;
}

interface Period {
  description: string;
  hours: number;
  toCount: number;
  effective: number;
}

interface CalcResult {
  allowed: number;
  timeUsed: number;
  diff: number;
  demurrageAmount: number;
  despatchAmount: number;
  status: "on_demurrage" | "on_despatch" | "within_laytime";
  periods: Period[];
  totalSpan: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _idCounter = 0;
function uid() {
  return `ev-${Date.now()}-${++_idCounter}`;
}

function fmtHours(h: number): string {
  const abs = Math.abs(h);
  const hrs = Math.floor(abs);
  const mins = Math.round((abs - hrs) * 60);
  const sign = h < 0 ? "-" : "";
  return `${sign}${hrs}h ${mins}m`;
}

function fmtMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// ─── Default State ────────────────────────────────────────────────────────────

const defaultTerms: Terms = {
  allowedDays: "",
  allowedHours: "",
  demurrageRate: "",
  despatchRate: "",
  laytimeTerms: "SHINC",
  currency: "USD",
};

function makeDefaultEvents(): SofEvent[] {
  return [
    { id: uid(), dateTime: "", description: "NOR Tendered", toCount: 100 },
    { id: uid(), dateTime: "", description: "Loading Commenced", toCount: 100 },
    { id: uid(), dateTime: "", description: "Loading Completed", toCount: 100 },
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ToCountBadge({ value }: { value: number }) {
  if (value === 100)
    return <span className="inline-block w-10 text-center text-[11px] font-bold text-blue-500">100%</span>;
  if (value === 50)
    return <span className="inline-block w-10 text-center text-[11px] font-bold text-amber-500">50%</span>;
  return <span className="inline-block w-10 text-center text-[11px] font-bold text-muted-foreground">0%</span>;
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

async function downloadPdf(
  title: string,
  vesselName: string,
  portName: string,
  terms: Terms,
  events: SofEvent[],
  calc: CalcResult
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 15;
  let y = 20;

  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("LAYTIME CALCULATION REPORT", margin, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("VesselPDA Maritime Platform", margin, 19);
  doc.text(new Date().toLocaleDateString("en-GB"), pageW - margin, 19, { align: "right" });
  y = 36;

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  if (vesselName) doc.text(`Vessel: ${vesselName}`, margin, y);
  if (portName) doc.text(`Port: ${portName}`, margin + 60, y);
  y += 10;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageW - 2 * margin, 28, "F");
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const cols = ["Time Allowed", "Time Used", "Balance", "Status"];
  const vals = [
    fmtHours(calc.allowed),
    fmtHours(calc.timeUsed),
    (calc.diff >= 0 ? "+" : "") + fmtHours(calc.diff),
    calc.status === "on_demurrage" ? "DEMURRAGE" : calc.status === "on_despatch" ? "DESPATCH" : "WITHIN LAYTIME",
  ];
  const colW = (pageW - 2 * margin) / 4;
  cols.forEach((c, i) => { doc.text(c, margin + i * colW + 2, y + 7); });
  doc.setFont("helvetica", "normal");
  vals.forEach((v, i) => { doc.text(v, margin + i * colW + 2, y + 16); });
  const financialAmt = calc.status === "on_demurrage"
    ? `-${fmtMoney(calc.demurrageAmount, terms.currency)}`
    : calc.status === "on_despatch"
    ? `+${fmtMoney(calc.despatchAmount, terms.currency)}`
    : `${terms.currency} 0.00`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Financial Result: ${financialAmt}`, margin + 2, y + 26);
  y += 38;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Statement of Facts (SOF)", margin, y);
  y += 5;
  doc.setFillColor(30, 58, 95);
  doc.rect(margin, y, pageW - 2 * margin, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("#", margin + 2, y + 4);
  doc.text("Date / Time", margin + 8, y + 4);
  doc.text("Description", margin + 50, y + 4);
  doc.text("Count%", margin + 130, y + 4);
  doc.text("Effective", margin + 148, y + 4);
  y += 6;

  const sorted = [...events].filter(e => e.dateTime).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  sorted.forEach((ev, i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 252 : 255);
    doc.rect(margin, y, pageW - 2 * margin, 6, "F");
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    const p = calc.periods[i];
    doc.text(String(i + 1), margin + 2, y + 4);
    doc.text(ev.dateTime.replace("T", " "), margin + 8, y + 4);
    doc.text((ev.description || "").substring(0, 38), margin + 50, y + 4);
    doc.text(`${ev.toCount}%`, margin + 130, y + 4);
    doc.text(p ? fmtHours(p.effective) : "—", margin + 148, y + 4);
    y += 6;
  });

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text("Generated by VesselPDA — All calculations are for reference only.", margin, 285);

  doc.save(`${title.replace(/\s+/g, "_")}_laytime_report.pdf`);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LaytimeCalculator() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const voyageIdParam = params.get("voyageId") ? parseInt(params.get("voyageId")!) : undefined;
  const sheetIdParam = params.get("sheetId") ? parseInt(params.get("sheetId")!) : undefined;

  const [activeSheetId, setActiveSheetId] = useState<number | undefined>(sheetIdParam);
  const [title, setTitle] = useState("Laytime Calculation");
  const [vesselName, setVesselName] = useState("");
  const [portName, setPortName] = useState("");
  const [terms, setTerms] = useState<Terms>(defaultTerms);
  const [events, setEvents] = useState<SofEvent[]>(makeDefaultEvents);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNewRef = useRef(!sheetIdParam);

  const { data: sheets = [] } = useQuery<any[]>({
    queryKey: ["/api/laytime-sheets"],
  });

  const { data: voyageData } = useQuery<any>({
    queryKey: ["/api/voyages", voyageIdParam],
    enabled: !!voyageIdParam,
  });

  useEffect(() => {
    if (voyageData) {
      setVesselName(v => v || voyageData.vesselName || "");
      setPortName(p => p || voyageData.portName || "");
      if (!title || title === "Laytime Calculation") {
        setTitle(`Laytime — ${voyageData.vesselName || "Voyage"} / ${voyageData.portName || ""}`);
      }
    }
  }, [voyageData]);

  const { data: loadedSheet } = useQuery<any>({
    queryKey: ["/api/laytime-sheets", activeSheetId],
    enabled: !!activeSheetId,
  });

  useEffect(() => {
    if (loadedSheet && loadedSheet.id === activeSheetId) {
      setTitle(loadedSheet.title || "Laytime Calculation");
      setVesselName(loadedSheet.vesselName || "");
      setPortName(loadedSheet.portName || "");
      setTerms((loadedSheet.terms as Terms) || defaultTerms);
      const evts: SofEvent[] = Array.isArray(loadedSheet.events) ? loadedSheet.events : makeDefaultEvents();
      setEvents(evts.length ? evts : makeDefaultEvents());
      isNewRef.current = false;
    }
  }, [loadedSheet, activeSheetId]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/laytime-sheets", data),
    onSuccess: async (res: any) => {
      const sheet = await res.json();
      setActiveSheetId(sheet.id);
      isNewRef.current = false;
      qc.invalidateQueries({ queryKey: ["/api/laytime-sheets"] });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/laytime-sheets/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/laytime-sheets"] });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/laytime-sheets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/laytime-sheets"] });
      toast({ title: "Sheet deleted" });
      handleNewSheet();
    },
  });

  const currentCalcResult = useMemo<CalcResult>(() => {
    const allowed = (parseFloat(terms.allowedDays) || 0) * 24 + (parseFloat(terms.allowedHours) || 0);
    const demRate = parseFloat(terms.demurrageRate) || 0;
    const desRate = parseFloat(terms.despatchRate) || 0;
    const sorted = [...events].filter(e => e.dateTime).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    const periods: Period[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const start = new Date(sorted[i].dateTime);
      const end = new Date(sorted[i + 1].dateTime);
      const hours = Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);
      const effective = hours * (sorted[i].toCount / 100);
      periods.push({ description: sorted[i].description, hours, toCount: sorted[i].toCount, effective });
    }
    const timeUsed = periods.reduce((s, p) => s + p.effective, 0);
    const totalSpan = periods.reduce((s, p) => s + p.hours, 0);
    const diff = timeUsed - allowed;
    let demurrageAmount = 0, despatchAmount = 0;
    let status: CalcResult["status"] = "within_laytime";
    if (allowed > 0) {
      if (diff > 0) { demurrageAmount = diff * (demRate / 24); status = "on_demurrage"; }
      else if (diff < 0) { despatchAmount = Math.abs(diff) * (desRate / 24); status = "on_despatch"; }
    }
    return { allowed, timeUsed, diff, demurrageAmount, despatchAmount, status, periods, totalSpan };
  }, [terms, events]);

  const calc = currentCalcResult;

  const triggerAutosave = useCallback(() => {
    if (isNewRef.current) return;
    if (!activeSheetId) return;
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    setSaveStatus("saving");
    autosaveRef.current = setTimeout(() => {
      updateMutation.mutate({
        id: activeSheetId,
        data: { title, vesselName, portName, terms, events, result: calc },
      });
    }, 1500);
  }, [activeSheetId, title, vesselName, portName, terms, events, calc]);

  useEffect(() => { triggerAutosave(); }, [terms, events]);

  const setTerm = useCallback(<K extends keyof Terms>(key: K, value: Terms[K]) =>
    setTerms(prev => ({ ...prev, [key]: value })), []);

  const addEvent = useCallback(() => {
    setEvents(prev => [...prev, { id: uid(), dateTime: "", description: "", toCount: 100 }]);
  }, []);

  const removeEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  const updateEvent = useCallback(<K extends keyof SofEvent>(id: string, key: K, value: SofEvent[K]) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, [key]: value } : e));
  }, []);

  const handleSave = useCallback(async () => {
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    const payload = {
      title, vesselName, portName, terms, events,
      result: calc,
      voyageId: voyageIdParam,
    };
    if (activeSheetId && !isNewRef.current) {
      setSaveStatus("saving");
      updateMutation.mutate({ id: activeSheetId, data: payload });
    } else {
      setSaveStatus("saving");
      createMutation.mutate(payload);
    }
  }, [title, vesselName, portName, terms, events, calc, activeSheetId, voyageIdParam]);

  const handleNewSheet = useCallback(() => {
    setActiveSheetId(undefined);
    setTitle("Laytime Calculation");
    setVesselName("");
    setPortName("");
    setTerms(defaultTerms);
    setEvents(makeDefaultEvents());
    isNewRef.current = true;
    setSaveStatus("idle");
  }, []);

  const handleLoadSheet = useCallback((sheet: any) => {
    setActiveSheetId(sheet.id);
  }, []);

  const handleDownloadPdf = () => {
    downloadPdf(title, vesselName, portName, terms, events, calc);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title="Laytime Calculator | VesselPDA"
        description="Charter party laytime & demurrage/despatch calculator with SOF event tracking"
      />

      {/* Page Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Scale className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="text-2xl font-bold tracking-tight bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
                  data-testid="input-sheet-title"
                />
                {activeSheetId && voyageIdParam && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Link2 className="w-3 h-3" /> Voyage
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Charter party terms &amp; SOF — live demurrage / despatch
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saveStatus === "saving" && (
              <span className="text-xs text-muted-foreground animate-pulse" data-testid="text-save-status">Saving…</span>
            )}
            {saveStatus === "saved" && (
              <span className="text-xs text-emerald-500" data-testid="text-save-status">Saved ✓</span>
            )}
            <Button variant="outline" size="sm" onClick={handleNewSheet} className="gap-2" data-testid="button-new-sheet">
              <FilePlus className="w-4 h-4" /> New
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="gap-2" data-testid="button-download-pdf">
              <Download className="w-4 h-4" /> PDF
            </Button>
            <Button size="sm" onClick={handleSave} className="gap-2" data-testid="button-save-sheet">
              <Save className="w-4 h-4" /> {activeSheetId && !isNewRef.current ? "Update" : "Save"}
            </Button>
            {activeSheetId && !isNewRef.current && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate(activeSheetId)}
                className="gap-2"
                data-testid="button-delete-sheet"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Vessel / Port fields */}
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">Vessel:</Label>
            <input
              value={vesselName}
              onChange={e => setVesselName(e.target.value)}
              placeholder="Vessel name"
              className="text-sm bg-transparent border-b border-border focus:outline-none focus:border-primary px-1 w-40"
              data-testid="input-vessel-name"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">Port:</Label>
            <input
              value={portName}
              onChange={e => setPortName(e.target.value)}
              placeholder="Port name"
              className="text-sm bg-transparent border-b border-border focus:outline-none focus:border-primary px-1 w-40"
              data-testid="input-port-name"
            />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex gap-5 p-6 items-start">

        {/* ── SAVED SHEETS PANEL ────────────────────────────────────────── */}
        {sheets.length > 0 && (
          <div className="w-56 shrink-0">
            <div className="rounded-xl border border-border bg-card overflow-hidden sticky top-6">
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-muted/20">
                <FolderOpen className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold">Saved Sheets</span>
              </div>
              <div className="max-h-[350px] overflow-y-auto">
                {sheets.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => handleLoadSheet(s)}
                    className={`w-full text-left px-3 py-2 border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors text-xs ${activeSheetId === s.id ? "bg-primary/10" : ""}`}
                    data-testid={`button-load-sheet-${s.id}`}
                  >
                    <p className="font-medium truncate">{s.title || "Untitled"}</p>
                    <p className="text-muted-foreground mt-0.5">{s.vesselName || "—"} · {s.portName || "—"}</p>
                    {s.result?.status === "on_demurrage" && (
                      <span className="text-red-500 font-bold">DEM {fmtMoney(s.result.demurrageAmount || 0, s.terms?.currency || "USD")}</span>
                    )}
                    {s.result?.status === "on_despatch" && (
                      <span className="text-emerald-500 font-bold">DES +{fmtMoney(s.result.despatchAmount || 0, s.terms?.currency || "USD")}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── LEFT COLUMN ───────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-5 min-w-0">

          {/* Charter Party Terms */}
          <div className="rounded-xl border border-border bg-card overflow-hidden" data-testid="card-charter-party-terms">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/20">
              <Scale className="w-4 h-4 text-primary" />
              <h2 className="font-bold text-sm">Charter Party Terms</h2>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Allowed Time (Days)</Label>
                  <Input type="number" min="0" placeholder="e.g. 4" value={terms.allowedDays} onChange={e => setTerm("allowedDays", e.target.value)} className="h-9" data-testid="input-allowed-days" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">+ Extra Hours</Label>
                  <Input type="number" min="0" max="23" placeholder="e.g. 12" value={terms.allowedHours} onChange={e => setTerm("allowedHours", e.target.value)} className="h-9" data-testid="input-allowed-hours" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Demurrage Rate ($/Day)</Label>
                  <Input type="number" min="0" placeholder="e.g. 8000" value={terms.demurrageRate} onChange={e => setTerm("demurrageRate", e.target.value)} className="h-9" data-testid="input-demurrage-rate" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Despatch Rate ($/Day)</Label>
                  <Input type="number" min="0" placeholder="e.g. 4000" value={terms.despatchRate} onChange={e => setTerm("despatchRate", e.target.value)} className="h-9" data-testid="input-despatch-rate" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Laytime Terms</Label>
                  <Select value={terms.laytimeTerms} onValueChange={v => setTerm("laytimeTerms", v)}>
                    <SelectTrigger className="h-9" data-testid="select-laytime-terms"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SHINC">SHINC</SelectItem>
                      <SelectItem value="SHEX">SHEX</SelectItem>
                      <SelectItem value="SHEX EIU">SHEX EIU</SelectItem>
                      <SelectItem value="WWD">WWD</SelectItem>
                      <SelectItem value="WWDSHEX">WWDSHEX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency</Label>
                  <Select value={terms.currency} onValueChange={v => setTerm("currency", v)}>
                    <SelectTrigger className="h-9" data-testid="select-currency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD — US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR — Euro</SelectItem>
                      <SelectItem value="GBP">GBP — British Pound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(terms.allowedDays || terms.allowedHours) && (
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Total allowed laytime: <strong className="text-foreground">{fmtHours(calc.allowed)}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* SOF Events Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden" data-testid="card-sof-events">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2">
                <List className="w-4 h-4 text-primary" />
                <h2 className="font-bold text-sm">Statement of Facts (SOF)</h2>
                <span className="ml-1 text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">{events.length} events</span>
              </div>
              <Button size="sm" variant="outline" onClick={addEvent} className="gap-1.5 h-7 text-xs" data-testid="button-add-sof-event">
                <Plus className="w-3.5 h-3.5" /> Add Event
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/10">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground w-8">#</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground w-52">Date / Time</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">Event Description</th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-muted-foreground w-28">To Count %</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, idx) => (
                    <tr key={ev.id} className="border-b border-border/50 last:border-0 hover:bg-muted/5 transition-colors" data-testid={`row-sof-event-${idx}`}>
                      <td className="px-4 py-2 text-[11px] text-muted-foreground/50 font-mono">{idx + 1}</td>
                      <td className="px-4 py-2">
                        <input type="datetime-local" value={ev.dateTime} onChange={e => updateEvent(ev.id, "dateTime", e.target.value)} className="bg-transparent border-0 text-xs text-foreground focus:outline-none w-48 [color-scheme:dark]" data-testid={`input-event-datetime-${idx}`} />
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" value={ev.description} onChange={e => updateEvent(ev.id, "description", e.target.value)} placeholder="e.g. NOR Tendered, Rain Commenced, Loading Completed…" className="bg-transparent border-0 text-xs text-foreground focus:outline-none w-full placeholder:text-muted-foreground/40" data-testid={`input-event-description-${idx}`} />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Select value={String(ev.toCount)} onValueChange={v => updateEvent(ev.id, "toCount", Number(v) as ToCount)}>
                          <SelectTrigger className="h-6 text-xs w-20 mx-auto border-border/60" data-testid={`select-to-count-${idx}`}>
                            <SelectValue><ToCountBadge value={ev.toCount} /></SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="100"><span className="text-blue-500 font-bold text-xs">100% — Counts in Full</span></SelectItem>
                            <SelectItem value="50"><span className="text-amber-500 font-bold text-xs">50% — Half Count</span></SelectItem>
                            <SelectItem value="0"><span className="text-muted-foreground font-bold text-xs">0% — Excluded</span></SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground/30 hover:text-destructive" onClick={() => removeEvent(ev.id)} data-testid={`button-remove-event-${idx}`}>
                          <X className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {events.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No events yet.{" "}
                        <button className="underline text-primary" onClick={addEvent}>Add the first event</button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-border/50 bg-muted/10">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                <strong>How it works:</strong> Each row marks the <em>start</em> of a laytime period. The "To Count %" determines how much of that period counts toward used laytime (100% = full count, 50% = half, 0% = excluded e.g. rain/Sundays). The period ends when the next event begins.
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ──────────────────────────────────────────────── */}
        <div className="w-80 shrink-0">
          <div className="sticky top-6 flex flex-col gap-4">

            {/* Calculation Summary */}
            <div className="rounded-xl border border-border bg-card overflow-hidden" data-testid="card-calculation-summary">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
                <Calculator className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm">Calculation Summary</h3>
              </div>
              <div className="p-4 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Time Allowed</span>
                  <span className="font-mono text-sm font-semibold" data-testid="text-time-allowed">{calc.allowed > 0 ? fmtHours(calc.allowed) : "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Time Used</span>
                  <span className="font-mono text-sm font-semibold" data-testid="text-time-used">{calc.timeUsed > 0 ? fmtHours(calc.timeUsed) : "—"}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{calc.diff > 0 ? "Time Exceeded" : calc.diff < 0 ? "Time Saved" : "Balance"}</span>
                  <span className={`font-mono text-sm font-bold ${calc.diff > 0 ? "text-red-500" : calc.diff < 0 ? "text-emerald-500" : "text-muted-foreground"}`} data-testid="text-time-diff">
                    {calc.allowed > 0 && calc.timeUsed > 0 ? (calc.diff >= 0 ? "+" : "") + fmtHours(calc.diff) : "—"}
                  </span>
                </div>
                {calc.allowed > 0 && calc.timeUsed > 0 && (
                  <div className="pt-1">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${calc.status === "on_demurrage" ? "bg-red-500" : calc.status === "on_despatch" ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${Math.min(100, (calc.timeUsed / calc.allowed) * 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 text-right">{Math.round((calc.timeUsed / calc.allowed) * 100)}% of allowed time used</p>
                  </div>
                )}
              </div>
            </div>

            {/* Time Breakdown */}
            {calc.periods.length > 0 && (
              <div className="rounded-xl border border-border bg-card overflow-hidden" data-testid="card-time-breakdown">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20">
                  <Clock className="w-4 h-4 text-primary" />
                  <h3 className="font-bold text-sm">Time Breakdown</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="h-5 rounded-lg overflow-hidden flex gap-0.5 bg-muted/30">
                    {calc.periods.map((p, i) => {
                      const width = calc.totalSpan > 0 ? (p.hours / calc.totalSpan) * 100 : 0;
                      const color = p.toCount === 100 ? "bg-blue-500" : p.toCount === 50 ? "bg-amber-400" : "bg-muted-foreground/20";
                      return <div key={i} style={{ width: `${width}%` }} className={`${color} transition-all duration-300`} title={`${p.description || "Period"} — ${fmtHours(p.hours)} raw · ${fmtHours(p.effective)} counted (${p.toCount}%)`} />;
                    })}
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />100%</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />50%</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/20" />0% excl.</div>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {calc.periods.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] py-0.5" data-testid={`row-period-${i}`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${p.toCount === 100 ? "bg-blue-500" : p.toCount === 50 ? "bg-amber-400" : "bg-muted-foreground/30"}`} />
                          <span className="truncate text-muted-foreground">{p.description || "—"}</span>
                        </div>
                        <div className="text-right shrink-0 ml-2 space-x-1">
                          <span className="font-mono text-foreground">{fmtHours(p.effective)}</span>
                          <span className="text-muted-foreground/50">({p.toCount}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-1 border-t border-border/50 flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Total span: {fmtHours(calc.totalSpan)}</span>
                    <span className="font-semibold">Counted: {fmtHours(calc.timeUsed)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Financial Result */}
            <div className={`rounded-xl border-2 overflow-hidden transition-colors duration-300 ${calc.status === "on_demurrage" ? "border-red-500/40 bg-red-500/5" : calc.status === "on_despatch" ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-muted/10"}`} data-testid="card-financial-result">
              <div className="p-5 text-center space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Financial Result</p>
                {calc.status === "on_demurrage" && (
                  <>
                    <div className="flex items-center justify-center gap-2">
                      <TrendingUp className="w-5 h-5 text-red-500" />
                      <p className="text-3xl font-black text-red-500 tabular-nums" data-testid="text-financial-amount">-{fmtMoney(calc.demurrageAmount, terms.currency)}</p>
                    </div>
                    <p className="text-xs font-bold text-red-400 tracking-wider">DEMURRAGE</p>
                    <p className="text-[10px] text-muted-foreground">{fmtHours(calc.diff)} over laytime × {fmtMoney(parseFloat(terms.demurrageRate) || 0, terms.currency)}/day</p>
                  </>
                )}
                {calc.status === "on_despatch" && (
                  <>
                    <div className="flex items-center justify-center gap-2">
                      <TrendingDown className="w-5 h-5 text-emerald-500" />
                      <p className="text-3xl font-black text-emerald-500 tabular-nums" data-testid="text-financial-amount">+{fmtMoney(calc.despatchAmount, terms.currency)}</p>
                    </div>
                    <p className="text-xs font-bold text-emerald-400 tracking-wider">DESPATCH EARNED</p>
                    <p className="text-[10px] text-muted-foreground">{fmtHours(Math.abs(calc.diff))} saved × {fmtMoney(parseFloat(terms.despatchRate) || 0, terms.currency)}/day</p>
                  </>
                )}
                {calc.status === "within_laytime" && (
                  <>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-blue-500" />
                      <p className="text-3xl font-black text-blue-500 tabular-nums" data-testid="text-financial-amount">{terms.currency === "USD" ? "$" : terms.currency === "EUR" ? "€" : "£"}0.00</p>
                    </div>
                    <p className="text-xs font-bold text-blue-400 tracking-wider">WITHIN LAYTIME</p>
                    <p className="text-[10px] text-muted-foreground">{calc.allowed > 0 && calc.timeUsed > 0 ? `${fmtHours(Math.abs(calc.diff))} to spare` : "Enter terms & events to calculate"}</p>
                  </>
                )}
                {calc.allowed > 0 && (
                  <div className="pt-2 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground">
                      {terms.laytimeTerms} · Allowed {fmtHours(calc.allowed)} · {fmtMoney(parseFloat(terms.demurrageRate) || 0, terms.currency)}/day DEM / {fmtMoney(parseFloat(terms.despatchRate) || 0, terms.currency)}/day DES
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
