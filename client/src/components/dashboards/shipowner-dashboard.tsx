import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Ship, FileText, Gavel, Bell, Plus, ArrowRight, Crown, Zap, Navigation, Users, Building2, Activity, Fuel, Clock, Calendar, Anchor, CheckCircle2, AlertCircle, Receipt, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Vessel, Proforma } from "@shared/schema";
import { ProformaTrendChart, TenderTrendChart, VoyageTrendChart, StatusDistributionChart } from "./dashboard-charts";
import { AiSmartDropMini } from "@/components/ai-smart-drop";
import { fmtDate } from "@/lib/formatDate";

function formatCountdown(etaStr: string): { text: string; className: string } {
  const diff = new Date(etaStr).getTime() - Date.now();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 0) return { text: "Departed", className: "text-slate-400" };
  if (hours < 1) return { text: "Soon", className: "text-red-500 font-bold" };
  if (hours < 24) return { text: "Today", className: "text-red-500 font-bold" };
  if (hours < 48) return { text: "Tomorrow", className: "text-amber-500 font-semibold" };
  const days = Math.round(hours / 24);
  return { text: `in ${days}d`, className: "text-muted-foreground" };
}

function UpcomingPortCallsWidget() {
  const { data } = useQuery<any[]>({ queryKey: ["/api/vessel-schedule/upcoming"] });
  if (!data || data.length === 0) return null;
  return (
    <Card className="p-4 space-y-3" data-testid="card-upcoming-port-calls">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
          <h3 className="font-semibold text-sm">Upcoming Port Calls</h3>
        </div>
        <Link href="/vessel-schedule">
          <span className="text-xs text-sky-400 hover:underline cursor-pointer">View Schedule →</span>
        </Link>
      </div>
      <div className="space-y-2">
        {data.slice(0, 5).map((item: any) => {
          const countdown = formatCountdown(item.eta);
          return (
            <Link key={item.id} href={`/voyages/${item.id}`}>
              <div className="flex items-center gap-3 py-1.5 hover:bg-muted/40 rounded-lg px-1 transition-colors cursor-pointer">
                <Anchor className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.vesselName}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.portName} · {item.operation}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-muted-foreground">{item.eta ? fmtDate(item.eta) : "—"}</p>
                  <p className={`text-xs ${countdown.className}`}>{countdown.text}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

function RecentActivityCard() {
  const { data } = useQuery<{ activities: any[] }>({
    queryKey: ["/api/user/recent-activity"],
  });
  const activities = data?.activities || [];

  function getActivityEmoji(type: string): string {
    const map: Record<string, string> = {
      voyage_created: "🗺️", status_changed: "🔄", eta_updated: "🕐",
      document_uploaded: "📄", document_signed: "✍️", checklist_completed: "✅",
      chat_message: "💬", sof_created: "📝", sof_finalized: "📝",
      pda_created: "📋", pda_approved: "📋", fda_created: "🧾", fda_approved: "🧾",
      invoice_created: "💳", invoice_paid: "💰", nomination_sent: "🤝",
      review_submitted: "⭐", custom_note: "📌",
      nor_tendered: "📋", nor_accepted: "✅",
    };
    return map[type] || "📌";
  }

  function timeAgo(dt: string) {
    const diff = Date.now() - new Date(dt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return fmtDate(dt);
  }

  return (
    <Card className="p-5 space-y-3" data-testid="card-recent-activity-feed">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground/60" />
        <h3 className="font-semibold text-sm">Recent Activity</h3>
      </div>
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
      ) : (
        <div className="space-y-1">
          {activities.map((a: any) => (
            <div key={a.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0" data-testid={`feed-item-${a.id}`}>
              <span className="text-base flex-shrink-0">{getActivityEmoji(a.activityType)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{a.title}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</p>
              </div>
              <Link href={`/voyages/${a.voyageId}`}>
                <span className="text-xs text-sky-400 hover:underline flex-shrink-0 cursor-pointer">View →</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

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
              <p className={`text-3xl font-bold tracking-tight ${typeof value === 'number' && value === 0 ? 'text-slate-500' : 'dark:bg-gradient-to-r dark:from-white dark:to-slate-300 dark:bg-clip-text dark:text-transparent'}`}>{value}</p>
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
  const { data: pendingApprovalList, isLoading: pendingLoading } = useQuery<any[]>({ queryKey: ["/api/proformas/pending-approval"] });
  const { data: dashStatsData } = useQuery<any>({ queryKey: ["/api/stats/dashboard"] });
  const dashStats = dashStatsData?.stats;

  const activeVoyages = (voyages || []).filter((v: any) => ["in_progress", "scheduled", "planned"].includes(v.status)).length;
  const pendingApprovals = (pendingApprovalList || []).length;

  const fleetStatus = {
    in_progress: (voyages || []).filter((v: any) => v.status === "in_progress").length,
    scheduled: (voyages || []).filter((v: any) => v.status === "scheduled").length,
    planned: (voyages || []).filter((v: any) => v.status === "planned").length,
    completed: (voyages || []).filter((v: any) => v.status === "completed").length,
  };
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
        <StatCard label="Pending Approvals" value={pendingLoading ? "…" : pendingApprovals} loading={pendingLoading} icon={FileText} color="38 92% 50%" href="/proformas" testId="stat-pending-approvals" />
        <StatCard label="Pending Invoices" value={dashStats?.pending_invoice_count ?? 0} icon={Receipt} color="var(--maritime-accent)" href="/invoices" testId="stat-pending-invoices" />
      </div>

      {/* Fleet Status Breakdown */}
      {!voyagesLoading && (fleetStatus.in_progress + fleetStatus.scheduled + fleetStatus.planned + fleetStatus.completed) > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1" data-testid="widget-fleet-status">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Fleet:</span>
          {fleetStatus.in_progress > 0 && (
            <Link href="/voyages">
              <Badge className="gap-1.5 text-xs cursor-pointer bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400" data-testid="fleet-badge-in-progress">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                {fleetStatus.in_progress} In Progress
              </Badge>
            </Link>
          )}
          {fleetStatus.scheduled > 0 && (
            <Link href="/voyages">
              <Badge className="gap-1.5 text-xs cursor-pointer bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400" data-testid="fleet-badge-scheduled">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                {fleetStatus.scheduled} Scheduled
              </Badge>
            </Link>
          )}
          {fleetStatus.planned > 0 && (
            <Link href="/voyages">
              <Badge className="gap-1.5 text-xs cursor-pointer bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/50 dark:text-slate-400" data-testid="fleet-badge-planned">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                {fleetStatus.planned} Planned
              </Badge>
            </Link>
          )}
          {fleetStatus.completed > 0 && (
            <Link href="/voyages">
              <Badge className="gap-1.5 text-xs cursor-pointer bg-muted text-muted-foreground hover:bg-muted/80" data-testid="fleet-badge-completed">
                <CheckCircle2 className="w-3 h-3" />
                {fleetStatus.completed} Completed
              </Badge>
            </Link>
          )}
        </div>
      )}

      {/* Pending PDA Approvals Alert */}
      {pendingApprovals > 0 && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30" data-testid="banner-pending-approvals">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {pendingApprovals} Proforma{pendingApprovals > 1 ? "s" : ""} awaiting your approval
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">Review and approve the disbursement accounts sent to you by agents.</p>
            </div>
          </div>
          <Link href="/proformas">
            <Button size="sm" className="flex-shrink-0 h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1" data-testid="button-review-approvals">
              Review <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      )}

      {/* Overdue Invoice Alert */}
      {dashStats?.overdue_invoice_count > 0 && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30" data-testid="banner-overdue-invoices">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                {dashStats.overdue_invoice_count} overdue invoice{dashStats.overdue_invoice_count > 1 ? "s" : ""} — ${Number(dashStats.pending_invoice_total || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} unpaid
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">These invoices have passed their due date and require attention.</p>
            </div>
          </div>
          <Link href="/invoices">
            <Button size="sm" className="flex-shrink-0 h-7 text-xs bg-red-600 hover:bg-red-700 text-white gap-1" data-testid="button-view-overdue-invoices">
              View <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      )}

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
          {/* Pending PDA Approvals */}
          {(pendingLoading || (pendingApprovalList || []).length > 0) && (
            <Card className="p-5 space-y-3" data-testid="card-pending-approvals">
              <div className="flex items-center justify-between">
                <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" /> Pending PDA Approvals
                </h2>
                <Link href="/proformas">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                    All Proformas <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
              {pendingLoading ? (
                <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
              ) : (
                <div className="space-y-1.5">
                  {(pendingApprovalList || []).slice(0, 5).map((pda: any) => (
                    <Link key={pda.id} href={`/proformas/${pda.id}`}>
                      <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group border border-amber-200/50 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-950/10" data-testid={`row-pda-approval-${pda.id}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-md bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{pda.vesselName || `Proforma #${pda.id}`}</p>
                            <p className="text-xs text-muted-foreground truncate">{pda.portName || pda.purposeOfCall || "—"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {pda.totalUsd && <span className="text-sm font-bold text-[hsl(var(--maritime-primary))]">${Number(pda.totalUsd).toLocaleString()}</span>}
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400" data-testid={`button-review-pda-${pda.id}`}>
                            Review →
                          </Button>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          )}

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
        <div className="space-y-6">
          <UpcomingPortCallsWidget />
          <RecentActivityCard />
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

          <Card className="p-4 space-y-3" data-testid="card-ai-smart-drop-widget">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-sm">AI Smart Drop</h2>
              <Link href="/ai-smart-drop">
                <span className="text-xs text-sky-500 hover:text-sky-400 cursor-pointer">View history →</span>
              </Link>
            </div>
            <AiSmartDropMini />
          </Card>
        </div>
      </div>
    </div>
  );
}
