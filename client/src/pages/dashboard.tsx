import { useQuery, useMutation } from "@tanstack/react-query";
import { Ship, Anchor, Building2, Shield, Plus, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { PageMeta } from "@/components/page-meta";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Vessel, Proforma, CompanyProfile } from "@shared/schema";
import { ShipownerDashboard } from "@/components/dashboards/shipowner-dashboard";
import { AgentDashboard } from "@/components/dashboards/agent-dashboard";
import { ProviderDashboard } from "@/components/dashboards/provider-dashboard";
import { AdminDashboard } from "@/components/dashboards/admin-dashboard";

const ROLE_LABELS: Record<string, string> = {
  shipowner: "Shipowner / Broker",
  agent: "Ship Agent",
  provider: "Service Provider",
  admin: "Administrator",
};

const ROLE_SUBTITLES: Record<string, string> = {
  shipowner: "Manage your fleet, tenders, and proformas.",
  agent: "Track tenders, submit bids, and manage your performance.",
  provider: "Build your profile and grow your directory presence.",
  admin: "Full system access — users, vessels, proformas, and analytics.",
};

const ADMIN_ROLES = [
  { value: "admin", label: "Admin Overview", icon: LayoutDashboard, color: "hsl(0, 84%, 35%)" },
  { value: "shipowner", label: "Shipowner", icon: Ship, color: "hsl(var(--maritime-primary))" },
  { value: "agent", label: "Agent", icon: Anchor, color: "hsl(var(--maritime-secondary))" },
  { value: "provider", label: "Provider", icon: Building2, color: "hsl(var(--maritime-accent))" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const userRole = (user as any)?.userRole || "shipowner";
  const activeRole = (user as any)?.activeRole || "admin";

  const isAdmin = userRole === "admin";
  const effectiveRole = isAdmin ? activeRole : userRole;

  const switchRoleMutation = useMutation({
    mutationFn: async (newRole: string) => {
      const res = await apiRequest("PATCH", "/api/admin/active-role", { activeRole: newRole });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vessels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/proformas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
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

  const { data: vesselsRes, isLoading: vesselsLoading } = useQuery<{ data: Vessel[]; pagination: any }>({
    queryKey: ["/api/vessels", "dashboard"],
    queryFn: () => fetch("/api/vessels?limit=500", { credentials: "include" }).then(r => r.json()),
    enabled: effectiveRole === "shipowner" || isAdmin,
  });
  const vessels = vesselsRes?.data ?? [];

  const { data: proformasRes, isLoading: proformasLoading } = useQuery<{ data: Proforma[]; pagination: any }>({
    queryKey: ["/api/proformas", "dashboard"],
    queryFn: () => fetch("/api/proformas?limit=500", { credentials: "include" }).then(r => r.json()),
    enabled: effectiveRole !== "provider" || isAdmin,
  });
  const proformas = proformasRes?.data ?? [];
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
            {ROLE_SUBTITLES[isAdmin ? effectiveRole : effectiveRole] || ROLE_SUBTITLES.shipowner}
          </p>
        </div>
        {effectiveRole !== "provider" && (
          <Link href="/proformas/new">
            <Button size="sm" className="gap-2 shrink-0 shadow-sm bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)] text-white" data-testid="button-new-proforma-header">
              <Plus className="w-4 h-4" /> New Proforma
            </Button>
          </Link>
        )}
      </div>

      {/* ── Admin overview mode: just AdminDashboard ── */}
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
                <span className="text-xs font-bold uppercase tracking-widest text-red-500">Admin Paneli</span>
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
                <span className="text-xs font-bold uppercase tracking-widest text-red-500">Admin Paneli</span>
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
                <span className="text-xs font-bold uppercase tracking-widest text-red-500">Admin Paneli</span>
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
