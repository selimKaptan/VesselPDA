import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Users, Ship, FileText, Building2, TrendingUp, Gavel, ArrowRight, Shield, MessageSquare, Activity, User, Database, Wifi, WifiOff, CheckCircle2, XCircle, Clock, AlertCircle, HardDrive } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  proforma: FileText, vessel: Ship, user: User, company: Building2,
};

function StatTile({ label, value, icon: Icon, color, testId, href }: {
  label: string; value: number | string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string; testId: string; href?: string;
}) {
  const inner = (
    <Card className={`p-4 ${href ? "hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer" : ""}`} data-testid={testId} style={{ borderLeft: `3px solid hsl(${color} / 0.4)` }}>
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold font-serif">{value ?? 0}</p>
        </div>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `hsl(${color} / 0.1)` }}>
          <Icon className="w-5 h-5" style={{ color: `hsl(${color})` } as React.CSSProperties} />
        </div>
      </div>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className={`font-medium ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{ok ? "OK" : "Error"}</span>
    </div>
  );
}

const HOUR_LABELS = ["12a","1a","2a","3a","4a","5a","6a","7a","8a","9a","10a","11a","12p","1p","2p","3p","4p","5p","6p","7p","8p","9p","10p","11p"];

function HourlyHeatmap({ data }: { data: { hour: number; count: number }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="grid grid-cols-12 gap-1" data-testid="heatmap-hourly">
      {data.map((d) => {
        const intensity = d.count / maxCount;
        return (
          <div
            key={d.hour}
            title={`${HOUR_LABELS[d.hour]}: ${d.count} actions`}
            className="rounded h-6 flex items-center justify-center text-[9px] font-medium transition-all hover:scale-110"
            style={{
              background: intensity === 0
                ? "hsl(var(--muted))"
                : `hsl(var(--maritime-primary) / ${0.1 + intensity * 0.85})`,
              color: intensity > 0.5 ? "white" : "hsl(var(--muted-foreground))",
            }}
          >
            {d.count > 0 ? d.count : ""}
          </div>
        );
      })}
      {data.map((d) => (
        <div key={`label-${d.hour}`} className="text-[9px] text-center text-muted-foreground/60">
          {d.hour % 4 === 0 ? HOUR_LABELS[d.hour] : ""}
        </div>
      ))}
    </div>
  );
}

export function AdminDashboard({ adminStats }: { adminStats: any }) {
  const { data: activityFeed, isLoading: activityLoading } = useQuery<any[]>({
    queryKey: ["/api/activity-feed"],
  });

  const { data: userGrowth, isLoading: growthLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/reports/user-growth"],
  });

  const { data: hourlyActivity, isLoading: hourlyLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/hourly-activity"],
  });

  const { data: systemHealth, isLoading: healthLoading } = useQuery<any>({
    queryKey: ["/api/admin/system-health"],
  });

  const { data: auditLogs } = useQuery<any>({
    queryKey: ["/api/admin/audit-logs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/audit-logs?limit=10", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const roleColors: Record<string, string> = {
    shipowner: "bg-[hsl(var(--maritime-primary)/0.1)] text-[hsl(var(--maritime-primary))]",
    agent: "bg-[hsl(var(--maritime-secondary)/0.1)] text-[hsl(var(--maritime-secondary))]",
    provider: "bg-[hsl(var(--maritime-accent)/0.1)] text-[hsl(var(--maritime-accent))]",
    admin: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  };

  const quickActions = [
    { href: "/admin", icon: Shield, label: "Admin Panel", desc: "Manage users, plans & suspensions", color: "0 84% 35%", testId: "qa-admin" },
    { href: "/proformas", icon: FileText, label: "All Proformas", desc: "View all system proformas", color: "var(--maritime-secondary)", testId: "qa-proformas" },
    { href: "/directory", icon: Building2, label: "Directory", desc: "Company listings", color: "var(--maritime-accent)", testId: "qa-directory" },
    { href: "/forum", icon: MessageSquare, label: "Forum", desc: "Discussion board", color: "142 71% 30%", testId: "qa-forum" },
  ];

  const recentAuditLogs: any[] = (auditLogs?.data || auditLogs?.logs || []).slice(0, 10);

  return (
    <div className="space-y-5">
      {/* 6-card stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatTile label="Total Users" value={adminStats?.totalUsers} icon={Users} color="var(--maritime-primary)" testId="card-admin-users" href="/admin" />
        <StatTile label="New This Week" value={adminStats?.weeklyUsers} icon={TrendingUp} color="var(--maritime-secondary)" testId="card-admin-weekly-users" href="/admin" />
        <StatTile label="Total Vessels" value={adminStats?.totalVessels} icon={Ship} color="var(--maritime-accent)" testId="card-admin-vessels" href="/admin" />
        <StatTile label="Total Proformas" value={adminStats?.totalProformas} icon={FileText} color="38 92% 50%" testId="card-admin-proformas" href="/proformas" />
        <StatTile label="Active Tenders" value={adminStats?.openTendersCount} icon={Gavel} color="142 71% 30%" testId="card-admin-tenders" href="/tenders" />
        <StatTile label="Company Profiles" value={adminStats?.totalCompanyProfiles} icon={Building2} color="0 72% 40%" testId="card-admin-profiles" href="/directory" />
      </div>

      {/* User Growth Chart */}
      <Card className="p-5 space-y-3" data-testid="card-user-growth">
        <div className="flex items-center justify-between">
          <h2 className="font-serif font-semibold text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground/60" /> User Growth — Last 6 Months
          </h2>
          <Link href="/admin?tab=reports">
            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">Reports <ArrowRight className="w-3 h-3" /></Button>
          </Link>
        </div>
        {growthLoading ? (
          <Skeleton className="h-36 w-full" />
        ) : !userGrowth?.length ? (
          <div className="text-center py-8 text-sm text-muted-foreground">No growth data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={userGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                cursor={{ stroke: "hsl(var(--maritime-primary)/0.3)", strokeWidth: 1 }}
              />
              <Line type="monotone" dataKey="total" name="Total New Users" stroke="hsl(var(--maritime-primary))" strokeWidth={2} dot={{ fill: "hsl(var(--maritime-primary))", r: 3 }} />
              <Line type="monotone" dataKey="shipowner" name="Shipowners" stroke="hsl(38 92% 50%)" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              <Line type="monotone" dataKey="agent" name="Agents" stroke="hsl(142 71% 35%)" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Hourly Activity Heatmap */}
      <Card className="p-5 space-y-3" data-testid="card-hourly-activity">
        <h2 className="font-serif font-semibold text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground/60" /> Hourly Activity Pattern — Last 7 Days
        </h2>
        <p className="text-xs text-muted-foreground">Darker = more activity</p>
        {hourlyLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !hourlyActivity?.length ? (
          <div className="text-center py-4 text-sm text-muted-foreground">No audit log activity data</div>
        ) : (
          <HourlyHeatmap data={hourlyActivity} />
        )}
      </Card>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
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
                  const Icon = ACTIVITY_ICONS[item.icon] || Activity;
                  const colors: Record<string, string> = {
                    proforma: "bg-[hsl(var(--maritime-secondary)/0.1)] text-[hsl(var(--maritime-secondary))]",
                    vessel: "bg-[hsl(var(--maritime-primary)/0.1)] text-[hsl(var(--maritime-primary))]",
                    user: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
                    building: "bg-[hsl(var(--maritime-accent)/0.1)] text-[hsl(var(--maritime-accent))]",
                  };
                  const iconClass = colors[item.icon] || "bg-muted text-muted-foreground";
                  const timeAgo = item.timestamp ? (() => {
                    const diff = Date.now() - new Date(item.timestamp).getTime();
                    const h = Math.floor(diff / 3600000);
                    const d = Math.floor(diff / 86400000);
                    return d > 0 ? `${d}d ago` : h > 0 ? `${h}h ago` : "just now";
                  })() : "";
                  return (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40 transition-colors" data-testid={`activity-${i}`}>
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${iconClass}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <p className="text-sm flex-1 min-w-0 truncate">{item.message}</p>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Recent Audit Logs */}
          <Card className="p-5 space-y-3" data-testid="card-audit-logs">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-muted-foreground/60" /> Recent Audit Log
              </h2>
              <Link href="/admin?tab=audit">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">View All <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </div>
            {recentAuditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No audit events yet</p>
            ) : (
              <div className="space-y-1">
                {recentAuditLogs.map((log: any, i: number) => {
                  const timeAgo = (() => {
                    const diff = Date.now() - new Date(log.createdAt || log.created_at).getTime();
                    const m = Math.floor(diff / 60000);
                    const h = Math.floor(diff / 3600000);
                    const d = Math.floor(diff / 86400000);
                    return d > 0 ? `${d}d` : h > 0 ? `${h}h` : m > 0 ? `${m}m` : "now";
                  })();
                  return (
                    <div key={i} className="flex items-center gap-3 py-1.5 border-b last:border-0 border-border/40" data-testid={`audit-log-${i}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--maritime-primary)/0.6)] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate">
                          <span className="font-medium">{log.action}</span>
                          {log.entity_type && <span className="text-muted-foreground"> · {log.entity_type}</span>}
                          {log.user_name && <span className="text-muted-foreground"> by {log.user_name}</span>}
                        </p>
                      </div>
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

        {/* Right col */}
        <div className="space-y-5">
          {/* System Health */}
          <Card className="p-5 space-y-4" data-testid="card-system-health">
            <h2 className="font-serif font-semibold text-sm flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-muted-foreground/60" /> System Health
            </h2>
            {healthLoading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-5 w-full" />)}</div>
            ) : !systemHealth ? (
              <p className="text-xs text-muted-foreground">Unable to load system health</p>
            ) : (
              <div className="space-y-3">
                {/* DB */}
                <div className="p-3 rounded-lg bg-muted/40 space-y-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
                    <p className="text-xs font-semibold">Database</p>
                    <span className="text-xs text-muted-foreground ml-auto">{systemHealth.db?.size}</span>
                  </div>
                  <div className="space-y-1 text-[10px] text-muted-foreground pl-5">
                    {Object.entries(systemHealth.tables || {}).map(([tbl, cnt]) => (
                      <div key={tbl} className="flex justify-between">
                        <span>{tbl}</span><span className="font-medium">{cnt as number}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cache */}
                <div className="p-3 rounded-lg bg-muted/40 space-y-1.5">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    <p className="text-xs font-semibold">Cache</p>
                    <Badge className="text-[9px] ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {systemHealth.cache?.size ?? 0} entries
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <div className="text-center p-1 rounded bg-background">
                      <p className="font-bold">{systemHealth.cache?.hits ?? 0}</p>
                      <p className="text-muted-foreground">Hits</p>
                    </div>
                    <div className="text-center p-1 rounded bg-background">
                      <p className="font-bold">{systemHealth.cache?.misses ?? 0}</p>
                      <p className="text-muted-foreground">Misses</p>
                    </div>
                  </div>
                </div>

                {/* API Keys */}
                <div className="p-3 rounded-lg bg-muted/40 space-y-1.5">
                  <p className="text-xs font-semibold mb-1.5">API Integrations</p>
                  <StatusDot ok={systemHealth.ais?.connected} label="AIS Stream" />
                  <StatusDot ok={systemHealth.apiKeys?.tradingEconomics} label="Trading Economics" />
                  <StatusDot ok={systemHealth.apiKeys?.resend} label="Resend Email" />
                  <StatusDot ok={systemHealth.apiKeys?.mapbox} label="Mapbox" />
                </div>

                {/* AIS Cache */}
                <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30">
                  <span className="text-muted-foreground">AIS Position Cache</span>
                  <span className="font-semibold">{systemHealth.ais?.cacheSize ?? 0} vessels</span>
                </div>
              </div>
            )}
          </Card>

          {/* Quick Actions */}
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
