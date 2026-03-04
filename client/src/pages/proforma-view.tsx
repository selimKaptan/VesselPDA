import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Download, Printer, Ship, Globe, FileText, Calendar, Package, Loader2, Mail, Send, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { Proforma, Vessel, Port, CompanyProfile } from "@shared/schema";

async function downloadProformaPDF(refNumber: string) {
  const el = document.getElementById("proforma-document");
  if (!el) return;
  const { default: jsPDF } = await import("jspdf");
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = canvas.width / canvas.height;
  const imgH = pageW / ratio;
  let y = 0;
  if (imgH <= pageH) {
    pdf.addImage(imgData, "PNG", 0, 0, pageW, imgH);
  } else {
    while (y < canvas.height) {
      const sliceH = Math.min(canvas.height - y, (pageH * canvas.width) / pageW);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      const ctx = sliceCanvas.getContext("2d")!;
      ctx.drawImage(canvas, 0, -y);
      pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", 0, 0, pageW, (sliceH * pageW) / canvas.width);
      y += sliceH;
      if (y < canvas.height) pdf.addPage();
    }
  }
  pdf.save(`${refNumber || "proforma"}.pdf`);
}

export default function ProformaView() {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | "request_revision">("approve");
  const [reviewNote, setReviewNote] = useState("");
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const userRole = (user as any)?.userRole;
  const isAgent = userRole === "agent";
  const isShipownerOrAdmin = userRole === "shipowner" || userRole === "admin";

  const { data: proforma, isLoading } = useQuery<Proforma & { vessel?: Vessel; port?: Port }>({
    queryKey: ["/api/proformas", params.id],
  });

  const { data: approvalHistory } = useQuery<any[]>({
    queryKey: ["/api/proformas", params.id, "approval-history"],
    queryFn: async () => {
      const res = await fetch(`/api/proformas/${params.id}/approval-history`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!params.id,
  });

  const { data: myProfile } = useQuery<CompanyProfile | null>({
    queryKey: ["/api/company-profile/me"],
  });

  const sendForApprovalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/proformas/${params.id}/send`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proformas", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/proformas", params.id, "approval-history"] });
      toast({ title: "Sent for approval", description: "Shipowner will be notified." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ action, note }: { action: string; note: string }) => {
      const res = await apiRequest("POST", `/api/proformas/${params.id}/review`, { action, note });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proformas", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/proformas", params.id, "approval-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/proformas/pending-approval"] });
      setReviewOpen(false);
      setReviewNote("");
      toast({ title: "Review submitted" });
    },
    onError: (err: Error) => {
      toast({ title: "Review failed", description: err.message, variant: "destructive" });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/proformas/${params.id}/send-email`, {
        toEmail: emailTo,
        subject: emailSubject,
        message: emailMessage || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Email sent", description: `Proforma sent to ${emailTo}` });
      setEmailOpen(false);
      setEmailTo("");
      setEmailMessage("");
    },
    onError: () => {
      toast({ title: "Failed to send", description: "Please try again.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="px-3 py-5 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!proforma) {
    return (
      <div className="px-3 py-5 max-w-6xl mx-auto text-center py-20">
        <FileText className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
        <h2 className="font-serif text-xl font-bold">Proforma Not Found</h2>
        <Link href="/proformas">
          <Button variant="outline" className="mt-4">Back to Proformas</Button>
        </Link>
      </div>
    );
  }

  const exchangeRate = proforma.exchangeRate || 1.1593;
  const logoSrc = myProfile?.logoUrl || "/logo-v2.png";
  const approvalStatus = (proforma as any).approvalStatus || "draft";
  const revisionNote = (proforma as any).revisionNote;
  const approvalNote = (proforma as any).approvalNote;

  const approvalBannerConfig: Record<string, { bg: string; text: string; icon: any; label: string }> = {
    draft: { bg: "bg-muted/50 border-muted-foreground/20", text: "text-muted-foreground", icon: FileText, label: "Draft — Not yet submitted for approval" },
    sent: { bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300", icon: Clock, label: "Submitted for Approval — Awaiting review" },
    under_review: { bg: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800", text: "text-yellow-700 dark:text-yellow-300", icon: Clock, label: "Under Review by Shipowner" },
    revision_requested: { bg: "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300", icon: RefreshCw, label: "Revision Requested" },
    approved: { bg: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800", text: "text-green-700 dark:text-green-300", icon: CheckCircle2, label: "Approved by Shipowner" },
    rejected: { bg: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800", text: "text-red-700 dark:text-red-300", icon: XCircle, label: "Rejected" },
  };
  const banner = approvalBannerConfig[approvalStatus] || approvalBannerConfig.draft;
  const BannerIcon = banner.icon;

  const openEmailDialog = () => {
    setEmailSubject(`Proforma D/A — ${proforma.referenceNumber || `#${params.id}`}`);
    setEmailOpen(true);
  };

  return (
    <div className="p-4 sm:px-3 py-5 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/proformas">
            <Button variant="ghost" size="icon" data-testid="button-back-view">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight" data-testid="text-proforma-ref">
              {proforma.referenceNumber}
            </h1>
            <Badge variant="secondary" className="capitalize">{proforma.status}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAgent && (approvalStatus === "draft" || approvalStatus === "revision_requested") && (
            <Button
              size="sm"
              className={`gap-2 ${approvalStatus === "revision_requested" ? "bg-orange-600 hover:bg-orange-700" : ""}`}
              onClick={() => sendForApprovalMutation.mutate()}
              disabled={sendForApprovalMutation.isPending}
              data-testid="button-send-for-approval"
            >
              {sendForApprovalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{approvalStatus === "revision_requested" ? "Resubmit for Approval" : "Send for Approval"}</span>
            </Button>
          )}
          {isShipownerOrAdmin && (approvalStatus === "sent" || approvalStatus === "under_review") && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => setReviewOpen(true)}
              data-testid="button-review-pda"
            >
              <ChevronRight className="w-4 h-4" /> Review PDA
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()} data-testid="button-print">
            <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Print</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={openEmailDialog}
            data-testid="button-send-email"
          >
            <Mail className="w-4 h-4" /> <span className="hidden sm:inline">Send Email</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            data-testid="button-download"
            disabled={pdfLoading}
            onClick={async () => {
              setPdfLoading(true);
              try {
                await downloadProformaPDF(proforma.referenceNumber || "proforma");
              } finally {
                setPdfLoading(false);
              }
            }}
          >
            {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="hidden sm:inline">{pdfLoading ? "Generating..." : "Download PDF"}</span>
          </Button>
        </div>
      </div>

      {/* Approval Status Banner */}
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${banner.bg}`} data-testid="banner-approval-status">
        <BannerIcon className={`w-5 h-5 ${banner.text} flex-shrink-0`} />
        <span className={`text-sm font-medium ${banner.text}`}>{banner.label}</span>
        {(approvalStatus === "approved" || approvalStatus === "rejected") && approvalNote && (
          <span className={`text-xs ml-2 ${banner.text} opacity-75`}>— {approvalNote}</span>
        )}
      </div>

      {/* Revision Note Warning */}
      {approvalStatus === "revision_requested" && revisionNote && (
        <div className="flex items-start gap-3 p-4 rounded-lg border bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800" data-testid="box-revision-note">
          <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">Revision Requested by Shipowner</p>
            <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">{revisionNote}</p>
          </div>
        </div>
      )}

      <Card className="p-6 sm:p-8 space-y-6 sm:space-y-8 print:shadow-none print:border-none" id="proforma-document" data-testid="card-proforma-document">
        <div className="flex items-start justify-between gap-4 sm:gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <img src={logoSrc} alt="Company Logo" className="w-10 h-10 rounded-md object-contain" />
              <div>
                <h2 className="font-serif font-bold text-base sm:text-lg">PROFORMA D/A - INVOICE</h2>
                <p className="text-xs text-muted-foreground">{myProfile?.companyName || "VesselPDA Professional"}</p>
              </div>
            </div>
          </div>
          <div className="text-right text-sm flex-shrink-0">
            <p className="font-medium">{proforma.createdAt ? new Date(proforma.createdAt).toLocaleDateString("en-GB") : ""}</p>
            <p className="text-muted-foreground text-xs">{proforma.referenceNumber}</p>
          </div>
        </div>

        <Separator />

        {proforma.toCompany && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">To</p>
              <p className="font-medium">{proforma.toCompany}</p>
              {proforma.toCountry && <p className="text-muted-foreground">{proforma.toCountry}</p>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-4 rounded-md bg-muted/50">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Ship className="w-3 h-3" /> Vessel</p>
            <p className="font-medium text-xs sm:text-sm" data-testid="text-vessel-info">{proforma.vessel?.name || `Vessel #${proforma.vesselId}`}</p>
            <p className="text-xs text-muted-foreground">
              Flag: {proforma.vessel?.flag || "-"} | NRT/GRT: {proforma.vessel?.nrt?.toLocaleString()}/{proforma.vessel?.grt?.toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" /> Port</p>
            <p className="font-medium text-xs sm:text-sm">{proforma.port?.name || `Port #${proforma.portId}`}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Package className="w-3 h-3" /> Cargo</p>
            <p className="font-medium text-xs sm:text-sm">{proforma.purposeOfCall}: {proforma.cargoType || "-"}</p>
            <p className="text-xs text-muted-foreground">
              {proforma.cargoQuantity ? `${proforma.cargoQuantity.toLocaleString()} ${proforma.cargoUnit}` : "-"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Stay</p>
            <p className="font-medium text-xs sm:text-sm">{proforma.berthStayDays} Day(s)</p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-muted-foreground text-right mb-2">
            Exchange Rate: $1 = €{(1 / exchangeRate).toFixed(4)} &nbsp;|&nbsp; Date: {proforma.createdAt ? new Date(proforma.createdAt).toLocaleDateString("en-GB") : ""}
          </div>
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b" style={{ background: "#003D7A" }}>
                  <th className="text-left p-2 sm:p-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: "#fff", minWidth: "180px" }}>Description</th>
                  <th className="text-right p-2 sm:p-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: "#fff", minWidth: "90px" }}>USD</th>
                  <th className="text-right p-2 sm:p-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap" style={{ color: "#fff", minWidth: "90px" }}>EUR</th>
                </tr>
              </thead>
              <tbody>
                {(proforma.lineItems as any[])?.map((item: any, i: number) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-2 sm:p-3 whitespace-nowrap">
                      {item.description}
                      {item.notes && <span className="text-xs text-muted-foreground ml-2">({item.notes})</span>}
                    </td>
                    <td className="p-2 sm:p-3 text-right font-mono whitespace-nowrap">{item.amountUsd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-2 sm:p-3 text-right font-mono whitespace-nowrap">{(item.amountEur || (item.amountUsd / exchangeRate))?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold" style={{ background: "hsl(var(--maritime-primary) / 0.07)" }}>
                  <td className="p-2 sm:p-3 whitespace-nowrap">Total Port Expenses</td>
                  <td className="p-2 sm:p-3 text-right font-mono whitespace-nowrap">${proforma.totalUsd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="p-2 sm:p-3 text-right font-mono whitespace-nowrap">€{(proforma.totalEur || proforma.totalUsd / exchangeRate)?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {proforma.notes && (
          <div className="text-sm space-y-1">
            <p className="font-medium">Notes:</p>
            <p className="text-muted-foreground whitespace-pre-wrap text-xs sm:text-sm">{proforma.notes}</p>
          </div>
        )}

        {proforma.bankDetails && (
          <>
            <Separator />
            <div className="text-sm space-y-2">
              <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground">Bank Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground text-xs bg-muted/30 p-3 rounded-md">
                <p><span className="font-medium text-foreground">Bank:</span> {(proforma.bankDetails as any).bankName}</p>
                <p><span className="font-medium text-foreground">Branch:</span> {(proforma.bankDetails as any).branch}</p>
                <p><span className="font-medium text-foreground">SWIFT:</span> {(proforma.bankDetails as any).swiftCode}</p>
                <p className="break-all"><span className="font-medium text-foreground">USD IBAN:</span> {(proforma.bankDetails as any).usdIban}</p>
                <p className="break-all"><span className="font-medium text-foreground">EUR IBAN:</span> {(proforma.bankDetails as any).eurIban}</p>
                <p><span className="font-medium text-foreground">Beneficiary:</span> {(proforma.bankDetails as any).beneficiary}</p>
              </div>
            </div>
          </>
        )}

        <Separator />

        <div className="grid grid-cols-2 gap-8 pt-4">
          <div className="space-y-2">
            <div className="border-b border-foreground/20 pb-1 mb-2 h-10" />
            <p className="text-xs font-medium">Authorized Signature</p>
            <p className="text-xs text-muted-foreground">{myProfile?.companyName || "Ship Agent"}</p>
            <p className="text-xs text-muted-foreground">Date: ___________</p>
          </div>
          <div className="space-y-2">
            <div className="border-b border-foreground/20 pb-1 mb-2 h-10" />
            <p className="text-xs font-medium">Agent Stamp</p>
            <p className="text-xs text-muted-foreground">&nbsp;</p>
            <p className="text-xs text-muted-foreground">&nbsp;</p>
          </div>
        </div>

        <div className="p-3 rounded-md bg-muted/30 text-xs text-muted-foreground italic">
          This proforma disbursement account is an estimate only. Actual charges are subject to change based on vessel call conditions and applicable port tariffs.
        </div>
      </Card>

      {/* Approval History Timeline */}
      {approvalHistory && approvalHistory.length > 0 && (
        <Card className="p-5" data-testid="card-approval-history">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" /> Approval History
          </h3>
          <div className="space-y-3">
            {approvalHistory.map((log: any, i: number) => {
              const actionConfig: Record<string, { color: string; label: string; icon: any }> = {
                sent: { color: "text-blue-600 dark:text-blue-400", label: "Sent for Approval", icon: Send },
                approve: { color: "text-green-600 dark:text-green-400", label: "Approved", icon: CheckCircle2 },
                reject: { color: "text-red-600 dark:text-red-400", label: "Rejected", icon: XCircle },
                request_revision: { color: "text-orange-600 dark:text-orange-400", label: "Revision Requested", icon: RefreshCw },
              };
              const cfg = actionConfig[log.action] || { color: "text-muted-foreground", label: log.action, icon: Clock };
              const LogIcon = cfg.icon;
              return (
                <div key={log.id || i} className="flex items-start gap-3" data-testid={`row-approval-log-${i}`}>
                  <div className={`mt-0.5 flex-shrink-0 ${cfg.color}`}>
                    <LogIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-muted-foreground">by {log.user_name?.trim() || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">
                        {log.created_at ? new Date(log.created_at).toLocaleString("en-GB") : ""}
                      </span>
                    </div>
                    {log.note && (
                      <p className="text-xs text-muted-foreground mt-1 bg-muted/30 px-2 py-1 rounded">{log.note}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Review Dialog (Shipowner / Admin) */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-review-pda">
          <DialogHeader>
            <DialogTitle>Review Proforma</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Decision</Label>
              <div className="flex gap-2">
                <Button
                  variant={reviewAction === "approve" ? "default" : "outline"}
                  size="sm"
                  className={reviewAction === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
                  onClick={() => setReviewAction("approve")}
                  data-testid="button-action-approve"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                </Button>
                <Button
                  variant={reviewAction === "request_revision" ? "default" : "outline"}
                  size="sm"
                  className={reviewAction === "request_revision" ? "bg-orange-600 hover:bg-orange-700" : ""}
                  onClick={() => setReviewAction("request_revision")}
                  data-testid="button-action-revision"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Request Revision
                </Button>
                <Button
                  variant={reviewAction === "reject" ? "default" : "outline"}
                  size="sm"
                  className={reviewAction === "reject" ? "bg-red-600 hover:bg-red-700" : ""}
                  onClick={() => setReviewAction("reject")}
                  data-testid="button-action-reject"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="review-note">
                {reviewAction === "request_revision" ? "Revision Instructions *" : "Note (optional)"}
              </Label>
              <Textarea
                id="review-note"
                placeholder={reviewAction === "request_revision" ? "Describe what needs to be revised..." : "Add a note for the agent..."}
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                rows={3}
                data-testid="input-review-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
            <Button
              onClick={() => reviewMutation.mutate({ action: reviewAction, note: reviewNote })}
              disabled={reviewMutation.isPending || (reviewAction === "request_revision" && !reviewNote.trim())}
              className={reviewAction === "approve" ? "bg-green-600 hover:bg-green-700" : reviewAction === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"}
              data-testid="button-submit-review"
            >
              {reviewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-send-email">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4" /> Send Proforma by Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="email-to">Recipient Email *</Label>
              <Input
                id="email-to"
                type="email"
                placeholder="shipowner@example.com"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                data-testid="input-email-to"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                data-testid="input-email-subject"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-message">Message (optional)</Label>
              <Textarea
                id="email-message"
                placeholder="Add a personal message..."
                value={emailMessage}
                onChange={e => setEmailMessage(e.target.value)}
                rows={3}
                data-testid="input-email-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>Cancel</Button>
            <Button
              onClick={() => sendEmailMutation.mutate()}
              disabled={!emailTo || !emailSubject || sendEmailMutation.isPending}
              data-testid="button-send-email-submit"
            >
              {sendEmailMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
