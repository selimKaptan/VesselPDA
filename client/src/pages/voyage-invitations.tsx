import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { UserPlus, Ship, MapPin, Calendar, Clock, CheckCircle2, XCircle, Loader2, Anchor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import { Link } from "wouter";
import { fmtDate } from "@/lib/formatDate";

const ROLE_COLORS: Record<string, string> = {
  agent: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  provider: "bg-purple-500/15 text-purple-500 border-purple-500/30",
  surveyor: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  broker: "bg-green-500/15 text-green-500 border-green-500/30",
  observer: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

function InvitationCard({
  invite,
  onAccept,
  onDecline,
  isAccepting,
}: {
  invite: any;
  onAccept: () => void;
  onDecline: () => void;
  isAccepting: boolean;
}) {
  const vesselName = invite.vesselName ?? "Unknown Vessel";
  const portName = invite.portName ?? "Unknown Port";
  const inviterName = `${invite.inviterFirstName ?? ""} ${invite.inviterLastName ?? ""}`.trim() || "A voyage manager";
  const roleColor = ROLE_COLORS[invite.role] ?? ROLE_COLORS.observer;
  const daysLeft = invite.expiresAt ? daysUntil(invite.expiresAt) : null;
  const expiryUrgent = daysLeft !== null && daysLeft <= 2;

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4" data-testid={`card-invitation-${invite.id}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Ship className="w-4 h-4 text-sky-400 flex-shrink-0" />
            <h3 className="font-semibold text-base truncate">{vesselName}</h3>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {portName}
            </span>
            {invite.eta && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                ETA: {fmtDate(invite.eta)}
              </span>
            )}
          </div>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border capitalize flex-shrink-0 ${roleColor}`}>
          {invite.role}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white uppercase">
          {invite.inviterProfileImageUrl
            ? <img src={invite.inviterProfileImageUrl} alt={inviterName} className="w-7 h-7 rounded-full object-cover" />
            : (invite.inviterFirstName?.[0] ?? "?")}
        </div>
        <span className="text-muted-foreground">Invited by <span className="font-medium text-foreground">{inviterName}</span></span>
      </div>

      {invite.serviceType && (
        <div className="text-sm text-muted-foreground">Service: <span className="capitalize font-medium text-foreground">{invite.serviceType}</span></div>
      )}

      {invite.message && (
        <div className="bg-muted/30 border-l-2 border-sky-500/40 px-3 py-2 rounded text-sm italic text-muted-foreground">
          "{invite.message}"
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {daysLeft !== null ? (
          <span className={`text-xs flex items-center gap-1 ${expiryUrgent ? "text-amber-500" : "text-muted-foreground"}`}>
            <Clock className="w-3.5 h-3.5" />
            {daysLeft > 0 ? `Expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}` : "Expires today"}
          </span>
        ) : <span />}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={onDecline}
            data-testid={`button-decline-invite-${invite.id}`}
          >
            <XCircle className="w-3.5 h-3.5 mr-1" /> Decline
          </Button>
          <Button
            size="sm"
            className="bg-sky-600 hover:bg-sky-700 text-white"
            onClick={onAccept}
            disabled={isAccepting}
            data-testid={`button-accept-invite-${invite.id}`}
          >
            {isAccepting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function VoyageInvitations() {
  const { toast } = useToast();
  const [declineDialog, setDeclineDialog] = useState<{ voyageId: number; inviteId: number } | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [acceptingId, setAcceptingId] = useState<number | null>(null);

  const { data: invitations = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/my-voyage-invitations"],
    queryFn: () => fetch("/api/my-voyage-invitations", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const pendingInvites = Array.isArray(invitations) ? invitations.filter((i: any) => i.status === "pending") : [];

  const acceptMutation = useMutation({
    mutationFn: ({ voyageId, inviteId }: { voyageId: number; inviteId: number }) =>
      apiRequest("POST", `/api/voyages/${voyageId}/invitations/${inviteId}/accept`, {}),
    onSuccess: () => {
      toast({ title: "You've joined the voyage!" });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/my-voyage-invitations/count"] });
      setAcceptingId(null);
    },
    onError: () => {
      toast({ title: "Failed to accept invitation", variant: "destructive" });
      setAcceptingId(null);
    },
  });

  const declineMutation = useMutation({
    mutationFn: ({ voyageId, inviteId, reason }: { voyageId: number; inviteId: number; reason?: string }) =>
      apiRequest("POST", `/api/voyages/${voyageId}/invitations/${inviteId}/decline`, { reason }),
    onSuccess: () => {
      toast({ title: "Invitation declined" });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/my-voyage-invitations/count"] });
      setDeclineDialog(null);
      setDeclineReason("");
    },
    onError: () => toast({ title: "Failed to decline", variant: "destructive" }),
  });

  return (
    <>
      <PageMeta title="Voyage Invitations — VesselPDA" />
      <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-voyage-invitations">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <UserPlus className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Voyage Invitations</h1>
            <p className="text-sm text-muted-foreground">Invitations to join voyages as agent, provider, or other roles.</p>
          </div>
          {pendingInvites.length > 0 && (
            <Badge className="ml-auto bg-amber-500/15 text-amber-500 border border-amber-500/30">
              {pendingInvites.length} pending
            </Badge>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-8 w-32 mt-4" />
              </div>
            ))}
          </div>
        ) : pendingInvites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center">
              <Anchor className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">No pending invitations</h2>
              <p className="text-sm text-muted-foreground mt-1">
                When someone invites you to join their voyage, it will appear here.
              </p>
            </div>
            <Link href="/voyages">
              <Button variant="outline" size="sm">View My Voyages</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingInvites.map((inv: any) => (
              <InvitationCard
                key={inv.id}
                invite={inv}
                isAccepting={acceptingId === inv.id && acceptMutation.isPending}
                onAccept={() => {
                  setAcceptingId(inv.id);
                  acceptMutation.mutate({ voyageId: inv.voyageId, inviteId: inv.id });
                }}
                onDecline={() => setDeclineDialog({ voyageId: inv.voyageId, inviteId: inv.id })}
              />
            ))}
          </div>
        )}

        {/* Decline reason dialog */}
        <Dialog open={!!declineDialog} onOpenChange={(open) => { if (!open) { setDeclineDialog(null); setDeclineReason(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Decline Invitation</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">You can optionally share a reason for declining.</p>
              <Textarea
                placeholder="Reason (optional)..."
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value)}
                rows={3}
                data-testid="input-decline-reason"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDeclineDialog(null); setDeclineReason(""); }}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={declineMutation.isPending}
                onClick={() => declineDialog && declineMutation.mutate({ voyageId: declineDialog.voyageId, inviteId: declineDialog.inviteId, reason: declineReason || undefined })}
              >
                {declineMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Decline Invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
