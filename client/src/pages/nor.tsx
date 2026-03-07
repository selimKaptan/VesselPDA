import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, Eye, Download, Trash2, FileCheck, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { PageMeta } from "@/components/page-meta";
import { EmptyState } from "@/components/empty-state";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Nor } from "@shared/schema";
import { fmtDate } from "@/lib/formatDate";

type NorStatus = "draft" | "tendered" | "accepted" | "rejected";

const statusConfig: Record<NorStatus, { label: string; className: string }> = {
  draft:    { label: "Draft",    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  tendered: { label: "Tendered", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  accepted: { label: "Accepted", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const READY_TO_OPTIONS = ["Load", "Discharge", "Receive Cargo"];
const CONDITION_OPTIONS = [
  "Whether in berth or not (WIBON)",
  "Whether in free pratique or not (WIFPON)",
  "Whether customs cleared or not (WCCON)",
  "Whether in port or not (WIPON)",
];

const DEFAULT_FORM = {
  voyageId: "",
  vesselName: "",
  portName: "",
  masterName: "",
  agentName: "",
  chartererName: "",
  cargoType: "",
  cargoQuantity: "",
  operation: "loading",
  anchorageArrival: "",
  berthArrival: "",
  norTenderedTo: "",
  readyTo: [] as string[],
  conditions: [] as string[],
  berthName: "",
  remarks: "",
};

export default function NorPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [location] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: nors = [], isLoading } = useQuery<Nor[]>({
    queryKey: ["/api/nor"],
  });

  const { data: voyages = [] } = useQuery<any[]>({
    queryKey: ["/api/voyages"],
  });

  // Auto-open create dialog if ?voyageId= is in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vid = params.get("voyageId");
    if (vid) {
      setForm(f => ({ ...f, voyageId: vid }));
      setCreateOpen(true);
      handleVoyageSelect(vid);
    }
  }, []);

  function handleVoyageSelect(voyageId: string) {
    if (!voyageId) {
      setForm(f => ({ ...f, voyageId: "" }));
      return;
    }
    const voyage = (voyages as any[]).find((v: any) => String(v.id) === voyageId);
    if (voyage) {
      setForm(f => ({
        ...f,
        voyageId,
        vesselName: voyage.vesselName || f.vesselName,
        portName: voyage.portName || f.portName,
      }));
    } else {
      setForm(f => ({ ...f, voyageId }));
    }
  }

  function toggleArray(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/nor", {
      ...form,
      voyageId: form.voyageId ? parseInt(form.voyageId) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nor"] });
      setCreateOpen(false);
      setForm({ ...DEFAULT_FORM });
      toast({ title: "NOR created successfully" });
    },
    onError: () => toast({ title: "Failed to create NOR", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/nor/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nor"] });
      setDeleteId(null);
      toast({ title: "NOR deleted" });
    },
    onError: () => toast({ title: "Failed to delete NOR", variant: "destructive" }),
  });

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageMeta title="Notice of Readiness | VesselPDA" description="Manage NOR documents for port calls" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
          <h1 className="text-xl font-bold">Notice of Readiness</h1>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-create-nor" className="gap-1.5">
          <Plus className="w-4 h-4" /> Create NOR
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : nors.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No NOR records yet"
          description="Create a Notice of Readiness from a voyage or standalone."
          actionLabel="Create NOR"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden" data-testid="table-nor">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vessel</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Port</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Operation</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Tendered At</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {nors.map((nor: Nor) => {
                const sc = statusConfig[(nor.status as NorStatus) || "draft"];
                return (
                  <tr key={nor.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-nor-${nor.id}`}>
                    <td className="px-4 py-3 font-medium">{nor.vesselName || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{nor.portName || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize hidden md:table-cell">{nor.operation || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{fmtDate(nor.norTenderedAt?.toString())}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${sc.className}`} data-testid={`badge-status-${nor.id}`}>{sc.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/nor/${nor.id}`}>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="View" data-testid={`button-view-${nor.id}`}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Download PDF"
                          data-testid={`button-pdf-${nor.id}`}
                          onClick={() => window.open(`/api/nor/${nor.id}/pdf`, "_blank")}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        {nor.status === "draft" && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" title="Delete"
                            data-testid={`button-delete-${nor.id}`}
                            onClick={() => setDeleteId(nor.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-nor">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="w-4 h-4" /> Create Notice of Readiness
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Voyage */}
            <div>
              <Label>Voyage (optional — auto-fills vessel & port)</Label>
              <Select value={form.voyageId} onValueChange={handleVoyageSelect}>
                <SelectTrigger data-testid="select-voyage">
                  <SelectValue placeholder="Select voyage..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No voyage</SelectItem>
                  {(voyages as any[]).map((v: any) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.vesselName || `Voyage #${v.id}`} — {v.portName || "Unknown port"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Vessel Name <span className="text-destructive">*</span></Label>
                <Input value={form.vesselName} onChange={e => setForm(f => ({ ...f, vesselName: e.target.value }))}
                  placeholder="MV Example" data-testid="input-vessel-name" />
              </div>
              <div>
                <Label>Port Name</Label>
                <Input value={form.portName} onChange={e => setForm(f => ({ ...f, portName: e.target.value }))}
                  placeholder="Istanbul" data-testid="input-port-name" />
              </div>
              <div>
                <Label>Master Name</Label>
                <Input value={form.masterName} onChange={e => setForm(f => ({ ...f, masterName: e.target.value }))}
                  placeholder="Capt. John Smith" data-testid="input-master-name" />
              </div>
              <div>
                <Label>Agent Name</Label>
                <Input value={form.agentName} onChange={e => setForm(f => ({ ...f, agentName: e.target.value }))}
                  placeholder="Ship Agency Ltd." data-testid="input-agent-name" />
              </div>
              <div>
                <Label>Charterer Name</Label>
                <Input value={form.chartererName} onChange={e => setForm(f => ({ ...f, chartererName: e.target.value }))}
                  placeholder="Charterer Corp." data-testid="input-charterer-name" />
              </div>
              <div>
                <Label>Operation</Label>
                <Select value={form.operation} onValueChange={v => setForm(f => ({ ...f, operation: v }))}>
                  <SelectTrigger data-testid="select-operation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loading">Loading</SelectItem>
                    <SelectItem value="discharging">Discharging</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cargo Type</Label>
                <Input value={form.cargoType} onChange={e => setForm(f => ({ ...f, cargoType: e.target.value }))}
                  placeholder="Steel Coils" data-testid="input-cargo-type" />
              </div>
              <div>
                <Label>Cargo Quantity</Label>
                <Input value={form.cargoQuantity} onChange={e => setForm(f => ({ ...f, cargoQuantity: e.target.value }))}
                  placeholder="5,000 MT" data-testid="input-cargo-qty" />
              </div>
              <div>
                <Label>Anchorage Arrival</Label>
                <Input type="datetime-local" value={form.anchorageArrival}
                  onChange={e => setForm(f => ({ ...f, anchorageArrival: e.target.value }))}
                  data-testid="input-anchorage-arrival" />
              </div>
              <div>
                <Label>Berth Arrival</Label>
                <Input type="datetime-local" value={form.berthArrival}
                  onChange={e => setForm(f => ({ ...f, berthArrival: e.target.value }))}
                  data-testid="input-berth-arrival" />
              </div>
              <div>
                <Label>NOR Tendered To</Label>
                <Input value={form.norTenderedTo} onChange={e => setForm(f => ({ ...f, norTenderedTo: e.target.value }))}
                  placeholder="Charterers / Receivers" data-testid="input-nor-tendered-to" />
              </div>
              <div>
                <Label>Berth Name</Label>
                <Input value={form.berthName} onChange={e => setForm(f => ({ ...f, berthName: e.target.value }))}
                  placeholder="Berth No. 5" data-testid="input-berth-name" />
              </div>
            </div>

            {/* Ready To */}
            <div>
              <Label className="mb-2 block">Ready To</Label>
              <div className="flex flex-wrap gap-4">
                {READY_TO_OPTIONS.map(opt => (
                  <div key={opt} className="flex items-center gap-2">
                    <Checkbox
                      id={`ready-${opt}`}
                      checked={form.readyTo.includes(opt)}
                      onCheckedChange={() => setForm(f => ({ ...f, readyTo: toggleArray(f.readyTo, opt) }))}
                      data-testid={`checkbox-ready-${opt.toLowerCase().replace(/\s/g, "-")}`}
                    />
                    <Label htmlFor={`ready-${opt}`} className="font-normal cursor-pointer">{opt}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Conditions */}
            <div>
              <Label className="mb-2 block">Conditions</Label>
              <div className="space-y-2">
                {CONDITION_OPTIONS.map(opt => (
                  <div key={opt} className="flex items-center gap-2">
                    <Checkbox
                      id={`cond-${opt}`}
                      checked={form.conditions.includes(opt)}
                      onCheckedChange={() => setForm(f => ({ ...f, conditions: toggleArray(f.conditions, opt) }))}
                      data-testid={`checkbox-cond-${opt.substring(0, 10).toLowerCase().replace(/\s/g, "-")}`}
                    />
                    <Label htmlFor={`cond-${opt}`} className="font-normal cursor-pointer text-sm">{opt}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Remarks */}
            <div>
              <Label>Remarks</Label>
              <Textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                placeholder="Additional remarks..." rows={3} data-testid="textarea-remarks" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setForm({ ...DEFAULT_FORM }); }}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.vesselName.trim() || createMutation.isPending}
              data-testid="button-submit-create-nor"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Create NOR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete NOR</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this NOR record? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
