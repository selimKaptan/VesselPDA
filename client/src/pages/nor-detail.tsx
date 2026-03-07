import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FileCheck, ArrowLeft, Download, Edit2, CheckCircle2, XCircle,
  Send, Loader2, AlertTriangle, Clock, Anchor, Package, Ship,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { PageMeta } from "@/components/page-meta";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Nor } from "@shared/schema";
import { fmtDate, fmtDateTime } from "@/lib/formatDate";

type NorStatus = "draft" | "tendered" | "accepted" | "rejected";

const statusConfig: Record<NorStatus, { label: string; className: string }> = {
  draft:    { label: "Draft",    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  tendered: { label: "Tendered", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  accepted: { label: "Accepted", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

function fmtDT(d: string | Date | null | undefined) {
  if (!d) return "—";
  return fmtDateTime(d);
}
function toDatetimeLocal(d: string | Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 16);
}

const READY_TO_OPTIONS = ["Load", "Discharge", "Receive Cargo"];
const CONDITION_OPTIONS = [
  "Whether in berth or not (WIBON)",
  "Whether in free pratique or not (WIFPON)",
  "Whether customs cleared or not (WCCON)",
  "Whether in port or not (WIPON)",
];

function toggleArray(arr: string[], val: string) {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

export default function NorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const norId = parseInt(id);
  const { toast } = useToast();

  const { data: nor, isLoading, refetch } = useQuery<Nor>({
    queryKey: ["/api/nor", norId],
    queryFn: async () => {
      const res = await fetch(`/api/nor/${norId}`);
      if (!res.ok) throw new Error("NOR not found");
      return res.json();
    },
  });

  // Dialog state
  const [showEdit, setShowEdit] = useState(false);
  const [showTender, setShowTender] = useState(false);
  const [showAccept, setShowAccept] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showSign, setShowSign] = useState<"master" | "agent" | "charterer" | null>(null);
  const [signatureText, setSignatureText] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [acceptedBy, setAcceptedBy] = useState("");
  const [laytimeStartsAt, setLaytimeStartsAt] = useState("");

  // Edit form state
  const [editForm, setEditForm] = useState<any>({});

  function openEdit() {
    if (!nor) return;
    setEditForm({
      vesselName: nor.vesselName || "",
      portName: nor.portName || "",
      masterName: nor.masterName || "",
      agentName: nor.agentName || "",
      chartererName: nor.chartererName || "",
      cargoType: nor.cargoType || "",
      cargoQuantity: nor.cargoQuantity || "",
      operation: nor.operation || "loading",
      anchorageArrival: toDatetimeLocal(nor.anchorageArrival),
      berthArrival: toDatetimeLocal(nor.berthArrival),
      norTenderedTo: nor.norTenderedTo || "",
      berthName: nor.berthName || "",
      remarks: nor.remarks || "",
      readyTo: (nor.readyTo as string[]) || [],
      conditions: (nor.conditions as string[]) || [],
    });
    setShowEdit(true);
  }

  const mutation = (path: string, body?: any, method = "POST") => useMutation({
    mutationFn: () => apiRequest(method as any, path, body),
    onSuccess: () => { refetch(); },
    onError: (e: any) => toast({ title: e.message || "Action failed", variant: "destructive" }),
  });

  const tenderMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/nor/${norId}/tender`),
    onSuccess: () => { refetch(); setShowTender(false); toast({ title: "NOR tendered successfully" }); },
    onError: () => toast({ title: "Failed to tender NOR", variant: "destructive" }),
  });

  const acceptMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/nor/${norId}/accept`, {
      acceptedBy: acceptedBy || "Receiver",
      laytimeStartsAt: laytimeStartsAt || undefined,
    }),
    onSuccess: () => { refetch(); setShowAccept(false); toast({ title: "NOR accepted, laytime started" }); },
    onError: () => toast({ title: "Failed to accept NOR", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/nor/${norId}/reject`, { reason: rejectReason }),
    onSuccess: () => { refetch(); setShowReject(false); setRejectReason(""); toast({ title: "NOR rejected" }); },
    onError: () => toast({ title: "Failed to reject NOR", variant: "destructive" }),
  });

  const signMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/nor/${norId}/sign`, { role: showSign, signature: signatureText }),
    onSuccess: () => { refetch(); setShowSign(null); setSignatureText(""); toast({ title: "Signature added" }); },
    onError: () => toast({ title: "Failed to add signature", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/nor/${norId}`, editForm),
    onSuccess: () => { refetch(); setShowEdit(false); toast({ title: "NOR updated" }); },
    onError: () => toast({ title: "Failed to update NOR", variant: "destructive" }),
  });

  const reactivateMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/nor/${norId}`, { status: "draft" }),
    onSuccess: () => { refetch(); openEdit(); },
    onError: () => toast({ title: "Failed to reactivate NOR", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!nor) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>NOR record not found.</p>
        <Link href="/nor"><Button variant="ghost" className="mt-2">Back to NOR list</Button></Link>
      </div>
    );
  }

  const status = (nor.status as NorStatus) || "draft";
  const sc = statusConfig[status];
  const conditions = (nor.conditions as string[]) || [];
  const readyTo = (nor.readyTo as string[]) || [];
  const op = nor.operation === "both" ? "load and discharge"
    : nor.operation === "discharging" ? "discharge" : "load";

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-6xl mx-auto" data-testid="page-nor-detail">
      <PageMeta
        title={`NOR — ${nor.vesselName || "Detail"} | VesselPDA`}
        description="Notice of Readiness document"
      />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/nor" className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Notice of Readiness
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{nor.vesselName || `NOR #${nor.id}`}</span>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge className={`text-sm px-3 py-1 ${sc.className}`} data-testid="text-nor-status">
          {sc.label}
        </Badge>

        {status === "draft" && (
          <>
            <Button variant="outline" size="sm" onClick={openEdit} data-testid="button-edit-nor">
              <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit
            </Button>
            <Button size="sm" onClick={() => setShowTender(true)} data-testid="button-tender-nor">
              <Send className="w-3.5 h-3.5 mr-1.5" /> Tender NOR
            </Button>
          </>
        )}

        {status === "tendered" && (
          <>
            <Button variant="outline" size="sm" className="border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              onClick={() => setShowAccept(true)} data-testid="button-accept-nor">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Accept NOR
            </Button>
            <Button variant="outline" size="sm" className="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => setShowReject(true)} data-testid="button-reject-nor">
              <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject NOR
            </Button>
          </>
        )}

        {status === "accepted" && (
          <>
            <Button variant="outline" size="sm" onClick={() => window.open(`/api/nor/${norId}/pdf`, "_blank")}
              data-testid="button-view-pdf">
              <Download className="w-3.5 h-3.5 mr-1.5" /> View PDF
            </Button>
            {nor.laytimeStartsAt && (
              <div className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                <Clock className="w-3.5 h-3.5" />
                Laytime starts: {fmtDT(nor.laytimeStartsAt)}
              </div>
            )}
          </>
        )}

        {status === "rejected" && (
          <Button variant="outline" size="sm" onClick={() => reactivateMutation.mutate()}
            disabled={reactivateMutation.isPending} data-testid="button-reteender-nor">
            <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit & Re-tender
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={() => window.open(`/api/nor/${norId}/pdf`, "_blank")}
          className="ml-auto" title="Download PDF">
          <Download className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Rejection Banner */}
      {status === "rejected" && nor.rejectionReason && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">NOR Rejected</p>
            <p>{nor.rejectionReason}</p>
          </div>
        </div>
      )}

      {/* Main layout: document + info panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Left: Formal document ──────────────────────────── */}
        <div className="lg:col-span-3">
          <Card className="p-8 space-y-6 bg-white dark:bg-card">
            {/* Document Title */}
            <div className="text-center space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Maritime Document</p>
              <h1 className="text-2xl font-bold tracking-widest uppercase font-serif">
                NOTICE OF READINESS
              </h1>
              <div className="w-full h-px bg-border mt-2" />
            </div>

            {/* Date & To */}
            <div className="space-y-1 text-sm">
              <p className="text-right text-muted-foreground">Date: <span className="text-foreground font-medium">{fmtDT(nor.norTenderedAt) || "Pending tender"}</span></p>
              <p>To: <span className="font-medium">{nor.norTenderedTo || "—"}</span></p>
            </div>

            {/* Body Paragraph */}
            <div className="space-y-3 text-sm leading-relaxed">
              <p className="text-muted-foreground">Dear Sirs,</p>
              <p>
                We hereby give you notice that the vessel{" "}
                <strong>{nor.vesselName || "[Vessel Name]"}</strong>{" "}
                arrived at{" "}
                <strong>{nor.portName || "[Port]"}</strong>{" "}
                on{" "}
                <strong>{fmtDT(nor.berthArrival ?? nor.anchorageArrival) || "N/A"}</strong>{" "}
                and is in all respects ready to{" "}
                <strong>{op}</strong>{" "}
                a cargo of{" "}
                <strong>{nor.cargoType || "[Cargo Type]"}</strong>{" "}
                ({nor.cargoQuantity || "quantity TBC"}).
              </p>
              <p>
                This Notice of Readiness is tendered at:{" "}
                <strong>{fmtDT(nor.norTenderedAt) || "Pending"}</strong>
              </p>
            </div>

            {/* Conditions */}
            {conditions.length > 0 && (
              <div className="space-y-1 text-sm">
                <p className="font-semibold">Conditions:</p>
                <ul className="space-y-0.5 pl-2">
                  {conditions.map(c => (
                    <li key={c} className="flex items-center gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ready To */}
            {readyTo.length > 0 && (
              <div className="text-sm">
                <span className="font-semibold">Ready to: </span>
                <span>{readyTo.join(", ")}</span>
              </div>
            )}

            {/* Times Table */}
            <div className="space-y-1">
              <p className="text-sm font-semibold mb-2">Key Times:</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {[
                  ["Anchorage Arrival", fmtDT(nor.anchorageArrival)],
                  ["Berth Arrival", fmtDT(nor.berthArrival)],
                  ["NOR Tendered", fmtDT(nor.norTenderedAt)],
                  ["NOR Accepted", fmtDT(nor.norAcceptedAt)],
                  ["Laytime Starts", fmtDT(nor.laytimeStartsAt)],
                ].map(([label, val]) => (
                  <div key={label} className="contents">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-medium ${label === "Laytime Starts" && nor.laytimeStartsAt ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {nor.berthName && (
              <p className="text-sm"><span className="font-semibold">Berth: </span>{nor.berthName}</p>
            )}

            {nor.remarks && (
              <div className="text-sm">
                <p className="font-semibold mb-1">Remarks:</p>
                <p className="text-muted-foreground">{nor.remarks}</p>
              </div>
            )}

            {/* Signature Blocks */}
            <div>
              <div className="w-full h-px bg-border mb-6" />
              <div className="grid grid-cols-3 gap-4">
                {(["master", "agent", "charterer"] as const).map((role) => {
                  const labels: Record<string, string> = { master: "Master / Captain", agent: "Ship Agent", charterer: "Charterer / Receiver" };
                  const sigs: Record<string, string | null | undefined> = {
                    master: nor.signatureMaster,
                    agent: nor.signatureAgent,
                    charterer: nor.signatureCharterer,
                  };
                  const sig = sigs[role];
                  return (
                    <div key={role} className="space-y-2 text-center" data-testid={`sig-block-${role}`}>
                      <div className="border-b border-gray-400 dark:border-gray-600 pb-1 min-h-[40px] flex items-end justify-center">
                        {sig ? (
                          <p className="text-sm font-medium">{sig}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Signature</p>
                        )}
                      </div>
                      <p className="text-xs font-medium text-muted-foreground">{labels[role]}</p>
                      {sig ? (
                        <p className="text-xs text-muted-foreground">{fmtDate(nor.updatedAt)}</p>
                      ) : (
                        <Button size="sm" variant="outline" className="h-6 px-2 text-xs w-full"
                          onClick={() => { setShowSign(role); setSignatureText(""); }}
                          data-testid={`button-sign-${role}`}>
                          Sign
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        {/* ── Right: Info Panel ──────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Vessel & Cargo */}
          <Card className="p-4 space-y-3" data-testid="card-vessel-info">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Ship className="w-4 h-4 text-[hsl(var(--maritime-primary))]" /> Vessel & Cargo
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vessel</span>
                <span className="font-medium">{nor.vesselName || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Master</span>
                <span>{nor.masterName || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agent</span>
                <span>{nor.agentName || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Charterer</span>
                <span>{nor.chartererName || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Operation</span>
                <Badge variant="outline" className="text-xs capitalize">{nor.operation || "—"}</Badge>
              </div>
            </div>
          </Card>

          {/* Cargo */}
          <Card className="p-4 space-y-3" data-testid="card-cargo-info">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Package className="w-4 h-4 text-[hsl(var(--maritime-primary))]" /> Cargo
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cargo Type</span>
                <span className="font-medium">{nor.cargoType || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Quantity</span>
                <span>{nor.cargoQuantity || "—"}</span>
              </div>
            </div>
          </Card>

          {/* Port */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Anchor className="w-4 h-4 text-[hsl(var(--maritime-primary))]" /> Port
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Port</span>
                <span className="font-medium">{nor.portName || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Berth</span>
                <span>{nor.berthName || "—"}</span>
              </div>
            </div>
          </Card>

          {/* Status & Timestamps */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="w-4 h-4 text-[hsl(var(--maritime-primary))]" /> Timeline
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{fmtDT(nor.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tendered</span>
                <span>{fmtDT(nor.norTenderedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Accepted</span>
                <span>{fmtDT(nor.norAcceptedAt)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Laytime Starts</span>
                <span className={nor.laytimeStartsAt ? "text-emerald-600 dark:text-emerald-400" : ""}>
                  {fmtDT(nor.laytimeStartsAt)}
                </span>
              </div>
            </div>
          </Card>

          {/* Related Links */}
          {nor.voyageId && (
            <Card className="p-4 space-y-2">
              <p className="text-sm font-semibold">Related</p>
              <Link href={`/voyages/${nor.voyageId}`}>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                  <Ship className="w-3.5 h-3.5" /> View Voyage #{nor.voyageId}
                </Button>
              </Link>
            </Card>
          )}
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────── */}

      {/* Tender Confirm */}
      <Dialog open={showTender} onOpenChange={setShowTender}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tender NOR</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will officially tender the Notice of Readiness for{" "}
            <strong>{nor.vesselName}</strong> at <strong>{nor.portName}</strong>.
            The NOR tendered timestamp will be set to now.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTender(false)}>Cancel</Button>
            <Button onClick={() => tenderMutation.mutate()} disabled={tenderMutation.isPending}>
              {tenderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
              Tender NOR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept Dialog */}
      <Dialog open={showAccept} onOpenChange={setShowAccept}>
        <DialogContent>
          <DialogHeader><DialogTitle>Accept NOR</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Accepted By</Label>
              <Input value={acceptedBy} onChange={e => setAcceptedBy(e.target.value)}
                placeholder="Charterer / Receiver" data-testid="input-accepted-by" />
            </div>
            <div>
              <Label>Laytime Starts At (optional — defaults to now)</Label>
              <Input type="datetime-local" value={laytimeStartsAt}
                onChange={e => setLaytimeStartsAt(e.target.value)}
                data-testid="input-laytime-starts" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccept(false)}>Cancel</Button>
            <Button onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {acceptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Accept NOR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject NOR</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label>Reason for Rejection <span className="text-destructive">*</span></Label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Vessel not ready, holds not clean..." rows={3}
              data-testid="textarea-reject-reason" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectMutation.mutate()}
              disabled={!rejectReason.trim() || rejectMutation.isPending}>
              {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
              Reject NOR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign Dialog */}
      <Dialog open={showSign !== null} onOpenChange={() => setShowSign(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign as {showSign === "master" ? "Master / Captain" : showSign === "agent" ? "Ship Agent" : "Charterer / Receiver"}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>Your Signature (name / title)</Label>
            <Input value={signatureText} onChange={e => setSignatureText(e.target.value)}
              placeholder="Capt. John Smith" data-testid="input-signature-text" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSign(null)}>Cancel</Button>
            <Button onClick={() => signMutation.mutate()} disabled={!signatureText.trim() || signMutation.isPending}>
              {signMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Add Signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit NOR</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Vessel Name</Label>
                <Input value={editForm.vesselName || ""} onChange={e => setEditForm((f: any) => ({ ...f, vesselName: e.target.value }))} /></div>
              <div><Label>Port Name</Label>
                <Input value={editForm.portName || ""} onChange={e => setEditForm((f: any) => ({ ...f, portName: e.target.value }))} /></div>
              <div><Label>Master Name</Label>
                <Input value={editForm.masterName || ""} onChange={e => setEditForm((f: any) => ({ ...f, masterName: e.target.value }))} /></div>
              <div><Label>Agent Name</Label>
                <Input value={editForm.agentName || ""} onChange={e => setEditForm((f: any) => ({ ...f, agentName: e.target.value }))} /></div>
              <div><Label>Charterer Name</Label>
                <Input value={editForm.chartererName || ""} onChange={e => setEditForm((f: any) => ({ ...f, chartererName: e.target.value }))} /></div>
              <div><Label>Operation</Label>
                <Select value={editForm.operation || "loading"} onValueChange={v => setEditForm((f: any) => ({ ...f, operation: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loading">Loading</SelectItem>
                    <SelectItem value="discharging">Discharging</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Cargo Type</Label>
                <Input value={editForm.cargoType || ""} onChange={e => setEditForm((f: any) => ({ ...f, cargoType: e.target.value }))} /></div>
              <div><Label>Cargo Quantity</Label>
                <Input value={editForm.cargoQuantity || ""} onChange={e => setEditForm((f: any) => ({ ...f, cargoQuantity: e.target.value }))} /></div>
              <div><Label>Anchorage Arrival</Label>
                <Input type="datetime-local" value={editForm.anchorageArrival || ""} onChange={e => setEditForm((f: any) => ({ ...f, anchorageArrival: e.target.value }))} /></div>
              <div><Label>Berth Arrival</Label>
                <Input type="datetime-local" value={editForm.berthArrival || ""} onChange={e => setEditForm((f: any) => ({ ...f, berthArrival: e.target.value }))} /></div>
              <div><Label>NOR Tendered To</Label>
                <Input value={editForm.norTenderedTo || ""} onChange={e => setEditForm((f: any) => ({ ...f, norTenderedTo: e.target.value }))} /></div>
              <div><Label>Berth Name</Label>
                <Input value={editForm.berthName || ""} onChange={e => setEditForm((f: any) => ({ ...f, berthName: e.target.value }))} /></div>
            </div>

            <div>
              <Label className="mb-2 block">Ready To</Label>
              <div className="flex flex-wrap gap-4">
                {READY_TO_OPTIONS.map(opt => (
                  <div key={opt} className="flex items-center gap-2">
                    <Checkbox id={`edit-ready-${opt}`} checked={(editForm.readyTo || []).includes(opt)}
                      onCheckedChange={() => setEditForm((f: any) => ({ ...f, readyTo: toggleArray(f.readyTo || [], opt) }))} />
                    <Label htmlFor={`edit-ready-${opt}`} className="font-normal cursor-pointer">{opt}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Conditions</Label>
              <div className="space-y-2">
                {CONDITION_OPTIONS.map(opt => (
                  <div key={opt} className="flex items-center gap-2">
                    <Checkbox id={`edit-cond-${opt}`} checked={(editForm.conditions || []).includes(opt)}
                      onCheckedChange={() => setEditForm((f: any) => ({ ...f, conditions: toggleArray(f.conditions || [], opt) }))} />
                    <Label htmlFor={`edit-cond-${opt}`} className="font-normal cursor-pointer text-sm">{opt}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div><Label>Remarks</Label>
              <Textarea value={editForm.remarks || ""} onChange={e => setEditForm((f: any) => ({ ...f, remarks: e.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
              {editMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
