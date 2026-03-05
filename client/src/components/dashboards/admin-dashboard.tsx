import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, Ship, FileText, Building2, TrendingUp, Gavel, ArrowRight, Shield, MessageSquare, Activity, Navigation, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProformaTrendChart, TenderTrendChart, VoyageTrendChart, StatusDistributionChart } from "./dashboard-charts";

function StatCard({ label, value, loading, icon: Icon, color, href, testId }: {
  label: string; value: React.ReactNode; loading?: boolean;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string; href: string; testId: string;
}) {
  return (
    <Link href={href}>
      <Card className="p-4 hover:shadow-lg hover:shadow-black/25 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group relative overflow-hidden animate-fade-in" data-testid={testId}
        style={{ borderLeft: `3px solid hsl(${color} / 0.5)` }}>
        <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-40"
          style={{ background: `hsl(${color} / 0.05)` }} />
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            {loading ? <Skeleton className="h-8 w-12" /> : (
              <p className={`text-3xl font-bold tracking-tight ${typeof value === 'number' && value === 0 ? 'text-slate-500' : 'dark:bg-gradient-to-r dark:from-white dark:to-slate-300 dark:bg-clip-text dark:text-transparent'}`}>{value ?? 0}</p>
            )}
          </div>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
            style={{ background: `hsl(${color} / 0.12)` }}>
            <Icon className="w-4 h-4" style={{ color: `hsl(${color})` } as React.CSSProperties} />
          </div>
        </div>
        <p className="mt-2 text-[11px] font-medium flex items-center gap-1" style={{ color: `hsl(${color})` }}>
          View <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </p>
      </Card>
    </Link>
  );
}

const roleColors: Record<string, string> = {
  shipowner: "bg-[hsl(var(--maritime-primary)/0.1)] text-[hsl(var(--maritime-primary))]",
  agent: "bg-[hsl(var(--maritime-secondary)/0.1)] text-[hsl(var(--maritime-secondary))]",
  provider: "bg-[hsl(var(--maritime-accent)/0.1)] text-[hsl(var(--maritime-accent))]",
  admin: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  broker: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
};

export function AdminDashboard({ adminStats }: { adminStats: any }) {
  const { data: activityFeed, isLoading: activityLoading } = useQuery<any[]>({
    queryKey: ["/api/activity-feed"],
  });
  const { data: dashData } = useQuery<any>({ queryKey: ["/api/stats/dashboard"] });

  const quickActions = [
    { href: "/admin", icon: Shield, label: "Admin Panel", desc: "Manage users, plans & suspensions", color: "0 84% 35%", testId: "qa-admin" },
    { href: "/admin#users", icon: Users, label: "User Management", desc: "View and manage all users", color: "var(--maritime-primary)", testId: "qa-users" },
    { href: "/proformas", icon: FileText, label: "All Proformas", desc: "View all system proformas", color: "var(--maritime-secondary)", testId: "qa-proformas" },
    { href: "/admin#settings", icon: Navigation, label: "System Settings", desc: "API keys and system config", color: "var(--maritime-accent)", testId: "qa-settings" },
    { href: "/directory", icon: Building2, label: "Directory", desc: "Company listings", color: "142 71% 30%", testId: "qa-directory" },
    { href: "/forum", icon: MessageSquare, label: "Forum", desc: "Discussion board", color: "217 91% 40%", testId: "qa-forum" },
  ];

  const aisConnected = true;

  return (
    <div className="space-y-6">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={adminStats?.totalUsers} icon={Users} color="var(--maritime-primary)" href="/admin" testId="stat-admin-users" />
        <StatCard label="Total Vessels" value={adminStats?.totalVessels} icon={Ship} color="var(--maritime-secondary)" href="/admin" testId="stat-admin-vessels" />
        <StatCard label="Total Voyages" value={adminStats?.totalVoyages ?? adminStats?.activeVoyages ?? "—"} icon={Navigation} color="var(--maritime-accent)" href="/admin" testId="stat-admin-voyages" />
        <StatCard label="System Status" value={aisConnected ? "Online" : "Offline"} icon={CheckCircle2} color="142 71% 35%" href="/admin" testId="stat-system-status" />
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ProformaTrendChart />
        <TenderTrendChart />
        <VoyageTrendChart />
      </div>

      {/* Status Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatusDistributionChart title="Tender Status Distribution" data={dashData?.tenderDistribution || []} testId="chart-tender-dist" />
        <StatusDistributionChart title="Voyage Status Distribution" data={dashData?.voyageDistribution || []} testId="chart-voyage-dist" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Activity Feed */}
          <Card className="p-5 space-y-4" data-testid="card-activity-feed">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground/60" /> Recent Activity
              </h2>
            </div>
            {activityLoading ? (
              <div className="space-y-2.5">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}</div>
            ) : !activityFeed?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
            ) : (
              <div className="space-y-1.5">
                {activityFeed.slice(0, 8).map((item: any, i: number) => {
                  const timeAgo = item.timestamp ? (() => {
                    const diff = Date.now() - new Date(item.timestamp).getTime();
                    const h = Math.floor(diff / 3600000);
                    const d = Math.floor(diff / 86400000);
                    return d > 0 ? `${d}d ago` : h > 0 ? `${h}h ago` : "just now";
                  })() : "";
                  return (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40 transition-colors" data-testid={`activity-${i}`}>
                      <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0 text-sm">
                        {item.icon === "ship" ? "🚢" : item.icon === "user" ? "👤" : item.icon === "building" ? "🏢" : "📄"}
                      </div>
                      <p className="text-sm flex-1 min-w-0 truncate">{item.message}</p>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* User Role Breakdown */}
          {adminStats?.usersByRole && (
            <Card className="p-5 space-y-3" data-testid="card-user-roles">
              <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground/60" /> Users by Role
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(adminStats.usersByRole as Record<string, number>).map(([role, count]) => (
                  <div key={role} className="p-3 rounded-xl bg-muted/40 text-center space-y-1" data-testid={`role-count-${role}`}>
                    <p className="text-xl font-bold font-serif">{count}</p>
                    <Badge className={`text-[10px] capitalize ${roleColors[role] || "bg-muted text-muted-foreground"}`}>{role}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right: Quick Actions */}
        <div>
          <Card className="p-5 space-y-3">
            <h2 className="font-serif font-semibold text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground/60" /> Admin Actions
            </h2>
            <div className="space-y-1.5">
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={action.testId}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `hsl(${action.color} / 0.1)` }}>
                      <action.icon className="w-4 h-4" style={{ color: `hsl(${action.color})` } as React.CSSProperties} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{action.label}</p>
                      <p className="text-xs text-muted-foreground">{action.desc}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
            <div className="pt-2 border-t border-border/50">
              <Link href="/admin">
                <Button className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white" size="sm" data-testid="button-admin-panel">
                  <Shield className="w-3.5 h-3.5" /> Open Admin Panel
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
