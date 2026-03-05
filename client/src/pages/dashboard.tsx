import { useQuery, useMutation } from "@tanstack/react-query";
import { Ship, Anchor, Building2, Shield, Plus, LayoutDashboard, Handshake, CheckCircle2, Circle, ChevronRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { PageMeta } from "@/components/page-meta";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Vessel, Proforma, CompanyProfile } from "@shared/schema";
import { ShipownerDashboard } from "@/components/dashboards/shipowner-dashboard";
import { AgentDashboard } from "@/components/dashboards/agent-dashboard";
import { ProviderDashboard } from "@/components/dashboards/provider-dashboard";
import { AdminDashboard } from "@/components/dashboards/admin-dashboard";
import { BrokerDashboard } from "@/components/dashboards/broker-dashboard";

function GettingStartedChecklist({ vessels, proformas, myProfile }: { vessels: Vessel[] | undefined; proformas: Proforma[] | undefined; myProfile: any }) {
  const hasProfile = !!myProfile && (!!myProfile.companyName || !!myProfile.email);
  const hasVessel = (vessels?.length || 0) > 0;
  const hasProforma = (proformas?.length || 0) > 0;

  const steps = [
    { label: "Complete your company profile", href: "/company-profile", done: hasProfile },
    { label: "Add your first vessel", href: "/vessels", done: hasVessel },
    { label: "Create your first proforma", href: "/proformas/new", done: hasProforma },
    { label: "Explore the port directory", href: "/directory", done: false },
    { label: "Join the community forum", href: "/forum", done: false },
  ];

  return (
    <Card className="border-[hsl(var(--maritime-primary)/0.2)] bg-gradient-to-br from-white to-sky-50/30 dark:from-slate-950 dark:to-sky-950/10 overflow-hidden" data-testid="card-getting-started">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-sky-500" />
          </div>
          Getting Started with VesselPDA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {steps.map((step, i) => (
          <Link key={i} href={step.href}>
            <div
              className="flex items-center justify-between p-3 rounded-lg hover:bg-white/50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
              data-testid={`checklist-item-${i}`}
            >
              <div className="flex items-center gap-3">
                {step.done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground/30" />
                )}
                <span className={`text-sm font-medium ${step.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {step.label}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

const ROLE_LABELS: Record<string, string> = {
  shipowner: "Shipowner",
  agent: "Ship Agent",
  broker: "Ship Broker",
  provider: "Service Provider",
  admin: "Administrator",
};

const ROLE_SUBTITLES: Record<string, string> = {
  shipowner: "Manage your fleet, tenders, and proformas.",
  agent: "Track tenders, submit bids, and manage your performance.",
  broker: "Manage fixtures, cargo positions, and market intelligence.",
  provider: "Build your profile and grow your directory presence.",
  admin: "Full system access — users, vessels, proformas, and analytics.",
};

const ADMIN_ROLES = [
  { value: "admin", label: "Admin Overview", icon: LayoutDashboard, color: "hsl(0, 84%, 35%)" },
  { value: "shipowner", label: "Shipowner", icon: Ship, color: "hsl(var(--maritime-primary))" },
  { value: "agent", label: "Agent", icon: Anchor, color: "hsl(var(--maritime-secondary))" },
  { value: "broker", label: "Broker", icon: Handshake, color: "hsl(270, 70%, 50%)" },
  { value: "provider", label: "Provider", icon: Building2, color: "hsl(var(--maritime-accent))" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const userRole = (user as any)?.userRole || "shipowner";
  const activeRole = (user as any)?.activeRole || "admin";

  const isAdmin = userRole === "admin";
  const effectiveRole = isAdmin ? activeRole : userRole;

  const { toast } = useToast();

  const switchRoleMutation = useMutation({
    mutationFn: async (newRole: string) => {
      const res = await apiRequest("PATCH", "/api/admin/active-role", { activeRole: newRole });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      queryClient.refetchQueries({ queryKey: ["/api/vessels"] });
      queryClient.refetchQueries({ queryKey: ["/api/proformas"] });
      queryClient.refetchQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (err: any) => {
      toast({ title: "Role switch failed", description: err.message, variant: "destructive" });
    },
  });

  const bootstrapAdminMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/bootstrap", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const { data: vessels, isLoading: vesselsLoading } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
    enabled: effectiveRole === "shipowner" || isAdmin,
  });
  const { data: proformas, isLoading: proformasLoading } = useQuery<Proforma[]>({
    queryKey: ["/api/proformas"],
    enabled: effectiveRole !== "provider" || isAdmin,
  });
  const { data: myProfile } = useQuery<CompanyProfile | null>({
    queryKey: ["/api/company-profile/me"],
    enabled: effectiveRole === "agent" || effectiveRole === "provider" || isAdmin,
  });
  const { data: adminStats } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    enabled: isAdmin,
  });
  const { data: tendersData } = useQuery<any>({
    queryKey: ["/api/tenders"],
    enabled: effectiveRole !== "provider" || isAdmin,
  });
  const { data: notificationsData } = useQuery<any>({
    queryKey: ["/api/notifications"],
  });
  const { data: myBidsData } = useQuery<any>({
    queryKey: ["/api/tenders/my-bids"],
    enabled: effectiveRole === "agent",
  });

  const tenders: any[] = tendersData?.tenders || [];
  const plan = (user as any)?.subscriptionPlan || "free";
  const proformaCount = (user as any)?.proformaCount ?? 0;
  const proformaLimit = (user as any)?.proformaLimit ?? 1;

  const hasProfile = !!myProfile && (!!myProfile.companyName || !!myProfile.email);
  const hasVessel = (vessels?.length || 0) > 0;
  const hasProforma = (proformas?.length || 0) > 0;

  const adminRoleSwitcher = isAdmin && (
    <div className="rounded-xl border-2 border-red-200 dark:border-red-900 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/20 p-4" data-testid="admin-role-switcher">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-md bg-red-500 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400">Admin Mode</p>
            <p className="text-[11px] text-red-500/70 dark:text-red-500/60">Select dashboard view</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap sm:ml-auto">
          {ADMIN_ROLES.map((role) => {
            const active = effectiveRole === role.value || (role.value === "admin" && effectiveRole === "admin");
            return (
              <button
                key={role.value}
                onClick={() => switchRoleMutation.mutate(role.value)}
                disabled={switchRoleMutation.isPending}
                data-testid={`button-switch-role-${role.value}`}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 border-2 ${
                  active
                    ? "border-red-400 bg-white dark:bg-red-950/40 text-red-700 dark:text-red-300 shadow-sm"
                    : "border-transparent bg-white/50 dark:bg-white/5 text-muted-foreground hover:bg-white dark:hover:bg-white/10 hover:text-foreground"
                }`}
              >
                <role.icon className="w-3.5 h-3.5" />
                {role.label}
                {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="px-3 py-5 space-y-6 max-w-7xl mx-auto">
      <PageMeta title="Dashboard | VesselPDA" description="Your maritime operations dashboard — vessels, proformas, tenders, and fleet activity." />

      {/* Admin Bootstrap (non-admin users only) */}
      {!isAdmin && bootstrapAdminMutation.isSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-sm text-emerald-700 dark:text-emerald-400 font-medium">
          Admin mode activated! Refresh the page (F5).
        </div>
      )}
      {!isAdmin && (
        <div className="flex justify-end">
          <button
            onClick={() => bootstrapAdminMutation.mutate()}
            disabled={bootstrapAdminMutation.isPending || bootstrapAdminMutation.isSuccess}
            data-testid="button-bootstrap-admin"
            className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors px-2 py-1"
          >
            {bootstrapAdminMutation.isPending ? "..." : bootstrapAdminMutation.isSuccess ? "✓" : "⚙"}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-welcome">
              Welcome back, {user?.firstName || "Captain"}
            </h1>
            {isAdmin && (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-red-300 text-red-600 dark:border-red-700 dark:text-red-400" data-testid="badge-admin-role">
                Admin
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-[hsl(var(--maritime-primary)/0.3)] text-[hsl(var(--maritime-primary))]" data-testid="badge-user-role">
              {ROLE_LABELS[isAdmin ? effectiveRole : userRole] || userRole}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {ROLE_SUBTITLES[effectiveRole] || ROLE_SUBTITLES.shipowner}
          </p>
        </div>
        {effectiveRole !== "provider" && effectiveRole !== "broker" && (
          <Link href="/proformas/new">
            <Button size="sm" className="gap-2 shrink-0 shadow-sm bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)] text-white" data-testid="button-new-proforma-header">
              <Plus className="w-4 h-4" /> New Proforma
            </Button>
          </Link>
        )}
      </div>

      {effectiveRole !== "admin" && !hasProfile && !hasVessel && !hasProforma && (
        <GettingStartedChecklist vessels={vessels} proformas={proformas} myProfile={myProfile} />
      )}

      {/* ── Admin overview mode ── */}
      {effectiveRole === "admin" && (
        <>
          <AdminDashboard adminStats={adminStats} />
          {adminRoleSwitcher}
        </>
      )}

      {/* ── Shipowner view ── */}
      {effectiveRole === "shipowner" && (
        <>
          <ShipownerDashboard
            user={user}
            vessels={vessels}
            vesselsLoading={vesselsLoading}
            proformas={proformas}
            proformasLoading={proformasLoading}
            tenders={tenders}
            notificationsData={notificationsData}
            plan={plan}
            proformaCount={proformaCount}
            proformaLimit={proformaLimit}
          />
          {isAdmin && (
            <>
              <Separator className="my-2" />
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-red-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-red-500">Admin Panel</span>
              </div>
              <AdminDashboard adminStats={adminStats} />
              {adminRoleSwitcher}
            </>
          )}
        </>
      )}

      {/* ── Agent view ── */}
      {effectiveRole === "agent" && (
        <>
          <AgentDashboard
            user={user}
            tenders={tenders}
            myBidsData={myBidsData}
            myProfile={myProfile}
            notificationsData={notificationsData}
          />
          {isAdmin && (
            <>
              <Separator className="my-2" />
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-red-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-red-500">Admin Panel</span>
              </div>
              <AdminDashboard adminStats={adminStats} />
              {adminRoleSwitcher}
            </>
          )}
        </>
      )}

      {/* ── Broker view ── */}
      {effectiveRole === "broker" && (
        <>
          <BrokerDashboard user={user} />
          {isAdmin && (
            <>
              <Separator className="my-2" />
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-red-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-red-500">Admin Panel</span>
              </div>
              <AdminDashboard adminStats={adminStats} />
              {adminRoleSwitcher}
            </>
          )}
        </>
      )}

      {/* ── Provider view ── */}
      {effectiveRole === "provider" && (
        <>
          <ProviderDashboard
            user={user}
            myProfile={myProfile}
          />
          {isAdmin && (
            <>
              <Separator className="my-2" />
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-red-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-red-500">Admin Panel</span>
              </div>
              <AdminDashboard adminStats={adminStats} />
              {adminRoleSwitcher}
            </>
          )}
        </>
      )}
    </div>
  );
}
