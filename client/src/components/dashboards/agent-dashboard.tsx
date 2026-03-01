import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Anchor, Gavel, Star, TrendingUp, ArrowRight, Building2, Activity, Navigation, MapPin, FileText, MessageSquare, ShieldCheck, AlertTriangle, Clock, XCircle, Settings } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompanyProfile } from "@shared/schema";

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

export function AgentDashboard({ user, tenders, myBidsData, myProfile, notificationsData }: {
  user: any; tenders: any[]; myBidsData: any; myProfile?: CompanyProfile | null; notificationsData: any;
}) {
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

  const openTenders = tenders.filter((t) => t.status === "open");
  const allBids: any[] = Array.isArray(myBidsData) ? myBidsData : [];
  const pendingBids = allBids.filter((b) => b.status === "pending");
  const selectedBids = allBids.filter((b) => b.status === "selected");
  const servedPorts = ((myProfile as any)?.servedPorts as number[]) || [];
  const unread = notificationsData?.unreadCount ?? 0;

  const quickActions = [
    { href: "/tenders", icon: Gavel, label: "View Tenders", desc: "Browse open port call tenders", color: "38 92% 50%", testId: "qa-tenders" },
    { href: "/company-profile", icon: Building2, label: "Edit Profile", desc: "Update your company listing", color: "var(--maritime-primary)", testId: "qa-profile" },
    { href: "/port-info", icon: MapPin, label: "Port Information", desc: "Turkish port details & tariffs", color: "var(--maritime-secondary)", testId: "qa-ports" },
    { href: "/vessel-track", icon: Navigation, label: "Vessel Tracker", desc: "Track vessels in your ports", color: "217 91% 40%", testId: "qa-track" },
    { href: "/proformas/new", icon: FileText, label: "New Proforma", desc: "Generate a proforma D/A", color: "var(--maritime-accent)", testId: "qa-proforma" },
    { href: "/forum", icon: MessageSquare, label: "Forum", desc: "Connect with the community", color: "142 71% 30%", testId: "qa-forum" },
  ];

  const verificationStatus = (myProfile as any)?.verificationStatus || "unverified";
  const verificationNote = (myProfile as any)?.verificationNote;

  return (
    <div className="space-y-6">
      {/* Verification status banner */}
      {myProfile && (
        <>
          {verificationStatus === "unverified" && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50" data-testid="banner-verification-unverified">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Şirketiniz henüz doğrulanmamış</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Doğrulama talebi göndererek dizinde güven rozeti kazanın ve öne çıkın.</p>
              </div>
              <Link href="/settings">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-100 flex-shrink-0 dark:border-amber-700 dark:text-amber-300" data-testid="button-go-verify">
                  <Settings className="w-3 h-3" /> Doğrulama Talebi
                </Button>
              </Link>
            </div>
          )}
          {verificationStatus === "pending" && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/50" data-testid="banner-verification-pending">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <span className="font-medium">Doğrulama talebiniz inceleniyor.</span>{" "}
                <span className="font-normal text-blue-600 dark:text-blue-400">En kısa sürede size dönülecek.</span>
              </p>
            </div>
          )}
          {verificationStatus === "verified" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/40" data-testid="banner-verification-verified">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Şirketiniz doğrulanmış — dizinde güven rozeti gösteriliyor.</p>
            </div>
          )}
          {verificationStatus === "rejected" && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/70 dark:border-red-800/50" data-testid="banner-verification-rejected">
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">Doğrulama talebiniz reddedildi</p>
                {verificationNote && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{verificationNote}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">Bilgilerinizi güncelleyerek tekrar başvurabilirsiniz.</p>
              </div>
              <Link href="/settings">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0 dark:border-red-700 dark:text-red-300" data-testid="button-retry-verify">
                  <Settings className="w-3 h-3" /> Tekrar Başvur
                </Button>
              </Link>
            </div>
          )}
        </>
      )}

      {/* Stat bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Served Ports" value={servedPorts.length} icon={Anchor} color="var(--maritime-primary)" href="/company-profile" testId="stat-ports" />
        <StatCard label="Pending Bids" value={pendingBids.length} icon={Gavel} color="38 92% 50%" href="/tenders" testId="stat-pending-bids" />
        <StatCard label="Won (Selected)" value={selectedBids.length} icon={TrendingUp} color="142 71% 30%" href="/tenders" testId="stat-won-bids" />
        <StatCard label="Avg. Rating" value={agentStats?.avgRating ? agentStats.avgRating.toFixed(1) : "—"} loading={statsLoading} icon={Star} color="var(--maritime-secondary)" href={profileId ? `/directory/${profileId}` : "/directory"} testId="stat-rating" />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
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
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center mx-auto">
                  <Gavel className="w-5 h-5 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">No open tenders in your ports</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    {servedPorts.length === 0
                      ? "Add served ports to your profile to receive tender notifications"
                      : "New tenders will appear here when shipowners post port call requests"
                    }
                  </p>
                </div>
                {servedPorts.length === 0 && (
                  <Link href="/company-profile">
                    <Button variant="outline" size="sm" className="gap-1.5">Add Served Ports</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {openTenders.slice(0, 6).map((t) => {
                  const age = t.createdAt ? daysSince(t.createdAt) : 0;
                  const isUrgent = age >= 7;
                  return (
                    <Link key={t.id} href={`/tenders/${t.id}`}>
                      <div className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors cursor-pointer group ${isUrgent ? "border-amber-200/60 bg-amber-50/30 dark:border-amber-800/40 dark:bg-amber-950/10 hover:bg-amber-50/50" : "border-transparent hover:bg-muted/50"}`}
                        data-testid={`row-tender-${t.id}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${isUrgent ? "bg-amber-100 dark:bg-amber-900/30" : "bg-[hsl(var(--maritime-primary)/0.08)]"}`}>
                            <Gavel className={`w-3.5 h-3.5 ${isUrgent ? "text-amber-600" : "text-[hsl(var(--maritime-primary))]"}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{t.portName || `Port #${t.portId}`}</p>
                              {isUrgent && <Badge className="text-[9px] px-1 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Urgent</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">{t.cargoType} · {age}d ago</p>
                          </div>
                        </div>
                        <Button size="sm" className="flex-shrink-0 h-7 text-xs gap-1 bg-[hsl(var(--maritime-primary))] text-white hover:bg-[hsl(var(--maritime-primary)/0.9)]">
                          Bid
                        </Button>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          {/* My Bids */}
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

            {allBids.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No bids submitted yet</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">Browse open tenders and submit your first bid</p>
              </div>
            ) : (
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
    </div>
  );
}
