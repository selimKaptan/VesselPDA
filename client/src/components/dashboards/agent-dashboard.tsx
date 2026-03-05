import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Anchor, Gavel, Star, TrendingUp, ArrowRight, Building2, Navigation, MapPin, FileText, MessageSquare, ShieldCheck, AlertTriangle, Clock, XCircle, Ship, Plus, Zap, BarChart3, Bell } from "lucide-react";
import { BidWinRateChart, ProformaTrendChart, VoyageTrendChart } from "./dashboard-charts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompanyProfile } from "@shared/schema";
import { VerificationRequestDialog } from "@/components/verification-request-dialog";

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
    return new Date(dt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  return (
    <Card className="p-5 space-y-3" data-testid="card-recent-activity-feed">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground/60" />
        <h3 className="font-semibold text-sm">Real-time Activity</h3>
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

function PaymentAlertsWidget() {
  const { data } = useQuery<{ overdueCount: number; overdueTotal: number; upcomingCount: number; upcomingTotal: number }>({
    queryKey: ["/api/invoices/alerts"],
  });

  if (!data || (data.overdueCount === 0 && data.upcomingCount === 0)) return null;

  return (
    <Card className="p-4 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/10" data-testid="card-payment-alerts">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4 text-amber-600" />
        <h3 className="font-semibold text-sm">Payment Alerts</h3>
      </div>
      <div className="space-y-2">
        {data.overdueCount > 0 && (
          <div className="flex items-center justify-between bg-red-100 dark:bg-red-950/30 rounded-lg px-3 py-2">
            <span className="text-xs font-medium text-red-700 dark:text-red-400">
              {data.overdueCount} overdue invoice{data.overdueCount !== 1 ? "s" : ""}
            </span>
            <span className="text-xs font-bold text-red-700 dark:text-red-400">
              ${data.overdueTotal.toLocaleString()}
            </span>
          </div>
        )}
        {data.upcomingCount > 0 && (
          <div className="flex items-center justify-between bg-amber-100 dark:bg-amber-950/30 rounded-lg px-3 py-2">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              {data.upcomingCount} due within 7 days
            </span>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
              ${data.upcomingTotal.toLocaleString()}
            </span>
          </div>
        )}
      </div>
      <Link href="/invoices">
        <Button variant="ghost" size="sm" className="w-full mt-2 h-7 text-xs text-muted-foreground hover:text-foreground" data-testid="link-view-all-invoices">
          View All Invoices <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </Link>
    </Card>
  );
}

function AccuracyWidget() {
  const { data } = useQuery<{ averageAccuracy: number | null; totalComparisons: number }>({
    queryKey: ["/api/da-comparison/history"],
    select: (d: any) => ({ averageAccuracy: d.averageAccuracy, totalComparisons: d.totalComparisons }),
  });

  if (!data || !data.totalComparisons) return null;

  const score = data.averageAccuracy ?? 0;
  const color = score >= 95 ? "text-emerald-600 dark:text-emerald-400"
    : score >= 90 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";
  const bg = score >= 95 ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
    : score >= 90 ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
    : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800";

  return (
    <Link href="/da-comparison">
      <Card className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${bg}`} data-testid="card-accuracy-score">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/60 dark:bg-black/20">
            <BarChart3 className={`w-5 h-5 ${color}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estimation Accuracy</p>
            <p className={`text-2xl font-bold ${color}`}>{score.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Based on {data.totalComparisons} disbursement{data.totalComparisons !== 1 ? "s" : ""}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto" />
        </div>
      </Card>
    </Link>
  );
}

export function AgentDashboard({ user, tenders, myBidsData, myProfile, notificationsData }: {
  user: any; tenders: any[]; myBidsData: any; myProfile?: CompanyProfile | null; notificationsData: any;
}) {
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);

  const { data: voyages, isLoading: voyagesLoading } = useQuery<any[]>({ queryKey: ["/api/voyages"] });
  const { data: proformas, isLoading: proformasLoading } = useQuery<any[]>({ queryKey: ["/api/proformas"] });
  const { data: dashData } = useQuery<any>({ queryKey: ["/api/stats/dashboard"] });

  const activeVoyages = (voyages || []).filter((v: any) => ["in_progress", "scheduled"].includes(v.status)).length;
  const pendingPDAs = (proformas || []).filter((p: any) => ["pending", "draft"].includes(p.status)).length;
  const approvedProformas = (proformas || []).filter((p: any) => ["approved", "finalized"].includes(p.status)).length;
  const unreadMessages = notificationsData?.unreadCount ?? 0;

  const openTenders = (tenders || []).filter((t: any) => t.status === "open");
  const allBids: any[] = Array.isArray(myBidsData) ? myBidsData : [];
  const pendingBids = allBids.filter((b: any) => b.status === "pending");
  const selectedBids = allBids.filter((b: any) => b.status === "selected");
  const servedPorts = ((myProfile as any)?.servedPorts as number[]) || [];

  const verificationStatus = (myProfile as any)?.verificationStatus || "unverified";
  const verificationNote = (myProfile as any)?.verificationNote;

  const recentItems: any[] = [
    ...(voyages || []).slice(0, 3).map((v: any) => ({ type: "voyage", label: `Voyage #${v.id}`, sub: v.status, date: v.createdAt || v.created_at, href: `/voyages/${v.id}` })),
    ...(proformas || []).slice(0, 3).map((p: any) => ({ type: "proforma", label: p.vesselName || `Proforma #${p.id}`, sub: p.portName || p.status, date: p.createdAt || p.created_at, href: `/proformas/${p.id}` })),
  ]
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Verification status banner */}
      {myProfile && (
        <>
          {verificationStatus === "unverified" && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50" data-testid="banner-verification-unverified">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Your company is not yet verified</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Request verification to earn a trust badge in the directory.</p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-100 flex-shrink-0 dark:border-amber-700 dark:text-amber-300" onClick={() => setVerifyDialogOpen(true)} data-testid="button-go-verify">
                <ShieldCheck className="w-3 h-3" /> Request Verification
              </Button>
            </div>
          )}
          {verificationStatus === "pending" && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/50" data-testid="banner-verification-pending">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <span className="font-medium">Your verification request is under review.</span>{" "}
                <span className="font-normal text-blue-600 dark:text-blue-400">We will get back to you shortly.</span>
              </p>
            </div>
          )}
          {verificationStatus === "verified" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/40" data-testid="banner-verification-verified">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Your company is verified — trust badge is displayed in the directory.</p>
            </div>
          )}
          {verificationStatus === "rejected" && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/70 dark:border-red-800/50" data-testid="banner-verification-rejected">
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Your verification request was rejected</p>
                {verificationNote && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{verificationNote}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">Update your information and apply again.</p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0 dark:border-red-700 dark:text-red-300" onClick={() => setVerifyDialogOpen(true)} data-testid="button-retry-verify">
                <ShieldCheck className="w-3 h-3" /> Apply Again
              </Button>
            </div>
          )}
        </>
      )}

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Voyages" value={voyagesLoading ? "…" : activeVoyages} loading={voyagesLoading} icon={Ship} color="var(--maritime-primary)" href="/voyages" testId="stat-active-voyages" />
        <StatCard label="Pending PDAs" value={proformasLoading ? "…" : pendingPDAs} loading={proformasLoading} icon={FileText} color="220 13% 46%" href="/proformas" testId="stat-pending-pdas" />
        <StatCard label="Approved Proformas" value={proformasLoading ? "…" : approvedProformas} loading={proformasLoading} icon={Anchor} color="142 71% 35%" href="/proformas" testId="stat-approved-proformas" />
        <StatCard label="Messages" value={unreadMessages > 0 ? unreadMessages : "0"} icon={MessageSquare} color="38 92% 40%" href="/messages" testId="stat-messages" />
      </div>
      <AccuracyWidget />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ProformaTrendChart />
        <VoyageTrendChart />
        <BidWinRateChart total={Number(dashData?.stats?.my_bids ?? allBids.length)} won={Number(dashData?.stats?.won_bids ?? selectedBids.length)} />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Activity */}
          <Card className="p-5 space-y-3" data-testid="card-recent-activity">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground/60" /> Recent Activity
              </h2>
              <Link href="/voyages">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                  All Voyages <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
            {voyagesLoading || proformasLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : recentItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No recent activity yet</p>
            ) : (
              <div className="space-y-1.5">
                {recentItems.map((item, i) => (
                  <Link key={i} href={item.href}>
                    <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`row-activity-${i}`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center text-white ${item.type === "voyage" ? "bg-[hsl(var(--maritime-primary))]" : "bg-slate-500"}`}>
                          {item.type === "voyage" ? <Navigation className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">{item.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{item.sub}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize">{item.type}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Incoming Tenders */}
          <Card className="p-5 space-y-3" data-testid="card-incoming-tenders">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                <Gavel className="w-4 h-4 text-muted-foreground/60" /> Tenders in My Ports
              </h2>
              <Link href="/tenders">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                  All Tenders <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
            {openTenders.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <Gavel className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">No open tenders in your ports</p>
                {servedPorts.length === 0 && (
                  <Link href="/company-profile">
                    <Button variant="outline" size="sm" className="gap-1.5 mt-1">Add Served Ports</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {openTenders.slice(0, 5).map((t: any) => (
                  <Link key={t.id} href={`/tenders/${t.id}`}>
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`row-tender-${t.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center flex-shrink-0">
                          <Gavel className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.portName || `Port #${t.portId}`}</p>
                          <p className="text-xs text-muted-foreground">{t.cargoType}</p>
                        </div>
                      </div>
                      <Button size="sm" className="flex-shrink-0 h-7 text-xs bg-[hsl(var(--maritime-primary))] text-white hover:bg-[hsl(var(--maritime-primary)/0.9)]">
                        Bid
                      </Button>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* My Bids */}
          {allBids.length > 0 && (
            <Card className="p-5 space-y-3" data-testid="card-my-bids">
              <div className="flex items-center justify-between">
                <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground/60" /> My Bids
                </h2>
                <div className="flex items-center gap-1.5">
                  <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{pendingBids.length} pending</Badge>
                  <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{selectedBids.length} won</Badge>
                </div>
              </div>
              <div className="space-y-1.5">
                {allBids.slice(0, 5).map((bid: any) => (
                  <Link key={bid.id} href={`/tenders/${bid.tenderId}`}>
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`row-bid-${bid.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-[hsl(var(--maritime-secondary)/0.08)] flex items-center justify-center flex-shrink-0">
                          <Anchor className="w-3.5 h-3.5 text-[hsl(var(--maritime-secondary))]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{bid.portName || `Tender #${bid.tenderId}`}</p>
                          <p className="text-xs text-muted-foreground">{bid.createdAt ? new Date(bid.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {bid.totalUsd && <span className="text-sm font-bold text-[hsl(var(--maritime-primary))]">${bid.totalUsd?.toLocaleString()}</span>}
                        <Badge className={`text-[10px] px-1.5 py-0 ${bid.status === "selected" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : bid.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}>
                          {bid.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right col: Quick Access */}
        <div className="space-y-5">
          <PaymentAlertsWidget />
          <RecentActivityCard />
          <Card className="p-5 space-y-3">
            <h2 className="font-serif font-semibold text-sm flex items-center gap-2">
              Quick Access
            </h2>
            <div className="space-y-1.5">
              {[
                { href: "/proformas/new", icon: Plus, label: "New Proforma", desc: "Generate a proforma D/A", color: "var(--maritime-primary)", testId: "qa-new-proforma" },
                { href: "/proformas", icon: Zap, label: "Quick Estimate", desc: "Instant proforma estimate", color: "38 92% 50%", testId: "qa-quick-proforma" },
                { href: "/voyages", icon: Navigation, label: "My Voyages", desc: "Manage active voyages", color: "var(--maritime-secondary)", testId: "qa-voyages" },
                { href: "/tenders", icon: Gavel, label: "Open Tenders", desc: "Browse port call tenders", color: "var(--maritime-accent)", testId: "qa-tenders" },
                { href: "/company-profile", icon: Building2, label: "My Profile", desc: "Edit your company listing", color: "142 71% 30%", testId: "qa-profile" },
                { href: "/port-info", icon: MapPin, label: "Port Information", desc: "Turkish port details", color: "217 91% 40%", testId: "qa-ports" },
              ].map((action) => (
                <Link key={action.href} href={action.href}>
                  <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={action.testId}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `hsl(${action.color} / 0.1)` }}>
                      <action.icon className="w-3.5 h-3.5" style={{ color: `hsl(${action.color})` } as React.CSSProperties} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{action.label}</p>
                      <p className="text-[11px] text-muted-foreground">{action.desc}</p>
                    </div>
                    <ArrowRight className="w-3 h-3 text-muted-foreground/40 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          {/* Performance summary if bids exist */}
          {allBids.length > 0 && (
            <Card className="p-4 space-y-3" data-testid="card-performance-summary">
              <h2 className="font-serif font-semibold text-sm flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" /> Bid Performance
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-muted/40 text-center">
                  <p className="text-lg font-bold font-serif">{allBids.length}</p>
                  <p className="text-[10px] text-muted-foreground">Total Bids</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/40 text-center">
                  <p className="text-lg font-bold font-serif">{selectedBids.length}</p>
                  <p className="text-[10px] text-muted-foreground">Won</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <VerificationRequestDialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen} />
    </div>
  );
}
