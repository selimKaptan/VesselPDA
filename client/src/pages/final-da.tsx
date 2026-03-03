import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { PageMeta } from "@/components/page-meta";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus, Search, TrendingUp, TrendingDown, Minus,
  FileText, Trash2, Eye, AlertTriangle, CheckCircle2, Send, DollarSign
} from "lucide-react";
import { useState } from "react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft:  { label: "Draft",  color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: FileText },
  final:  { label: "Final",  color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: CheckCircle2 },
  sent:   { label: "Sent",   color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: Send },
  paid:   { label: "Paid",   color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: DollarSign },
};

function VarianceBadge({ variance, pct }: { variance: number | null; pct: number | null }) {
  if (variance === null || variance === undefined) return <span className="text-muted-foreground text-xs">—</span>;
  const v = parseFloat(String(variance));
  const p = parseFloat(String(pct || 0));
  if (Math.abs(v) < 0.01) return (
    <span className="flex items-center gap-1 text-gray-500 text-xs"><Minus className="w-3 h-3" /> $0.00</span>
  );
  const isOver = v > 0;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${isOver ? "text-red-600" : "text-green-600"}`}>
      {isOver ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isOver ? "+" : ""}{v.toFixed(2)} ({p > 0 ? "+" : ""}{p.toFixed(1)}%)
    </span>
  );
}

export default function FinalDaPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const { data: fdas = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/final-da"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/final-da/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/final-da"] }); toast({ title: "Final DA deleted" }); },
    onError: () => toast({ title: "Error", description: "Failed to delete", variant: "destructive" }),
  });

  const filtered = fdas.filter(fda => {
    const q = search.toLowerCase();
    return !q || fda.reference_number?.toLowerCase().includes(q) ||
      fda.vessel_name?.toLowerCase().includes(q) ||
      fda.port_name?.toLowerCase().includes(q) ||
      fda.to_company?.toLowerCase().includes(q);
  });

  const totalActual = fdas.reduce((s, f) => s + (parseFloat(f.total_actual) || 0), 0);
  const totalVariance = fdas.reduce((s, f) => s + (parseFloat(f.total_variance) || 0), 0);

  return (
    <div className="space-y-6">
      <PageMeta title="Final Disbursement Accounts | VesselPDA" description="Final DA list and variance reports" />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">Final Disbursement Accounts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track actual port costs vs proforma estimates</p>
        </div>
        <Button onClick={() => navigate("/final-da/new")} className="gap-2" data-testid="button-new-fda">
          <Plus className="w-4 h-4" /> New Final DA
        </Button>
      </div>

      {/* Summary cards */}
      {fdas.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total FDAs</p>
            <p className="text-2xl font-bold mt-1">{fdas.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total Actual</p>
            <p className="text-2xl font-bold mt-1">${totalActual.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Net Variance</p>
            <p className={`text-2xl font-bold mt-1 ${totalVariance > 0 ? "text-red-600" : totalVariance < 0 ? "text-green-600" : ""}`}>
              {totalVariance > 0 ? "+" : ""}{totalVariance.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-2xl font-bold mt-1">{fdas.filter(f => f.status === "paid").length}</p>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by ref, vessel, port..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-fda-search" />
      </div>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No Final DAs yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create one from a Proforma or start fresh.</p>
            <Button className="mt-4 gap-2" onClick={() => navigate("/final-da/new")} data-testid="button-create-first-fda">
              <Plus className="w-4 h-4" /> Create First FDA
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref No.</TableHead>
                <TableHead>Vessel</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>Proforma Ref</TableHead>
                <TableHead className="text-right">Proforma</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead>Variance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(fda => {
                const scfg = STATUS_CONFIG[fda.status] || STATUS_CONFIG.draft;
                const SIcon = scfg.icon;
                return (
                  <TableRow key={fda.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/final-da/${fda.id}`)} data-testid={`row-fda-${fda.id}`}>
                    <TableCell className="font-mono text-xs font-semibold">{fda.reference_number}</TableCell>
                    <TableCell className="text-sm">{fda.vessel_name || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">{fda.port_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{fda.proforma_ref || "—"}</TableCell>
                    <TableCell className="text-right text-sm">
                      {fda.total_proforma != null ? `$${parseFloat(fda.total_proforma).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      ${parseFloat(fda.total_actual || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <VarianceBadge variance={fda.total_variance} pct={fda.variance_percentage} />
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] gap-1 ${scfg.color} border-0`}>
                        <SIcon className="w-2.5 h-2.5" />{scfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/final-da/${fda.id}`)} data-testid={`button-view-fda-${fda.id}`}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(fda.id)} data-testid={`button-delete-fda-${fda.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
