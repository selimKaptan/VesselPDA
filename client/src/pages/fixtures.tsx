import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Handshake, Plus, Trash2, FileText, Loader2, ChevronDown,
  Clock, TrendingUp, TrendingDown, Minus, X, ChevronRight,
  Anchor, Ship, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DeductionEntry { reason: string; hours: number; }

interface LaytimeCalc {
  id: number;
  fixture_id: number;
  port_call_type: string;
  port_name: string | null;
  allowed_laytime_hours: number;
  nor_started_at: string | null;
  berthing_at: string | null;
  loading_started_at: string | null;
  loading_completed_at: string | null;
  departed_at: string | null;
  time_used_hours: number;
  demurrage_rate: number;
  despatch_rate: number;
  demurrage_amount: number;
  despatch_amount: number;
  currency: string;
  deductions: DeductionEntry[];
  notes: string | null;
  created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  negotiating: { label: "Negotiating", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  fixed:       { label: "Fixed",       color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  failed:      { label: "Failed",      color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  cancelled:   { label: "Cancelled",   color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
};

const UNIT_OPTIONS = ["MT", "CBM", "TEU", "Units"];
const CURRENCY_OPTIONS = ["USD", "EUR", "TRY"];

function formatDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-GB");
}

function formatDateTimeLocal(dt: string | null | undefined): string {
  if (!dt) return "";
  return new Date(dt).toISOString().slice(0, 16);
}

function fmtHours(h: number | null | undefined): string {
  if (h == null) return "0h 0m";
  const hrs = Math.floor(Math.abs(h));
  const mins = Math.round((Math.abs(h) - hrs) * 60);
  return `${hrs}h ${mins}m`;
}

function fmtMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
}

// ─── Default forms ───────────────────────────────────────────────────────────

const defaultFixtureForm = {
  vesselName: "", imoNumber: "", cargoType: "", cargoQuantity: "",
  quantityUnit: "MT", loadingPort: "", dischargePort: "", laycanFrom: "",
  laycanTo: "", freightRate: "", freightCurrency: "USD",
  charterer: "", shipowner: "", brokerCommission: "", notes: "",
};

const defaultLaytimeForm = {
  portCallType: "loading",
  portName: "",
  allowedLaytimeHours: "",
  norStartedAt: "",
  berthingAt: "",
  loadingStartedAt: "",
  loadingCompletedAt: "",
  departedAt: "",
  demurrageRate: "",
  despatchRate: "",
  currency: "USD",
  notes: "",
};

// ─── Laytime preview (client-side calculation) ────────────────────────────────

function previewLaytime(form: typeof defaultLaytimeForm, deductions: DeductionEntry[]) {
  const allowed = parseFloat(form.allowedLaytimeHours) || 0;
  const demRate = parseFloat(form.demurrageRate) || 0;
  const desRate = parseFloat(form.despatchRate) || 0;

  const start = form.norStartedAt || form.berthingAt || form.loadingStartedAt;
  const end = form.departedAt || form.loadingCompletedAt;

  let timeUsed = 0;
  if (start && end) {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (diff > 0) timeUsed = diff / 1000 / 3600;
  }

  const totalDeduction = deductions.reduce((s, d) => s + (d.hours || 0), 0);
  const effective = Math.max(0, timeUsed - totalDeduction);
  const diff = effective - allowed;

  let demurrageAmount = 0;
  let despatchAmount = 0;
  let status: "on_demurrage" | "on_despatch" | "within_laytime" = "within_laytime";

  if (diff > 0) { demurrageAmount = diff * (demRate / 24); status = "on_demurrage"; }
  else if (diff < 0) { despatchAmount = Math.abs(diff) * (desRate / 24); status = "on_despatch"; }

  return { timeUsed, totalDeduction, effective, diff, demurrageAmount, despatchAmount, status };
}

// ─── Laytime result badge ─────────────────────────────────────────────────────

function LaytimeStatusBadge({ status, demurrage, despatch, currency }: {
  status: string; demurrage: number; despatch: number; currency: string;
}) {
  if (status === "on_demurrage") {
    return (
      <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
        <TrendingUp className="w-4 h-4" />
        <span className="font-semibold">Demurrage: {fmtMoney(demurrage, currency)}</span>
      </div>
    );
  }
  if (status === "on_despatch") {
    return (
      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
        <TrendingDown className="w-4 h-4" />
        <span className="font-semibold">Despatch: {fmtMoney(despatch, currency)}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
      <CheckCircle2 className="w-4 h-4" />
      <span className="font-semibold">Within Laytime</span>
    </div>
  );
}

// ─── Laytime Form Modal ───────────────────────────────────────────────────────

function LaytimeFormModal({
  open, onClose, fixtureId, existing,
}: {
  open: boolean;
  onClose: () => void;
  fixtureId: number;
  existing?: LaytimeCalc | null;
}) {
  const { toast } = useToast();
  const isEdit = !!existing;

  const [form, setForm] = useState(() =>
    existing ? {
      portCallType: existing.port_call_type,
      portName: existing.port_name || "",
      allowedLaytimeHours: String(existing.allowed_laytime_hours),
      norStartedAt: formatDateTimeLocal(existing.nor_started_at),
      berthingAt: formatDateTimeLocal(existing.berthing_at),
      loadingStartedAt: formatDateTimeLocal(existing.loading_started_at),
      loadingCompletedAt: formatDateTimeLocal(existing.loading_completed_at),
      departedAt: formatDateTimeLocal(existing.departed_at),
      demurrageRate: String(existing.demurrage_rate),
      despatchRate: String(existing.despatch_rate),
      currency: existing.currency,
      notes: existing.notes || "",
    } : { ...defaultLaytimeForm }
  );

  const [deductions, setDeductions] = useState<DeductionEntry[]>(
    existing?.deductions ?? []
  );
  const [deductReason, setDeductReason] = useState("");
  const [deductHours, setDeductHours] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const preview = useMemo(() => previewLaytime(form, deductions), [form, deductions]);

  const addDeduction = () => {
    const h = parseFloat(deductHours);
    if (!deductReason.trim() || isNaN(h) || h <= 0) return;
    setDeductions(d => [...d, { reason: deductReason.trim(), hours: h }]);
    setDeductReason(""); setDeductHours("");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        portCallType: form.portCallType,
        portName: form.portName || null,
        allowedLaytimeHours: parseFloat(form.allowedLaytimeHours) || 0,
        norStartedAt: form.norStartedAt || null,
        berthingAt: form.berthingAt || null,
        loadingStartedAt: form.loadingStartedAt || null,
        loadingCompletedAt: form.loadingCompletedAt || null,
        departedAt: form.departedAt || null,
        demurrageRate: parseFloat(form.demurrageRate) || 0,
        despatchRate: parseFloat(form.despatchRate) || 0,
        currency: form.currency,
        deductions,
        notes: form.notes || null,
      };
      if (isEdit) {
        return apiRequest("PUT", `/api/laytime/${existing!.id}`, payload);
      }
      return apiRequest("POST", `/api/fixtures/${fixtureId}/laytime`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixtures", fixtureId, "laytime"] });
      toast({ title: isEdit ? "Laytime updated" : "Laytime calculation saved" });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to save", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "Add"} Laytime Calculation</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Port & type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Port Call Type *</Label>
              <Select value={form.portCallType} onValueChange={v => set("portCallType", v)}>
                <SelectTrigger data-testid="select-port-call-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="loading">Loading</SelectItem>
                  <SelectItem value="discharging">Discharging</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Port Name</Label>
              <Input value={form.portName} onChange={e => set("portName", e.target.value)} placeholder="e.g. Rotterdam" data-testid="input-laytime-port" />
            </div>
          </div>

          {/* Allowed laytime & rates */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Allowed Laytime (hours) *</Label>
              <Input type="number" value={form.allowedLaytimeHours} onChange={e => set("allowedLaytimeHours", e.target.value)} placeholder="72" data-testid="input-allowed-hours" />
            </div>
            <div>
              <Label>Demurrage Rate ($/day)</Label>
              <Input type="number" value={form.demurrageRate} onChange={e => set("demurrageRate", e.target.value)} placeholder="5000" data-testid="input-demurrage-rate" />
            </div>
            <div>
              <Label>Despatch Rate ($/day)</Label>
              <Input type="number" value={form.despatchRate} onChange={e => set("despatchRate", e.target.value)} placeholder="2500" data-testid="input-despatch-rate" />
            </div>
          </div>

          <Separator />

          {/* Timeline */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Timeline</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>NOR Tendered</Label>
                <Input type="datetime-local" value={form.norStartedAt} onChange={e => set("norStartedAt", e.target.value)} data-testid="input-nor-started" />
              </div>
              <div>
                <Label>Berthing At</Label>
                <Input type="datetime-local" value={form.berthingAt} onChange={e => set("berthingAt", e.target.value)} data-testid="input-berthing-at" />
              </div>
              <div>
                <Label>{form.portCallType === "loading" ? "Loading" : "Discharge"} Started</Label>
                <Input type="datetime-local" value={form.loadingStartedAt} onChange={e => set("loadingStartedAt", e.target.value)} data-testid="input-ops-started" />
              </div>
              <div>
                <Label>{form.portCallType === "loading" ? "Loading" : "Discharge"} Completed</Label>
                <Input type="datetime-local" value={form.loadingCompletedAt} onChange={e => set("loadingCompletedAt", e.target.value)} data-testid="input-ops-completed" />
              </div>
              <div className="col-span-2">
                <Label>Departed</Label>
                <Input type="datetime-local" value={form.departedAt} onChange={e => set("departedAt", e.target.value)} data-testid="input-departed-at" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Deductions */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Deductions (Sundays, holidays, weather, etc.)</p>
            {deductions.length > 0 && (
              <div className="space-y-1 mb-2">
                {deductions.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-muted/40 rounded px-2 py-1">
                    <span className="flex-1 text-foreground">{d.reason}</span>
                    <span className="text-muted-foreground font-mono">{d.hours}h</span>
                    <button onClick={() => setDeductions(ds => ds.filter((_, j) => j !== i))} className="text-destructive hover:opacity-70">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Reason (e.g. Sunday, rain)"
                value={deductReason}
                onChange={e => setDeductReason(e.target.value)}
                className="flex-1"
                data-testid="input-deduction-reason"
              />
              <Input
                type="number"
                placeholder="Hours"
                value={deductHours}
                onChange={e => setDeductHours(e.target.value)}
                className="w-24"
                data-testid="input-deduction-hours"
              />
              <Button type="button" variant="outline" size="sm" onClick={addDeduction} data-testid="button-add-deduction">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Live preview */}
          {(form.norStartedAt || form.berthingAt || form.loadingStartedAt) && (form.departedAt || form.loadingCompletedAt) && (
            <Card className="p-4 bg-muted/30 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live Preview</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Time at Port:</span><span className="font-mono">{fmtHours(preview.timeUsed)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Deductions:</span><span className="font-mono text-amber-600">−{fmtHours(preview.totalDeduction)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Effective Time:</span><span className="font-mono">{fmtHours(preview.effective)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Allowed:</span><span className="font-mono">{fmtHours(parseFloat(form.allowedLaytimeHours) || 0)}</span></div>
              </div>
              <Separator />
              <LaytimeStatusBadge
                status={preview.status}
                demurrage={preview.demurrageAmount}
                despatch={preview.despatchAmount}
                currency={form.currency}
              />
            </Card>
          )}

          {/* Currency & Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => set("currency", v)}>
                <SelectTrigger data-testid="select-laytime-currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Optional notes" data-testid="input-laytime-notes" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.allowedLaytimeHours} data-testid="button-save-laytime">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Laytime Tab ─────────────────────────────────────────────────────────────

function LaytimeTab({ fixture }: { fixture: any }) {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LaytimeCalc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { data: calcs = [], isLoading } = useQuery<LaytimeCalc[]>({
    queryKey: ["/api/fixtures", fixture.id, "laytime"],
    queryFn: async () => {
      const r = await fetch(`/api/fixtures/${fixture.id}/laytime`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/laytime/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixtures", fixture.id, "laytime"] });
      toast({ title: "Calculation deleted" });
      setDeleteTarget(null);
    },
  });

  const totalDemurrage = calcs.reduce((s, c) => s + (c.demurrage_amount || 0), 0);
  const totalDespatch = calcs.reduce((s, c) => s + (c.despatch_amount || 0), 0);
  const netBalance = totalDemurrage - totalDespatch;

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Laytime &amp; demurrage calculations for <span className="font-medium text-foreground">{fixture.vesselName}</span>
        </p>
        <Button size="sm" onClick={() => { setEditTarget(null); setFormOpen(true); }} data-testid="button-add-laytime">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Port Call
        </Button>
      </div>

      {/* Summary strip */}
      {calcs.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Demurrage</p>
            <p className="font-bold text-red-600 dark:text-red-400">{fmtMoney(totalDemurrage, "USD")}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Despatch</p>
            <p className="font-bold text-emerald-600 dark:text-emerald-400">{fmtMoney(totalDespatch, "USD")}</p>
          </Card>
          <Card className={`p-3 text-center ${netBalance > 0 ? "border-red-300 dark:border-red-800" : netBalance < 0 ? "border-emerald-300 dark:border-emerald-800" : ""}`}>
            <p className="text-xs text-muted-foreground mb-1">Net Balance</p>
            <p className={`font-bold ${netBalance > 0 ? "text-red-600 dark:text-red-400" : netBalance < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
              {netBalance > 0 ? `+${fmtMoney(netBalance, "USD")}` : fmtMoney(Math.abs(netBalance), "USD")}
              {netBalance !== 0 && <span className="text-xs font-normal ml-1">{netBalance > 0 ? "due" : "earned"}</span>}
            </p>
          </Card>
        </div>
      )}

      {calcs.length === 0 ? (
        <Card className="p-10 text-center">
          <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-1">No laytime calculations yet</p>
          <p className="text-xs text-muted-foreground">Add a port call to start tracking time used and demurrage/despatch.</p>
          <Button className="mt-4" size="sm" onClick={() => { setEditTarget(null); setFormOpen(true); }}>Add First Port Call</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {calcs.map(c => {
            const status = c.demurrage_amount > 0 ? "on_demurrage" : c.despatch_amount > 0 ? "on_despatch" : "within_laytime";
            const deductions: DeductionEntry[] = Array.isArray(c.deductions) ? c.deductions : [];
            const totalDeduct = deductions.reduce((s, d) => s + d.hours, 0);
            return (
              <Card key={c.id} className="p-4" data-testid={`laytime-card-${c.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {c.port_call_type === "loading"
                        ? <Ship className="w-3.5 h-3.5 text-blue-500" />
                        : <Anchor className="w-3.5 h-3.5 text-amber-500" />}
                      <span className="font-semibold capitalize">{c.port_call_type}</span>
                      {c.port_name && <span className="text-sm text-muted-foreground">— {c.port_name}</span>}
                      <Badge variant="outline" className="text-[10px]">{c.currency}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Allowed laytime:</span>
                        <span className="font-mono text-foreground">{fmtHours(c.allowed_laytime_hours)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Time used:</span>
                        <span className="font-mono text-foreground">{fmtHours(c.time_used_hours)}</span>
                      </div>
                      {totalDeduct > 0 && (
                        <div className="flex justify-between">
                          <span>Deductions:</span>
                          <span className="font-mono text-amber-600">−{fmtHours(totalDeduct)}</span>
                        </div>
                      )}
                      {c.nor_started_at && (
                        <div className="flex justify-between">
                          <span>NOR:</span>
                          <span className="font-mono text-foreground">{new Date(c.nor_started_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      )}
                      {c.departed_at && (
                        <div className="flex justify-between">
                          <span>Departed:</span>
                          <span className="font-mono text-foreground">{new Date(c.departed_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      )}
                    </div>

                    <LaytimeStatusBadge
                      status={status}
                      demurrage={c.demurrage_amount}
                      despatch={c.despatch_amount}
                      currency={c.currency}
                    />

                    {deductions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {deductions.map((d, i) => (
                          <span key={i} className="text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                            {d.reason}: {d.hours}h
                          </span>
                        ))}
                      </div>
                    )}

                    {c.notes && <p className="text-xs text-muted-foreground italic">{c.notes}</p>}
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => { setEditTarget(c); setFormOpen(true); }} data-testid={`button-edit-laytime-${c.id}`}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c.id)} data-testid={`button-delete-laytime-${c.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <LaytimeFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        fixtureId={fixture.id}
        existing={editTarget}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Calculation</AlertDialogTitle>
            <AlertDialogDescription>This laytime calculation will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteTarget !== null && deleteMutation.mutate(deleteTarget)} data-testid="button-confirm-delete-laytime">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Fixtures() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [recapDialogOpen, setRecapDialogOpen] = useState(false);
  const [recapFixture, setRecapFixture] = useState<any>(null);
  const [recapText, setRecapText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [form, setForm] = useState({ ...defaultFixtureForm });
  const [expandedFixture, setExpandedFixture] = useState<number | null>(null);

  const { data: fixtures = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/fixtures"] });

  const createMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/fixtures", {
      ...form,
      cargoQuantity: form.cargoQuantity ? parseFloat(form.cargoQuantity) : null,
      freightRate: form.freightRate ? parseFloat(form.freightRate) : null,
      brokerCommission: form.brokerCommission ? parseFloat(form.brokerCommission) : null,
      imoNumber: form.imoNumber || null,
      charterer: form.charterer || null,
      shipowner: form.shipowner || null,
      notes: form.notes || null,
      laycanFrom: form.laycanFrom || null,
      laycanTo: form.laycanTo || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixtures"] });
      toast({ title: "Fixture created" });
      setDialogOpen(false);
      setForm({ ...defaultFixtureForm });
    },
    onError: () => toast({ title: "Error", description: "Operation failed", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => apiRequest("PATCH", `/api/fixtures/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/fixtures"] }),
  });

  const recapMutation = useMutation({
    mutationFn: async () => apiRequest("PATCH", `/api/fixtures/${recapFixture.id}`, { recapText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixtures"] });
      toast({ title: "Recap saved" });
      setRecapDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/fixtures/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixtures"] });
      toast({ title: "Fixture deleted" });
      setDeleteTarget(null);
      if (deleteTarget === expandedFixture) setExpandedFixture(null);
    },
  });

  const openRecap = (fx: any) => {
    setRecapFixture(fx);
    setRecapText(fx.recapText || "");
    setRecapDialogOpen(true);
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <PageMeta title="Fixture Management | VesselPDA" description="Charter fixture and recap tracking with laytime/demurrage calculations" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Handshake className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground font-serif">Fixture Management</h1>
            <p className="text-sm text-muted-foreground">Track charter negotiations, recaps and laytime calculations</p>
          </div>
        </div>
        <Button onClick={() => { setForm({ ...defaultFixtureForm }); setDialogOpen(true); }} data-testid="button-new-fixture">
          <Plus className="w-4 h-4 mr-1" /> New Fixture
        </Button>
      </div>

      {fixtures.length === 0 ? (
        <Card className="p-12 text-center">
          <Handshake className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No fixtures yet</p>
          <Button className="mt-4" onClick={() => setDialogOpen(true)}>Add First Fixture</Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {fixtures.map((fx: any) => (
            <Card key={fx.id} className="overflow-hidden" data-testid={`fixture-card-${fx.id}`}>
              {/* Summary row */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{fx.vesselName}</span>
                      {fx.imoNumber && <span className="text-xs text-muted-foreground">IMO: {fx.imoNumber}</span>}
                      <Badge className={STATUS_CONFIG[fx.status]?.color || ""}>{STATUS_CONFIG[fx.status]?.label || fx.status}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{fx.loadingPort}</span>
                      <span className="mx-2">→</span>
                      <span className="font-medium text-foreground">{fx.dischargePort}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span>Cargo: {fx.cargoType}{fx.cargoQuantity ? ` — ${fx.cargoQuantity} ${fx.quantityUnit}` : ""}</span>
                      {fx.freightRate && <span>Freight: {fx.freightRate} {fx.freightCurrency}</span>}
                      {fx.brokerCommission && <span>Commission: {fx.brokerCommission}%</span>}
                      {fx.laycanFrom && <span>Laycan: {formatDate(fx.laycanFrom)}{fx.laycanTo ? ` – ${formatDate(fx.laycanTo)}` : ""}</span>}
                      {fx.charterer && <span>Charterer: {fx.charterer}</span>}
                      {fx.shipowner && <span>Shipowner: {fx.shipowner}</span>}
                    </div>
                    {fx.notes && <p className="text-xs text-muted-foreground italic">{fx.notes}</p>}
                    {fx.recapText && (
                      <div className="mt-2 p-2.5 bg-muted/40 rounded text-xs text-muted-foreground border-l-2 border-primary/40">
                        <span className="font-medium text-foreground block mb-0.5">Recap:</span>
                        <span className="whitespace-pre-wrap">{fx.recapText.length > 200 ? fx.recapText.substring(0, 200) + "..." : fx.recapText}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openRecap(fx)} data-testid={`button-recap-${fx.id}`}>
                      <FileText className="w-3.5 h-3.5 mr-1" /> Recap
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" data-testid={`button-status-${fx.id}`}>
                          Status <ChevronDown className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                          <DropdownMenuItem key={k} onClick={() => statusMutation.mutate({ id: fx.id, status: k })}>
                            {v.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(fx.id)} data-testid={`button-delete-fixture-${fx.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expand toggle */}
                <button
                  className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setExpandedFixture(expandedFixture === fx.id ? null : fx.id)}
                  data-testid={`button-expand-fixture-${fx.id}`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Laytime &amp; Demurrage
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expandedFixture === fx.id ? "rotate-90" : ""}`} />
                </button>
              </div>

              {/* Laytime panel */}
              {expandedFixture === fx.id && (
                <div className="border-t px-5 py-4 bg-muted/20">
                  <LaytimeTab fixture={fx} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* New Fixture Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Fixture</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div>
              <Label>Vessel Name *</Label>
              <Input value={form.vesselName} onChange={e => setForm(f => ({ ...f, vesselName: e.target.value }))} placeholder="M/V ..." data-testid="input-vessel-name" />
            </div>
            <div>
              <Label>IMO No</Label>
              <Input value={form.imoNumber} onChange={e => setForm(f => ({ ...f, imoNumber: e.target.value }))} placeholder="optional" data-testid="input-imo-number" />
            </div>
            <div>
              <Label>Cargo Type *</Label>
              <Input value={form.cargoType} onChange={e => setForm(f => ({ ...f, cargoType: e.target.value }))} placeholder="e.g. Wheat, Containers..." data-testid="input-cargo-type" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Quantity</Label>
                <Input type="number" value={form.cargoQuantity} onChange={e => setForm(f => ({ ...f, cargoQuantity: e.target.value }))} placeholder="0" data-testid="input-cargo-qty" />
              </div>
              <div className="w-24">
                <Label>Unit</Label>
                <Select value={form.quantityUnit} onValueChange={v => setForm(f => ({ ...f, quantityUnit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Loading Port *</Label>
              <Input value={form.loadingPort} onChange={e => setForm(f => ({ ...f, loadingPort: e.target.value }))} placeholder="e.g. Izmir" data-testid="input-loading-port" />
            </div>
            <div>
              <Label>Discharge Port *</Label>
              <Input value={form.dischargePort} onChange={e => setForm(f => ({ ...f, dischargePort: e.target.value }))} placeholder="e.g. Hamburg" data-testid="input-discharge-port" />
            </div>
            <div>
              <Label>Laycan Start</Label>
              <Input type="date" value={form.laycanFrom} onChange={e => setForm(f => ({ ...f, laycanFrom: e.target.value }))} data-testid="input-laycan-from" />
            </div>
            <div>
              <Label>Laycan End</Label>
              <Input type="date" value={form.laycanTo} onChange={e => setForm(f => ({ ...f, laycanTo: e.target.value }))} data-testid="input-laycan-to" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Freight Rate</Label>
                <Input type="number" value={form.freightRate} onChange={e => setForm(f => ({ ...f, freightRate: e.target.value }))} placeholder="0" data-testid="input-freight-rate" />
              </div>
              <div className="w-24">
                <Label>Currency</Label>
                <Select value={form.freightCurrency} onValueChange={v => setForm(f => ({ ...f, freightCurrency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Charterer</Label>
              <Input value={form.charterer} onChange={e => setForm(f => ({ ...f, charterer: e.target.value }))} placeholder="optional" data-testid="input-charterer" />
            </div>
            <div>
              <Label>Shipowner</Label>
              <Input value={form.shipowner} onChange={e => setForm(f => ({ ...f, shipowner: e.target.value }))} placeholder="optional" data-testid="input-shipowner" />
            </div>
            <div>
              <Label>Broker Commission (%)</Label>
              <Input type="number" value={form.brokerCommission} onChange={e => setForm(f => ({ ...f, brokerCommission: e.target.value }))} placeholder="e.g. 1.25" data-testid="input-broker-commission" />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="optional" data-testid="textarea-fixture-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.vesselName || !form.cargoType || !form.loadingPort || !form.dischargePort || createMutation.isPending} data-testid="button-save-fixture">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recap Dialog */}
      <Dialog open={recapDialogOpen} onOpenChange={setRecapDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Recap — {recapFixture?.vesselName}</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>Recap Text</Label>
            <Textarea
              value={recapText}
              onChange={e => setRecapText(e.target.value)}
              rows={12}
              placeholder="Write all negotiated terms here (CP date, freight, demurrage, despatch, ports, brokers, etc.)"
              className="font-mono text-sm"
              data-testid="textarea-recap-text"
            />
            <p className="text-xs text-muted-foreground mt-1">Free-text field — write charter party terms in any format you prefer.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecapDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => recapMutation.mutate()} disabled={recapMutation.isPending} data-testid="button-save-recap">
              {recapMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Fixture */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fixture</AlertDialogTitle>
            <AlertDialogDescription>This fixture and all its laytime calculations will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteTarget !== null && deleteMutation.mutate(deleteTarget)} data-testid="button-confirm-delete-fixture">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
