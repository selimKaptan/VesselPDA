import { useMutation } from "@tanstack/react-query";
import { Shield, Plus, Anchor, Ship, Handshake, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { PageMeta } from "@/components/page-meta";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AgentDashboard } from "@/components/dashboards/agent-dashboard";
import { ShipownerDashboard } from "@/components/dashboards/shipowner-dashboard";
import { BrokerDashboard } from "@/components/dashboards/broker-dashboard";
import { ProviderDashboard } from "@/components/dashboards/provider-dashboard";
import { AdminDashboard } from "@/components/dashboards/admin-dashboard";

const ROLE_LABELS: Record<string, string> = {
  ship_agent:    "Ship Agent",
  shipowner:     "Shipowner",
  ship_broker:   "Ship Broker",
  ship_provider: "Service Provider",
  admin:         "Administrator",
};

const ROLE_SUBTITLES: Record<string, string> = {
  ship_agent:    "Manage port operations, proformas, tenders and voyages.",
  shipowner:     "Manage your fleet, fixtures, compliance and commercial operations.",
  ship_broker:   "Charter parties, cargo positions, fixtures and fleet management.",
  ship_provider: "Service requests, tenders and invoices.",
  admin:         "Full system access — users, vessels, proformas and analytics.",
};

const ADMIN_ROLES: { value: AppRole; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "admin",        label: "Admin",    icon: Shield },
  { value: "ship_agent",   label: "Agent",    icon: Anchor },
  { value: "shipowner",    label: "Owner",    icon: Ship },
  { value: "ship_broker",  label: "Broker",   icon: Handshake },
  { value: "ship_provider",label: "Provider", icon: Wrench },
];

const ROLE_BADGE_COLORS: Record<string, string> = {
  ship_agent:    "border-blue-400/40 text-blue-600 dark:text-blue-400",
  shipowner:     "border-green-400/40 text-green-600 dark:text-green-400",
  ship_broker:   "border-orange-400/40 text-orange-600 dark:text-orange-400",
  ship_provider: "border-purple-400/40 text-purple-600 dark:text-purple-400",
  admin:         "border-red-400/40 text-red-600 dark:text-red-400",
};

export default function Dashboard() {
  const { user, role, userRole, isAdmin } = useAuth();
  const activeRole = (user as any)?.activeRole as AppRole | undefined;
  const effectiveRole: AppRole = isAdmin ? (activeRole || "admin") : (role || "shipowner");

  const switchRoleMutation = useMutation({
    mutationFn: async (newRole: string) => {
      const res = await apiRequest("PATCH", "/api/admin/active-role", { activeRole: newRole });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const roleLabel = ROLE_LABELS[effectiveRole] || effectiveRole;
  const roleSub = ROLE_SUBTITLES[effectiveRole] || "";
  const badgeCls = ROLE_BADGE_COLORS[userRole || effectiveRole] || "border-slate-300 text-slate-600";

  return (
    <div className="px-3 py-5 space-y-5 max-w-7xl mx-auto">
      <PageMeta title="Dashboard | VesselPDA" description="Your maritime operations dashboard — vessels, proformas, tenders, and fleet activity." />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-welcome">
              Welcome back, {user?.firstName || "Captain"}
            </h1>
            {isAdmin && (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-red-300 text-red-600 dark:border-red-700 dark:text-red-400" data-testid="badge-admin-role">
                Admin
              </Badge>
            )}
            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${badgeCls}`} data-testid="badge-user-role">
              {ROLE_LABELS[userRole || effectiveRole] || roleLabel}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{roleSub}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {effectiveRole !== "ship_provider" && (
            <Link href="/proformas/new">
              <Button size="sm" className="gap-1.5 shadow-sm bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)] text-white" data-testid="button-new-proforma-header">
                <Plus className="w-4 h-4" /> New Proforma
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Admin role switcher banner ── */}
      {isAdmin && (
        <div className="rounded-xl border-2 border-red-200 dark:border-red-900 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/20 p-3" data-testid="admin-role-switcher">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-6 h-6 rounded-md bg-red-500 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400">Admin — View As</p>
            </div>
            <div className="flex gap-1.5 flex-wrap sm:ml-auto">
              {ADMIN_ROLES.map((r) => {
                const active = effectiveRole === r.value;
                return (
                  <button
                    key={r.value}
                    onClick={() => switchRoleMutation.mutate(r.value)}
                    disabled={switchRoleMutation.isPending}
                    data-testid={`button-switch-role-${r.value}`}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                      active
                        ? "border-red-400 bg-white dark:bg-red-950/40 text-red-700 dark:text-red-300 shadow-sm"
                        : "border-transparent bg-white/50 dark:bg-white/5 text-muted-foreground hover:bg-white dark:hover:bg-white/10"
                    }`}
                  >
                    <r.icon className="w-3 h-3" />
                    {r.label}
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Dashboard by role ── */}
      {effectiveRole === "ship_agent"   && <AgentDashboard user={user} />}
      {effectiveRole === "shipowner"    && <ShipownerDashboard user={user} />}
      {effectiveRole === "ship_broker"  && <BrokerDashboard user={user} />}
      {effectiveRole === "ship_provider"&& <ProviderDashboard user={user} />}
      {effectiveRole === "admin"        && <AdminDashboard user={user} />}
    </div>
  );
}
