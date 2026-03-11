import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { DollarSign, Plus, CheckCircle2, Clock, XCircle, AlertTriangle, FileText, Bell, X, Receipt, Download, FileDown, History, ChevronDown, ChevronUp, Check, Eye, Edit, Send, Search as SearchIcon, Filter, Calendar as CalendarIcon, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { isPast, format } from "date-fns";
import { EmptyState } from "@/components/empty-state";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { SmartMailComposer } from "@/components/smart-mail-composer";
import { fmtDate } from "@/lib/formatDate";
import { exportToCsv } from "@/lib/export-csv";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FloatingBulkActionBar } from "@/components/layout/floating-bulk-action-bar";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending:   { label: "Pending",   color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",  icon: Clock },
  paid:      { label: "Paid",      color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",  icon: CheckCircle2 },
  overdue:   { label: "Overdue",   color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",         icon: AlertTriangle },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",        icon: XCircle },
  provider_review: { label: "Review Required", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: Eye },
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

function InvoiceCard({ inv, cfg, StatusIcon, onPayFull, onPartialPayment, onCancel, onRemind, onReview, onEmail, isPaying, isCancelling, isReminding, isSelected, onSelect }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: payments = [], isLoading: loadingPayments } = useQuery<any[]>({
    queryKey: [`/api/invoices/${inv.id}/payments`],
    enabled: isOpen,
  });

  const amountPaid = Number(inv.amountPaid || 0);
  const totalAmount = Number(inv.amount);
  const progress = Math.min(100, (amountPaid / totalAmount) * 100);

  return (
    <Card className={`overflow-hidden border-muted-foreground/10 group relative transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`} data-testid={`invoice-card-${inv.id}`}>
      {/* Checkbox Overlay */}
      <div className={`absolute top-3 left-3 z-10 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <Checkbox 
          checked={isSelected} 
          onCheckedChange={() => onSelect(inv.id)} 
          className="h-5 w-5 bg-background shadow-sm border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          data-testid={`checkbox-invoice-${inv.id}`}
        />
      </div>

      <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0 ml-8 sm:ml-7">
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
          {inv.status === "provider_review" ? (
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => onReview(inv)}
              data-testid={`button-review-invoice-${inv.id}`}
            >
              <Edit className="w-3 h-3" /> Review & Approve
            </Button>
          ) : (
            <>
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

              {onEmail && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 text-sky-600 border-sky-200 hover:bg-sky-50 dark:hover:bg-sky-950/30"
                  onClick={() => onEmail(inv)}
                  data-testid={`button-email-invoice-${inv.id}`}
                >
                  <Mail className="w-3 h-3" /> Email
                </Button>
              )}

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
  const { user } = useAuth();
  const { toast } = useToast();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const fdaIdParam = params.get("fdaId");
  const fdaId = fdaIdParam ? parseInt(fdaIdParam) : null;
  const statusParam = params.get("status");

  const [activeTab, setActiveTab] = useState("all_invoices");
  const [statusFilter, setStatusFilter] = useState(statusParam || "all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState<number | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState<any>(null);
  const [fdaBannerDismissed, setFdaBannerDismissed] = useState(false);
  const preFilledRef = useRef(false);

  // Statement Filters
  const [statementCounterparty, setStatementCounterparty] = useState("");
  const [statementFromDate, setStatementFromDate] = useState("");
  const [statementToDate, setStatementToDate] = useState("");

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

  const [reviewForm, setReviewForm] = useState({
    amount: "",
    notes: ""
  });

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [emailEntity, setEmailEntity] = useState<{ type: string; id: number; inv: any } | null>(null);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const { data: statementInvoices = [], isLoading: isLoadingStatement } = useQuery<any[]>({
    queryKey: ["/api/invoices/statement", statementCounterparty, statementFromDate, statementToDate],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (statementCounterparty) q.append("counterparty", statementCounterparty);
      if (statementFromDate) q.append("from", statementFromDate);
      if (statementToDate) q.append("to", statementToDate);
      const res = await fetch(`/api/invoices/statement?${q.toString()}`);
      return res.json();
    },
    enabled: activeTab === "statement",
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, amount, notes }: any) => {
      const res = await apiRequest("PATCH", `/api/invoices/${id}/status`, { status, amount, notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setShowReviewDialog(null);
      toast({ title: "Invoice updated and approved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Failed to update invoice", variant: "destructive" }),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, action }: { ids: number[], action: "markPaid" | "sendReminder" }) => {
      const res = await apiRequest("POST", "/api/invoices/bulk-update", { ids, action });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setSelectedIds([]);
      toast({ 
        title: "Bulk update successful", 
        description: `Successfully ${variables.action === 'markPaid' ? 'marked as paid' : 'sent reminders for'} ${variables.ids.length} invoices.` 
      });
    },
    onError: (err: any) => toast({ title: "Bulk update failed", description: err?.message, variant: "destructive" }),
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

  const isProvider = user?.userRole === "provider" || user?.activeRole === "provider";

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

      <PageBreadcrumb items={[{ label: "Financial Flow" }]} />

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all_invoices" data-testid="tab-all-invoices">All Invoices</TabsTrigger>
          {isProvider && <TabsTrigger value="pending_review" data-testid="tab-pending-review">Pending My Review</TabsTrigger>}
          {isProvider && <TabsTrigger value="statement" data-testid="tab-statement">Statement of Account</TabsTrigger>}
        </TabsList>

        <TabsContent value="all_invoices" className="space-y-6">
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
              {["all", "pending", "paid", "overdue", "cancelled", "provider_review"].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all border ${
                    statusFilter === s 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                  }`}
                  data-testid={`filter-status-${s}`}
                >
                  {(STATUS_CONFIG[s]?.label || "All").toUpperCase()}
                </button>
              ))}
            </div>
            
            <div className="flex-1 min-w-[200px] relative">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs bg-muted/50 border-0 focus-visible:ring-1"
                data-testid="input-search-invoices"
              />
            </div>
          </div>

          {/* List */}
          <div className="space-y-3">
            {isLoading ? (
              [1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
            ) : filtered.length === 0 ? (
              <EmptyState
                icon="📄"
                title="No invoices found"
                description="Try adjusting your filters or create a new invoice."
              />
            ) : (
              filtered.map((inv: any) => (
                <InvoiceCard
                  key={inv.id}
                  inv={inv}
                  cfg={STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending}
                  StatusIcon={(STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending).icon}
                  onPayFull={() => {
                    setPaymentForm(f => ({ ...f, amount: String(inv.amount - (inv.amountPaid || 0)) }));
                    setShowPaymentDialog(inv.id);
                  }}
                  onPartialPayment={() => {
                    setPaymentForm(f => ({ ...f, amount: "" }));
                    setShowPaymentDialog(inv.id);
                  }}
                  onCancel={() => cancelMutation.mutate(inv.id)}
                  onRemind={() => reminderMutation.mutate(inv.id)}
                  onReview={(invoice: any) => {
                    setReviewForm({ amount: String(invoice.amount), notes: invoice.notes || "" });
                    setShowReviewDialog(invoice);
                  }}
                  onEmail={(invoice: any) => setEmailEntity({ type: "invoice", id: invoice.id, inv: invoice })}
                  isPaying={payMutation.isPending}
                  isCancelling={cancelMutation.isPending}
                  isReminding={reminderMutation.isPending}
                  isSelected={selectedIds.includes(inv.id)}
                  onSelect={toggleSelect}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="pending_review" className="space-y-4">
          <div className="space-y-3">
            {isLoading ? (
              [1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
            ) : invoices.filter((i: any) => i.status === "provider_review").length === 0 ? (
              <EmptyState
                icon="✅"
                title="All clear!"
                description="You have no invoices pending review."
              />
            ) : (
              invoices.filter((i: any) => i.status === "provider_review").map((inv: any) => (
                <InvoiceCard
                  key={inv.id}
                  inv={inv}
                  cfg={STATUS_CONFIG.provider_review}
                  StatusIcon={STATUS_CONFIG.provider_review.icon}
                  onReview={(invoice: any) => {
                    setReviewForm({ amount: String(invoice.amount), notes: invoice.notes || "" });
                    setShowReviewDialog(invoice);
                  }}
                  onCancel={() => cancelMutation.mutate(inv.id)}
                  onEmail={(invoice: any) => setEmailEntity({ type: "invoice", id: invoice.id, inv: invoice })}
                  isSelected={selectedIds.includes(inv.id)}
                  onSelect={toggleSelect}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="statement" className="space-y-6">
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-xs">Counterparty (Name or Email)</Label>
                <div className="relative">
                  <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search..." 
                    value={statementCounterparty}
                    onChange={(e) => setStatementCounterparty(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">From Date</Label>
                <Input 
                  type="date" 
                  value={statementFromDate}
                  onChange={(e) => setStatementFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">To Date</Label>
                <Input 
                  type="date" 
                  value={statementToDate}
                  onChange={(e) => setStatementToDate(e.target.value)}
                />
              </div>
              <Button 
                className="gap-2"
                onClick={() => {
                  const rows = statementInvoices.map(inv => ({
                    Date: inv.createdAt ? format(new Date(inv.createdAt), 'dd/MM/yyyy') : '',
                    Title: inv.title,
                    Recipient: inv.recipientName || inv.recipientEmail || '',
                    Amount: inv.amount,
                    Currency: inv.currency,
                    Status: inv.status,
                    'Amount Paid': inv.amountPaid || 0,
                    Balance: (inv.amount - (inv.amountPaid || 0)).toFixed(2)
                  }));
                  exportToCsv(`Statement-${statementCounterparty || 'All'}-${new Date().toISOString().split('T')[0]}.csv`, rows);
                }}
                disabled={statementInvoices.length === 0}
              >
                <Download className="w-4 h-4" /> Export Statement
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden border-muted-foreground/10">
            <div className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-muted-foreground/10">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Description</th>
                    <th className="px-4 py-3 text-left font-semibold">Counterparty</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th className="px-4 py-3 text-right font-semibold">Paid</th>
                    <th className="px-4 py-3 text-right font-semibold">Balance</th>
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted-foreground/10">
                  {isLoadingStatement ? (
                    [1,2,3].map(i => (
                      <tr key={i}>
                        <td colSpan={7} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                      </tr>
                    ))
                  ) : statementInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground italic">No invoices found for this criteria.</td>
                    </tr>
                  ) : (
                    <>
                      {statementInvoices.map((inv: any) => (
                        <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">{inv.createdAt ? format(new Date(inv.createdAt), 'dd/MM/yyyy') : '-'}</td>
                          <td className="px-4 py-3 font-medium">{inv.title}</td>
                          <td className="px-4 py-3">{inv.recipientName || inv.recipientEmail || '-'}</td>
                          <td className="px-4 py-3 text-right font-semibold">{inv.currency} {Number(inv.amount).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-emerald-600 font-medium">{inv.currency} {Number(inv.amountPaid || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-bold text-blue-600">{inv.currency} {(inv.amount - (inv.amountPaid || 0)).toLocaleString()}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={`text-[10px] uppercase ${STATUS_CONFIG[inv.status]?.color || ''}`}>
                              {inv.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/20 font-bold border-t-2 border-muted-foreground/20">
                        <td colSpan={3} className="px-4 py-4 text-right">Total Outstanding Balance (Current Filter):</td>
                        <td colSpan={3} className="px-4 py-4 text-right text-lg text-blue-700">
                          USD {statementInvoices.reduce((sum, inv) => sum + (inv.amount - (inv.amountPaid || 0)), 0).toLocaleString()}
                        </td>
                        <td></td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Floating Action Bar */}
      <FloatingBulkActionBar 
        selectedCount={selectedIds.length} 
        onClear={() => setSelectedIds([])}
      >
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 h-8 text-xs border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
          onClick={() => bulkUpdateMutation.mutate({ ids: selectedIds, action: "sendReminder" })}
          disabled={bulkUpdateMutation.isPending}
        >
          <Bell className="w-3.5 h-3.5" /> Send Reminders
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 h-8 text-xs border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
          onClick={() => bulkUpdateMutation.mutate({ ids: selectedIds, action: "markPaid" })}
          disabled={bulkUpdateMutation.isPending}
        >
          <Check className="w-3.5 h-3.5" /> Mark Paid
        </Button>
      </FloatingBulkActionBar>

      {/* New Invoice Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Invoice Title / Description</Label>
              <Input 
                placeholder="e.g. Proforma DA — MV Izmir Express" 
                value={form.title} 
                onChange={e => setForm({ ...form, title: e.target.value })} 
                data-testid="input-invoice-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Invoice Type</Label>
              <Select value={form.invoiceType} onValueChange={v => setForm({ ...form, invoiceType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Standard Invoice</SelectItem>
                  <SelectItem value="proforma_da">Proforma DA</SelectItem>
                  <SelectItem value="final_da">Final DA</SelectItem>
                  <SelectItem value="fda_disbursement">FDA Disbursement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={form.amount} 
                onChange={e => setForm({ ...form, amount: e.target.value })} 
                data-testid="input-invoice-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">🇺🇸 USD</SelectItem>
                  <SelectItem value="EUR">🇪🇺 EUR</SelectItem>
                  <SelectItem value="TRY">🇹🇷 TRY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input 
                type="date" 
                value={form.dueDate} 
                onChange={e => setForm({ ...form, dueDate: e.target.value })} 
                data-testid="input-invoice-due-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Voyage (Optional)</Label>
              <Select value={form.voyageId} onValueChange={v => setForm({ ...form, voyageId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select voyage" />
                </SelectTrigger>
                <SelectContent>
                  {voyages.map((v: any) => (
                    <SelectItem key={v.id} value={String(v.id)}>{v.vesselName} — {v.voyageNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recipient Name</Label>
              <Input 
                placeholder="Company or Person" 
                value={form.recipientName} 
                onChange={e => setForm({ ...form, recipientName: e.target.value })} 
                data-testid="input-recipient-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Recipient Email</Label>
              <Input 
                type="email" 
                placeholder="invoice@example.com" 
                value={form.recipientEmail} 
                onChange={e => setForm({ ...form, recipientEmail: e.target.value })} 
                data-testid="input-recipient-email"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea 
                placeholder="Bank details, terms, etc." 
                value={form.notes} 
                onChange={e => setForm({ ...form, notes: e.target.value })} 
                data-testid="textarea-invoice-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} data-testid="button-save-invoice">
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={!!showReviewDialog} onOpenChange={() => setShowReviewDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review & Approve Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <p className="text-sm font-medium">{showReviewDialog?.title}</p>
            </div>
            <div className="space-y-2">
              <Label>Amount ({showReviewDialog?.currency})</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={reviewForm.amount} 
                onChange={e => setReviewForm({ ...reviewForm, amount: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                value={reviewForm.notes} 
                onChange={e => setReviewForm({ ...reviewForm, notes: e.target.value })} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(null)}>Close</Button>
            <Button 
              className="gap-2"
              onClick={() => updateStatusMutation.mutate({ 
                id: showReviewDialog.id, 
                status: "pending", 
                amount: reviewForm.amount,
                notes: reviewForm.notes
              })}
              disabled={updateStatusMutation.isPending}
            >
              <Send className="w-4 h-4" /> Approve & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={!!showPaymentDialog} onOpenChange={() => setShowPaymentDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Payment Amount (USD)</Label>
              <Input 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={paymentForm.amount} 
                onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} 
                data-testid="input-payment-amount"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input 
                  type="date" 
                  value={paymentForm.paidAt} 
                  onChange={e => setPaymentForm({ ...paymentForm, paidAt: e.target.value })} 
                  data-testid="input-payment-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={paymentForm.paymentMethod} onValueChange={v => setPaymentForm({ ...paymentForm, paymentMethod: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reference (Optional)</Label>
              <Input 
                placeholder="SWIFT ref, check number, etc." 
                value={paymentForm.reference} 
                onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })} 
                data-testid="input-payment-ref"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                placeholder="Internal notes about this payment" 
                value={paymentForm.notes} 
                onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })} 
                data-testid="textarea-payment-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(null)}>Cancel</Button>
            <Button 
              onClick={() => payMutation.mutate({ id: showPaymentDialog!, data: paymentForm })} 
              disabled={payMutation.isPending || !paymentForm.amount}
              data-testid="button-save-payment"
            >
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {emailEntity && (
        <SmartMailComposer
          type="invoice"
          entityId={emailEntity.id}
          entityMeta={{
            referenceNumber: emailEntity.inv.title,
            toEmail: emailEntity.inv.recipientEmail || "",
            toCompany: emailEntity.inv.recipientName || "",
          }}
          onClose={() => setEmailEntity(null)}
        />
      )}
    </div>
  );
}
