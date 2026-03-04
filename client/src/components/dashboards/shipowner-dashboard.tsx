import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Ship, FileText, Gavel, Bell, Plus, ArrowRight, Crown, Zap, Navigation, Users, Building2, Activity, Fuel } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Vessel, Proforma } from "@shared/schema";
import { ProformaTrendChart, TenderTrendChart, VoyageTrendChart, StatusDistributionChart } from "./dashboard-charts";

function StatCard({ label, value, loading, icon: Icon, color, href, testId }: {
  label: string; value: React.ReactNode; loading?: boolean;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string; href: string; testId: string;
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

const FLAG_EMOJI: Record<string, string> = {
  Turkey: "🇹🇷", Panama: "🇵🇦", "Marshall Islands": "🇲🇭", Liberia: "🇱🇷", Bahamas: "🇧🇸",
  Malta: "🇲🇹", Cyprus: "🇨🇾", Greece: "🇬🇷", Singapore: "🇸🇬",
};

export function ShipownerDashboard({ user, vessels, vesselsLoading, proformas, proformasLoading, tenders, notificationsData, plan, proformaCount, proformaLimit }: {
  user: any; vessels?: Vessel[]; vesselsLoading?: boolean; proformas?: Proforma[];
  proformasLoading?: boolean; tenders: any[]; notificationsData: any; plan: string;
  proformaCount: number; proformaLimit: number;
}) {
  const { data: voyages, isLoading: voyagesLoading } = useQuery<any[]>({ queryKey: ["/api/voyages"] });

  const activeVoyages = (voyages || []).filter((v: any) => ["in_progress", "scheduled"].includes(v.status)).length;
  const pendingApprovals = (proformas || []).filter((p: any) => p.status === "pending").length;
  const openTenders = (tenders || []).filter((t: any) => t.status === "open");
  const recentVessels = vessels?.slice(0, 5) || [];
  const recentProformas = proformas?.slice(0, 5) || [];
  const unread = notificationsData?.unreadCount ?? 0;
  const proformaPercent = Math.min((proformaCount / Math.max(proformaLimit, 1)) * 100, 100);
  const progressColor = proformaPercent >= 90 ? "bg-red-500" : proformaPercent >= 60 ? "bg-amber-500" : "bg-emerald-500";
  const planIcons = { free: Zap, standard: Ship, unlimited: Crown };
  const PlanIcon = planIcons[plan as keyof typeof planIcons] || Zap;

  const quickActions = [
    { href: "/vessels", icon: Ship, label: "My Fleet", desc: "Manage your fleet", color: "var(--maritime-primary)", testId: "qa-fleet" },
    { href: "/voyages", icon: Navigation, label: "New Voyage", desc: "Create a voyage", color: "var(--maritime-secondary)", testId: "qa-voyage" },
    { href: "/proformas/new", icon: FileText, label: "New Proforma", desc: "Generate a proforma D/A", color: "var(--maritime-accent)", testId: "qa-proforma" },
    { href: "/tenders", icon: Gavel, label: "Post a Tender", desc: "Request quotes from agents", color: "38 92% 50%", testId: "qa-tender" },
    { href: "/vessel-track", icon: Navigation, label: "Fleet Tracker", desc: "Live vessel positions", color: "217 91% 40%", testId: "qa-track" },
    { href: "/directory", icon: Users, label: "Find an Agent", desc: "Browse maritime directory", color: "142 71% 30%", testId: "qa-directory" },
  ];

  return (
    <div className="space-y-6">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Vessels" value={vessels?.length ?? 0} loading={vesselsLoading} icon={Ship} color="var(--maritime-primary)" href="/vessels" testId="stat-fleet" />
        <StatCard label="Active Voyages" value={voyagesLoading ? "…" : activeVoyages} loading={voyagesLoading} icon={Navigation} color="var(--maritime-secondary)" href="/voyages" testId="stat-active-voyages" />
        <StatCard label="Pending Approvals" value={pendingApprovals} icon={FileText} color="38 92% 50%" href="/proformas" testId="stat-pending-approvals" />
        <StatCard label="Notifications" value={unread} icon={Bell} color="var(--maritime-accent)" href="/messages" testId="stat-notifications" />
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ProformaTrendChart />
        <TenderTrendChart />
        <VoyageTrendChart />
      </div>

      {/* Subscription + Plan Usage */}
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
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Fleet Summary */}
          <Card className="p-5 space-y-3" data-testid="card-fleet">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                <Ship className="w-4 h-4 text-muted-foreground/60" /> My Fleet
              </h2>
              <Link href="/vessels">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">Manage Fleet <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </div>
            {vesselsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
            ) : recentVessels.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <Ship className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">No vessels yet</p>
                <Link href="/vessels?new=true"><Button variant="outline" size="sm">Add First Vessel</Button></Link>
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
          </Card>

          {/* Active Tenders */}
          <Card className="p-5 space-y-3" data-testid="card-tenders">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                <Gavel className="w-4 h-4 text-muted-foreground/60" /> My Tenders
              </h2>
              <Link href="/tenders">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">All Tenders <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </div>
            {openTenders.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <Gavel className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">No active tenders</p>
                <Link href="/tenders"><Button variant="outline" size="sm">Post First Tender</Button></Link>
              </div>
            ) : (
              <div className="space-y-1.5">
                {openTenders.slice(0, 5).map((t: any) => (
                  <Link key={t.id} href={`/tenders/${t.id}`}>
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={`row-tender-${t.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center flex-shrink-0">
                          <Gavel className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.portName || `Port #${t.portId}`}</p>
                          <p className="text-xs text-muted-foreground">{t.cargoType}</p>
                        </div>
                      </div>
                      <Badge className={`text-[10px] flex-shrink-0 ${(t.bidCount ?? 0) > 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                        {t.bidCount ?? 0} bids
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Proformas */}
          {recentProformas.length > 0 && (
            <Card className="p-5 space-y-3" data-testid="card-recent-proformas">
              <div className="flex items-center justify-between">
                <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground/60" /> Recent Proformas
                </h2>
                <Link href="/proformas">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">View All <ArrowRight className="w-3 h-3" /></Button>
                </Link>
              </div>
              <div className="space-y-1.5">
                {recentProformas.map((pda: any) => (
                  <Link key={pda.id} href={`/proformas/${pda.id}`}>
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={`row-proforma-${pda.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center flex-shrink-0">
                          <FileText className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{pda.referenceNumber || `Proforma #${pda.id}`}</p>
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
            </Card>
          )}
        </div>

        {/* Right col: Quick Actions */}
        <div>
          <Card className="p-5 space-y-3">
            <h2 className="font-serif font-semibold text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground/60" /> Quick Access
            </h2>
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
          </Card>
        </div>
      </div>
    </div>
  );
}
