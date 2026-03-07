import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, Plus, X, CreditCard, CheckCircle2, Clock, XCircle, AlertCircle, ChevronDown, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageMeta } from "@/components/page-meta";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  partially_received: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  fully_received: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  cancelled: "bg-slate-500/15 text-slate-500 border-slate-500/30",
};

const STATUS_ICONS: Record<string, any> = {
  pending: AlertCircle,
  partially_received: Clock,
  fully_received: CheckCircle2,
  cancelled: XCircle,
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  partially_received: "Partially Received",
  fully_received: "Fully Received",
  cancelled: "Cancelled",
};

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", TRY: "₺" };

function fmtAmt(amount: number, currency: string) {
  const sym = CURRENCY_SYMBOLS[currency] || currency + " ";
  return sym + amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ProgressBar({ received, requested }: { received: number; requested: number }) {
  const pct = requested > 0 ? Math.min(100, (received / requested) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-blue-500" : "bg-amber-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% received</p>
    </div>
  );
}

const EMPTY_FORM = {
  title: "",
  voyageId: "",
  proformaId: "",
  requestedAmount: "",
  currency: "USD",
  dueDate: "",
  recipientEmail: "",
  principalName: "",
  bankDetails: "",
  notes: "",
};

export default function DaAdvancesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const voyageIdParam = params.get("voyageId") || "";

  const [filterStatus, setFilterStatus] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState<{ id: number; title: string; currency: string } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [form, setForm] = useState({ ...EMPTY_FORM, voyageId: voyageIdParam });

  const { data: advances = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/da-advances"],
  });

  const { data: voyages = [] } = useQuery<any[]>({
    queryKey: ["/api/voyages"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/da-advances", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/da-advances"] });
      setShowDialog(false);
      setForm({ ...EMPTY_FORM, voyageId: voyageIdParam });
      toast({ title: "DA Advance request created" });
    },
    onError: () => toast({ title: "Failed to create request", variant: "destructive" }),
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      apiRequest("POST", `/api/da-advances/${id}/record-payment`, { amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/da-advances"] });
      setPaymentDialog(null);
      setPaymentAmount("");
      toast({ title: "Payment recorded" });
    },
    onError: () => toast({ title: "Failed to record payment", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/da-advances/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/da-advances"] });
      toast({ title: "Advance deleted" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/da-advances/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/da-advances"] }),
  });

  const filtered = advances.filter(a => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (voyageIdParam && a.voyageId !== parseInt(voyageIdParam)) return false;
    return true;
  });

  const totalRequested = filtered.reduce((s, a) => s + (a.requestedAmount || 0), 0);
  const totalReceived = filtered.reduce((s, a) => s + (a.receivedAmount || 0), 0);

  function handleSubmit(e: any) {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      voyageId: form.voyageId && form.voyageId !== "0" ? parseInt(form.voyageId) : null,
      proformaId: form.proformaId && form.proformaId !== "0" ? parseInt(form.proformaId) : null,
      requestedAmount: parseFloat(form.requestedAmount),
      dueDate: form.dueDate || null,
    });
  }

  const setF = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="min-h-screen bg-background">
      <PageMeta title="DA Advances | VesselPDA" description="Manage disbursement account advance fund requests" />

      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Banknote className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">DA Advance Requests</h1>
              <p className="text-sm text-muted-foreground">Manage advance fund requests from principals</p>
            </div>
          </div>
          <Button onClick={() => setShowDialog(true)} className="gap-2" data-testid="button-new-advance">
            <Plus className="w-4 h-4" /> New Request
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total Requested</p>
            <p className="text-xl font-bold mt-0.5" data-testid="text-total-requested">${totalRequested.toLocaleString("en-US", { minimumFractionDigits: 0 })}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total Received</p>
            <p className="text-xl font-bold text-emerald-500 mt-0.5" data-testid="text-total-received">${totalReceived.toLocaleString("en-US", { minimumFractionDigits: 0 })}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-xl font-bold text-amber-500 mt-0.5" data-testid="text-total-outstanding">${(totalRequested - totalReceived).toLocaleString("en-US", { minimumFractionDigits: 0 })}</p>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 mt-4 flex-wrap overflow-x-auto pb-1 no-scrollbar">
          {["all", "pending", "partially_received", "fully_received", "cancelled"].map(s => (
            <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(s)} data-testid={`filter-${s}`} className="h-7 text-xs whitespace-nowrap">
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl border border-border animate-pulse bg-muted/20" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Banknote className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-lg font-semibold">No advance requests</p>
            <p className="text-sm mt-1">Create a new DA advance request to get started</p>
            <Button onClick={() => setShowDialog(true)} className="mt-4 gap-2">
              <Plus className="w-4 h-4" /> New Request
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((adv: any) => {
              const StatusIcon = STATUS_ICONS[adv.status] || AlertCircle;
              const voyage = voyages.find((v: any) => v.id === adv.voyageId);
              return (
                <div key={adv.id} className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow" data-testid={`card-advance-${adv.id}`}>
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-base" data-testid={`text-advance-title-${adv.id}`}>{adv.title}</h3>
                        <Badge className={`text-xs border ${STATUS_COLORS[adv.status] || ""}`} data-testid={`badge-status-${adv.id}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {STATUS_LABELS[adv.status] || adv.status}
                        </Badge>
                        {adv.dueDate && new Date(adv.dueDate) < new Date() && adv.status !== "fully_received" && (
                          <Badge className="text-xs border bg-red-500/10 text-red-600 border-red-500/30">Overdue</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground flex-wrap">
                        {adv.principalName && <span>{adv.principalName}</span>}
                        {voyage && <span className="text-primary">📋 {voyage.vesselName || `Voyage #${adv.voyageId}`}</span>}
                        {adv.dueDate && <span>Due: {new Date(adv.dueDate).toLocaleDateString("en-GB")}</span>}
                        {adv.recipientEmail && <span className="text-xs break-all">{adv.recipientEmail}</span>}
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0 w-full sm:w-auto">
                      <p className="text-lg font-bold" data-testid={`text-amount-${adv.id}`}>{fmtAmt(adv.requestedAmount, adv.currency)}</p>
                      <p className="text-xs text-muted-foreground">Received: <span className="text-emerald-500 font-semibold">{fmtAmt(adv.receivedAmount || 0, adv.currency)}</span></p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <ProgressBar received={adv.receivedAmount || 0} requested={adv.requestedAmount} />
                  </div>

                  {adv.notes && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{adv.notes}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {adv.status !== "fully_received" && adv.status !== "cancelled" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPaymentDialog({ id: adv.id, title: adv.title, currency: adv.currency })}
                        className="gap-1.5 h-7 text-xs"
                        data-testid={`button-record-payment-${adv.id}`}
                      >
                        <CreditCard className="w-3 h-3" /> Record Payment
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/api/da-advances/${adv.id}/pdf`, '_blank')}
                      className="gap-1.5 h-7 text-xs"
                      data-testid={`button-download-advance-pdf-${adv.id}`}
                    >
                      <FileDown className="w-3 h-3" /> PDF
                    </Button>
                    {adv.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatusMutation.mutate({ id: adv.id, status: "cancelled" })}
                        className="gap-1.5 h-7 text-xs text-muted-foreground"
                        data-testid={`button-cancel-${adv.id}`}
                      >
                        <XCircle className="w-3 h-3" /> Cancel
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(adv.id)}
                      className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-destructive ml-auto"
                      data-testid={`button-delete-advance-${adv.id}`}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Request Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-4 h-4" /> New DA Advance Request
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title / Reference *</Label>
              <Input value={form.title} onChange={e => setF("title", e.target.value)} placeholder="e.g. Port Agency Advance — MV Barbaros" required data-testid="input-advance-title" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Voyage (optional)</Label>
                <Select value={form.voyageId} onValueChange={v => setF("voyageId", v)}>
                  <SelectTrigger data-testid="select-voyage"><SelectValue placeholder="Select voyage" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">None</SelectItem>
                    {(voyages as any[]).map((v: any) => (
                      <SelectItem key={v.id} value={String(v.id)}>{v.vesselName} — {v.portName || `Voyage #${v.id}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={v => setF("currency", v)}>
                  <SelectTrigger data-testid="select-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="TRY">TRY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Requested Amount *</Label>
                <Input type="number" min="0" step="0.01" value={form.requestedAmount} onChange={e => setF("requestedAmount", e.target.value)} placeholder="0.00" required data-testid="input-amount" />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date (optional)</Label>
                <Input type="date" value={form.dueDate} onChange={e => setF("dueDate", e.target.value)} data-testid="input-due-date" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Principal Name</Label>
                <Input value={form.principalName} onChange={e => setF("principalName", e.target.value)} placeholder="Shipowner name" data-testid="input-principal-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Recipient Email</Label>
                <Input type="email" value={form.recipientEmail} onChange={e => setF("recipientEmail", e.target.value)} placeholder="owner@example.com" data-testid="input-recipient-email" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Bank Details</Label>
              <Textarea value={form.bankDetails} onChange={e => setF("bankDetails", e.target.value)} placeholder="Bank name, IBAN, SWIFT/BIC…" rows={2} data-testid="input-bank-details" />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setF("notes", e.target.value)} placeholder="Additional notes…" rows={2} data-testid="input-notes" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-advance">
                {createMutation.isPending ? "Creating…" : "Create Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={!!paymentDialog} onOpenChange={open => { if (!open) { setPaymentDialog(null); setPaymentAmount(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Record Payment
            </DialogTitle>
          </DialogHeader>
          {paymentDialog && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{paymentDialog.title}</p>
              <div className="space-y-1.5">
                <Label>Amount Received ({paymentDialog.currency})</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  data-testid="input-payment-amount"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPaymentDialog(null); setPaymentAmount(""); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (paymentDialog && paymentAmount) {
                  paymentMutation.mutate({ id: paymentDialog.id, amount: parseFloat(paymentAmount) });
                }
              }}
              disabled={!paymentAmount || paymentMutation.isPending}
              data-testid="button-confirm-payment"
            >
              {paymentMutation.isPending ? "Saving…" : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
