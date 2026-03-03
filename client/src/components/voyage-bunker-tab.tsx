import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Fuel, Plus, Pencil, Trash2, ExternalLink, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

const FUEL_TYPES = ["IFO380", "VLSFO", "MGO", "LSMGO", "LNG"];
const FUEL_COLORS: Record<string, string> = {
  IFO380: "#3b82f6", VLSFO: "#8b5cf6", MGO: "#10b981", LSMGO: "#f59e0b", LNG: "#06b6d4",
};
const RECORD_TYPES = [
  { value: "bunkering",   label: "Bunkering" },
  { value: "rob_report",  label: "ROB Report" },
  { value: "consumption", label: "Consumption" },
];

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtCost = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

interface Props {
  voyageId: number;
  vesselId?: number;
  portCalls?: any[];
}

export function VoyageBunkerTab({ voyageId, vesselId, portCalls = [] }: Props) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [deletingRecord, setDeletingRecord] = useState<any>(null);

  const recordsQuery = useQuery<any[]>({
    queryKey: ["/api/vessels", vesselId, "bunker", "voyage", voyageId],
    queryFn: () =>
      fetch(`/api/vessels/${vesselId}/bunker?voyageId=${voyageId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!vesselId,
  });

  const robQuery = useQuery<any>({
    queryKey: ["/api/vessels", vesselId, "bunker", "rob"],
    queryFn: () => fetch(`/api/vessels/${vesselId}/bunker/rob`, { credentials: "include" }).then(r => r.json()),
    enabled: !!vesselId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/vessels", vesselId, "bunker"] });
  };

  const addMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/vessels/${vesselId}/bunker`, { ...data, voyageId }).then(r => r.json()),
    onSuccess: () => { invalidate(); setShowAdd(false); setEditingRecord(null); toast({ title: "Record added" }); },
    onError: () => toast({ title: "Failed to add record", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PATCH", `/api/vessels/${vesselId}/bunker/${id}`, data).then(r => r.json()),
    onSuccess: () => { invalidate(); setEditingRecord(null); toast({ title: "Record updated" }); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/vessels/${vesselId}/bunker/${id}`, {}),
    onSuccess: () => { invalidate(); setDeletingRecord(null); toast({ title: "Record deleted" }); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const records: any[] = recordsQuery.data ?? [];
  const rob = robQuery.data;

  const totalBunkered = records.filter(r => r.record_type === "bunkering").reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);
  const totalCost = records.filter(r => r.record_type === "bunkering").reduce((s, r) => s + (parseFloat(r.total_cost) || 0), 0);
  const totalConsumed = records.filter(r => r.record_type === "consumption").reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);

  const consumptionChartData = records
    .filter(r => r.record_type === "consumption")
    .sort((a, b) => new Date(a.record_date).getTime() - new Date(b.record_date).getTime())
    .reduce((acc: any[], r) => {
      const day = new Date(r.record_date).toISOString().split("T")[0].slice(5);
      const existing = acc.find(e => e.day === day);
      if (existing) { existing[r.fuel_type] = (existing[r.fuel_type] ?? 0) + parseFloat(r.quantity); }
      else { acc.push({ day, [r.fuel_type]: parseFloat(r.quantity) }); }
      return acc;
    }, []);

  if (!vesselId) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
        <p className="text-muted-foreground text-sm">No vessel linked to this voyage. Assign a vessel to track bunker data.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Fuel className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
          <h3 className="text-sm font-semibold">Bunker Records — This Voyage</h3>
          <Badge variant="outline" className="text-[10px]">{records.length} records</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/bunker-management">
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Full Bunker Page
            </Link>
          </Button>
          <Button size="sm" onClick={() => { setEditingRecord(null); setShowAdd(true); }} data-testid="button-add-voyage-bunker">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Record
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Bunkered (MT)</p>
          <p className="text-xl font-bold font-mono">{fmt(totalBunkered)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Consumed (MT)</p>
          <p className="text-xl font-bold font-mono">{fmt(totalConsumed)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Bunker Cost</p>
          <p className="text-xl font-bold font-mono">{fmtCost(totalCost)}</p>
        </Card>
      </div>

      {/* Current ROB */}
      {rob && (
        <Card className="p-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Current Vessel ROB</h4>
          <div className="grid grid-cols-4 gap-3">
            {["IFO380", "VLSFO", "MGO", "LSMGO"].map(ft => {
              const val = rob.source === "survey"
                ? (rob.robs[ft] ?? 0)
                : (rob.robs?.[ft]?.rob ?? null);
              return (
                <div key={ft} className="text-center">
                  <div className="flex justify-center mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: FUEL_COLORS[ft] }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{ft}</p>
                  <p className="text-sm font-bold font-mono">
                    {val !== null ? fmt(val) : "—"} <span className="text-[10px] font-normal">MT</span>
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Records Table */}
      {records.length === 0 ? (
        <Card className="p-10 text-center">
          <Fuel className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">No bunker records for this voyage yet.</p>
          <p className="text-muted-foreground text-xs mt-1">Track fuel intake, consumption and ROB reports.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Fuel</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Qty (MT)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Cost</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Port / Supplier</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">ROB After</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((r: any) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-voyage-bunker-${r.id}`}>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{fmtDate(r.record_date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px]">
                        {RECORD_TYPES.find(t => t.value === r.record_type)?.label ?? r.record_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: FUEL_COLORS[r.fuel_type] ?? "#6b7280" }} />
                        <span className="text-xs font-medium">{r.fuel_type}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{fmt(parseFloat(r.quantity))}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {r.total_cost ? fmtCost(parseFloat(r.total_cost)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span>{r.port_name || "—"}</span>
                      {r.supplier && <div className="text-[10px] text-muted-foreground">{r.supplier}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {r.rob_after != null ? fmt(parseFloat(r.rob_after)) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => { setEditingRecord(r); setShowAdd(true); }}
                          className="p-1 text-muted-foreground hover:text-foreground"
                          data-testid={`button-edit-voyage-bunker-${r.id}`}
                        ><Pencil className="w-3 h-3" /></button>
                        <button
                          onClick={() => setDeletingRecord(r)}
                          className="p-1 text-muted-foreground hover:text-red-600"
                          data-testid={`button-delete-voyage-bunker-${r.id}`}
                        ><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Consumption Line Chart */}
      {consumptionChartData.length > 1 && (
        <Card className="p-5">
          <h4 className="text-sm font-semibold mb-4">Consumption Trend</h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={consumptionChartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} label={{ value: "MT", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
              <Tooltip formatter={(v: number) => [`${fmt(v)} MT`]} />
              <Legend />
              {FUEL_TYPES.map(ft => (
                <Line key={ft} type="monotone" dataKey={ft} stroke={FUEL_COLORS[ft]}
                  dot={false} strokeWidth={2} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      {showAdd && (
        <VoyageBunkerRecordDialog
          record={editingRecord}
          portCalls={portCalls}
          onClose={() => { setShowAdd(false); setEditingRecord(null); }}
          onSubmit={(data) => {
            if (editingRecord) editMutation.mutate({ id: editingRecord.id, data });
            else addMutation.mutate(data);
          }}
          isPending={addMutation.isPending || editMutation.isPending}
        />
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingRecord} onOpenChange={() => setDeletingRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>Delete this bunker record? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMutation.mutate(deletingRecord.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VoyageBunkerRecordDialog({ record, portCalls, onClose, onSubmit, isPending }: {
  record: any;
  portCalls: any[];
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    recordType: record?.record_type ?? "bunkering",
    recordDate: record?.record_date ? new Date(record.record_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    fuelType: record?.fuel_type ?? "VLSFO",
    quantity: record?.quantity?.toString() ?? "",
    pricePerTon: record?.price_per_ton?.toString() ?? "",
    totalCost: record?.total_cost?.toString() ?? "",
    currency: record?.currency ?? "USD",
    supplier: record?.supplier ?? "",
    deliveryNote: record?.delivery_note ?? "",
    robBefore: record?.rob_before?.toString() ?? "",
    robAfter: record?.rob_after?.toString() ?? "",
    portName: record?.port_name ?? "",
    portCallId: record?.port_call_id?.toString() ?? "",
    notes: record?.notes ?? "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const autoRobAfter = () => {
    if (form.robBefore && form.quantity) {
      const b = parseFloat(form.robBefore), q = parseFloat(form.quantity);
      if (!isNaN(b) && !isNaN(q)) {
        if (form.recordType === "bunkering") return (b + q).toFixed(1);
        if (form.recordType === "consumption") return Math.max(0, b - q).toFixed(1);
      }
    }
    return "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recordType || !form.fuelType || !form.quantity) return;
    const autoRob = form.robAfter || autoRobAfter();
    onSubmit({
      recordType: form.recordType,
      recordDate: form.recordDate,
      fuelType: form.fuelType,
      quantity: parseFloat(form.quantity),
      pricePerTon: form.pricePerTon ? parseFloat(form.pricePerTon) : undefined,
      totalCost: form.totalCost ? parseFloat(form.totalCost) : form.pricePerTon && form.quantity ? parseFloat(form.pricePerTon) * parseFloat(form.quantity) : undefined,
      currency: form.currency,
      supplier: form.supplier || undefined,
      deliveryNote: form.deliveryNote || undefined,
      robBefore: form.robBefore ? parseFloat(form.robBefore) : undefined,
      robAfter: autoRob ? parseFloat(autoRob) : undefined,
      portName: form.portName || undefined,
      portCallId: form.portCallId ? parseInt(form.portCallId) : undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? "Edit Bunker Record" : "Add Bunker Record"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Record Type *</Label>
              <Select value={form.recordType} onValueChange={v => set("recordType", v)}>
                <SelectTrigger data-testid="select-voyage-record-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fuel Type *</Label>
              <Select value={form.fuelType} onValueChange={v => set("fuelType", v)}>
                <SelectTrigger data-testid="select-voyage-fuel-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUEL_TYPES.map(ft => <SelectItem key={ft} value={ft}>{ft}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date & Time *</Label>
              <Input type="datetime-local" value={form.recordDate} onChange={e => set("recordDate", e.target.value)} />
            </div>
            {portCalls.length > 0 ? (
              <div className="space-y-1.5">
                <Label>Port Call</Label>
                <Select value={form.portCallId} onValueChange={v => {
                  set("portCallId", v);
                  const pc = portCalls.find((p: any) => p.id.toString() === v);
                  if (pc) set("portName", pc.port_name || pc.portName || "");
                }}>
                  <SelectTrigger data-testid="select-voyage-port-call">
                    <SelectValue placeholder="Select port" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General / No port</SelectItem>
                    {portCalls.map((pc: any) => (
                      <SelectItem key={pc.id} value={pc.id.toString()}>
                        {pc.port_name || pc.portName || `Port #${pc.port_call_order}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Port Name</Label>
                <Input value={form.portName} onChange={e => set("portName", e.target.value)} placeholder="e.g. Mersin" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Quantity (MT) *</Label>
              <Input type="number" step="0.001" min="0" value={form.quantity} onChange={e => set("quantity", e.target.value)} placeholder="0.000" data-testid="input-voyage-quantity" />
            </div>
            {form.recordType === "bunkering" && (
              <>
                <div className="space-y-1.5">
                  <Label>$/MT</Label>
                  <Input type="number" step="0.01" min="0" value={form.pricePerTon} onChange={e => set("pricePerTon", e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label>Total Cost</Label>
                  <Input type="number" step="0.01" min="0" value={form.totalCost}
                    onChange={e => set("totalCost", e.target.value)}
                    placeholder={form.pricePerTon && form.quantity ? `≈ ${(parseFloat(form.pricePerTon || "0") * parseFloat(form.quantity || "0")).toFixed(0)}` : "auto"} />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>ROB Before (MT)</Label>
              <Input type="number" step="0.1" min="0" value={form.robBefore} onChange={e => set("robBefore", e.target.value)} placeholder="0.0" />
            </div>
            <div className="space-y-1.5">
              <Label>ROB After (MT)</Label>
              <Input type="number" step="0.1" min="0" value={form.robAfter}
                onChange={e => set("robAfter", e.target.value)}
                placeholder={autoRobAfter() || "auto-calculated"} />
              {autoRobAfter() && !form.robAfter && (
                <p className="text-[10px] text-muted-foreground">Auto: {autoRobAfter()} MT</p>
              )}
            </div>
          </div>

          {form.recordType === "bunkering" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Supplier</Label>
                <Input value={form.supplier} onChange={e => set("supplier", e.target.value)} placeholder="Bunker supplier" />
              </div>
              <div className="space-y-1.5">
                <Label>BDN No.</Label>
                <Input value={form.deliveryNote} onChange={e => set("deliveryNote", e.target.value)} placeholder="Delivery note no." />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending || !form.recordType || !form.fuelType || !form.quantity} data-testid="button-save-voyage-bunker">
              {isPending ? "Saving…" : record ? "Update" : "Add Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
