import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function OrganizationJoinPage() {
  const params = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const token = params.token;

  const { data: invite, isLoading, error } = useQuery<any>({
    queryKey: [`/api/organizations/invite/${token}`],
    enabled: !!token,
    retry: false,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/organizations/join/${token}`, {});
      return res.json();
    },
    onSuccess: () => {
      setTimeout(() => navigate("/organization"), 1500);
    },
  });

  if (!token) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl overflow-hidden ring-2 ring-primary/20">
              <img src="/logo-v2.png" alt="VesselPDA" className="w-full h-full object-contain" />
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Organization Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading invitation...</p>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center gap-3 py-6">
                <XCircle className="w-10 h-10 text-destructive" />
                <p className="font-semibold">Invitation Not Found</p>
                <p className="text-sm text-muted-foreground text-center">
                  This invitation link is invalid, expired, or has already been used.
                </p>
                <Button variant="outline" onClick={() => navigate("/")}>Go to Dashboard</Button>
              </div>
            )}

            {joinMutation.isSuccess && (
              <div className="flex flex-col items-center gap-3 py-6">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
                <p className="font-semibold">Successfully joined!</p>
                <p className="text-sm text-muted-foreground">Redirecting to your organization...</p>
              </div>
            )}

            {invite && !joinMutation.isSuccess && (
              <div className="space-y-5">
                <div className="flex flex-col items-center gap-3 py-4">
                  {invite.org_logo ? (
                    <img src={invite.org_logo} alt={invite.org_name} className="w-14 h-14 rounded-xl object-contain bg-muted" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-7 h-7 text-primary" />
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-lg font-bold">{invite.org_name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You have been invited to join as a <strong className="capitalize">{invite.role}</strong>
                    </p>
                  </div>
                </div>

                {!user ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground text-center">
                      You need to be logged in to accept this invitation.
                    </p>
                    <Button className="w-full" onClick={() => navigate(`/login?redirect=/organization/join/${token}`)}>
                      Sign In to Accept
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => navigate(`/register?redirect=/organization/join/${token}`)}>
                      Create Account
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Button
                      className="w-full"
                      onClick={() => joinMutation.mutate()}
                      disabled={joinMutation.isPending}
                      data-testid="btn-accept-invite"
                    >
                      {joinMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Joining...</>
                      ) : (
                        "Accept Invitation"
                      )}
                    </Button>
                    {joinMutation.isError && (
                      <p className="text-sm text-destructive text-center">{(joinMutation.error as any)?.message}</p>
                    )}
                    <Button variant="ghost" className="w-full" onClick={() => navigate("/")}>
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
