import { useQuery, useMutation } from "@tanstack/react-query";
import { Ship, FileText, TrendingUp, Plus, ArrowRight, Crown, Zap, Users, Building2, Anchor, Star, Shield, BarChart3, Activity, Navigation } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Vessel, Proforma, CompanyProfile } from "@shared/schema";

const ROLE_LABELS: Record<string, string> = {
  shipowner: "Shipowner / Broker",
  agent: "Ship Agent",
  provider: "Service Provider",
  admin: "Administrator",
};

const ROLE_SUBTITLES: Record<string, string> = {
  shipowner: "Manage your fleet & browse maritime services.",
  agent: "Manage your fleet & connect with shipowners.",
  provider: "Manage your company profile and services.",
  admin: "Full system access — all users, vessels, and proformas.",
};

function StatCard({
  label,
  value,
  loading,
  icon: Icon,
  color,
  accent,
  href,
  testId,
}: {
  label: string;
  value: React.ReactNode;
  loading?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  accent: string;
  href: string;
  testId: string;
}) {
  return (
    <Link href={href}>
      <Card
        className="p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group overflow-hidden relative"
        data-testid={testId}
        style={{ borderLeft: `3px solid hsl(${color} / 0.5)` }}
      >
        <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-50 transition-opacity duration-200 group-hover:opacity-70"
          style={{ background: `hsl(${color} / 0.04)` }} />
        <div className="flex items-start justify-between gap-3 relative">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="h-9 w-14" />
            ) : (
              <p className="text-3xl font-bold font-serif tracking-tight">{value}</p>
            )}
          </div>
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
            style={{ background: `linear-gradient(135deg, hsl(${color} / 0.15), hsl(${color} / 0.08))` }}
          >
            <Icon className="w-5 h-5" style={{ color: `hsl(${color})` } as React.CSSProperties} />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1 text-xs font-medium transition-colors group-hover:text-foreground" style={{ color: `hsl(${color})` }}>
          <span>View {label}</span>
          <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  );
}

const ADMIN_ROLES = [
  { value: "shipowner", label: "Shipowner / Broker", icon: Ship, color: "hsl(var(--maritime-primary))" },
  { value: "agent", label: "Ship Agent", icon: Anchor, color: "hsl(var(--maritime-secondary))" },
  { value: "provider", label: "Service Provider", icon: Building2, color: "hsl(var(--maritime-accent))" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const userRole = (user as any)?.userRole || "shipowner";
  const activeRole = (user as any)?.activeRole || "agent";

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
  const { data: vessels, isLoading: vesselsLoading } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"], enabled: isAdmin || userRole !== "provider" });
  const { data: proformas, isLoading: proformasLoading } = useQuery<Proforma[]>({ queryKey: ["/api/proformas"], enabled: isAdmin || userRole !== "provider" });
  const { data: featured, isLoading: featuredLoading } = useQuery<CompanyProfile[]>({ queryKey: ["/api/directory/featured"] });
  const { data: myProfile } = useQuery<CompanyProfile | null>({ queryKey: ["/api/company-profile/me"], enabled: isAdmin || userRole === "agent" || userRole === "provider" });
  const { data: adminStats } = useQuery<any>({ queryKey: ["/api/admin/stats"], enabled: isAdmin });

  const recentProformas = proformas?.slice(0, 5) || [];

  const proformaCount = (user as any)?.proformaCount ?? 0;
  const proformaLimit = (user as any)?.proformaLimit ?? 1;
  const proformaPercent = Math.min((proformaCount / proformaLimit) * 100, 100);
  const progressColor = proformaPercent >= 90 ? "bg-red-500" : proformaPercent >= 60 ? "bg-amber-500" : "bg-emerald-500";

  const planConfig = {
    free: { label: "Free Plan", color: "text-slate-500", badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400", icon: Zap },
    standard: { label: "Standard Plan", color: "text-[hsl(var(--maritime-gold))]", badge: "bg-[hsl(var(--maritime-gold)/0.1)] text-[hsl(var(--maritime-gold))]", icon: Ship },
    unlimited: { label: "Unlimited Plan", color: "text-[hsl(var(--maritime-primary))]", badge: "bg-[hsl(var(--maritime-primary)/0.1)] text-[hsl(var(--maritime-primary))]", icon: Crown },
  };
  const plan = (user as any)?.subscriptionPlan || "free";
  const pc = planConfig[plan as keyof typeof planConfig] || planConfig.free;

  return (
    <div className="p-6 space-y-7 max-w-7xl mx-auto">

      {/* Admin Bootstrap — one-time activation for approved admin email */}
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

      {/* Admin Role Switcher — always visible for admin users */}
      {isAdmin && (
        <div className="rounded-xl border-2 border-red-200 dark:border-red-900 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/20 p-4" data-testid="admin-role-switcher">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-7 h-7 rounded-md bg-red-500 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400">Admin Mode</p>
                <p className="text-[11px] text-red-500/70 dark:text-red-500/60">Select view role</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap sm:ml-auto">
              {ADMIN_ROLES.map((role) => {
                const active = effectiveRole === role.value;
                return (
                  <button
                    key={role.value}
                    onClick={() => switchRoleMutation.mutate(role.value)}
                    disabled={switchRoleMutation.isPending}
                    data-testid={`button-switch-role-${role.value}`}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 border-2 ${
                      active
                        ? "border-red-400 bg-white dark:bg-red-950/40 text-red-700 dark:text-red-300 shadow-sm"
                        : "border-transparent bg-white/50 dark:bg-white/5 text-muted-foreground hover:bg-white dark:hover:bg-white/10 hover:text-foreground"
                    }`}
                  >
                    <role.icon className="w-4 h-4" />
                    {role.label}
                    {active && <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>
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
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-red-300 text-red-600" data-testid="badge-admin-role">
                Admin
              </Badge>
            )}
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 border-[hsl(var(--maritime-primary)/0.3)] text-[hsl(var(--maritime-primary))]"
              data-testid="badge-user-role"
            >
              {isAdmin ? ROLE_LABELS[effectiveRole] || effectiveRole : ROLE_LABELS[userRole] || userRole}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {ROLE_SUBTITLES[isAdmin ? "admin" : effectiveRole] || ROLE_SUBTITLES.shipowner}
          </p>
        </div>
        {(isAdmin || userRole !== "provider") && (
          <Link href="/proformas/new">
            <Button size="sm" className="gap-2 shrink-0 shadow-sm" data-testid="button-new-proforma-header">
              <Plus className="w-4 h-4" /> New Proforma
            </Button>
          </Link>
        )}
      </div>

      {/* Admin Stats */}
      {isAdmin && adminStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: adminStats.totalUsers, icon: Users, color: "var(--maritime-primary)", testId: "card-admin-users" },
            { label: "Total Vessels", value: adminStats.totalVessels, icon: Ship, color: "var(--maritime-secondary)", testId: "card-admin-vessels" },
            { label: "Total Proformas", value: adminStats.totalProformas, icon: FileText, color: "var(--maritime-accent)", testId: "card-admin-proformas" },
            { label: "Company Profiles", value: adminStats.totalCompanyProfiles, icon: Building2, color: "38 92% 50%", testId: "card-admin-profiles" },
          ].map((s) => (
            <Card key={s.testId} className="p-4" data-testid={s.testId} style={{ borderLeft: `3px solid hsl(${s.color} / 0.4)` }}>
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                  <p className="text-2xl font-bold font-serif">{s.value}</p>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `hsl(${s.color} / 0.1)` }}>
                  <s.icon className="w-5 h-5" style={{ color: `hsl(${s.color})` } as React.CSSProperties} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Subscription Card */}
      {(isAdmin || userRole !== "provider") && (
        <Card className="p-5 border-[hsl(var(--maritime-primary)/0.2)]" data-testid="card-subscription">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `linear-gradient(135deg, hsl(var(--maritime-primary) / 0.12), hsl(var(--maritime-accent) / 0.08))` }}>
                <pc.icon className={`w-6 h-6 ${pc.color}`} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-serif font-semibold" data-testid="text-plan-name">{pc.label}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${pc.badge}`} data-testid="badge-plan">
                    {plan.toUpperCase()}
                  </span>
                </div>
                {plan !== "unlimited" ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground" data-testid="text-usage">
                      {proformaCount} of {proformaLimit} proformas used
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="relative h-1.5 w-48 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${progressColor}`}
                          style={{ width: `${proformaPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{Math.round(proformaPercent)}%</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground" data-testid="text-usage">Unlimited proforma generations</p>
                )}
              </div>
            </div>
            {plan !== "unlimited" && (
              <Link href="/pricing">
                <Button size="sm" className="gap-1.5 bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)] text-white shadow-sm" data-testid="button-upgrade">
                  <Crown className="w-3.5 h-3.5" /> Upgrade Plan
                </Button>
              </Link>
            )}
          </div>
        </Card>
      )}

      {/* Stat Cards */}
      {(isAdmin || userRole !== "provider") && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCard
            label="Vessels"
            value={vessels?.length || 0}
            loading={vesselsLoading}
            icon={Ship}
            color="var(--maritime-primary)"
            accent="primary"
            href="/vessels"
            testId="card-stat-vessels"
          />
          <StatCard
            label="Proformas"
            value={proformas?.length || 0}
            loading={proformasLoading}
            icon={FileText}
            color="var(--maritime-secondary)"
            accent="secondary"
            href="/proformas"
            testId="card-stat-proformas"
          />
          <StatCard
            label="Directory"
            value={<Users className="w-8 h-8" style={{ color: "hsl(var(--maritime-accent))" }} />}
            icon={Building2}
            color="var(--maritime-accent)"
            accent="accent"
            href="/directory"
            testId="card-stat-directory"
          />
        </div>
      )}

      {/* Create Profile CTA */}
      {(isAdmin || effectiveRole === "agent" || effectiveRole === "provider") && !myProfile && (
        <Card className="p-6 border-dashed border-2 border-[hsl(var(--maritime-primary)/0.25)] bg-[hsl(var(--maritime-primary)/0.02)]" data-testid="card-setup-profile-cta">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="w-14 h-14 rounded-xl bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0">
              <Building2 className="w-7 h-7 text-[hsl(var(--maritime-primary))]" />
            </div>
            <div className="flex-1 text-center sm:text-left space-y-1">
              <p className="font-serif font-semibold text-base">Set Up Your Company Profile</p>
              <p className="text-sm text-muted-foreground">
                Create your profile to appear in the maritime directory. Shipowners and brokers will be able to find and contact you.
              </p>
            </div>
            <Link href="/company-profile">
              <Button className="gap-2 bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)] shadow-sm" data-testid="button-setup-profile">
                <Building2 className="w-4 h-4" /> Create Profile
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Quick Actions + Recent Proformas */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-semibold text-base">Quick Actions</h2>
            <Activity className="w-4 h-4 text-muted-foreground/50" />
          </div>
          <div className="space-y-2">
            {[
              ...(isAdmin || userRole !== "provider" ? [
                { href: "/vessels?new=true", icon: Ship, label: "Add Vessel", desc: "Register a new vessel", color: "var(--maritime-primary)", testId: "button-add-vessel-quick" },
                { href: "/proformas/new", icon: FileText, label: "New Proforma", desc: "Generate a proforma invoice", color: "var(--maritime-secondary)", testId: "button-new-proforma-quick" },
                { href: "/vessel-track", icon: Navigation, label: "Vessel Track", desc: "Track your fleet on the map", color: "217 91% 40%", testId: "button-vessel-track-quick" },
              ] : []),
              ...(isAdmin ? [{ href: "/admin", icon: Shield, label: "Admin Panel", desc: "Manage users and data", color: "0 84% 35%", testId: "button-admin-panel-quick" }] : []),
              { href: "/directory", icon: Users, label: "Browse Directory", desc: "Find agents and providers", color: "var(--maritime-accent)", testId: "button-browse-directory" },
              ...((isAdmin || effectiveRole === "agent" || effectiveRole === "provider") ? [
                { href: "/company-profile", icon: Building2, label: myProfile ? "Edit Profile" : "Create Profile", desc: "Manage your company listing", color: "38 92% 50%", testId: "button-edit-profile-quick" }
              ] : []),
            ].map((action) => (
              <Link key={action.href} href={action.href}>
                <div
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer"
                  data-testid={action.testId}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                    style={{ background: `hsl(${action.color} / 0.1)` }}
                  >
                    <action.icon className="w-4 h-4" style={{ color: `hsl(${action.color})` } as React.CSSProperties} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.desc}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground/80 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {(isAdmin || userRole !== "provider") ? (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-base">{isAdmin ? "All Recent Proformas" : "Recent Proformas"}</h2>
              <Link href="/proformas">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" data-testid="link-view-all-proformas">
                  View All <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
            {proformasLoading ? (
              <div className="space-y-2.5">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
              </div>
            ) : recentProformas.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <div className="w-14 h-14 rounded-xl bg-muted/60 flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">No proformas yet</p>
                  <p className="text-xs text-muted-foreground/70">Create your first proforma to get started</p>
                </div>
                <Link href="/proformas/new">
                  <Button variant="outline" size="sm" data-testid="button-create-first-proforma">Create Your First</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentProformas.map((pda) => (
                  <Link key={pda.id} href={`/proformas/${pda.id}`}>
                    <div className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={`row-proforma-${pda.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center flex-shrink-0">
                          <FileText className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{pda.referenceNumber}</p>
                          <p className="text-xs text-muted-foreground truncate">{pda.purposeOfCall} · {pda.cargoType}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-[hsl(var(--maritime-primary))]">${pda.totalUsd?.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{pda.status}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-6 space-y-4">
            <h2 className="font-serif font-semibold text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" /> Featured Listings
            </h2>
            <p className="text-sm text-muted-foreground">
              Boost your visibility! Featured companies appear at the top of the directory with a highlighted badge.
            </p>
            <Link href="/pricing">
              <Button className="gap-2 bg-amber-500 hover:bg-amber-600 text-white shadow-sm" data-testid="button-get-featured">
                <Star className="w-4 h-4" /> Get Featured
              </Button>
            </Link>
          </Card>
        )}
      </div>

      {/* Featured Companies */}
      {featured && featured.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-semibold text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> Featured Companies
            </h2>
            <Link href="/directory">
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" data-testid="link-view-directory">
                View All <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featured.slice(0, 3).map((profile) => (
              <Card key={profile.id} className="p-5 border-amber-200/60 dark:border-amber-800/40 space-y-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200" data-testid={`card-featured-${profile.id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {profile.logoUrl ? (
                      <img src={profile.logoUrl} alt={profile.companyName} className="w-full h-full object-contain" />
                    ) : profile.companyType === "agent" ? (
                      <Anchor className="w-5 h-5 text-amber-600" />
                    ) : (
                      <Building2 className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{profile.companyName}</p>
                    <p className="text-xs text-muted-foreground">{profile.city || "Turkey"}</p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-0 text-[10px] px-1.5 flex-shrink-0">
                    <Star className="w-2.5 h-2.5 mr-0.5 fill-current" />
                    Featured
                  </Badge>
                </div>
                {profile.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{profile.description}</p>
                )}
                {(profile.serviceTypes as string[])?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(profile.serviceTypes as string[]).slice(0, 3).map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px] h-5">{s}</Badge>
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
