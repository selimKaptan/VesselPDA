import { useQuery, useMutation } from "@tanstack/react-query";
import { Ship, FileText, TrendingUp, Plus, ArrowRight, Crown, Zap, Users, Building2, Anchor, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Vessel, Proforma, CompanyProfile } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRole = (user as any)?.userRole || "shipowner";

  const { data: vessels, isLoading: vesselsLoading } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"], enabled: userRole !== "provider" });
  const { data: proformas, isLoading: proformasLoading } = useQuery<Proforma[]>({ queryKey: ["/api/proformas"], enabled: userRole !== "provider" });
  const { data: featured, isLoading: featuredLoading } = useQuery<CompanyProfile[]>({ queryKey: ["/api/directory/featured"] });
  const { data: myProfile } = useQuery<CompanyProfile | null>({ queryKey: ["/api/company-profile/me"], enabled: userRole === "agent" || userRole === "provider" });

  const roleMutation = useMutation({
    mutationFn: async (role: string) => {
      const res = await apiRequest("PATCH", "/api/user/role", { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Role updated. Please refresh the page to see changes." });
      window.location.reload();
    },
  });

  const recentProformas = proformas?.slice(0, 5) || [];

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-welcome">
            Welcome back, {user?.firstName || "Captain"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {userRole === "agent" ? "Manage your fleet & connect with shipowners." :
             userRole === "provider" ? "Manage your company profile and services." :
             "Create proformas and find trusted maritime services."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">I am a:</span>
          <Select value={userRole} onValueChange={(v) => roleMutation.mutate(v)}>
            <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="shipowner">Shipowner / Broker</SelectItem>
              <SelectItem value="agent">Ship Agent</SelectItem>
              <SelectItem value="provider">Service Provider</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {userRole !== "provider" && (
        <Card className="p-6 border-[hsl(var(--maritime-accent)/0.3)]" data-testid="card-subscription">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[hsl(var(--maritime-accent)/0.1)] flex items-center justify-center flex-shrink-0">
                {(user as any)?.subscriptionPlan === "unlimited" ? (
                  <Crown className="w-6 h-6 text-[hsl(var(--maritime-accent))]" />
                ) : (
                  <Zap className="w-6 h-6 text-[hsl(var(--maritime-accent))]" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-serif font-semibold" data-testid="text-plan-name">
                    {(user as any)?.subscriptionPlan === "free" ? "Free Plan" :
                     (user as any)?.subscriptionPlan === "standard" ? "Standard Plan" : "Unlimited Plan"}
                  </p>
                  <Badge
                    variant={(user as any)?.subscriptionPlan === "unlimited" ? "default" : "outline"}
                    className={(user as any)?.subscriptionPlan === "unlimited" ? "bg-[hsl(var(--maritime-accent))] text-white" : ""}
                    data-testid="badge-plan"
                  >
                    {((user as any)?.subscriptionPlan || "free").toUpperCase()}
                  </Badge>
                </div>
                {(user as any)?.subscriptionPlan !== "unlimited" ? (
                  <div className="space-y-1.5">
                    <p className="text-sm text-muted-foreground" data-testid="text-usage">
                      {(user as any)?.proformaCount ?? 0} / {(user as any)?.proformaLimit ?? 1} proformas used
                    </p>
                    <Progress
                      value={Math.min((((user as any)?.proformaCount ?? 0) / ((user as any)?.proformaLimit ?? 1)) * 100, 100)}
                      className="h-2 w-48"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground" data-testid="text-usage">Unlimited proforma generations</p>
                )}
              </div>
            </div>
            {(user as any)?.subscriptionPlan !== "unlimited" && (
              <Link href="/pricing">
                <Button size="sm" className="bg-[hsl(var(--maritime-accent))] hover:bg-[hsl(var(--maritime-accent)/0.9)] text-white gap-1.5" data-testid="button-upgrade">
                  <Crown className="w-3.5 h-3.5" />
                  Upgrade Plan
                </Button>
              </Link>
            )}
          </div>
        </Card>
      )}

      {userRole !== "provider" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/vessels">
            <Card className="p-6 hover-elevate cursor-pointer" data-testid="card-stat-vessels">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Vessels</p>
                  {vesselsLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-3xl font-bold font-serif">{vessels?.length || 0}</p>}
                </div>
                <div className="w-12 h-12 rounded-md bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0">
                  <Ship className="w-6 h-6 text-[hsl(var(--maritime-primary))]" />
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/proformas">
            <Card className="p-6 hover-elevate cursor-pointer" data-testid="card-stat-proformas">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Proformas</p>
                  {proformasLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-3xl font-bold font-serif">{proformas?.length || 0}</p>}
                </div>
                <div className="w-12 h-12 rounded-md bg-[hsl(var(--maritime-secondary)/0.1)] flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-[hsl(var(--maritime-secondary))]" />
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/directory">
            <Card className="p-6 hover-elevate cursor-pointer" data-testid="card-stat-directory">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Directory</p>
                  <p className="text-3xl font-bold font-serif"><Users className="w-7 h-7 inline" /></p>
                </div>
                <div className="w-12 h-12 rounded-md bg-[hsl(var(--maritime-accent)/0.1)] flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-6 h-6 text-[hsl(var(--maritime-accent))]" />
                </div>
              </div>
            </Card>
          </Link>
        </div>
      )}

      {(userRole === "agent" || userRole === "provider") && !myProfile && (
        <Card className="p-6 border-dashed border-2 border-[hsl(var(--maritime-primary)/0.3)] bg-[hsl(var(--maritime-primary)/0.03)]" data-testid="card-setup-profile-cta">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-14 h-14 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0">
              <Building2 className="w-7 h-7 text-[hsl(var(--maritime-primary))]" />
            </div>
            <div className="flex-1 text-center sm:text-left space-y-1">
              <p className="font-serif font-semibold text-lg">Set Up Your Company Profile</p>
              <p className="text-sm text-muted-foreground">
                Create your profile to appear in the maritime directory. Shipowners and brokers will be able to find and contact you.
              </p>
            </div>
            <Link href="/company-profile">
              <Button className="gap-2 bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)]" data-testid="button-setup-profile">
                <Building2 className="w-4 h-4" />
                Create Profile
              </Button>
            </Link>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif font-semibold text-lg">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {userRole !== "provider" && (
              <>
                <Link href="/vessels?new=true">
                  <Card className="p-4 hover-elevate cursor-pointer space-y-2" data-testid="button-add-vessel-quick">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center">
                        <Plus className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                      </div>
                      <span className="font-medium text-sm">Add Vessel</span>
                    </div>
                  </Card>
                </Link>
                <Link href="/proformas/new">
                  <Card className="p-4 hover-elevate cursor-pointer space-y-2" data-testid="button-new-proforma-quick">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-[hsl(var(--maritime-secondary)/0.1)] flex items-center justify-center">
                        <FileText className="w-4 h-4 text-[hsl(var(--maritime-secondary))]" />
                      </div>
                      <span className="font-medium text-sm">New Proforma</span>
                    </div>
                  </Card>
                </Link>
              </>
            )}
            <Link href="/directory">
              <Card className="p-4 hover-elevate cursor-pointer space-y-2" data-testid="button-browse-directory">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md bg-[hsl(var(--maritime-accent)/0.1)] flex items-center justify-center">
                    <Users className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />
                  </div>
                  <span className="font-medium text-sm">Browse Directory</span>
                </div>
              </Card>
            </Link>
            {(userRole === "agent" || userRole === "provider") && (
              <Link href="/company-profile">
                <Card className="p-4 hover-elevate cursor-pointer space-y-2" data-testid="button-edit-profile-quick">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-amber-600" />
                    </div>
                    <span className="font-medium text-sm">{myProfile ? "Edit Profile" : "Create Profile"}</span>
                  </div>
                </Card>
              </Link>
            )}
          </div>
        </Card>

        {userRole !== "provider" ? (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-serif font-semibold text-lg">Recent Proformas</h2>
              <Link href="/proformas">
                <Button variant="ghost" size="sm" className="gap-1 text-xs" data-testid="link-view-all-proformas">
                  View All <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
            {proformasLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recentProformas.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">No proformas yet</p>
                <Link href="/proformas/new">
                  <Button variant="outline" size="sm" data-testid="button-create-first-proforma">Create Your First</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentProformas.map((pda) => (
                  <Link key={pda.id} href={`/proformas/${pda.id}`}>
                    <div className="flex items-center justify-between gap-4 p-3 rounded-md hover-elevate cursor-pointer" data-testid={`row-proforma-${pda.id}`}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{pda.referenceNumber}</p>
                        <p className="text-xs text-muted-foreground truncate">{pda.purposeOfCall} - {pda.cargoType}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold">${pda.totalUsd?.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{pda.status}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-6 space-y-4">
            <h2 className="font-serif font-semibold text-lg flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Featured Listings
            </h2>
            <p className="text-sm text-muted-foreground">
              Boost your visibility! Featured companies appear at the top of the directory with a highlighted badge.
            </p>
            <Link href="/pricing">
              <Button className="gap-2 bg-amber-500 hover:bg-amber-600 text-white" data-testid="button-get-featured">
                <Star className="w-4 h-4" />
                Get Featured
              </Button>
            </Link>
          </Card>
        )}
      </div>

      {featured && featured.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif font-semibold text-lg flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              Featured Companies
            </h2>
            <Link href="/directory">
              <Button variant="ghost" size="sm" className="gap-1 text-xs" data-testid="link-view-directory">
                View All <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featured.slice(0, 3).map((profile) => (
              <Card key={profile.id} className="p-5 border-amber-200 dark:border-amber-800 space-y-3" data-testid={`card-featured-${profile.id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center flex-shrink-0">
                    {profile.companyType === "agent" ? (
                      <Anchor className="w-5 h-5 text-amber-600" />
                    ) : (
                      <Building2 className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{profile.companyName}</p>
                    <p className="text-xs text-muted-foreground">{profile.city || "Turkey"}</p>
                  </div>
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0 ml-auto" />
                </div>
                {profile.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{profile.description}</p>
                )}
                {(profile.serviceTypes as string[])?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(profile.serviceTypes as string[]).slice(0, 3).map(s => (
                      <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
