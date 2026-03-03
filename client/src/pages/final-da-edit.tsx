import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { PageMeta } from "@/components/page-meta";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft, Save, Loader2, TrendingUp, TrendingDown, Minus,
  FileText, CheckCircle2, Send, DollarSign, Download, BarChart3,
  Ship, MapPin, Calendar, Plus, Trash2, AlertTriangle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts";
import jsPDF from "jspdf";

const STATUS_ORDER = ["draft", "final", "sent", "paid"] as const;
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; next?: string }> = {
  draft:  { label: "Draft",  color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: FileText, next: "final" },
  final:  { label: "Final",  color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: CheckCircle2, next: "sent" },
  sent:   { label: "Sent",   color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: Send, next: "paid" },
  paid:   { label: "Paid",   color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: DollarSign },
};

interface LineItem {
  description: string;
  proformaAmount: number;
  actualAmount: number;
  difference: number;
  notes: string;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function VarianceCell({ diff, pct }: { diff: number; pct?: number }) {
  if (Math.abs(diff) < 0.005) return <span className="text-gray-400 text-xs">—</span>;
  const isOver = diff > 0;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${isOver ? "text-red-600" : "text-green-600"}`}>
      {isOver ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isOver ? "+" : ""}${fmt(diff)}
    </span>
  );
}

export default function FinalDaEditPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isNew = id === "new";

  const { data: fda, isLoading } = useQuery<any>({
    queryKey: ["/api/final-da", id],
    queryFn: async () => {
      if (isNew) return null;
      const res = await fetch(`/api/final-da/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !isNew,
  });

  const { data: varianceReport } = useQuery<any>({
    queryKey: ["/api/final-da", id, "variance"],
    queryFn: async () => {
      const res = await fetch(`/api/final-da/${id}/variance-report`);
      return res.json();
    },
    enabled: !isNew && !!id,
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [toCompany, setToCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [bankDetails, setBankDetails] = useState({ bankName: "", swiftCode: "", usdIban: "", beneficiary: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (fda) {
      setLineItems((fda.line_items || []).map((item: any) => ({
        description: item.description || "",
        proformaAmount: parseFloat(item.proformaAmount) || 0,
        actualAmount: parseFloat(item.actualAmount) || 0,
        difference: (parseFloat(item.actualAmount) || 0) - (parseFloat(item.proformaAmount) || 0),
        notes: item.notes || "",
      })));
      setToCompany(fda.to_company || "");
      setNotes(fda.notes || "");
      setCurrency(fda.currency || "USD");
      if (fda.bank_details) setBankDetails(fda.bank_details);
    }
  }, [fda]);

  const updateMutation = useMutation({
    mutationFn: (body: any) => apiRequest("PATCH", `/api/final-da/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/final-da", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/final-da"] });
      queryClient.invalidateQueries({ queryKey: ["/api/final-da", id, "variance"] });
      toast({ title: "Final DA saved" });
    },
    onError: () => toast({ title: "Error", description: "Failed to save", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/final-da/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/final-da", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/final-da"] });
      toast({ title: "Status updated" });
    },
  });

  function updateItem(idx: number, field: keyof LineItem, value: string | number) {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      updated.difference = (parseFloat(String(updated.actualAmount)) || 0) - (parseFloat(String(updated.proformaAmount)) || 0);
      return updated;
    }));
  }

  function addItem() {
    setLineItems(prev => [...prev, { description: "", proformaAmount: 0, actualAmount: 0, difference: 0, notes: "" }]);
  }

  function removeItem(idx: number) {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateMutation.mutateAsync({ lineItems, toCompany, notes, currency, bankDetails });
    } finally {
      setSaving(false);
    }
  }

  function exportPdf() {
    if (!fda) return;
    const doc = new jsPDF();
    const margin = 14;
    let y = 20;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("FINAL DISBURSEMENT ACCOUNT", 105, y, { align: "center" });
    y += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Reference: ${fda.reference_number}`, margin, y); y += 6;
    if (fda.vessel_name) { doc.text(`Vessel: ${fda.vessel_name}`, margin, y); y += 6; }
    doc.text(`Port: ${fda.port_name}`, margin, y); y += 6;
    if (toCompany) { doc.text(`To: ${toCompany}`, margin, y); y += 6; }
    doc.text(`Currency: ${currency}`, margin, y); y += 10;

    doc.setLineWidth(0.3);
    doc.line(margin, y, 200, y); y += 6;

    doc.setFont("helvetica", "bold");
    const cols = [margin, margin + 70, margin + 100, margin + 130, margin + 165];
    doc.text("Description", cols[0], y);
    doc.text("Proforma", cols[1], y);
    doc.text("Actual", cols[2], y);
    doc.text("Difference", cols[3], y);
    doc.text("Notes", cols[4], y);
    y += 4;
    doc.line(margin, y, 200, y); y += 5;

    doc.setFont("helvetica", "normal");
    lineItems.forEach((item) => {
      if (y > 265) { doc.addPage(); y = 20; }
      const descLines = doc.splitTextToSize(item.description, 65);
      doc.text(descLines, cols[0], y);
      doc.text(`$${fmt(item.proformaAmount)}`, cols[1], y);
      doc.text(`$${fmt(item.actualAmount)}`, cols[2], y);
      const diff = item.difference;
      doc.text(`${diff >= 0 ? "+" : ""}$${fmt(diff)}`, cols[3], y);
      if (item.notes) doc.text(item.notes.substring(0, 20), cols[4], y);
      y += descLines.length * 5 + 2;
    });

    y += 5;
    doc.line(margin, y, 200, y); y += 5;
    doc.setFont("helvetica", "bold");
    const totActual = lineItems.reduce((s, i) => s + i.actualAmount, 0);
    const totPf = lineItems.reduce((s, i) => s + i.proformaAmount, 0);
    const totDiff = totActual - totPf;
    doc.text("TOTAL (Proforma):", cols[0], y); doc.text(`$${fmt(totPf)}`, cols[1], y); y += 5;
    doc.text("TOTAL (Actual):", cols[0], y); doc.text(`$${fmt(totActual)}`, cols[2], y); y += 5;
    doc.text("TOTAL VARIANCE:", cols[0], y); doc.text(`${totDiff >= 0 ? "+" : ""}$${fmt(totDiff)}`, cols[3], y); y += 12;

    if (bankDetails.bankName) {
      doc.setFont("helvetica", "bold"); doc.text("BANK DETAILS", margin, y); y += 5;
      doc.setFont("helvetica", "normal");
      if (bankDetails.beneficiary) { doc.text(`Beneficiary: ${bankDetails.beneficiary}`, margin, y); y += 5; }
      if (bankDetails.bankName) { doc.text(`Bank: ${bankDetails.bankName}`, margin, y); y += 5; }
      if (bankDetails.swiftCode) { doc.text(`SWIFT: ${bankDetails.swiftCode}`, margin, y); y += 5; }
      if (bankDetails.usdIban) { doc.text(`IBAN: ${bankDetails.usdIban}`, margin, y); y += 5; }
      y += 5;
    }

    y += 10;
    doc.line(margin, y, 85, y); doc.line(120, y, 195, y);
    y += 5;
    doc.text("Ship Agent", margin, y); doc.text("Master / Owner", 120, y);

    doc.save(`${fda.reference_number}.pdf`);
    toast({ title: "FDA PDF exported" });
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
  );

  const status = fda?.status || "draft";
  const scfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const SIcon = scfg.icon;
  const nextStatus = scfg.next;
  const nextCfg = nextStatus ? STATUS_CONFIG[nextStatus] : null;
  const NextIcon = nextCfg?.icon;

  const totalProforma = lineItems.reduce((s, i) => s + (parseFloat(String(i.proformaAmount)) || 0), 0);
  const totalActual = lineItems.reduce((s, i) => s + (parseFloat(String(i.actualAmount)) || 0), 0);
  const totalVariance = totalActual - totalProforma;
  const variancePct = totalProforma !== 0 ? (totalVariance / totalProforma) * 100 : 0;

  const chartData = lineItems.slice(0, 12).map(item => ({
    name: item.description.length > 18 ? item.description.substring(0, 18) + "…" : item.description,
    "Proforma": parseFloat(String(item.proformaAmount)) || 0,
    "Actual": parseFloat(String(item.actualAmount)) || 0,
  }));

  const topVariance = [...lineItems]
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
    .slice(0, 3)
    .filter(i => Math.abs(i.difference) > 0.01);

  return (
    <div className="space-y-6">
      <PageMeta
        title={`${fda?.reference_number || "New"} Final DA | VesselPDA`}
        description="Final Disbursement Account editor"
      />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/final-da">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif text-xl font-bold">{fda?.reference_number || "New Final DA"}</h1>
              <Badge className={`text-[10px] gap-1 border-0 ${scfg.color}`}>
                <SIcon className="w-2.5 h-2.5" />{scfg.label}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
              {fda?.vessel_name && <span className="flex items-center gap-1"><Ship className="w-3 h-3" />{fda.vessel_name}</span>}
              {fda?.port_name && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{fda.port_name}</span>}
              {fda?.proforma_ref && <span className="font-mono">Proforma: {fda.proforma_ref}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {nextStatus && nextCfg && NextIcon && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs"
              onClick={() => statusMutation.mutate(nextStatus)}
              disabled={statusMutation.isPending}
              data-testid={`button-status-${nextStatus}`}
            >
              <NextIcon className="w-3.5 h-3.5" /> Mark as {nextCfg.label}
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportPdf} data-testid="button-fda-pdf">
            <Download className="w-3.5 h-3.5" /> PDF
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={handleSave} disabled={saving} data-testid="button-save-fda">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </Button>
        </div>
      </div>

      {/* Variance summary */}
      {lineItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Proforma Total", value: `$${fmt(totalProforma)}`, color: "" },
            { label: "Actual Total", value: `$${fmt(totalActual)}`, color: "" },
            {
              label: "Total Variance",
              value: `${totalVariance >= 0 ? "+" : ""}$${fmt(totalVariance)}`,
              color: totalVariance > 0 ? "text-red-600" : totalVariance < 0 ? "text-green-600" : "",
            },
            {
              label: "Variance %",
              value: `${variancePct >= 0 ? "+" : ""}${variancePct.toFixed(1)}%`,
              color: variancePct > 0 ? "text-red-600" : variancePct < 0 ? "text-green-600" : "",
            },
          ].map(({ label, value, color }) => (
            <Card key={label} className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items" data-testid="tab-fda-items"><FileText className="w-3.5 h-3.5 mr-1.5" />Line Items</TabsTrigger>
          <TabsTrigger value="variance" data-testid="tab-fda-variance"><BarChart3 className="w-3.5 h-3.5 mr-1.5" />Variance Report</TabsTrigger>
          <TabsTrigger value="details" data-testid="tab-fda-details"><DollarSign className="w-3.5 h-3.5 mr-1.5" />Details & Bank</TabsTrigger>
        </TabsList>

        {/* Line Items Tab */}
        <TabsContent value="items" className="mt-4">
          <Card>
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">Line Items</h2>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={addItem} data-testid="button-add-line-item">
                <Plus className="w-3 h-3" /> Add Item
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Description</TableHead>
                    <TableHead className="text-right w-32">Proforma (USD)</TableHead>
                    <TableHead className="text-right w-32">Actual (USD)</TableHead>
                    <TableHead className="w-36">Difference</TableHead>
                    <TableHead className="w-28">Diff %</TableHead>
                    <TableHead className="min-w-[140px]">Notes</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item, idx) => {
                    const pct = item.proformaAmount !== 0 ? (item.difference / item.proformaAmount) * 100 : 0;
                    return (
                      <TableRow key={idx} data-testid={`row-line-item-${idx}`}>
                        <TableCell>
                          <Input
                            value={item.description}
                            onChange={e => updateItem(idx, "description", e.target.value)}
                            className="h-7 text-xs border-0 shadow-none px-0 focus-visible:ring-0"
                            placeholder="Description..."
                            data-testid={`input-item-desc-${idx}`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={item.proformaAmount || ""}
                            onChange={e => updateItem(idx, "proformaAmount", parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs text-right border-0 shadow-none px-0 focus-visible:ring-0 text-muted-foreground"
                            placeholder="0.00"
                            data-testid={`input-item-proforma-${idx}`}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={item.actualAmount || ""}
                            onChange={e => updateItem(idx, "actualAmount", parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs text-right border-0 shadow-none px-0 focus-visible:ring-0 font-medium"
                            placeholder="0.00"
                            data-testid={`input-item-actual-${idx}`}
                          />
                        </TableCell>
                        <TableCell><VarianceCell diff={item.difference} /></TableCell>
                        <TableCell>
                          <span className={`text-xs ${pct > 0 ? "text-red-500" : pct < 0 ? "text-green-500" : "text-gray-400"}`}>
                            {Math.abs(pct) > 0.01 ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%` : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.notes}
                            onChange={e => updateItem(idx, "notes", e.target.value)}
                            className="h-7 text-xs border-0 shadow-none px-0 focus-visible:ring-0"
                            placeholder="Note..."
                            data-testid={`input-item-notes-${idx}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeItem(idx)} data-testid={`button-remove-item-${idx}`}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Totals row */}
            {lineItems.length > 0 && (
              <div className="p-4 border-t bg-muted/30">
                <div className="flex items-center justify-end gap-8">
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Proforma Total</p>
                    <p className="text-sm font-semibold text-muted-foreground">${fmt(totalProforma)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Actual Total</p>
                    <p className="text-sm font-bold">${fmt(totalActual)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Variance</p>
                    <p className={`text-sm font-bold ${totalVariance > 0 ? "text-red-600" : totalVariance < 0 ? "text-green-600" : "text-gray-500"}`}>
                      {totalVariance >= 0 ? "+" : ""}${fmt(totalVariance)}
                      {totalProforma !== 0 && <span className="text-xs ml-1">({variancePct >= 0 ? "+" : ""}{variancePct.toFixed(1)}%)</span>}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {lineItems.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No line items yet. Click "Add Item" to start.
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Variance Report Tab */}
        <TabsContent value="variance" className="mt-4 space-y-4">
          {lineItems.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Add line items to see the variance report.</p>
            </Card>
          ) : (
            <>
              {/* Top variance items */}
              {topVariance.length > 0 && (
                <Card className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <h3 className="text-sm font-semibold">Top Variance Items</h3>
                  </div>
                  <div className="space-y-2">
                    {topVariance.map((item, idx) => (
                      <div key={idx} className={`flex items-center justify-between p-2 rounded-md ${item.difference > 0 ? "bg-red-50 dark:bg-red-900/10" : "bg-green-50 dark:bg-green-900/10"}`}>
                        <span className="text-sm font-medium">{item.description}</span>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">PDA: ${fmt(item.proformaAmount)}</span>
                          <span className="font-medium">FDA: ${fmt(item.actualAmount)}</span>
                          <VarianceCell diff={item.difference} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Bar chart */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-4">Proforma vs Actual by Line Item</h3>
                <div style={{ height: Math.max(200, chartData.length * 40) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={v => `$${(v/1000).toFixed(0)}k`} fontSize={10} />
                      <YAxis type="category" dataKey="name" width={140} fontSize={10} />
                      <Tooltip
                        formatter={(v: number) => [`$${fmt(v)}`, undefined]}
                        labelFormatter={(l) => l}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Proforma" fill="hsl(215 70% 60%)" radius={[0, 3, 3, 0]} />
                      <Bar dataKey="Actual" radius={[0, 3, 3, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry["Actual"] > entry["Proforma"] ? "hsl(0 72% 60%)" : "hsl(142 72% 45%)"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Details & Bank Tab */}
        <TabsContent value="details" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4 space-y-4">
              <h3 className="text-sm font-semibold">General Details</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">To Company</Label>
                  <Input value={toCompany} onChange={e => setToCompany(e.target.value)} placeholder="Company name..." data-testid="input-fda-to-company" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency</Label>
                  <Input value={currency} onChange={e => setCurrency(e.target.value)} placeholder="USD" data-testid="input-fda-currency" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." className="min-h-[80px] text-sm" data-testid="textarea-fda-notes" />
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Change Status</h4>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_ORDER.map(s => {
                    const cfg = STATUS_CONFIG[s];
                    const CIcon = cfg.icon;
                    return (
                      <Button
                        key={s}
                        variant={status === s ? "default" : "outline"}
                        size="sm"
                        className={`text-xs gap-1.5 h-7 ${status === s ? "" : ""}`}
                        onClick={() => statusMutation.mutate(s)}
                        disabled={statusMutation.isPending || status === s}
                        data-testid={`button-set-status-${s}`}
                      >
                        <CIcon className="w-3 h-3" />{cfg.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-4">
              <h3 className="text-sm font-semibold">Bank Details</h3>
              <div className="space-y-3">
                {[
                  { label: "Beneficiary", key: "beneficiary", placeholder: "Account holder..." },
                  { label: "Bank Name", key: "bankName", placeholder: "Bank..." },
                  { label: "SWIFT Code", key: "swiftCode", placeholder: "XXXXXXXX..." },
                  { label: "USD IBAN", key: "usdIban", placeholder: "TRXX XXXX..." },
                ].map(({ label, key, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      value={(bankDetails as any)[key] || ""}
                      onChange={e => setBankDetails(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      data-testid={`input-bank-${key}`}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
