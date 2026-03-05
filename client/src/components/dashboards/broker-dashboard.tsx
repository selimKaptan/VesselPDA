import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Handshake, Gavel, Package, TrendingUp, ArrowRight, Plus, BarChart3, Ship, Clock, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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

export function BrokerDashboard({ user }: { user: any }) {
  const { data: fixtures, isLoading: fixturesLoading } = useQuery<any[]>({ queryKey: ["/api/fixtures"] });
  const { data: tendersData, isLoading: tendersLoading } = useQuery<any>({ queryKey: ["/api/tenders"] });
  const { data: cargoPositions, isLoading: cargoLoading } = useQuery<any[]>({ queryKey: ["/api/cargo-positions"] });
  const { data: marketData } = useQuery<any>({ queryKey: ["/api/market-data"] });

  const tenders: any[] = tendersData?.tenders || [];

  const activeFixtures = (fixtures || []).filter((f: any) => f.status === "active" || f.status === "in_progress").length;
  const openTenders = tenders.filter((t: any) => t.status === "open").length;
  const cargoCount = (cargoPositions || []).length;
  const hasMarketData = !!(marketData?.bdi || marketData?.indices);

  const recentFixtures = (fixtures || []).slice(0, 4);
  const recentTenders = tenders.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Fixtures" value={fixturesLoading ? "…" : activeFixtures} loading={fixturesLoading} icon={Handshake} color="var(--maritime-primary)" href="/fixtures" testId="stat-active-fixtures" />
        <StatCard label="Open Tenders" value={tendersLoading ? "…" : openTenders} loading={tendersLoading} icon={Gavel} color="38 92% 40%" href="/tenders" testId="stat-open-tenders" />
        <StatCard label="Cargo Positions" value={cargoLoading ? "…" : cargoCount} loading={cargoLoading} icon={Package} color="142 71% 35%" href="/cargo-positions" testId="stat-cargo-positions" />
        <StatCard label="Market Updates" value={hasMarketData ? "Live" : "—"} icon={TrendingUp} color="var(--maritime-secondary)" href="/market-data" testId="stat-market-updates" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Fixtures */}
          <Card className="p-5 space-y-3" data-testid="card-recent-fixtures">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                <Handshake className="w-4 h-4 text-muted-foreground/60" /> Recent Fixtures
              </h2>
              <Link href="/fixtures">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">View All <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </div>
            {fixturesLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : recentFixtures.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <Handshake className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">No fixtures yet</p>
                <Link href="/fixtures">
                  <Button variant="outline" size="sm" className="mt-1">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> New Fixture
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentFixtures.map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors" data-testid={`row-fixture-${f.id}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-md bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center flex-shrink-0">
                        <Ship className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{f.vesselName || `Fixture #${f.id}`}</p>
                        <p className="text-xs text-muted-foreground">{f.cargoType || f.charterer || "Charter party"}</p>
                      </div>
                    </div>
                    <Badge className={`text-[10px] flex-shrink-0 capitalize ${f.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {f.status || "draft"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Tenders */}
          <Card className="p-5 space-y-3" data-testid="card-recent-tenders">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                <Gavel className="w-4 h-4 text-muted-foreground/60" /> Open Tenders
              </h2>
              <Link href="/tenders">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">All Tenders <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </div>
            {tendersLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : recentTenders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No open tenders</p>
            ) : (
              <div className="space-y-1.5">
                {recentTenders.map((t: any) => (
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
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex-shrink-0">
                        {t.bidCount ?? 0} bids
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Quick Access */}
        <div className="space-y-6">
          <RecentActivityCard />
          <Card className="p-5 space-y-3">
            <h2 className="font-serif font-semibold text-base">Quick Access</h2>
            <div className="space-y-1.5">
              {[
                { href: "/fixtures", icon: Plus, label: "New Fixture", desc: "Start charter negotiation", color: "var(--maritime-primary)", testId: "qa-new-fixture" },
                { href: "/market-data", icon: BarChart3, label: "Market Data", desc: "Baltic indices & freight rates", color: "var(--maritime-secondary)", testId: "qa-market" },
                { href: "/cargo-positions", icon: Package, label: "Cargo Positions", desc: "Browse cargo & vessel ads", color: "142 71% 35%", testId: "qa-cargo" },
                { href: "/tenders", icon: Gavel, label: "Open Tenders", desc: "View port call tenders", color: "38 92% 50%", testId: "qa-tenders" },
                { href: "/vessel-track", icon: Ship, label: "Vessel Tracker", desc: "Live vessel positions", color: "217 91% 40%", testId: "qa-track" },
                { href: "/proformas", icon: FileText, label: "Proformas", desc: "Proforma disbursements", color: "var(--maritime-accent)", testId: "qa-proformas" },
              ].map((action) => (
                <Link key={action.href} href={action.href}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={action.testId}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `hsl(${action.color} / 0.1)` }}>
                      <action.icon className="w-4 h-4" style={{ color: `hsl(${action.color})` } as React.CSSProperties} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{action.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{action.desc}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          {/* Market snapshot */}
          <Card className="p-4 mt-4 space-y-2" data-testid="card-market-snapshot">
            <h2 className="font-serif font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground/60" /> Market Snapshot
            </h2>
            <Link href="/market-data">
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer">
                <span className="text-xs font-medium">Baltic Dry Index</span>
                <Badge variant="outline" className="text-[10px]">View Live</Badge>
              </div>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
