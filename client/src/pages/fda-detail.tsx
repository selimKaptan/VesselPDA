import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  ArrowLeft, Download, CheckCircle2, Loader2, Calculator,
  TrendingUp, TrendingDown, Minus, Plus, Trash2, Save, ArrowUpDown, BarChart3, Receipt,
  Layers, Link as LinkIcon, AlertTriangle, Check, Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PageMeta } from "@/components/page-meta";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fmtDate } from "@/lib/formatDate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FdaLineItem {
  id: string;
  description: string;
  category: string;
  estimatedUsd: number;
  estimatedEur: number;
  actualUsd: number;
  actualEur: number;
  varianceUsd: number;
  variancePercent: number;
  receiptUrl?: string;
  remarks?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:            { label: "Draft",           className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  pending_approval: { label: "Pending Approval", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  approved:         { label: "Approved",         className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  sent:             { label: "Sent",             className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

function fmtUsd(n: number) {
  return `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function VarianceBadge({ usd, pct }: { usd: number; pct: number }) {
  if (!usd && !pct) return <span className="text-muted-foreground text-xs">—</span>;
  const over = usd > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
      over ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
           : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
    }`}>
      {over ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {over ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function calcVariance(items: FdaLineItem[]): { totalEst: number; totalAct: number; varUsd: number; varPct: number } {
  const totalEst = items.reduce((s, i) => s + (i.estimatedUsd || 0), 0);
  const totalAct = items.reduce((s, i) => s + (i.actualUsd || 0), 0);
  const varUsd = totalAct - totalEst;
  const varPct = totalEst ? (varUsd / totalEst) * 100 : 0;
  return { totalEst, totalAct, varUsd, varPct };
}

const BLANK_ITEM = (): FdaLineItem => ({
  id: `item_${Date.now()}`,
  description: "",
  category: "General",
  estimatedUsd: 0,
  estimatedEur: 0,
  actualUsd: 0,
  actualEur: 0,
  varianceUsd: 0,
  variancePercent: 0,
  remarks: "",
});

export default function FdaDetail() {
  const { id } = useParams<{ id: string }>();
  const fdaId = parseInt(id || "0");
  const { toast } = useToast();

  const [localItems, setLocalItems] = useState<FdaLineItem[] | null>(null);
  const [notes, setNotes] = useState("");
  const [dirty, setDirty] = useState(false);

  const { data: fda, isLoading } = useQuery<any>({
    queryKey: ["/api/fda", fdaId],
    queryFn: async () => {
      const res = await fetch(`/api/fda/${fdaId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!fdaId,
  });

  const { data: recon, isLoading: isLoadingRecon } = useQuery<any>({
    queryKey: ["/api/fda", fdaId, "reconciliation"],
    queryFn: async () => {
      const res = await fetch(`/api/fda/${fdaId}/reconciliation`, { credentials: "include" });
      return res.json();
    },
    enabled: !!fdaId,
  });

  const linkExpenseMutation = useMutation({
    mutationFn: (data: { expenseId: number; fdaId: number }) => 
      apiRequest("PATCH", `/api/port-expenses/${data.expenseId}`, { fdaId: data.fdaId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fda", fdaId, "reconciliation"] });
      toast({ title: "Expense linked to FDA" });
    },
    onError: () => toast({ title: "Error linking expense", variant: "destructive" }),
  });

  const unlinkExpenseMutation = useMutation({
    mutationFn: (expenseId: number) => 
      apiRequest("PATCH", `/api/port-expenses/${expenseId}`, { fdaId: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fda", fdaId, "reconciliation"] });
      toast({ title: "Expense unlinked" });
    },
    onError: () => toast({ title: "Error unlinking expense", variant: "destructive" }),
  });

  useEffect(() => {
    if (fda && localItems === null) {
      setLocalItems(fda.lineItems || []);
      setNotes(fda.notes || "");
    }
  }, [fda]);

  const isApproved = fda?.status === "approved" || fda?.status === "sent";
  const items: FdaLineItem[] = localItems ?? fda?.lineItems ?? [];

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/fda/${fdaId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fda", fdaId] });
      queryClient.invalidateQueries({ queryKey: ["/api/fda"] });
      setDirty(false);
      toast({ title: "FDA saved" });
    },
    onError: () => toast({ title: "Error saving FDA", variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/fda/${fdaId}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fda", fdaId] });
      queryClient.invalidateQueries({ queryKey: ["/api/fda"] });
      setLocalItems(null);
      toast({ title: "FDA approved", description: "Status updated to Approved." });
    },
  });

  function updateItem(idx: number, key: keyof FdaLineItem, value: any) {
    setLocalItems(prev => {
      const next = prev ? [...prev] : [...items];
      const item = { ...next[idx], [key]: value };
      const varUsd = (key === "actualUsd" ? value : item.actualUsd || 0) - (item.estimatedUsd || 0);
      const varPct = item.estimatedUsd ? (varUsd / item.estimatedUsd) * 100 : 0;
      next[idx] = { ...item, varianceUsd: varUsd, variancePercent: Math.round(varPct * 100) / 100 };
      return next;
    });
    setDirty(true);
  }

  function addItem() {
    setLocalItems(prev => [...(prev ?? items), BLANK_ITEM()]);
    setDirty(true);
  }

  function removeItem(idx: number) {
    setLocalItems(prev => {
      const next = [...(prev ?? items)];
      next.splice(idx, 1);
      return next;
    });
    setDirty(true);
  }

  function handleSave() {
    saveMutation.mutate({ lineItems: items, notes });
  }

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/fda-mapping-templates"],
  });

  const saveTemplateMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/fda-mapping-templates", {
      name,
      mappings: items.map(i => ({
        pdaCategory: i.category,
        portExpenseCategory: i.category, // Simplification for now
        description: i.description
      }))
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fda-mapping-templates"] });
      toast({ title: "Template saved" });
    },
  });

  const loadTemplate = (templateId: string) => {
    const template = templates.find(t => String(t.id) === templateId);
    if (!template) return;

    if (template.mappings && Array.isArray(template.mappings)) {
      setLocalItems(prev => {
        const current = prev ?? items;
        return current.map(item => {
          const mapping = template.mappings.find((m: any) => m.description === item.description);
          if (mapping) {
            return { ...item, category: mapping.portExpenseCategory };
          }
          return item;
        });
      });
      setDirty(true);
      toast({ title: "Template applied", description: "Line item categories updated based on description matches." });
    }
  };

  const { totalEst, totalAct, varUsd, varPct } = calcVariance(items);

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!fda || fda.error) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">FDA not found.</p>
        <Link href="/fda"><Button variant="outline" className="mt-4 gap-2"><ArrowLeft className="h-4 w-4" />Back</Button></Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[fda.status] || STATUS_CONFIG.draft;

  return (
    <>
      <PageMeta title={`FDA ${fda.referenceNumber || fdaId} | VesselPDA`} description="Final Disbursement Account" />
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/fda">
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back-fda">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Calculator className="h-6 w-6 text-maritime-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold" data-testid="text-fda-ref">{fda.referenceNumber || `FDA-${fda.id}`}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.className}`}>
                  {statusCfg.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Final Disbursement Account</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {fda.proformaId && (
              <Link href={`/da-comparison/${fda.proformaId}`}>
                <Button variant="outline" className="gap-2" size="sm" data-testid="button-compare-pda">
                  <BarChart3 className="h-4 w-4" /> Compare with PDA
                </Button>
              </Link>
            )}
            {isApproved && (
              <Link href={`/invoices?fdaId=${fda.id}`}>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="button-create-invoice-from-fda">
                  <Receipt className="h-4 w-4" /> Create Invoice
                </Button>
              </Link>
            )}
            {!isApproved && (
              <Button
                variant="outline"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400"
                data-testid="button-approve-fda"
              >
                {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Approve
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || !dirty}
              className="gap-2"
              data-testid="button-save-fda"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
            <a href={`/api/fda/${fdaId}/pdf`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2" data-testid="button-pdf-fda">
                <Download className="h-4 w-4" /> Export PDF
              </Button>
            </a>
          </div>
        </div>

        {/* Info + Variance Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Vessel/Port Info */}
          <div className="md:col-span-2 border rounded-xl p-5 bg-card space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Port Call Details</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                { label: "Vessel", value: fda.vesselName },
                { label: "Port", value: fda.portName },
                { label: "Proforma Ref", value: fda.proformaId ? `PDA-${fda.proformaId}` : null },
                { label: "Exchange Rate", value: fda.exchangeRate ? `${fda.exchangeRate} TRY/USD` : null },
              ].map(({ label, value }) => value ? (
                <div key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-medium">{value}</p>
                </div>
              ) : null)}
            </div>
            {fda.approvedBy && (
              <p className="text-xs text-muted-foreground pt-1 border-t">
                Approved by <strong>{fda.approvedBy}</strong>
                {fda.approvedAt ? ` on ${fmtDate(fda.approvedAt)}` : ""}
              </p>
            )}
          </div>

          {/* Variance Summary */}
          <div className="border rounded-xl p-5 bg-card space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Summary</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Estimated</span>
                <span className="font-mono font-medium">{fmtUsd(totalEst)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Actual</span>
                <span className="font-mono font-medium">{fmtUsd(totalAct)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Variance</span>
                <div className="text-right">
                  <p className={`font-mono font-bold text-sm ${varUsd > 0 ? "text-red-600 dark:text-red-400" : varUsd < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                    {varUsd >= 0 ? "+" : ""}{fmtUsd(varUsd)}
                  </p>
                  <VarianceBadge usd={varUsd} pct={varPct} />
                </div>
              </div>
              {recon && (
                <div className="pt-2 border-t flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Recon. Status</span>
                  {recon.unlinkedExpenses?.length === 0 ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex gap-1 items-center">
                      <Check className="h-3 w-3" /> Fully Reconciled
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex gap-1 items-center">
                      <AlertTriangle className="h-3 w-3" /> {recon.unlinkedExpenses?.length} Pending
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="line-items" className="space-y-4">
          <TabsList>
            <TabsTrigger value="line-items" className="gap-2">
              <Layers className="h-4 w-4" /> Line Items
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="gap-2">
              <ArrowUpDown className="h-4 w-4" /> Reconciliation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="line-items" className="space-y-6">
            {/* Line Items Table */}
            <div className="border rounded-xl overflow-hidden bg-card">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-maritime-primary" />
                  <span className="font-semibold text-sm">Cost Comparison</span>
                  <span className="text-xs text-muted-foreground">({items.length} items)</span>
                </div>
                {!isApproved && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2 h-7 text-xs" onClick={addItem} data-testid="button-add-line-item">
                      <Plus className="h-3 w-3" /> Add Item
                    </Button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/10">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-[30%]">Description</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Estimated USD</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Actual USD</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Variance USD</th>
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">Var %</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Remarks</th>
                      {!isApproved && <th className="w-8" />}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={isApproved ? 6 : 7} className="px-4 py-8 text-center text-muted-foreground text-xs">
                          No line items. {!isApproved && "Click \"Add Item\" to add cost entries."}
                        </td>
                      </tr>
                    ) : items.map((item, idx) => {
                      const v = item.varianceUsd || 0;
                      const vPct = item.variancePercent || 0;
                      const vClass = v > 0 ? "text-red-600 dark:text-red-400" : v < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground";
                      return (
                        <tr key={item.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors" data-testid={`row-item-${idx}`}>
                          <td className="px-4 py-2">
                            {isApproved ? (
                              <span className="font-medium">{item.description}</span>
                            ) : (
                              <Input
                                className="h-7 text-xs border-0 bg-transparent px-0 focus-visible:ring-1"
                                value={item.description}
                                onChange={e => updateItem(idx, "description", e.target.value)}
                                placeholder="Cost description…"
                                data-testid={`input-desc-${idx}`}
                              />
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {isApproved ? (
                              <span className="font-mono text-xs">{fmtUsd(item.estimatedUsd)}</span>
                            ) : (
                              <Input
                                type="number"
                                className="h-7 text-xs text-right border-0 bg-transparent px-0 focus-visible:ring-1 w-24 ml-auto"
                                value={item.estimatedUsd || ""}
                                onChange={e => updateItem(idx, "estimatedUsd", parseFloat(e.target.value) || 0)}
                                data-testid={`input-est-${idx}`}
                              />
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {isApproved ? (
                              <span className="font-mono text-xs">{fmtUsd(item.actualUsd)}</span>
                            ) : (
                              <Input
                                type="number"
                                className="h-7 text-xs text-right border-0 bg-muted/30 px-2 focus-visible:ring-1 w-24 ml-auto rounded"
                                value={item.actualUsd || ""}
                                onChange={e => updateItem(idx, "actualUsd", parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                data-testid={`input-actual-${idx}`}
                              />
                            )}
                          </td>
                          <td className={`px-4 py-2 text-right font-mono text-xs ${vClass}`}>
                            {v >= 0 ? "+" : ""}{fmtUsd(v)}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`text-xs font-semibold ${vClass}`}>
                              {vPct >= 0 ? "+" : ""}{vPct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {isApproved ? (
                              <span className="text-xs text-muted-foreground">{item.remarks || "—"}</span>
                            ) : (
                              <Input
                                className="h-7 text-xs border-0 bg-transparent px-0 focus-visible:ring-1"
                                value={item.remarks || ""}
                                onChange={e => updateItem(idx, "remarks", e.target.value)}
                                placeholder="Note…"
                                data-testid={`input-remarks-${idx}`}
                              />
                            )}
                          </td>
                          {!isApproved && (
                            <td className="px-2 py-2">
                              <Button
                                variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500"
                                onClick={() => removeItem(idx)}
                                data-testid={`button-remove-item-${idx}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  {items.length > 0 && (
                    <tfoot className="border-t bg-muted/20">
                      <tr>
                        <td className="px-4 py-2.5 text-xs font-bold">TOTAL</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-bold">{fmtUsd(totalEst)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs font-bold">{fmtUsd(totalAct)}</td>
                        <td className={`px-4 py-2.5 text-right font-mono text-xs font-bold ${varUsd > 0 ? "text-red-600" : varUsd < 0 ? "text-emerald-600" : ""}`}>
                          {varUsd >= 0 ? "+" : ""}{fmtUsd(varUsd)}
                        </td>
                        <td className={`px-4 py-2.5 text-center text-xs font-bold ${varUsd > 0 ? "text-red-600" : varUsd < 0 ? "text-emerald-600" : ""}`}>
                          {varPct >= 0 ? "+" : ""}{varPct.toFixed(1)}%
                        </td>
                        <td colSpan={isApproved ? 1 : 2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Notes */}
            <div className="border rounded-xl p-5 bg-card space-y-2">
              <Label className="text-sm font-semibold">Notes / Remarks</Label>
              {isApproved ? (
                <p className="text-sm text-muted-foreground">{fda.notes || "—"}</p>
              ) : (
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={e => { setNotes(e.target.value); setDirty(true); }}
                  placeholder="Internal notes, bank details, or remarks…"
                  className="resize-none"
                  data-testid="textarea-notes"
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="reconciliation" className="space-y-6">
            {isLoadingRecon ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between py-3">
                      <CardTitle className="text-sm font-semibold">Matched FDA Items</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {recon.lineItems?.length || 0} Categories
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b bg-muted/30">
                            <tr>
                              <th className="text-left px-4 py-2 text-xs font-semibold">Category</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold">Estimated</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold">Actual (Linked)</th>
                              <th className="text-right px-4 py-2 text-xs font-semibold">Variance</th>
                              <th className="w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {recon.lineItems?.map((li: any, idx: number) => (
                              <tr key={idx} className="border-b last:border-0 hover:bg-muted/5">
                                <td className="px-4 py-3">
                                  <p className="font-medium text-xs">{li.description}</p>
                                  <p className="text-[10px] text-muted-foreground uppercase">{li.category}</p>
                                  {li.linkedExpenses?.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {li.linkedExpenses.map((exp: any) => (
                                        <div key={exp.id} className="flex items-center gap-2 text-[10px] bg-muted/50 p-1 rounded">
                                          <span className="flex-1 truncate">{exp.description}</span>
                                          <span className="font-mono">{fmtUsd(exp.amountUsd || exp.amount)}</span>
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-4 w-4 text-muted-foreground hover:text-red-500"
                                            onClick={() => unlinkExpenseMutation.mutate(exp.id)}
                                          >
                                            <Minus className="h-2.5 w-2.5" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-xs">{fmtUsd(li.estimated)}</td>
                                <td className="px-4 py-3 text-right font-mono text-xs">{fmtUsd(li.actual)}</td>
                                <td className={`px-4 py-3 text-right font-mono text-xs ${li.variance > 0 ? "text-red-600" : li.variance < 0 ? "text-emerald-600" : ""}`}>
                                  {li.variance > 0 ? "+" : ""}{fmtUsd(li.variance)}
                                </td>
                                <td className="px-4 py-3">
                                  <Select onValueChange={(val) => linkExpenseMutation.mutate({ expenseId: parseInt(val), fdaId: fda.id })}>
                                    <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent hover:bg-muted">
                                      <Plus className="h-3 w-3" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="_" disabled>Link Port Expense...</SelectItem>
                                      {recon.unlinkedExpenses?.filter((e: any) => e.category === li.category).map((e: any) => (
                                        <SelectItem key={e.id} value={e.id.toString()}>
                                          {e.description} ({fmtUsd(e.amountUsd || e.amount)})
                                        </SelectItem>
                                      ))}
                                      {recon.unlinkedExpenses?.filter((e: any) => e.category !== li.category).length > 0 && (
                                        <>
                                          <SelectItem value="_other" disabled className="text-[10px] font-bold">Other Categories</SelectItem>
                                          {recon.unlinkedExpenses?.filter((e: any) => e.category !== li.category).map((e: any) => (
                                            <SelectItem key={e.id} value={e.id.toString()}>
                                              [{e.category}] {e.description} ({fmtUsd(e.amountUsd || e.amount)})
                                            </SelectItem>
                                          ))}
                                        </>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-muted/20 font-bold border-t">
                            <tr>
                              <td className="px-4 py-2 text-xs">TOTAL MATCHED</td>
                              <td className="px-4 py-2 text-right font-mono text-xs">{fmtUsd(recon.totalEstimated)}</td>
                              <td className="px-4 py-2 text-right font-mono text-xs">{fmtUsd(recon.totalActual)}</td>
                              <td className={`px-4 py-2 text-right font-mono text-xs ${recon.totalVariance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                                {recon.totalVariance > 0 ? "+" : ""}{fmtUsd(recon.totalVariance)}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card className="border-amber-200 bg-amber-50/30">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Unlinked Expenses
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {recon.unlinkedExpenses?.length === 0 ? (
                        <div className="text-center py-6">
                          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-20" />
                          <p className="text-xs text-muted-foreground">All expenses linked!</p>
                        </div>
                      ) : (
                        recon.unlinkedExpenses.map((exp: any) => (
                          <div key={exp.id} className="bg-card border rounded-lg p-3 space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-xs">{exp.description}</p>
                                <Badge variant="outline" className="text-[9px] uppercase h-4 px-1">{exp.category}</Badge>
                              </div>
                              <span className="font-mono text-xs font-bold">{fmtUsd(exp.amountUsd || exp.amount)}</span>
                            </div>
                            <div className="flex justify-end gap-2 pt-1 border-t">
                              <Select onValueChange={(val) => {
                                const matchedLi = recon.lineItems.find((li: any) => li.id === val);
                                if (matchedLi) {
                                  linkExpenseMutation.mutate({ expenseId: exp.id, fdaId: fda.id });
                                }
                              }}>
                                <SelectTrigger className="h-7 text-[10px] w-full gap-1">
                                  <LinkIcon className="h-3 w-3" /> Link to FDA
                                </SelectTrigger>
                                <SelectContent>
                                  {recon.lineItems.map((li: any, lIdx: number) => (
                                    <SelectItem key={lIdx} value={li.id || lIdx.toString()}>
                                      {li.description} ({li.category})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Bottom Save button */}
        {!isApproved && dirty && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2" data-testid="button-save-bottom">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
