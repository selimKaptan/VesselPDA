import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { DollarSign, Plus, CheckCircle2, Clock, XCircle, AlertTriangle, FileText, Bell, X, Receipt, Download, FileDown, History, ChevronDown, ChevronUp } from "lucide-react";
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
import { exportToCsv } from "@/lib/export-csv";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

function InvoiceCard({ inv, cfg, StatusIcon, onPayFull, onPartialPayment, onCancel, onRemind, isPaying, isCancelling, isReminding }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: payments = [], isLoading: loadingPayments } = useQuery<any[]>({
    queryKey: [`/api/invoices/${inv.id}/payments`],
    enabled: isOpen,
  });

  const amountPaid = Number(inv.amountPaid || 0);
  const totalAmount = Number(inv.amount);
  const progress = Math.min(100, (amountPaid / totalAmount) * 100);

  return (
    <Card className="overflow-hidden border-muted-foreground/10" data-testid={`invoice-card-${inv.id}`}>
      <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
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
                {CURRENCY_FLAGS[inv.currency]} {inv.currency} {totalAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </span>
              {(() => {
                const badge = getDueDateBadge(inv.dueDate, inv.status);
                return (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.className}`} data-testid={`badge-due-date-${inv.id}`}>
                    {badge.label}
                  </span>
                );
              })()}
              {amountPaid > 0 && (
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400" data-testid={`text-paid-amount-${inv.id}`}>
                  Paid: {CURRENCY_FLAGS[inv.currency]} {amountPaid.toLocaleString()} ({progress.toFixed(0)}%)
                </span>
              )}
            </div>
            {amountPaid > 0 && amountPaid < totalAmount && (
              <div className="mt-2 w-full max-w-[200px]">
                <Progress value={progress} className="h-1" />
              </div>
            )}
            {inv.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{inv.notes}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a href={`/api/invoices/${inv.id}/pdf`} download={`Invoice-${inv.id}.pdf`} data-testid={`button-download-invoice-pdf-${inv.id}`}>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-slate-600 border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900/30" type="button">
              <Download className="w-3 h-3" /> PDF
            </Button>
          </a>
          
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" data-testid={`button-toggle-payments-${inv.id}`}>
                <History className="w-3 h-3" /> History {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>

          {inv.status === "pending" && inv.recipientEmail && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              onClick={onRemind}
              disabled={isReminding}
              data-testid={`button-send-reminder-${inv.id}`}
            >
              <Bell className="w-3 h-3" /> Remind
            </Button>
          )}
          {(inv.status === "pending" || inv.status === "overdue") && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                onClick={onPartialPayment}
                data-testid={`button-partial-payment-${inv.id}`}
              >
                Partial Pay
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950/30"
                onClick={onPayFull}
                disabled={isPaying}
                data-testid={`button-mark-paid-${inv.id}`}
              >
                <CheckCircle2 className="w-3 h-3" /> Full Pay
              </Button>
            </>
          )}
          {inv.status !== "cancelled" && inv.status !== "paid" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              onClick={onCancel}
              disabled={isCancelling}
              data-testid={`button-cancel-invoice-${inv.id}`}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
      
      <Collapsible open={isOpen}>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 border-t border-muted-foreground/5 bg-muted/30">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-3 mb-2">Payment History</h4>
            {loadingPayments ? (
              <div className="space-y-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : payments.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No payments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-muted-foreground/5 last:border-0" data-testid={`payment-row-${p.id}`}>
                    <div className="flex flex-col">
                      <span className="font-medium">{fmtDate(p.paidAt)}</span>
                      <span className="text-[10px] text-muted-foreground">{p.paymentMethod} {p.reference ? `• Ref: ${p.reference}` : ""}</span>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      +{CURRENCY_FLAGS[p.currency] || ""} {Number(p.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs pt-1 font-bold">
                  <span>Total Paid</span>
                  <span>{CURRENCY_FLAGS[inv.currency]} {amountPaid.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                  <span>Remaining Balance</span>
                  <span>{CURRENCY_FLAGS[inv.currency]} {(totalAmount - amountPaid).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function Invoices() {
  const { toast } = useToast();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const fdaIdParam = params.get("fdaId");
  const fdaId = fdaIdParam ? parseInt(fdaIdParam) : null;
  const statusParam = params.get("status");

  const [statusFilter, setStatusFilter] = useState(statusParam || "all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState<number | null>(null);
  const [fdaBannerDismissed, setFdaBannerDismissed] = useState(false);
  const preFilledRef = useRef(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "bank_transfer",
    reference: "",
    notes: "",
    paidAt: new Date().toISOString().split('T')[0]
  });
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

  useEffect(() => {
    if (statusParam) {
      setStatusFilter(statusParam);
    }
  }, [statusParam]);

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
    mutationFn: async ({ id, data }: { id: number, data?: any }) => {
      const res = await apiRequest("PATCH", `/api/invoices/${id}/pay`, data || { paidAt: new Date().toISOString() });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setShowPaymentDialog(null);
      setPaymentForm({
        amount: "",
        paymentMethod: "bank_transfer",
        reference: "",
        notes: "",
        paidAt: new Date().toISOString().split('T')[0]
      });
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const rows = filtered.map(inv => ({
                ID: inv.id,
                Title: inv.title,
                Type: TYPE_LABELS[inv.invoiceType] || inv.invoiceType,
                Amount: inv.amount,
                Currency: inv.currency,
                Status: inv.status,
                'Due Date': inv.dueDate ? fmtDate(inv.dueDate) : '',
                'Paid At': inv.paidAt ? fmtDate(inv.paidAt) : '',
                Recipient: inv.recipientEmail || inv.recipientName || '',
                Voyage: inv.vesselName || inv.voyageId || ''
              }));
              exportToCsv(`Invoices-${new Date().toISOString().split('T')[0]}.csv`, rows);
            }}
            data-testid="button-export-invoices-csv"
            className="gap-2"
          >
            <FileDown className="w-4 h-4" /> Export CSV
          </Button>
          <Button onClick={() => setShowNew(true)} data-testid="button-new-invoice" className="gap-2">
            <Plus className="w-4 h-4" /> New Invoice
          </Button>
        </div>
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
              <InvoiceCard
                key={inv.id}
                inv={inv}
                cfg={cfg}
                StatusIcon={StatusIcon}
                onPayFull={() => payMutation.mutate({ id: inv.id })}
                onPartialPayment={() => {
                  setPaymentForm({ ...paymentForm, amount: String(Number(inv.balance || inv.amount)) });
                  setShowPaymentDialog(inv.id);
                }}
                onCancel={() => cancelMutation.mutate(inv.id)}
                onRemind={() => reminderMutation.mutate(inv.id)}
                isPaying={payMutation.isPending}
                isCancelling={cancelMutation.isPending}
                isReminding={reminderMutation.isPending}
              />
            );
          })}
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog !== null} onOpenChange={(open) => !open && setShowPaymentDialog(null)}>
        <DialogContent className="max-w-md" data-testid="dialog-partial-payment">
          <DialogHeader>
            <DialogTitle className="font-serif">Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Amount *</Label>
              <Input
                type="number"
                value={paymentForm.amount}
                onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                data-testid="input-payment-amount"
              />
              <p className="text-[10px] text-muted-foreground">
                Remaining balance: {showPaymentDialog && (() => {
                  const inv = invoices.find((i: any) => i.id === showPaymentDialog);
                  return inv ? `${CURRENCY_FLAGS[inv.currency] || ""} ${Number(inv.balance || inv.amount).toLocaleString()}` : "";
                })()}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={paymentForm.paymentMethod} onValueChange={v => setPaymentForm(f => ({ ...f, paymentMethod: v }))}>
                <SelectTrigger data-testid="select-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Paid Date</Label>
              <Input
                type="date"
                value={paymentForm.paidAt}
                onChange={e => setPaymentForm(f => ({ ...f, paidAt: e.target.value }))}
                data-testid="input-payment-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reference (Optional)</Label>
              <Input
                value={paymentForm.reference}
                onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))}
                placeholder="Bank reference number"
                data-testid="input-payment-reference"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (Optional)</Label>
              <Textarea
                value={paymentForm.notes}
                onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Internal payment notes"
                className="h-20"
                data-testid="textarea-payment-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(null)}>Cancel</Button>
            <Button
              onClick={() => showPaymentDialog && payMutation.mutate({ id: showPaymentDialog, data: paymentForm })}
              disabled={payMutation.isPending || !paymentForm.amount}
              data-testid="button-confirm-payment"
            >
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
