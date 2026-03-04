import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Anchor, Gavel, Star, TrendingUp, ArrowRight, Building2, Activity, Navigation, MapPin, FileText, MessageSquare, ShieldCheck, AlertTriangle, Clock, XCircle, Ship, CheckCircle2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { CompanyProfile } from "@shared/schema";
import { VerificationRequestDialog } from "@/components/verification-request-dialog";

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

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function build7DayChart(voyages: any[]) {
  const days: { label: string; completed: number; active: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-GB", { weekday: "short" });
    const dayVoyages = voyages.filter((v) => (v.createdAt || v.created_at || "").slice(0, 10) === dateStr);
    days.push({
      label,
      completed: dayVoyages.filter((v) => v.status === "completed").length,
      active: dayVoyages.filter((v) => v.status === "in_progress" || v.status === "active").length,
    });
  }
  return days;
}

export function AgentDashboard({ user, tenders: tendersProp, myBidsData: myBidsDataProp, myProfile: myProfileProp, notificationsData: notificationsDataProp }: {
  user?: any; tenders?: any[]; myBidsData?: any; myProfile?: CompanyProfile | null; notificationsData?: any;
}) {
  const { data: tendersInternal = [] } = useQuery<any[]>({ queryKey: ["/api/tenders"] });
  const { data: myBidsInternal } = useQuery<any[]>({ queryKey: ["/api/tenders/my-bids"] });
  const { data: myProfileInternal } = useQuery<CompanyProfile | null>({
    queryKey: ["/api/company-profile/me"],
    queryFn: () => fetch("/api/company-profile/me", { credentials: "include" }).then(r => r.ok ? r.json() : null),
  });

  const tendersRaw = tendersProp ?? tendersInternal;
  const tenders = Array.isArray(tendersRaw) ? tendersRaw : [];
  const myBidsData = myBidsDataProp ?? myBidsInternal;
  const myProfile = myProfileProp ?? myProfileInternal;
  const notificationsData = notificationsDataProp;

  const profileId = (myProfile as any)?.id;

  const { data: agentStats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/agent-stats", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const res = await fetch(`/api/agent-stats/${profileId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!profileId,
  });

  const { data: voyages = [], isLoading: voyagesLoading } = useQuery<any[]>({
    queryKey: ["/api/voyages"],
  });

  const { data: expiringCerts = [] } = useQuery<any[]>({
    queryKey: ["/api/certificates/expiring"],
  });

  const { data: nominationCount } = useQuery<any>({
    queryKey: ["/api/nominations/pending-count"],
  });

  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);

  const openTenders = tenders.filter((t) => t.status === "open");
  const allBids: any[] = Array.isArray(myBidsData) ? myBidsData : [];
  const pendingBids = allBids.filter((b) => b.status === "pending");
  const selectedBids = allBids.filter((b) => b.status === "selected");
  const servedPorts = ((myProfile as any)?.servedPorts as number[]) || [];

  const activeVoyages = voyages.filter((v) => v.status === "in_progress" || v.status === "active" || v.status === "scheduled");
  const upcomingETAs = activeVoyages.filter((v) => v.eta && daysUntil(v.eta) <= 7 && daysUntil(v.eta) >= 0).sort((a, b) => new Date(a.eta).getTime() - new Date(b.eta).getTime());
  const chartData = build7DayChart(voyages);
  const hasChartData = chartData.some((d) => d.completed > 0 || d.active > 0);

  const criticalCerts = expiringCerts.filter((c) => daysUntil(c.expiryDate || c.expiry_date) <= 7);
  const warnCerts = expiringCerts.filter((c) => { const d = daysUntil(c.expiryDate || c.expiry_date); return d > 7 && d <= 30; });

  const verificationStatus = (myProfile as any)?.verificationStatus || "unverified";
  const verificationNote = (myProfile as any)?.verificationNote;

  const quickActions = [
    { href: "/tenders", icon: Gavel, label: "View Tenders", desc: "Browse open port call tenders", color: "38 92% 50%", testId: "qa-tenders" },
    { href: "/company-profile", icon: Building2, label: "Edit Profile", desc: "Update your company listing", color: "var(--maritime-primary)", testId: "qa-profile" },
    { href: "/port-info", icon: MapPin, label: "Port Information", desc: "Turkish port details & tariffs", color: "var(--maritime-secondary)", testId: "qa-ports" },
    { href: "/vessel-track", icon: Navigation, label: "Vessel Tracker", desc: "Track vessels in your ports", color: "217 91% 40%", testId: "qa-track" },
    { href: "/proformas/new", icon: FileText, label: "New Proforma", desc: "Generate a proforma D/A", color: "var(--maritime-accent)", testId: "qa-proforma" },
    { href: "/forum", icon: MessageSquare, label: "Forum", desc: "Connect with the community", color: "142 71% 30%", testId: "qa-forum" },
  ];

  return (
    <div className="space-y-5">
      {/* Expiring certificates warning band */}
      {(criticalCerts.length > 0 || warnCerts.length > 0) && (
        <Link href="/vessel-certificates">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer hover:opacity-90 transition-opacity ${criticalCerts.length > 0 ? "bg-red-50 dark:bg-red-950/30 border-red-200/70 dark:border-red-800/50" : "bg-amber-50 dark:bg-amber-950/30 border-amber-200/70 dark:border-amber-800/50"}`}
            data-testid="banner-expiring-certs">
            <AlertCircle className={`w-4 h-4 flex-shrink-0 ${criticalCerts.length > 0 ? "text-red-600" : "text-amber-600"}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${criticalCerts.length > 0 ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300"}`}>
                {criticalCerts.length > 0
                  ? `${criticalCerts.length} certificate${criticalCerts.length !== 1 ? "s" : ""} expiring within 7 days`
                  : `${warnCerts.length} certificate${warnCerts.length !== 1 ? "s" : ""} expiring within 30 days`}
              </p>
              <p className="text-xs text-muted-foreground">Click to view vessel certificates</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
          </div>
        </Link>
      )}

      {/* Verification status banner */}
      {myProfile && (
        <>
          {verificationStatus === "unverified" && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50" data-testid="banner-verification-unverified">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Your company is not yet verified</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Send a verification request to earn a trust badge in the directory.</p>
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
                <span className="font-medium">Verification request under review.</span>{" "}
                <span className="font-normal text-blue-600 dark:text-blue-400">We will get back to you shortly.</span>
              </p>
            </div>
          )}
          {verificationStatus === "verified" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/40" data-testid="banner-verification-verified">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Your company is verified — trust badge visible in directory.</p>
            </div>
          )}
          {verificationStatus === "rejected" && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/70 dark:border-red-800/50" data-testid="banner-verification-rejected">
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Verification request was rejected</p>
                {verificationNote && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{verificationNote}</p>}
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0 dark:border-red-700 dark:text-red-300" onClick={() => setVerifyDialogOpen(true)} data-testid="button-retry-verify">
                <ShieldCheck className="w-3 h-3" /> Re-apply
              </Button>
            </div>
          )}
        </>
      )}

      {/* Stat bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Served Ports" value={servedPorts.length} icon={Anchor} color="var(--maritime-primary)" href="/company-profile" testId="stat-ports" />
        <StatCard label="Pending Bids" value={pendingBids.length} icon={Gavel} color="38 92% 50%" href="/tenders" testId="stat-pending-bids" />
        <StatCard label="Nominations" value={selectedBids.length} icon={TrendingUp} color="142 71% 30%" href="/nominations" testId="stat-won-bids" />
        <StatCard label="Avg. Rating" value={agentStats?.avgRating ? agentStats.avgRating.toFixed(1) : "—"} loading={statsLoading} icon={Star} color="var(--maritime-secondary)" href={profileId ? `/directory/${profileId}` : "/directory"} testId="stat-rating" />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Today's Tasks */}
          <Card className="p-5 space-y-3" data-testid="card-today-tasks">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground/60" /> Today's Tasks
              </h2>
              <div className="flex items-center gap-1.5">
                {(nominationCount?.count ?? 0) > 0 && (
                  <Badge className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">{nominationCount.count} nomination{nominationCount.count !== 1 ? "s" : ""}</Badge>
                )}
                {pendingBids.length > 0 && (
                  <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{pendingBids.length} pending bid{pendingBids.length !== 1 ? "s" : ""}</Badge>
                )}
              </div>
            </div>
            {upcomingETAs.length === 0 && pendingBids.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400/60" />
                All clear — no urgent tasks today
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingETAs.slice(0, 3).map((v) => (
                  <Link key={v.id} href={`/voyages/${v.id}`}>
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-blue-100 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20 hover:bg-blue-50/60 transition-colors cursor-pointer" data-testid={`task-voyage-eta-${v.id}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Ship className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{v.vesselName || `Voyage #${v.id}`}</p>
                          <p className="text-xs text-muted-foreground">ETA in {daysUntil(v.eta)} day{daysUntil(v.eta) !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <Badge className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex-shrink-0">ETA</Badge>
                    </div>
                  </Link>
                ))}
                {pendingBids.slice(0, 3).map((bid: any) => (
                  <Link key={bid.id} href={`/tenders/${bid.tenderId}`}>
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-amber-100 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20 hover:bg-amber-50/60 transition-colors cursor-pointer" data-testid={`task-bid-${bid.id}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Gavel className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{bid.portName || `Tender #${bid.tenderId}`}</p>
                          <p className="text-xs text-muted-foreground">Bid awaiting decision</p>
                        </div>
                      </div>
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex-shrink-0">Pending</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* 7-Day Performance Chart */}
          <Card className="p-5 space-y-3" data-testid="card-performance-chart">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground/60" /> Last 7 Days — Voyage Activity
              </h2>
              <Link href="/voyages">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                  All Voyages <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
            {voyagesLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !hasChartData ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <p>No voyage activity in the last 7 days</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={chartData} barSize={18} barGap={2}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                    cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                  />
                  <Bar dataKey="completed" name="Completed" fill="hsl(142 71% 35%)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="active" name="Active" fill="hsl(var(--maritime-primary) / 0.7)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Active Voyages */}
          <Card className="p-5 space-y-3" data-testid="card-active-voyages">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                <Anchor className="w-4 h-4 text-muted-foreground/60" /> Active Voyages
                {activeVoyages.length > 0 && <Badge className="text-[10px]">{activeVoyages.length}</Badge>}
              </h2>
              <Link href="/voyages">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">All <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </div>
            {voyagesLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : activeVoyages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No active voyages</p>
            ) : (
              <div className="space-y-1.5">
                {activeVoyages.slice(0, 5).map((v) => (
                  <Link key={v.id} href={`/voyages/${v.id}`}>
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`row-voyage-${v.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center flex-shrink-0">
                          <Ship className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{v.vesselName || `Voyage #${v.id}`}</p>
                          {v.eta && <p className="text-xs text-muted-foreground">ETA: {new Date(v.eta).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>}
                        </div>
                      </div>
                      <Badge className={`text-[10px] flex-shrink-0 ${v.status === "in_progress" || v.status === "active" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>
                        {v.status?.replace("_", " ")}
                      </Badge>
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
                <Gavel className="w-4 h-4 text-muted-foreground/60" /> Open Tenders in My Ports
              </h2>
              <Link href="/tenders">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
                  All Tenders <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
            {openTenders.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No open tenders in your ports</p>
                {servedPorts.length === 0 && (
                  <Link href="/company-profile">
                    <Button variant="outline" size="sm" className="gap-1.5 mt-3">Add Served Ports</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {openTenders.slice(0, 5).map((t) => {
                  const age = t.createdAt ? daysSince(t.createdAt) : 0;
                  const isUrgent = age >= 7;
                  return (
                    <Link key={t.id} href={`/tenders/${t.id}`}>
                      <div className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors cursor-pointer group ${isUrgent ? "border-amber-200/60 bg-amber-50/30 dark:border-amber-800/40 dark:bg-amber-950/10 hover:bg-amber-50/50" : "border-transparent hover:bg-muted/50"}`}
                        data-testid={`row-tender-${t.id}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <Gavel className={`w-3.5 h-3.5 flex-shrink-0 ${isUrgent ? "text-amber-600" : "text-[hsl(var(--maritime-primary))]"}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{t.portName || `Port #${t.portId}`}</p>
                            <p className="text-xs text-muted-foreground">{t.cargoType} · {age}d ago</p>
                          </div>
                        </div>
                        <Link href={`/tenders/${t.id}`}>
                          <Button size="sm" className="flex-shrink-0 h-7 text-xs gap-1 bg-[hsl(var(--maritime-primary))] text-white hover:bg-[hsl(var(--maritime-primary)/0.9)]">
                            Bid
                          </Button>
                        </Link>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right col */}
        <div className="space-y-5">
          {/* Performance Card */}
          <Card className="p-5 space-y-4" data-testid="card-performance">
            <h2 className="font-serif font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground/60" /> Performance
            </h2>
            {statsLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-6 w-full" />)}</div>
            ) : agentStats ? (
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Win Rate</span>
                    <span className="font-semibold">{agentStats.winRate}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${agentStats.winRate}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-muted/40 text-center">
                    <p className="text-lg font-bold font-serif">{agentStats.totalBids}</p>
                    <p className="text-[10px] text-muted-foreground">Total Bids</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40 text-center">
                    <p className="text-lg font-bold font-serif">{agentStats.selectedBids}</p>
                    <p className="text-[10px] text-muted-foreground">Nominations</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/40">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                  <span className="font-bold">{agentStats.avgRating || "—"}</span>
                  <span className="text-xs text-muted-foreground">({agentStats.totalReviews} review{agentStats.totalReviews !== 1 ? "s" : ""})</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-3">
                {!myProfile ? "Create a profile to track performance" : "No bids yet — submit your first bid!"}
              </p>
            )}
          </Card>

          {/* Expiring Certs Summary */}
          {expiringCerts.length > 0 && (
            <Link href="/vessel-certificates">
              <Card className="p-4 space-y-2 cursor-pointer hover:shadow-md transition-all border-amber-200/60 dark:border-amber-800/40" data-testid="card-expiring-certs">
                <h2 className="font-serif font-semibold text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" /> Expiring Certificates
                </h2>
                <div className="space-y-1.5">
                  {expiringCerts.slice(0, 4).map((cert: any, i) => {
                    const days = daysUntil(cert.expiryDate || cert.expiry_date);
                    return (
                      <div key={i} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-muted-foreground">{cert.certificateType || cert.certificate_type}</span>
                        <span className={`font-semibold flex-shrink-0 ${days <= 7 ? "text-red-600" : "text-amber-600"}`}>{days}d</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  View all <ArrowRight className="w-2.5 h-2.5" />
                </p>
              </Card>
            </Link>
          )}

          {/* Quick Actions */}
          <Card className="p-5 space-y-3">
            <h2 className="font-serif font-semibold text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground/60" /> Quick Actions
            </h2>
            <div className="space-y-1">
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href}>
                  <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={action.testId}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `hsl(${action.color} / 0.1)` }}>
                      <action.icon className="w-3.5 h-3.5" style={{ color: `hsl(${action.color})` } as React.CSSProperties} />
                    </div>
                    <span className="text-sm flex-1">{action.label}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground/40 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <VerificationRequestDialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen} />
    </div>
  );
}
