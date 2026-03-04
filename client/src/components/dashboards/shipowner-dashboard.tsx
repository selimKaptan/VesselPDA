import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Ship, FileText, Gavel, Bell, Plus, ArrowRight, Crown, Zap, Navigation, Users, Building2, Activity, AlertCircle, Package, DollarSign, Anchor, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Vessel, Proforma } from "@shared/schema";

function StatCard({ label, value, loading, icon: Icon, color, href, testId, sub }: {
  label: string; value: React.ReactNode; loading?: boolean;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string; href: string; testId: string; sub?: string;
}) {
  return (
    <Link href={href}>
      <Card className="p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group relative overflow-hidden" data-testid={testId}
        style={{ borderLeft: `3px solid hsl(${color} / 0.5)` }}>
        <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-40"
          style={{ background: `hsl(${color} / 0.05)` }} />
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            {loading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-bold font-serif">{value}</p>}
            {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
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

function SectionCard({ title, icon: Icon, href, linkLabel, children, testId }: {
  title: string; icon?: React.ComponentType<{ className?: string }>;
  href?: string; linkLabel?: string; children: React.ReactNode; testId?: string;
}) {
  return (
    <Card className="p-5 space-y-3" data-testid={testId}>
      <div className="flex items-center justify-between">
        <h2 className="font-serif font-semibold text-base flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-muted-foreground/60" />} {title}
        </h2>
        {href && linkLabel && (
          <Link href={href}>
            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
              {linkLabel} <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        )}
      </div>
      {children}
    </Card>
  );
}

const FLAG_EMOJI: Record<string, string> = {
  Turkey: "🇹🇷", Panama: "🇵🇦", "Marshall Islands": "🇲🇭", Liberia: "🇱🇷", Bahamas: "🇧🇸",
  Malta: "🇲🇹", Cyprus: "🇨🇾", Greece: "🇬🇷", Singapore: "🇸🇬",
};

function buildMonthlySpending(proformas: Proforma[]) {
  const months: { month: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const monthStr = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
    const monthProformas = proformas.filter((p) => {
      const pDate = new Date(p.createdAt || "");
      return pDate.getFullYear() === d.getFullYear() && pDate.getMonth() === d.getMonth();
    });
    const total = monthProformas.reduce((sum, p) => sum + (p.totalUsd || 0), 0);
    months.push({ month: monthStr, total: Math.round(total) });
  }
  return months;
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function ShipownerDashboard({ user, vessels, vesselsLoading, proformas, proformasLoading, tenders, notificationsData, plan, proformaCount, proformaLimit }: {
  user: any; vessels?: Vessel[]; vesselsLoading?: boolean; proformas?: Proforma[];
  proformasLoading?: boolean; tenders: any[]; notificationsData: any; plan: string;
  proformaCount: number; proformaLimit: number;
}) {
  const { data: voyages = [], isLoading: voyagesLoading } = useQuery<any[]>({
    queryKey: ["/api/voyages"],
  });

  const { data: fixtures = [], isLoading: fixturesLoading } = useQuery<any[]>({
    queryKey: ["/api/fixtures"],
  });

  const { data: expiringCerts = [] } = useQuery<any[]>({
    queryKey: ["/api/certificates/expiring"],
  });

  const { data: complianceDash } = useQuery<any>({
    queryKey: ["/api/compliance/dashboard"],
    queryFn: () => fetch("/api/compliance/dashboard", { credentials: "include" }).then(r => r.json()),
    staleTime: 60000,
  });
  const openFindings: any[] = Array.isArray(complianceDash?.openFindings) ? complianceDash.openFindings : [];
  const upcomingComplianceAudits: any[] = Array.isArray(complianceDash?.upcomingAudits) ? complianceDash.upcomingAudits : [];
  const nextAudit = upcomingComplianceAudits[0];

  const openTenders = tenders.filter((t) => t.status === "open");
  const recentProformas = proformas?.slice(0, 5) || [];
  const recentVessels = vessels?.slice(0, 5) || [];
  const unread = notificationsData?.unreadCount ?? 0;
  const proformaPercent = Math.min((proformaCount / Math.max(proformaLimit, 1)) * 100, 100);
  const progressColor = proformaPercent >= 90 ? "bg-red-500" : proformaPercent >= 60 ? "bg-amber-500" : "bg-emerald-500";

  const planIcons = { free: Zap, standard: Ship, unlimited: Crown };
  const PlanIcon = planIcons[plan as keyof typeof planIcons] || Zap;

  // Fleet status from voyages
  const inPortVessels = voyages.filter((v) => v.status === "completed" || v.status === "in_port").length;
  const underwayVessels = voyages.filter((v) => v.status === "in_progress" || v.status === "active").length;
  const scheduledVessels = voyages.filter((v) => v.status === "scheduled").length;

  // Monthly spending from proformas
  const spendingData = buildMonthlySpending(proformas || []);
  const totalSpending = spendingData.reduce((s, d) => s + d.total, 0);
  const hasSpendingData = spendingData.some((d) => d.total > 0);

  const activeFixtures = fixtures.filter((f) => f.status === "active" || f.status === "open" || f.status === "signed");
  const criticalCerts = expiringCerts.filter((c) => daysUntil(c.expiryDate || c.expiry_date) <= 14);

  const quickActions = [
    { href: "/proformas/new", icon: FileText, label: "New Proforma", desc: "Generate a proforma D/A", color: "var(--maritime-secondary)", testId: "qa-new-proforma" },
    { href: "/tenders", icon: Gavel, label: "Post a Tender", desc: "Request port call quotes from agents", color: "38 92% 50%", testId: "qa-new-tender" },
    { href: "/vessels?new=true", icon: Ship, label: "Add Vessel", desc: "Register a new ship to your fleet", color: "var(--maritime-primary)", testId: "qa-add-vessel" },
    { href: "/directory", icon: Users, label: "Find an Agent", desc: "Browse maritime service directory", color: "var(--maritime-accent)", testId: "qa-find-agent" },
    { href: "/vessel-track", icon: Navigation, label: "Fleet Tracker", desc: "View live vessel positions on map", color: "217 91% 40%", testId: "qa-vessel-track" },
    { href: "/fixtures", icon: Package, label: "Fixtures", desc: "Manage charter negotiations", color: "142 71% 30%", testId: "qa-fixtures" },
  ];

  return (
    <div className="space-y-5">
      {/* Expiring Certificates */}
      {criticalCerts.length > 0 && (
        <Link href="/vessel-certificates">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-red-50 dark:bg-red-950/30 border-red-200/70 dark:border-red-800/50 cursor-pointer hover:opacity-90 transition-opacity" data-testid="banner-expiring-certs">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">{criticalCerts.length} certificate{criticalCerts.length !== 1 ? "s" : ""} expiring within 14 days</p>
              <p className="text-xs text-muted-foreground">Click to manage vessel certificates</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
          </div>
        </Link>
      )}

      {/* Stat bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="My Fleet" value={vessels?.length ?? 0} loading={vesselsLoading} icon={Ship} color="var(--maritime-primary)" href="/vessels" testId="stat-fleet" />
        <StatCard label="Proformas" value={proformas?.length ?? 0} loading={proformasLoading} icon={FileText} color="var(--maritime-secondary)" href="/proformas" testId="stat-proformas" />
        <StatCard label="Open Tenders" value={openTenders.length} icon={Gavel} color="38 92% 50%" href="/tenders" testId="stat-tenders" />
        <StatCard label="Active Fixtures" value={activeFixtures.length} loading={fixturesLoading} icon={Package} color="142 71% 30%" href="/fixtures" testId="stat-fixtures" />
      </div>

      {/* Compliance widget — only shown when there's something actionable */}
      {(openFindings.length > 0 || nextAudit) && (
        <Link href="/compliance">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200/70 dark:border-blue-800/50 cursor-pointer hover:opacity-90 transition-opacity" data-testid="banner-compliance">
            <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                {openFindings.length > 0 && `${openFindings.length} open finding${openFindings.length !== 1 ? "s" : ""}`}
                {openFindings.length > 0 && nextAudit && " · "}
                {nextAudit && (() => {
                  const days = Math.ceil((new Date(nextAudit.next_audit_date).getTime() - Date.now()) / 86400000);
                  return `${nextAudit.standard_code} audit in ${days} day${days !== 1 ? "s" : ""}`;
                })()}
              </p>
              <p className="text-xs text-muted-foreground">Click to manage compliance checklists</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
          </div>
        </Link>
      )}

      {/* Fleet Status Cards */}
      {!voyagesLoading && (
        <div className="grid grid-cols-3 gap-3">
          <Link href="/voyages">
            <Card className="p-3 text-center hover:shadow-sm transition-all cursor-pointer border-emerald-200/50 dark:border-emerald-800/30" data-testid="fleet-status-inport">
              <p className="text-xl font-bold font-serif text-emerald-600">{inPortVessels}</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">In Port</p>
              <div className="w-2 h-2 rounded-full bg-emerald-500 mx-auto mt-1.5" />
            </Card>
          </Link>
          <Link href="/voyages">
            <Card className="p-3 text-center hover:shadow-sm transition-all cursor-pointer border-blue-200/50 dark:border-blue-800/30" data-testid="fleet-status-underway">
              <p className="text-xl font-bold font-serif text-blue-600">{underwayVessels}</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Underway</p>
              <div className="w-2 h-2 rounded-full bg-blue-500 mx-auto mt-1.5" />
            </Card>
          </Link>
          <Link href="/voyages">
            <Card className="p-3 text-center hover:shadow-sm transition-all cursor-pointer border-slate-200/50 dark:border-slate-700/30" data-testid="fleet-status-scheduled">
              <p className="text-xl font-bold font-serif text-slate-600 dark:text-slate-400">{scheduledVessels}</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Scheduled</p>
              <div className="w-2 h-2 rounded-full bg-slate-400 mx-auto mt-1.5" />
            </Card>
          </Link>
        </div>
      )}

      {/* Subscription */}
      <Card className="p-4 border-[hsl(var(--maritime-primary)/0.2)]" data-testid="card-subscription">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, hsl(var(--maritime-primary)/0.12), hsl(var(--maritime-accent)/0.08))" }}>
              <PlanIcon className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm capitalize">{plan} Plan</p>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[hsl(var(--maritime-primary)/0.1)] text-[hsl(var(--maritime-primary))] uppercase tracking-wide">{plan}</span>
              </div>
              {plan !== "unlimited" ? (
                <div className="flex items-center gap-2 mt-1">
                  <div className="relative h-1.5 w-36 bg-muted rounded-full overflow-hidden">
                    <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${proformaPercent}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{proformaCount}/{proformaLimit} proformas</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">Unlimited proforma generations</p>
              )}
            </div>
          </div>
          {plan !== "unlimited" && (
            <Link href="/pricing">
              <Button size="sm" className="gap-1.5 bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)] text-white shadow-sm shrink-0">
                <Crown className="w-3.5 h-3.5" /> Upgrade Plan
              </Button>
            </Link>
          )}
        </div>
      </Card>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Monthly Spending Chart */}
          <Card className="p-5 space-y-3" data-testid="card-spending-chart">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground/60" /> 6-Month Spending
              </h2>
              {totalSpending > 0 && (
                <span className="text-xs text-muted-foreground">${totalSpending.toLocaleString()} total</span>
              )}
            </div>
            {proformasLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !hasSpendingData ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <p>No proforma spending data yet</p>
                <Link href="/proformas/new">
                  <Button variant="outline" size="sm" className="gap-1.5 mt-3">Create First Proforma</Button>
                </Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={spendingData}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--maritime-primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--maritime-primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                    formatter={(v: any) => [`$${Number(v).toLocaleString()}`, "Spending"]}
                    cursor={{ stroke: "hsl(var(--maritime-primary)/0.3)", strokeWidth: 1 }}
                  />
                  <Area type="monotone" dataKey="total" name="Spending (USD)" stroke="hsl(var(--maritime-primary))" strokeWidth={2} fill="url(#spendGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Fleet Summary */}
          <SectionCard title="My Fleet" icon={Ship} href="/vessels" linkLabel="Manage Fleet" testId="card-fleet">
            {vesselsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
            ) : recentVessels.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No vessels yet</p>
                <Link href="/vessels?new=true">
                  <Button variant="outline" size="sm" className="gap-1.5 mt-3">Add First Vessel</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentVessels.map((v) => (
                  <Link key={v.id} href="/vessels">
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={`row-vessel-${v.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg flex-shrink-0">{FLAG_EMOJI[v.flag] || "🚢"}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{v.name}</p>
                          <p className="text-xs text-muted-foreground">{v.flag} · {v.grt?.toLocaleString()} GRT</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0 border-[hsl(var(--maritime-primary)/0.3)] text-[hsl(var(--maritime-primary))]">
                        {v.vesselType}
                      </Badge>
                    </div>
                  </Link>
                ))}
                <Link href="/vessels?new=true">
                  <Button variant="ghost" size="sm" className="w-full mt-1 gap-1.5 text-muted-foreground hover:text-foreground border border-dashed border-border/50">
                    <Plus className="w-3.5 h-3.5" /> Add Vessel
                  </Button>
                </Link>
              </div>
            )}
          </SectionCard>

          {/* Active Fixtures */}
          <SectionCard title="Active Fixtures" icon={Package} href="/fixtures" linkLabel="All Fixtures" testId="card-fixtures">
            {fixturesLoading ? (
              <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : activeFixtures.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">No active fixtures</p>
                <Link href="/fixtures">
                  <Button variant="outline" size="sm" className="gap-1.5 mt-3">Create Fixture</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5">
                {activeFixtures.slice(0, 5).map((f) => (
                  <Link key={f.id} href="/fixtures">
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`row-fixture-${f.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-[hsl(var(--maritime-accent)/0.1)] flex items-center justify-center flex-shrink-0">
                          <Package className="w-3.5 h-3.5 text-[hsl(var(--maritime-accent))]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{f.vesselName || `Fixture #${f.id}`}</p>
                          <p className="text-xs text-muted-foreground truncate">{f.cargoType || "—"}</p>
                        </div>
                      </div>
                      <Badge className="text-[10px] flex-shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        {f.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Recent Proformas */}
          <SectionCard title="Recent Proformas" icon={FileText} href="/proformas" linkLabel="View All" testId="card-proformas">
            {proformasLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
            ) : recentProformas.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">No proformas yet</p>
                <Link href="/proformas/new">
                  <Button variant="outline" size="sm" className="gap-1.5 mt-3">Create Proforma</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentProformas.map((pda) => (
                  <Link key={pda.id} href={`/proformas/${pda.id}`}>
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={`row-proforma-${pda.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center flex-shrink-0">
                          <FileText className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{pda.referenceNumber}</p>
                          <p className="text-xs text-muted-foreground truncate">{pda.purposeOfCall}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-[hsl(var(--maritime-primary))]">${pda.totalUsd?.toLocaleString()}</p>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{pda.status}</Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right col */}
        <div className="space-y-5">
          {/* Active Tenders */}
          <SectionCard title="My Tenders" icon={Gavel} href="/tenders" linkLabel="All" testId="card-tenders">
            {openTenders.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">No active tenders</p>
                <Link href="/tenders">
                  <Button variant="outline" size="sm" className="gap-1.5 mt-3">Post Tender</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5">
                {openTenders.slice(0, 4).map((t) => {
                  const bidCount = t.bidCount ?? 0;
                  return (
                    <Link key={t.id} href={`/tenders/${t.id}`}>
                      <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={`row-tender-${t.id}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Gavel className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                          <p className="text-sm font-medium truncate">{t.portName || `Port #${t.portId}`}</p>
                        </div>
                        <Badge className={`text-[10px] flex-shrink-0 ${bidCount > 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                          {bidCount} bid{bidCount !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* Quick Actions */}
          <SectionCard title="Quick Actions" icon={Activity}>
            <div className="space-y-1.5">
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={action.testId}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                      style={{ background: `hsl(${action.color} / 0.1)` }}>
                      <action.icon className="w-4 h-4" style={{ color: `hsl(${action.color})` } as React.CSSProperties} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{action.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{action.desc}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:translate-x-0.5 group-hover:text-muted-foreground/80 transition-all flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
