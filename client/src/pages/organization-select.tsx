import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, ChevronRight, Plus, ArrowLeft } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  agent: "Ship Agent",
  shipowner: "Shipowner",
  broker: "Broker",
  operator: "Operator",
  provider: "Service Provider",
  other: "Other",
};

export default function OrganizationSelectPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: myOrgs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/organizations/my"],
  });

  const switchMutation = useMutation({
    mutationFn: async (orgId: number) => {
      const res = await apiRequest("POST", `/api/organizations/switch/${orgId}`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const activeOrgId = (user as any)?.activeOrganizationId;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl overflow-hidden ring-2 ring-primary/20">
              <img src="/logo-v2.png" alt="VesselPDA" className="w-full h-full object-contain" />
            </div>
          </div>
          <h1 className="text-2xl font-bold font-serif">Select Organization</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Choose which organization you want to work in
          </p>
        </div>

        {/* Org list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : myOrgs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 flex flex-col items-center gap-4">
              <Building2 className="w-10 h-10 text-muted-foreground/40" />
              <div className="text-center">
                <p className="font-semibold">No organizations</p>
                <p className="text-sm text-muted-foreground mt-1">You are not a member of any organization yet</p>
              </div>
              <Button onClick={() => navigate("/organization")}>
                <Plus className="w-4 h-4 mr-2" /> Create Organization
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {myOrgs.map((org: any) => {
              const isActive = org.id === activeOrgId;
              return (
                <button
                  key={org.id}
                  onClick={() => switchMutation.mutate(org.id)}
                  disabled={switchMutation.isPending}
                  data-testid={`btn-select-org-${org.id}`}
                  className={`w-full text-left rounded-xl border p-4 transition-all hover:shadow-md ${
                    isActive
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/40 bg-card"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {org.logo_url ? (
                      <img src={org.logo_url} alt={org.name} className="w-10 h-10 rounded-lg object-contain flex-shrink-0 bg-muted" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{org.name}</span>
                        {isActive && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0">Active</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{TYPE_LABELS[org.type] || org.type}</span>
                        {org.member_role && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground capitalize">{org.member_role}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/organization")} className="gap-2">
            <Plus className="w-4 h-4" /> New Organization
          </Button>
        </div>
      </div>
    </div>
  );
}
