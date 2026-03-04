import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Gavel, ArrowLeft, Clock, Ship, FileText, Upload, CheckCircle2,
  XCircle, Building2, Trophy, Mail, AlertCircle, Eye, Send, Star, Users, Download,
  MessageCircle, Anchor
} from "lucide-react";

function useCountdown(createdAt: string, expiryHours: number) {
  const [remaining, setRemaining] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const expiresAt = new Date(createdAt).getTime() + expiryHours * 3600000;
    const update = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) { setRemaining("Expired"); setExpired(true); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(`${h}h ${m}m left`); setExpired(false);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [createdAt, expiryHours]);

  return { remaining, expired };
}

function BidCard({
  bid, isOwner, onSelect, onViewPdf
}: {
  bid: any; isOwner: boolean; onSelect: (bidId: number) => void; onViewPdf: (bidId: number) => void;
}) {
  const [, navigate] = useLocation();
  const statusConfig = {
    selected: { label: "Selected", cls: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" /> },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-700", icon: <XCircle className="w-4 h-4 text-red-500" /> },
    pending: { label: "Pending", cls: "bg-amber-100 text-amber-700", icon: null },
  }[bid.status as string] || { label: bid.status, cls: "bg-gray-100 text-gray-600", icon: null };

  const goToProfile = () => {
    if (bid.agentCompanyId) navigate(`/directory/${bid.agentCompanyId}`);
  };

  return (
    <Card className={`p-5 transition-all ${bid.status === "selected" ? "ring-2 ring-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10" : ""}`}
      data-testid={`card-bid-${bid.id}`}>
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 rounded-xl bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[hsl(var(--maritime-primary)/0.12)] ${bid.agentCompanyId ? "cursor-pointer hover:ring-2 hover:ring-[hsl(var(--maritime-primary)/0.3)] transition-all" : ""}`}
          onClick={goToProfile}
          data-testid={`img-bid-logo-${bid.id}`}
        >
          {bid.companyLogoUrl
            ? <img src={bid.companyLogoUrl} alt={bid.companyName} className="w-full h-full object-contain" />
            : <Building2 className="w-6 h-6 text-[hsl(var(--maritime-primary))]" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className={`font-semibold text-sm ${bid.agentCompanyId ? "cursor-pointer hover:text-[hsl(var(--maritime-primary))] hover:underline transition-colors" : ""}`}
                onClick={goToProfile}
                data-testid={`text-bid-company-${bid.id}`}
              >
                {bid.companyName || `${bid.agentFirstName} ${bid.agentLastName}`}
              </p>
              {bid.totalAmount && (
                <p className="text-lg font-bold text-[hsl(var(--maritime-primary))] mt-0.5">
                  {bid.totalAmount} <span className="text-sm font-normal text-muted-foreground">{bid.currency}</span>
                </p>
              )}
              {bid.notes && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{bid.notes}</p>
              )}
            </div>
            <Badge className={`text-[10px] border-0 flex items-center gap-1 ${statusConfig.cls}`}>
              {statusConfig.icon}{statusConfig.label}
            </Badge>
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {(bid.hasPdf || bid.proformaPdfBase64) && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
                onClick={() => onViewPdf(bid.id)} data-testid={`button-view-pdf-${bid.id}`}>
                <Eye className="w-3.5 h-3.5" /> View Proforma
              </Button>
            )}
            {isOwner && bid.status === "pending" && (
              <Button size="sm" className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => onSelect(bid.id)} data-testid={`button-select-bid-${bid.id}`}>
                <Trophy className="w-3.5 h-3.5" /> Select This Bid
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function SubmitBidForm({ tenderId, onSuccess }: { tenderId: number; onSuccess: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ notes: "", totalAmount: "", currency: "USD" });
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 5MB.", variant: "destructive" });
      return;
    }
    const allowed = ["application/pdf", "image/jpg", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png)$/i)) {
      toast({ title: "Invalid format", description: "Please upload a PDF, JPG or PNG file.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => { setPdfBase64(ev.target?.result as string); setPdfName(file.name); };
    reader.readAsDataURL(file);
  };

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/tenders/${tenderId}/bids`, data),
    onSuccess: () => {
      toast({ title: "Bid submitted!", description: "The shipowner will review your bid." });
      onSuccess();
    },
    onError: async (err: any) => {
      const data = await err.response?.json().catch(() => ({}));
      toast({ title: "Error", description: data.message || "Could not submit bid", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!form.totalAmount) {
      toast({ title: "Missing Field", description: "Please enter a price", variant: "destructive" });
      return;
    }
    if (!form.notes) {
      toast({ title: "Missing Field", description: "Please enter a description", variant: "destructive" });
      return;
    }
    mutation.mutate({ ...form, proformaPdfBase64: pdfBase64 || undefined });
  };

  return (
    <Card className="p-5 border-[hsl(var(--maritime-primary)/0.2)] bg-[hsl(var(--maritime-primary)/0.02)]">
      <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm">
        <Gavel className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
        Submit Bid
      </h3>
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <Label>Price <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g. 8,500"
              value={form.totalAmount}
              onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
              data-testid="input-total-amount"
            />
          </div>
          <div className="w-28 space-y-1.5">
            <Label>Currency</Label>
            <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
              <SelectTrigger data-testid="select-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="TRY">TRY</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Description <span className="text-red-500">*</span></Label>
          <Textarea
            placeholder="Add a description for your bid..."
            rows={3}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            data-testid="input-bid-notes"
          />
        </div>

        <div className="space-y-1.5">
          <Label>PDA File <span className="text-muted-foreground text-xs font-normal">(Optional — PDF / JPG, max 5MB)</span></Label>
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${pdfName ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/10" : "hover:bg-muted/30 border-border"}`}
            onClick={() => fileRef.current?.click()}
            data-testid="dropzone-pdf"
          >
            {pdfName ? (
              <div className="flex items-center justify-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">{pdfName}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="w-6 h-6" />
                <span className="text-sm">Click to upload PDA file</span>
                <span className="text-xs">PDF, JPG, PNG supported</span>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFile} data-testid="input-pdf-file" />
          {pdfBase64 && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="gap-1.5 text-xs"
              onClick={() => {
                const win = window.open();
                if (win) {
                  win.document.write(
                    `<iframe src="${pdfBase64}" width="100%" height="100%" style="border:none;margin:0;padding:0;height:100vh;"></iframe>`
                  );
                }
              }}
              data-testid="button-preview-pdf"
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </Button>
          )}
        </div>

        <Button onClick={handleSubmit} disabled={mutation.isPending} className="w-full gap-2" data-testid="button-submit-bid">
          {mutation.isPending ? "Submitting..." : (<><Send className="w-4 h-4" /> Submit Bid</>)}
        </Button>
      </div>
    </Card>
  );
}

export default function TenderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectBidId, setSelectBidId] = useState<number | null>(null);
  const [showNomination, setShowNomination] = useState(false);
  const [nominationData, setNominationData] = useState<any>(null);
  const [showQ88, setShowQ88] = useState(false);
  const [nominationNote, setNominationNote] = useState("");
  const [nominationExtraEmails, setNominationExtraEmails] = useState("");
  const [autoVoyageId, setAutoVoyageId] = useState<number | null>(null);
  const [autoConversationId, setAutoConversationId] = useState<number | null>(null);

  const userRole = (user as any)?.userRole;
  const activeRole = (user as any)?.activeRole;
  const effectiveRole = userRole === "admin" ? (activeRole || "shipowner") : userRole;

  const tenderId = parseInt(id!);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/tenders", tenderId],
    queryFn: async () => {
      const res = await fetch(`/api/tenders/${tenderId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const { data: tenderVoyage } = useQuery<{ voyageId: number; conversationId: number } | null>({
    queryKey: ["/api/tenders", tenderId, "voyage"],
    queryFn: async () => {
      const res = await fetch(`/api/tenders/${tenderId}/voyage`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!data && data?.tender?.status === "nominated",
  });

  const selectMutation = useMutation({
    mutationFn: (bidId: number) => apiRequest("POST", `/api/tenders/${tenderId}/bids/${bidId}/select`, {}),
    onSuccess: () => {
      toast({ title: "Bid selected!", description: "Continue to confirm the nomination." });
      setSelectBidId(null);
      refetch();
    },
    onError: async (err: any) => {
      const data = await err.response?.json().catch(() => ({}));
      toast({ title: "Error", description: data.message || "Operation failed", variant: "destructive" });
    },
  });

  const nominateMutation = useMutation({
    mutationFn: () => {
      const extraEmailsList = nominationExtraEmails
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      return apiRequest("POST", `/api/tenders/${tenderId}/nominate`, {
        note: nominationNote.trim() || undefined,
        extraEmails: extraEmailsList.length > 0 ? extraEmailsList : undefined,
      });
    },
    onSuccess: async (res: any) => {
      const d = await res.json();
      setNominationData(d.nominatedAgent);
      if (d.voyageId) setAutoVoyageId(d.voyageId);
      if (d.conversationId) setAutoConversationId(d.conversationId);
      setShowNomination(false);
      setNominationNote("");
      setNominationExtraEmails("");
      toast({
        title: "Nomination complete!",
        description: `${d.nominatedAgent.companyName} has been successfully nominated.`,
      });
      refetch();
    },
    onError: async (err: any) => {
      const d = await err.response?.json().catch(() => ({}));
      toast({ title: "Error", description: d.message || "Nomination failed", variant: "destructive" });
    },
  });

  const handleViewPdf = async (bidId: number) => {
    const res = await fetch(`/api/tenders/${tenderId}/bids/${bidId}/pdf`, { credentials: "include" });
    const data = await res.json();
    if (data.proformaPdfBase64) {
      const win = window.open();
      if (win) {
        win.document.write(`<iframe src="${data.proformaPdfBase64}" width="100%" height="100%" style="border:none;margin:0;padding:0;overflow:hidden;height:100vh;"></iframe>`);
      }
    } else {
      toast({ title: "PDF not found", description: "The agent has not uploaded a PDF.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="px-3 py-5 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-24 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 py-20">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Tender not found</p>
        <Button variant="outline" onClick={() => navigate("/tenders")}>Go Back</Button>
      </div>
    );
  }

  const { tender, bids, myBid, isOwner } = data;
  const { remaining, expired } = (() => {
    const expiresAt = new Date(tender.createdAt).getTime() + tender.expiryHours * 3600000;
    const diff = expiresAt - Date.now();
    if (diff <= 0) return { remaining: "Expired", expired: true };
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return { remaining: `${h}h ${m}m left`, expired: false };
  })();

  const selectedBid = bids?.find((b: any) => b.status === "selected");
  const pendingBids = bids?.filter((b: any) => b.status === "pending") || [];
  const allBids = bids || [];

  const statusColor = {
    open: "bg-emerald-100 text-emerald-700",
    closed: "bg-blue-100 text-blue-700",
    cancelled: "bg-red-100 text-red-700",
    nominated: "bg-purple-100 text-purple-700",
  }[tender.status as string] || "bg-gray-100 text-gray-600";

  const statusLabel = {
    open: "Open",
    closed: "Closed",
    cancelled: "Cancelled",
    nominated: "Nominated",
  }[tender.status as string] || tender.status;

  return (
    <div className="flex flex-col gap-6 px-3 py-5 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tenders")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>

      {/* Tender Info */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center flex-shrink-0">
              <Gavel className="w-6 h-6 text-[hsl(var(--maritime-primary))]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-bold">{tender.portName}</h1>
                <Badge className={`text-[10px] border-0 ${statusColor}`}>{statusLabel}</Badge>
              </div>
              {tender.vesselName && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Ship className="w-4 h-4" /> {tender.vesselName}
                </div>
              )}
            </div>
          </div>
          <div className={`flex items-center gap-1.5 text-sm font-medium ${expired || tender.status !== "open" ? "text-muted-foreground" : "text-amber-600"}`}>
            <Clock className="w-4 h-4" />
            {tender.status === "open" ? remaining : statusLabel}
          </div>
        </div>

        <Separator className="my-4" />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {tender.flag && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Flag</p>
              <p>{tender.flag}</p>
            </div>
          )}
          {tender.grt && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">GRT</p>
              <p>{Number(tender.grt).toLocaleString()}</p>
            </div>
          )}
          {tender.nrt && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">NRT</p>
              <p>{Number(tender.nrt).toLocaleString()}</p>
            </div>
          )}
          {tender.cargoType && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Cargo Type</p>
              <p>{tender.cargoType}</p>
            </div>
          )}
          {tender.cargoQuantity && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Cargo Quantity</p>
              <p>{tender.cargoQuantity}</p>
            </div>
          )}
          {tender.previousPort && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Previous Port</p>
              <p>{tender.previousPort}</p>
            </div>
          )}
          {tender.cargoInfo && !tender.cargoType && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Cargo</p>
              <p>{tender.cargoInfo}</p>
            </div>
          )}
          {tender.description && (
            <div className="col-span-2 md:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Description</p>
              <p>{tender.description}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Tender Duration</p>
            <p>{tender.expiryHours} Hours</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Created</p>
            <p>{new Date(tender.createdAt).toLocaleString("en-US")}</p>
          </div>
        </div>

        {/* Q88 Viewer */}
        {tender.q88Base64 && (
          <>
            <Separator className="my-4" />
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              <span className="text-sm font-medium">Q88 Vessel Form</span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-7"
                  data-testid="button-view-q88"
                  onClick={() => setShowQ88(true)}
                >
                  <Eye className="w-3.5 h-3.5" /> View Document
                </Button>
                <a
                  href={tender.q88Base64}
                  download="Q88_Form"
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Download
                </a>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Nomination success banner */}
      {nominationData && (
        <Card className="p-5 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">Nomination Complete</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-3">
                <strong>{nominationData.companyName}</strong> has been nominated.
                {nominationData.email && ` (${nominationData.email})`}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {autoVoyageId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-emerald-400 text-emerald-700 hover:bg-emerald-100"
                    onClick={() => navigate(`/voyages/${autoVoyageId}`)}
                    data-testid="button-view-voyage"
                  >
                    <Anchor className="w-3.5 h-3.5" /> View Voyage
                  </Button>
                )}
                {autoConversationId && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => navigate(`/messages/${autoConversationId}`)}
                    data-testid="button-open-chat"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> Open Chat
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tender closed/nominated status */}
      {tender.status === "nominated" && !nominationData && (
        <Card className="p-5 bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-purple-800 dark:text-purple-300 mb-2">Nomination has been completed for this tender.</p>
              <div className="flex items-center gap-2 flex-wrap">
                {tenderVoyage?.voyageId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-100"
                    onClick={() => navigate(`/voyages/${tenderVoyage.voyageId}`)}
                    data-testid="button-view-voyage-nominated"
                  >
                    <Anchor className="w-3.5 h-3.5" /> View Voyage
                  </Button>
                )}
                {tenderVoyage?.conversationId && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-purple-600 hover:bg-purple-700"
                    onClick={() => navigate(`/messages/${tenderVoyage.conversationId}`)}
                    data-testid="button-open-chat-nominated"
                  >
                    <MessageCircle className="w-3.5 h-3.5" /> Open Chat
                  </Button>
                )}
                {isOwner && effectiveRole === "shipowner" && (() => {
                  const nominatedBid = allBids?.find((b: any) => b.status === "selected");
                  return nominatedBid?.agentCompanyId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-100"
                      onClick={() => navigate(`/directory/${nominatedBid.agentCompanyId}`)}
                      data-testid="button-review-agent"
                    >
                      <Star className="w-3.5 h-3.5" /> Rate This Agent
                    </Button>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Owner: bid list */}
      {isOwner && allBids.length > 0 && (
        <div>
          <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
            Received Bids ({allBids.length})
          </h2>
          <div className="space-y-3">
            {allBids.map((bid: any) => (
              <BidCard
                key={bid.id}
                bid={bid}
                isOwner={isOwner && tender.status === "open"}
                onSelect={(bidId) => setSelectBidId(bidId)}
                onViewPdf={handleViewPdf}
              />
            ))}
          </div>

          {selectedBid && tender.status === "closed" && (
            <div className="mt-4">
              <Button
                className="gap-2 bg-purple-600 hover:bg-purple-700"
                onClick={() => setShowNomination(true)}
                data-testid="button-nominate"
              >
                <Mail className="w-4 h-4" /> Confirm Nomination
              </Button>
            </div>
          )}
        </div>
      )}

      {isOwner && allBids.length === 0 && tender.status === "open" && (
        <Card className="p-8 flex flex-col items-center gap-3 text-center border-dashed">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <FileText className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-muted-foreground">No bids received yet</p>
          <p className="text-sm text-muted-foreground">Agents are reviewing your tender...</p>
        </Card>
      )}

      {/* Agent mode viewing own tender: explain why bid isn't available */}
      {isOwner && effectiveRole === "agent" && (
        <Card className="p-5 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-400 text-sm">You created this tender</p>
              <p className="text-sm text-amber-700 dark:text-amber-500 mt-0.5">
                This tender was created from your Shipowner account. Switch to <strong>Shipowner mode</strong> from the sidebar to view and manage the incoming bids.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Agent: submit bid or show my bid */}
      {!isOwner && (
        <div>
          {myBid ? (
            <Card className="p-5">
              <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Your Bid Submitted
              </h2>
              <div className="space-y-2 text-sm">
                {myBid.totalAmount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold text-[hsl(var(--maritime-primary))]">
                      {myBid.totalAmount} {myBid.currency}
                    </span>
                  </div>
                )}
                {myBid.notes && (
                  <div>
                    <span className="text-muted-foreground">Note: </span>
                    <span>{myBid.notes}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={`text-[10px] border-0 ${
                    myBid.status === "selected" ? "bg-emerald-100 text-emerald-700" :
                    myBid.status === "rejected" ? "bg-red-100 text-red-700" :
                    "bg-amber-100 text-amber-700"
                  }`}>
                    {myBid.status === "selected" ? "Selected! 🎉" : myBid.status === "rejected" ? "Rejected" : "Under Review"}
                  </Badge>
                </div>
                {myBid.proformaPdfBase64 && (
                  <Button size="sm" variant="outline" className="w-full gap-2 mt-2"
                    onClick={() => handleViewPdf(myBid.id)} data-testid="button-my-pdf">
                    <Eye className="w-3.5 h-3.5" /> View My Proforma
                  </Button>
                )}
              </div>

              {myBid.status === "selected" && tender.status === "nominated" && (
                <div className="mt-4 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-700">
                  <div className="flex items-start gap-3">
                    <Trophy className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                        Congratulations! You Have Been Officially Nominated 🎉
                      </p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-0.5 mb-3">
                        Nomination confirmed for <strong>{tender.portName}</strong>{tender.vesselName ? ` — ${tender.vesselName}` : ""}. The shipowner has appointed you as the official agent.
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {tenderVoyage?.voyageId && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-emerald-400 text-emerald-700 hover:bg-emerald-100"
                            onClick={() => navigate(`/voyages/${tenderVoyage.voyageId}`)}
                            data-testid="button-agent-view-voyage"
                          >
                            <Anchor className="w-3.5 h-3.5" /> View Voyage
                          </Button>
                        )}
                        {tenderVoyage?.conversationId && (
                          <Button
                            size="sm"
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => navigate(`/messages/${tenderVoyage.conversationId}`)}
                            data-testid="button-agent-open-chat"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Chat with Shipowner
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {myBid.status === "selected" && tender.status !== "nominated" && (
                <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Your bid was selected! The shipowner will confirm the nomination.
                  </p>
                </div>
              )}
            </Card>
          ) : tender.status === "open" && !expired ? (
            <SubmitBidForm tenderId={tenderId} onSuccess={() => refetch()} />
          ) : (
            <Card className="p-5 text-center text-muted-foreground">
              <p className="text-sm">This tender is no longer accepting bids.</p>
            </Card>
          )}
        </div>
      )}

      {/* Select bid confirmation dialog */}
      <AlertDialog open={selectBidId !== null} onOpenChange={(o) => !o && setSelectBidId(null)}>
        <AlertDialogContent data-testid="dialog-select-bid">
          <AlertDialogHeader>
            <AlertDialogTitle>Select This Bid</AlertDialogTitle>
            <AlertDialogDescription>
              When you select this bid, all other bids will be rejected and the tender will close.
              You can then proceed to confirm the nomination. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-select">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectBidId && selectMutation.mutate(selectBidId)}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-confirm-select"
            >
              {selectMutation.isPending ? "Processing..." : "Yes, Select This Bid"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Nomination confirmation dialog */}
      <Dialog open={showNomination} onOpenChange={setShowNomination}>
        <DialogContent className="max-w-lg" data-testid="dialog-nominate">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-purple-600" />
              Confirm Nomination
            </DialogTitle>
          </DialogHeader>

          {selectedBid && (
            <div className="space-y-4">
              {/* Selected agent info */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Selected Agent</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {selectedBid.companyLogoUrl
                      ? <img src={selectedBid.companyLogoUrl} alt="" className="w-full h-full object-contain" />
                      : <Building2 className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                    }
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{selectedBid.companyName || `${selectedBid.agentFirstName} ${selectedBid.agentLastName}`}</p>
                    {selectedBid.agentEmail && <p className="text-xs text-muted-foreground">{selectedBid.agentEmail}</p>}
                  </div>
                </div>
              </div>

              {/* Vessel & cargo info */}
              {(tender.vesselName || tender.flag || tender.grt || tender.cargoType || tender.cargoQuantity || tender.previousPort) && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Vessel & Cargo Details</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {tender.vesselName && (
                      <><span className="text-muted-foreground">Vessel</span><span className="font-medium">{tender.vesselName}</span></>
                    )}
                    {tender.flag && (
                      <><span className="text-muted-foreground">Flag</span><span className="font-medium">{tender.flag}</span></>
                    )}
                    {tender.grt && (
                      <><span className="text-muted-foreground">GRT</span><span className="font-medium">{Number(tender.grt).toLocaleString()}</span></>
                    )}
                    {tender.nrt && (
                      <><span className="text-muted-foreground">NRT</span><span className="font-medium">{Number(tender.nrt).toLocaleString()}</span></>
                    )}
                    {tender.cargoType && (
                      <><span className="text-muted-foreground">Cargo Type</span><span className="font-medium">{tender.cargoType}</span></>
                    )}
                    {tender.cargoQuantity && (
                      <><span className="text-muted-foreground">Cargo Quantity</span><span className="font-medium">{tender.cargoQuantity}</span></>
                    )}
                    {tender.previousPort && (
                      <><span className="text-muted-foreground">Previous Port</span><span className="font-medium">{tender.previousPort}</span></>
                    )}
                  </div>
                </div>
              )}

              {/* Note field */}
              <div className="space-y-1.5">
                <Label htmlFor="nomination-note" className="text-sm font-medium">
                  Note / Message <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="nomination-note"
                  placeholder="Write a special note to send to the agent..."
                  rows={3}
                  value={nominationNote}
                  onChange={(e) => setNominationNote(e.target.value)}
                  data-testid="input-nomination-note"
                />
              </div>

              {/* Additional email addresses */}
              <div className="space-y-1.5">
                <Label htmlFor="nomination-emails" className="flex items-center gap-1.5 text-sm font-medium">
                  <Users className="w-3.5 h-3.5" />
                  Additional Email Addresses <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="nomination-emails"
                  placeholder="captain@vessel.com, ops@company.com (comma separated)"
                  value={nominationExtraEmails}
                  onChange={(e) => setNominationExtraEmails(e.target.value)}
                  data-testid="input-nomination-emails"
                />
                <p className="text-xs text-muted-foreground">You can add the vessel captain, operations officer, etc.</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowNomination(false)}
              data-testid="button-cancel-nominate"
            >
              Cancel
            </Button>
            <Button
              onClick={() => nominateMutation.mutate()}
              className="bg-purple-600 hover:bg-purple-700"
              disabled={nominateMutation.isPending}
              data-testid="button-confirm-nominate"
            >
              <Send className="w-4 h-4 mr-2" />
              {nominateMutation.isPending ? "Processing..." : "Send Nomination"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Q88 Document Viewer Dialog */}
      {tender && tender.q88Base64 && (
        <Dialog open={showQ88} onOpenChange={setShowQ88}>
          <DialogContent className="max-w-4xl h-[85vh] flex flex-col" data-testid="dialog-q88-viewer">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
                Q88 Vessel Form — {tender.vesselName}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0">
              {tender.q88Base64.startsWith("data:application/pdf") || tender.q88Base64.startsWith("data:application/octet") ? (
                <iframe
                  src={tender.q88Base64}
                  className="w-full h-full rounded border"
                  title="Q88 Vessel Form"
                />
              ) : tender.q88Base64.startsWith("data:image") ? (
                <div className="w-full h-full overflow-auto flex items-center justify-center bg-muted rounded">
                  <img src={tender.q88Base64} alt="Q88 Form" className="max-w-full object-contain" />
                </div>
              ) : (
                <iframe
                  src={tender.q88Base64}
                  className="w-full h-full rounded border"
                  title="Q88 Vessel Form"
                />
              )}
            </div>
            <DialogFooter>
              <a href={tender.q88Base64} download="Q88_Form">
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" /> Download
                </Button>
              </a>
              <Button variant="ghost" size="sm" onClick={() => setShowQ88(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
