import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Eye, Download, Trash2, FileText, Loader2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PageMeta } from "@/components/page-meta";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

type SofStatus = "draft" | "finalized" | "signed";

const statusConfig: Record<SofStatus, { label: string; className: string }> = {
  draft:     { label: "Draft",     className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  finalized: { label: "Finalized", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  signed:    { label: "Signed",    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const DEFAULT_FORM = {
  vesselName: "",
  portName: "",
  berthName: "",
  cargoType: "",
  cargoQuantity: "",
  operation: "loading",
  masterName: "",
  agentName: "",
  voyageId: "",
  remarks: "",
};

export default function SofPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: sofs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/sof"],
  });

  const { data: voyages = [] } = useQuery<any[]>({
    queryKey: ["/api/voyages"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sof", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sof"] });
      setCreateOpen(false);
      setForm({ ...DEFAULT_FORM });
      toast({ title: "SOF created", description: "13 standard events have been added automatically." });
    },
    onError: () => toast({ title: "Error", description: "Failed to create SOF.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/sof/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sof"] });
      setDeleteId(null);
      toast({ title: "SOF deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete SOF.", variant: "destructive" }),
  });

  const handleCreate = () => {
    const payload: any = { ...form };
    if (!payload.voyageId) delete payload.voyageId;
    else payload.voyageId = parseInt(payload.voyageId);
    createMutation.mutate(payload);
  };

  const handleVoyageSelect = (val: string) => {
    if (val === "__none__") {
      setForm(f => ({ ...f, voyageId: "" }));
      return;
    }
    const voyage = voyages.find((v: any) => String(v.id) === val);
    if (voyage) {
      setForm(f => ({
        ...f,
        voyageId: val,
        vesselName: voyage.vesselName || f.vesselName,
        portName: voyage.portName || f.portName,
      }));
    } else {
      setForm(f => ({ ...f, voyageId: val }));
    }
  };

  return (
    <>
      <PageMeta title="Statement of Facts | VesselPDA" description="Manage SOF documents" />
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-7 w-7 text-maritime-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Statement of Facts</h1>
              <p className="text-sm text-muted-foreground">Chronological port event records</p>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)} data-testid="button-create-sof" className="gap-2">
            <Plus className="h-4 w-4" />
            New SOF
          </Button>
        </div>

        {/* Table */}
        <div className="border rounded-xl overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Vessel</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Port</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Operation</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Created</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : sofs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>No SOFs yet. Create your first one.</p>
                  </td>
                </tr>
              ) : sofs.map((sof: any) => {
                const st = (sof.status as SofStatus) || "draft";
                const cfg = statusConfig[st] || statusConfig.draft;
                return (
                  <tr key={sof.id} className="border-b hover:bg-muted/20 transition-colors" data-testid={`row-sof-${sof.id}`}>
                    <td className="px-4 py-3 font-medium">{sof.vesselName || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{sof.portName || "—"}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{sof.operation || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(sof.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/sof/${sof.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="View" data-testid={`button-view-sof-${sof.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <a href={`/api/sof/${sof.id}/pdf`} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" title="Export PDF" data-testid={`button-pdf-sof-${sof.id}`}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          title="Delete"
                          data-testid={`button-delete-sof-${sof.id}`}
                          onClick={() => setDeleteId(sof.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Statement of Facts</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Link to Voyage (optional)</Label>
              <Select value={form.voyageId} onValueChange={handleVoyageSelect}>
                <SelectTrigger data-testid="select-voyage">
                  <SelectValue placeholder="Select voyage…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {voyages.map((v: any) => (
                    <SelectItem key={v.id} value={String(v.id)}>{v.vesselName || `Voyage #${v.id}`} — {v.portName || "Port"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vessel Name *</Label>
                <Input data-testid="input-vessel-name" value={form.vesselName} onChange={e => setForm(f => ({ ...f, vesselName: e.target.value }))} placeholder="M/V Example" />
              </div>
              <div>
                <Label>Port Name *</Label>
                <Input data-testid="input-port-name" value={form.portName} onChange={e => setForm(f => ({ ...f, portName: e.target.value }))} placeholder="Istanbul" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Berth Name</Label>
                <Input data-testid="input-berth-name" value={form.berthName} onChange={e => setForm(f => ({ ...f, berthName: e.target.value }))} placeholder="Berth No. 3" />
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
                    <SelectItem value="both">Loading & Discharging</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cargo Type</Label>
                <Input data-testid="input-cargo-type" value={form.cargoType} onChange={e => setForm(f => ({ ...f, cargoType: e.target.value }))} placeholder="Grain, Coal…" />
              </div>
              <div>
                <Label>Cargo Quantity</Label>
                <Input data-testid="input-cargo-quantity" value={form.cargoQuantity} onChange={e => setForm(f => ({ ...f, cargoQuantity: e.target.value }))} placeholder="10,000 MT" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Master Name</Label>
                <Input data-testid="input-master-name" value={form.masterName} onChange={e => setForm(f => ({ ...f, masterName: e.target.value }))} />
              </div>
              <div>
                <Label>Agent Name</Label>
                <Input data-testid="input-agent-name" value={form.agentName} onChange={e => setForm(f => ({ ...f, agentName: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending || !form.vesselName || !form.portName} data-testid="button-confirm-create-sof">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create SOF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete SOF?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the SOF and all its events. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteId!)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete-sof">
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
