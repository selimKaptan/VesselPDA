import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { DollarSign, Plus, CheckCircle2, Clock, XCircle, AlertTriangle, FileText, Bell, X, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { isPast } from "date-fns";
import { EmptyState } from "@/components/empty-state";
import { fmtDate } from "@/lib/formatDate";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending:   { label: "Pending",   color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",  icon: Clock },
  paid:      { label: "Paid",      color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",  icon: CheckCircle2 },
  overdue:   { label: "Overdue",   color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",         icon: AlertTriangle },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",        icon: XCircle },
};

const TYPE_LABELS: Record<string, string> = {
  proforma_da:      "Proforma DA",
  final_da:         "Final DA",
  invoice:          "Invoice",
  fda_disbursement: "FDA Disbursement",
};

const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  TRY: "🇹🇷",
};

function getDueDateBadge(dueDateStr: string | null, status: string): { label: string; className: string } {
  if (status === "paid") return { label: "PAID", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" };
  if (status === "cancelled") return { label: "Cancelled", className: "bg-muted text-muted-foreground" };
  if (!dueDateStr) return { label: "No due date", className: "bg-muted text-muted-foreground" };
  const due = new Date(dueDateStr);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (isPast(due)) {
    return { label: `OVERDUE — ${Math.abs(diffDays)}d`, className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  }
  if (diffDays <= 3) {
    return { label: `Due in ${diffDays}d`, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  }
  if (diffDays <= 7) {
    return { label: `Due ${fmtDate(due)}`, className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
  }
  return { label: `Due ${fmtDate(due)}`, className: "bg-muted text-muted-foreground" };
}

export default function Invoices() {
  const { toast } = useToast();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const fdaIdParam = params.get("fdaId");
  const fdaId = fdaIdParam ? parseInt(fdaIdParam) : null;

  const [statusFilter, setStatusFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [fdaBannerDismissed, setFdaBannerDismissed] = useState(false);
  const preFilledRef = useRef(false);
  const [form, setForm] = useState({
    title: "",
    invoiceType: "invoice",
    amount: "",
    currency: "USD",
    dueDate: "",
    notes: "",
    voyageId: "",
    fdaId: "",
    vesselName: "",
    portName: "",
    recipientName: "",
    recipientEmail: "",
  });

  const { data: invoices = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: voyages = [] } = useQuery<any[]>({
    queryKey: ["/api/voyages"],
  });

  const { data: linkedFda } = useQuery<any>({
    queryKey: ["/api/fda", fdaId],
    queryFn: () => fetch(`/api/fda/${fdaId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!fdaId,
  });

  // Pre-fill form when FDA is loaded from URL param — only once per mount
  useEffect(() => {
    if (linkedFda && !linkedFda.error && fdaId && !preFilledRef.current) {
      preFilledRef.current = true;
      setForm(f => ({
        ...f,
        title: `Final Disbursement — ${linkedFda.vesselName || ""}${linkedFda.portName ? " / " + linkedFda.portName : ""}`,
        amount: String(Math.round((linkedFda.totalActualUsd || 0) * 100) / 100),
        invoiceType: "fda_disbursement",
        voyageId: linkedFda.voyageId ? String(linkedFda.voyageId) : "",
        fdaId: String(fdaId),
        vesselName: linkedFda.vesselName || "",
        portName: linkedFda.portName || "",
      }));
      setShowNew(true);
    }
  }, [linkedFda, fdaId]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/invoices", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setShowNew(false);
      setForm({ title: "", invoiceType: "invoice", amount: "", currency: "USD", dueDate: "", notes: "", voyageId: "", fdaId: "", vesselName: "", portName: "", recipientName: "", recipientEmail: "" });
      toast({ title: "Invoice created" });
    },
    onError: () => toast({ title: "Error", description: "Could not create invoice", variant: "destructive" }),
  });

  const payMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/invoices/${id}/pay`, { paidAt: new Date().toISOString() });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Payment recorded" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/invoices/${id}/cancel`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice cancelled" });
    },
  });

  const reminderMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/invoices/${id}/send-reminder`, {});
      return res.json();
    },
    onSuccess: (_, id) => {
      toast({ title: "Reminder sent", description: "Payment reminder email dispatched." });
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Could not send reminder", variant: "destructive" }),
  });

  const filtered = invoices.filter((inv: any) => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (currencyFilter !== "all" && inv.currency !== currencyFilter) return false;
    if (search && !inv.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pending = invoices.filter((i: any) => i.status === "pending");
  const paid = invoices.filter((i: any) => i.status === "paid");
  const overdue = invoices.filter((i: any) => i.status === "overdue");

  const sumUsd = (list: any[]) => list.reduce((acc, i) => acc + (i.currency === "USD" ? i.amount : 0), 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6" data-testid="page-invoices">
      <PageMeta title="Financial Flow | VesselPDA" />

      {/* FDA Linked Banner */}
      {fdaId && linkedFda && !linkedFda.error && !fdaBannerDismissed && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800" data-testid="banner-fda-linked-invoice">
          <Receipt className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              Creating invoice for FDA{" "}
              <span className="font-bold">{linkedFda.referenceNumber || `#${fdaId}`}</span>
              {linkedFda.vesselName && ` — ${linkedFda.vesselName}`}
            </span>
          </div>
          <button
            onClick={() => setFdaBannerDismissed(true)}
            className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 flex-shrink-0"
            data-testid="button-dismiss-fda-banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Financial Flow</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Invoice and payment tracking</p>
        </div>
        <Button onClick={() => setShowNew(true)} data-testid="button-new-invoice" className="gap-2">
          <Plus className="w-4 h-4" /> New Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-lg font-bold">{pending.length} invoice(s)</p>
            {sumUsd(pending) > 0 && <p className="text-xs text-muted-foreground">${sumUsd(pending).toLocaleString()} USD</p>}
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-lg font-bold">{paid.length} invoice(s)</p>
            {sumUsd(paid) > 0 && <p className="text-xs text-muted-foreground">${sumUsd(paid).toLocaleString()} USD</p>}
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="text-lg font-bold">{overdue.length} invoice(s)</p>
            {sumUsd(overdue) > 0 && <p className="text-xs text-muted-foreground">${sumUsd(overdue).toLocaleString()} USD</p>}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 flex-wrap">
          {["all", "pending", "paid", "overdue", "cancelled"].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                statusFilter === s
                  ? "bg-[hsl(var(--maritime-primary))] text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              data-testid={`filter-status-${s}`}
            >
              {s === "all" ? "All" : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {["all", "USD", "EUR", "TRY"].map(c => (
            <button
              key={c}
              onClick={() => setCurrencyFilter(c)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                currencyFilter === c
                  ? "bg-[hsl(var(--maritime-primary))] text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              data-testid={`filter-currency-${c}`}
            >
              {c === "all" ? "All Currencies" : `${CURRENCY_FLAGS[c]} ${c}`}
            </button>
          ))}
        </div>
        <Input
          placeholder="Search invoices..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs h-8 text-sm"
          data-testid="input-search-invoices"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="💳"
          title="No Invoices"
          description="Invoices are created from approved FDAs or manually for port services."
          actionLabel="View FDAs"
          actionHref="/fda"
          secondaryLabel="Create Manual Invoice"
          onAction={() => setShowNew(true)}
          tips={[
            "Approved Proforma DAs can be converted to invoices",
            "Track payment status and overdue amounts here",
            "Export invoices as PDF for your clients"
          ]}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((inv: any) => {
            const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            return (
              <Card key={inv.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4" data-testid={`invoice-card-${inv.id}`}>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate">{inv.title}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/30">
                        {TYPE_LABELS[inv.invoiceType] || inv.invoiceType}
                      </Badge>
                      <Badge className={`text-[10px] px-1.5 py-0 ${cfg.color} border-0`} data-testid={`badge-invoice-status-${inv.id}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {cfg.label}
                      </Badge>
                      {inv.fdaId && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400" data-testid={`badge-fda-link-${inv.id}`}>
                          FDA #{inv.fdaId}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-base font-bold">
                        {CURRENCY_FLAGS[inv.currency]} {inv.currency} {Number(inv.amount).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                      </span>
                      {(() => {
                        const badge = getDueDateBadge(inv.dueDate, inv.status);
                        return (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.className}`} data-testid={`badge-due-date-${inv.id}`}>
                            {badge.label}
                          </span>
                        );
                      })()}
                      {inv.recipientEmail && (
                        <span className="text-[10px] text-muted-foreground">📧 {inv.recipientEmail}</span>
                      )}
                    </div>
                    {inv.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{inv.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {inv.status === "pending" && inv.recipientEmail && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      onClick={() => reminderMutation.mutate(inv.id)}
                      disabled={reminderMutation.isPending}
                      data-testid={`button-send-reminder-${inv.id}`}
                    >
                      <Bell className="w-3 h-3" /> Remind
                    </Button>
                  )}
                  {(inv.status === "pending" || inv.status === "overdue") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950/30"
                      onClick={() => payMutation.mutate(inv.id)}
                      disabled={payMutation.isPending}
                      data-testid={`button-mark-paid-${inv.id}`}
                    >
                      <CheckCircle2 className="w-3 h-3" /> Mark Paid
                    </Button>
                  )}
                  {inv.status !== "cancelled" && inv.status !== "paid" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => cancelMutation.mutate(inv.id)}
                      disabled={cancelMutation.isPending}
                      data-testid={`button-cancel-invoice-${inv.id}`}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Invoice Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg" data-testid="dialog-new-invoice">
          <DialogHeader>
            <DialogTitle className="font-serif">New Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Invoice title"
                data-testid="input-invoice-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.invoiceType} onValueChange={v => setForm(f => ({ ...f, invoiceType: v }))}>
                  <SelectTrigger data-testid="select-invoice-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="proforma_da">Proforma DA</SelectItem>
                    <SelectItem value="final_da">Final DA</SelectItem>
                    <SelectItem value="fda_disbursement">FDA Disbursement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger data-testid="select-invoice-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">🇺🇸 USD</SelectItem>
                    <SelectItem value="EUR">🇪🇺 EUR</SelectItem>
                    <SelectItem value="TRY">🇹🇷 TRY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Amount *</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                data-testid="input-invoice-amount"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                data-testid="input-invoice-due-date"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Recipient Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  value={form.recipientName}
                  onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))}
                  placeholder="e.g. John Smith"
                  data-testid="input-invoice-recipient-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Recipient Email <span className="text-muted-foreground text-xs">(reminders)</span></Label>
                <Input
                  type="email"
                  value={form.recipientEmail}
                  onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))}
                  placeholder="e.g. john@example.com"
                  data-testid="input-invoice-recipient-email"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Linked Voyage</Label>
              <Select value={form.voyageId} onValueChange={v => setForm(f => ({ ...f, voyageId: v }))}>
                <SelectTrigger data-testid="select-invoice-voyage">
                  <SelectValue placeholder="Select voyage (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No voyage</SelectItem>
                  {Array.isArray(voyages) && voyages.map((v: any) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.vesselName} — {v.portName || v.portId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional information..."
                rows={3}
                data-testid="input-invoice-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({
                title: form.title,
                invoiceType: form.invoiceType,
                amount: parseFloat(form.amount) || 0,
                currency: form.currency,
                dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
                notes: form.notes || null,
                voyageId: form.voyageId && form.voyageId !== "none" ? parseInt(form.voyageId) : null,
                fdaId: form.fdaId ? parseInt(form.fdaId) : null,
                vesselName: form.vesselName || null,
                portName: form.portName || null,
                recipientEmail: form.recipientEmail || null,
                recipientName: form.recipientName || null,
              })}
              disabled={createMutation.isPending || !form.title.trim() || !form.amount}
              data-testid="button-submit-invoice"
            >
              {createMutation.isPending ? "Creating..." : "Create Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
