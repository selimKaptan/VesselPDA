import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Clock, CheckCircle2, XCircle, RefreshCw, Eye, Ship, Anchor, Building, DollarSign, Calendar, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { fmtDate } from "@/lib/formatDate";

export default function PdaReview() {
  const [selectedPda, setSelectedPda] = useState<any>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | "request_revision">("approve");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const { toast } = useToast();

  const { data: pendingPdas, isLoading } = useQuery<any[]>({
    queryKey: ["/api/proformas/pending-approval"],
    queryFn: async () => {
      const res = await fetch("/api/proformas/pending-approval", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ proformaId, action, note }: { proformaId: number; action: string; note: string }) => {
      const res = await apiRequest("POST", `/api/proformas/${proformaId}/review`, { action, note });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proformas/pending-approval"] });
      setReviewOpen(false);
      setSelectedPda(null);
      setReviewNote("");
      toast({ title: "Review submitted", description: "The agent will be notified." });
    },
    onError: (err: Error) => {
      toast({ title: "Review failed", description: err.message, variant: "destructive" });
    },
  });

  const openReview = (pda: any) => {
    setSelectedPda(pda);
    setReviewAction("approve");
    setReviewNote("");
    setReviewOpen(true);
  };

  const approvalStatusBadge = (status: string) => {
    if (status === "sent") return <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"><Clock className="w-3 h-3 mr-1" />Awaiting Review</Badge>;
    if (status === "under_review") return <Badge className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"><Clock className="w-3 h-3 mr-1" />Under Review</Badge>;
    return <Badge variant="secondary" className="text-xs">{status}</Badge>;
  };

  return (
    <div className="px-3 py-5 max-w-6xl mx-auto space-y-6">
      <PageMeta title="PDA Pending Review | VesselPDA" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">PDA Pending Approval</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Proforma disbursement accounts submitted by agents, awaiting your review.
          </p>
        </div>
        {pendingPdas && pendingPdas.length > 0 && (
          <Badge variant="default" className="text-sm px-3 py-1">
            {pendingPdas.length} pending
          </Badge>
        )}
      </div>

      <Separator />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : !pendingPdas || pendingPdas.length === 0 ? (
        <Card className="p-12 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-green-400/40 mx-auto" />
          <div>
            <h3 className="font-serif font-semibold text-lg">All Clear</h3>
            <p className="text-muted-foreground text-sm mt-1">No proformas are waiting for your approval.</p>
          </div>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead className="hidden sm:table-cell">Vessel</TableHead>
                <TableHead className="hidden md:table-cell">Port</TableHead>
                <TableHead className="hidden md:table-cell">Agent</TableHead>
                <TableHead>Total (USD)</TableHead>
                <TableHead className="hidden lg:table-cell">Submitted</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingPdas.map((pda: any) => (
                <TableRow key={pda.id} data-testid={`row-pending-pda-${pda.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span>{pda.reference_number}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex items-center gap-1.5">
                      <Ship className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm">{pda.vessel_name || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-1.5">
                      <Anchor className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm">{pda.port_name || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-muted-foreground" />
                      <div>
                        <p className="text-sm">{pda.agent_name?.trim() || "-"}</p>
                        <p className="text-xs text-muted-foreground">{pda.agent_email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                      {pda.total_usd?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {pda.sent_at ? fmtDate(pda.sent_at) : "-"}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {approvalStatusBadge(pda.approval_status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/proformas/${pda.id}`}>
                        <Button size="icon" variant="ghost" title="View proforma" data-testid={`button-view-pda-${pda.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        onClick={() => openReview(pda)}
                        data-testid={`button-review-pda-${pda.id}`}
                        className="gap-1"
                      >
                        Review
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-review-pda">
          <DialogHeader>
            <DialogTitle>Review PDA — {selectedPda?.reference_number}</DialogTitle>
          </DialogHeader>
          {selectedPda && (
            <div className="py-2 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm p-3 rounded-md bg-muted/40">
                <div>
                  <span className="text-xs text-muted-foreground block">Vessel</span>
                  <span className="font-medium">{selectedPda.vessel_name || "-"}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Port</span>
                  <span className="font-medium">{selectedPda.port_name || "-"}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Agent</span>
                  <span className="font-medium">{selectedPda.agent_name?.trim() || "-"}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Total (USD)</span>
                  <span className="font-semibold">${selectedPda.total_usd?.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Decision</Label>
                <div className="flex gap-2 flex-wrap">
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
                <Label htmlFor="review-note-modal">
                  {reviewAction === "request_revision" ? "Revision Instructions *" : "Note (optional)"}
                </Label>
                <Textarea
                  id="review-note-modal"
                  placeholder={reviewAction === "request_revision" ? "Describe what needs to be revised..." : "Add a note for the agent..."}
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  rows={3}
                  data-testid="input-review-note"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
            <Button
              onClick={() => reviewMutation.mutate({ proformaId: selectedPda?.id, action: reviewAction, note: reviewNote })}
              disabled={reviewMutation.isPending || (reviewAction === "request_revision" && !reviewNote.trim())}
              className={reviewAction === "approve" ? "bg-green-600 hover:bg-green-700" : reviewAction === "reject" ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"}
              data-testid="button-submit-review"
            >
              {reviewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
