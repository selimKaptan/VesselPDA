import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, Eye, Download, Trash2, Loader2, Calculator, FileText, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PageMeta } from "@/components/page-meta";
import { EmptyState } from "@/components/empty-state";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type FdaStatus = "draft" | "pending_approval" | "approved" | "sent";

const statusCfg: Record<FdaStatus, { label: string; className: string }> = {
  draft:            { label: "Draft",           className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  pending_approval: { label: "Pending Approval", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  approved:         { label: "Approved",         className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  sent:             { label: "Sent",             className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

function fmtUsd(n: number | null | undefined) {
  if (!n && n !== 0) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function VariancePill({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined || pct === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const over = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
      over ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
    }`}>
      {over ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

export default function FdaPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [fromProformaOpen, setFromProformaOpen] = useState(false);
  const [selectedProformaId, setSelectedProformaId] = useState("__none__");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: fdas = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/fda"] });
  const { data: proformas = [] } = useQuery<any[]>({ queryKey: ["/api/proformas"] });

  const createMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/fda", body),
    onSuccess: async (res: any) => {
      const fda = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/fda"] });
      setFromProformaOpen(false);
      setSelectedProformaId("__none__");
      setLocation(`/fda/${fda.id}`);
    },
    onError: () => toast({ title: "Error", description: "Failed to create FDA.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/fda/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fda"] });
      setDeleteId(null);
      toast({ title: "FDA deleted" });
    },
  });

  const handleCreateBlank = () => {
    createMutation.mutate({});
  };

  const handleCreateFromProforma = () => {
    const proformaId = selectedProformaId !== "__none__" ? parseInt(selectedProformaId) : undefined;
    createMutation.mutate({ proformaId });
  };

  return (
    <>
      <PageMeta title="Final Disbursement Accounts | VesselPDA" description="FDA management" />
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calculator className="h-7 w-7 text-maritime-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Final Disbursement Accounts</h1>
              <p className="text-sm text-muted-foreground">Compare estimated vs actual port costs</p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2" data-testid="button-new-fda">
                <Plus className="h-4 w-4" /> New FDA <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFromProformaOpen(true)} data-testid="menu-from-proforma">
                <FileText className="h-4 w-4 mr-2 text-maritime-primary" /> From Proforma (PDA)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCreateBlank} data-testid="menu-blank-fda">
                <Plus className="h-4 w-4 mr-2" /> Blank FDA
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="border rounded-xl overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Reference</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Vessel</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Port</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Estimated</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actual</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Variance</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : fdas.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="No Final Disbursements"
            description="Create an FDA after a voyage is completed to compare estimated costs against actual expenses."
            actionLabel="Create from PDA"
            onAction={() => setFromProformaOpen(true)}
            tips={[
              "FDAs allow you to track the variance between PDA estimates and final costs.",
              "You can import all line items from an existing PDA to save time.",
              "Once finalized, FDAs can be used to generate official invoices."
            ]}
          />
        ) : (
          <div className="border rounded-xl overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Reference</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Vessel</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Port</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Estimated</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actual</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Variance</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fdas.map((fda: any) => {
                  const st = (fda.status as FdaStatus) || "draft";
                  const cfg = statusCfg[st] || statusCfg.draft;
                  return (
                    <tr key={fda.id} className="border-b hover:bg-muted/20 transition-colors" data-testid={`row-fda-${fda.id}`}>
                      <td className="px-4 py-3 font-mono text-xs font-medium">{fda.referenceNumber || `FDA-${fda.id}`}</td>
                      <td className="px-4 py-3 font-medium">{fda.vesselName || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fda.portName || "—"}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{fmtUsd(fda.totalEstimatedUsd)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{fmtUsd(fda.totalActualUsd)}</td>
                      <td className="px-4 py-3 text-center"><VariancePill pct={fda.variancePercent} /></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/fda/${fda.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="View" data-testid={`button-view-fda-${fda.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <a href={`/api/fda/${fda.id}/pdf`} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" title="Export PDF" data-testid={`button-pdf-fda-${fda.id}`}>
                              <Download className="h-4 w-4" />
                            </Button>
                          </a>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={() => setDeleteId(fda.id)}
                            data-testid={`button-delete-fda-${fda.id}`}
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
        )}
      </div>

      {/* From Proforma Dialog */}
      <Dialog open={fromProformaOpen} onOpenChange={setFromProformaOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create FDA from Proforma</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Select a Proforma (PDA) to import its estimated line items into the FDA. You'll then enter the actual amounts.
            </p>
            <div>
              <Label>Proforma (PDA)</Label>
              <Select value={selectedProformaId} onValueChange={setSelectedProformaId}>
                <SelectTrigger data-testid="select-proforma">
                  <SelectValue placeholder="Select a proforma…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select a proforma…</SelectItem>
                  {proformas.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.referenceNumber || `PDA-${p.id}`}
                      {p.vesselName || p.vessel?.name ? ` — ${p.vesselName || p.vessel?.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFromProformaOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateFromProforma}
              disabled={createMutation.isPending || selectedProformaId === "__none__"}
              data-testid="button-confirm-from-proforma"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create FDA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete FDA?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this FDA record. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteId!)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete-fda">
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
