import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Handshake, Gavel, Package, TrendingUp, ArrowRight, Plus, BarChart3, Ship,
  Clock, FileText, BookOpen, DollarSign, Calculator, Contact2, AlertCircle,
  CheckCircle2, Anchor, Calendar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AiSmartDropMini } from "@/components/ai-smart-drop";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/formatDate";

function timeAgo(dt: string) {
  const diff = Date.now() - new Date(dt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return fmtDate(dt);
}

function daysUntil(dt: string | null) {
  if (!dt) return null;
  return Math.ceil((new Date(dt).getTime() - Date.now()) / 86400000);
}

function RecentActivityCard() {
  const { data } = useQuery<{ activities: any[] }>({ queryKey: ["/api/user/recent-activity"] });
  const activities = data?.activities || [];

  const emojiMap: Record<string, string> = {
    voyage_created: "🗺️", status_changed: "🔄", eta_updated: "🕐",
    document_uploaded: "📄", document_signed: "✍️", checklist_completed: "✅",
    chat_message: "💬", sof_created: "📝", sof_finalized: "📝",
    pda_created: "📋", pda_approved: "📋", fda_created: "🧾", fda_approved: "🧾",
    invoice_created: "💳", invoice_paid: "💰", nomination_sent: "🤝",
    review_submitted: "⭐", custom_note: "📌", nor_tendered: "📋", nor_accepted: "✅",
  };

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
              <span className="text-base flex-shrink-0">{emojiMap[a.activityType] || "📌"}</span>
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
        <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-40" style={{ background: `hsl(${color} / 0.05)` }} />
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            {loading ? <Skeleton className="h-8 w-12" /> : (
              <p className={`text-3xl font-bold tracking-tight ${typeof value === 'number' && value === 0 ? 'text-slate-500' : 'dark:bg-gradient-to-r dark:from-white dark:to-slate-300 dark:bg-clip-text dark:text-transparent'}`}>{value}</p>
            )}
          </div>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110" style={{ background: `hsl(${color} / 0.12)` }}>
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

function ActiveOrdersWidget() {
  const { data: orders = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/order-book/cargo-orders"] });
  const openOrders = orders.filter((o: any) => o.status === "open" || o.status === "negotiating")
    .sort((a: any, b: any) => {
      const da = a.laycanFrom ? new Date(a.laycanFrom).getTime() : Infinity;
      const db = b.laycanFrom ? new Date(b.laycanFrom).getTime() : Infinity;
      return da - db;
    }).slice(0, 5);

  return (
    <Card className="p-5 space-y-3" data-testid="card-active-orders">
      <div className="flex items-center justify-between">
        <h2 className="font-serif font-semibold text-base flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground/60" /> Active Cargo Orders
        </h2>
        <Link href="/order-book">
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">Order Book <ArrowRight className="w-3 h-3" /></Button>
        </Link>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : openOrders.length === 0 ? (
        <div className="text-center py-5 space-y-2">
          <BookOpen className="w-8 h-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No open cargo orders</p>
          <Link href="/order-book">
            <Button variant="outline" size="sm" className="mt-1"><Plus className="w-3.5 h-3.5 mr-1.5" /> New Order</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {openOrders.map((o: any) => {
            const days = daysUntil(o.laycanFrom);
            const urgency = days === null ? "bg-slate-100 text-slate-600" : days <= 3 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : days <= 7 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
            return (
              <div key={o.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors" data-testid={`row-order-${o.id}`}>
                <div className="w-7 h-7 rounded-md bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center flex-shrink-0">
                  <Package className="w-3.5 h-3.5 text-sky-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{o.cargoType} {o.quantity ? `— ${o.quantity.toLocaleString()} ${o.quantityUnit || "MT"}` : ""}</p>
                  <p className="text-xs text-muted-foreground truncate">{[o.loadPort, o.dischargePort].filter(Boolean).join(" → ")}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {days !== null && (
                    <Badge className={`text-[10px] ${urgency}`}>
                      {days <= 0 ? "Today" : `${days}d`}
                    </Badge>
                  )}
                  <Badge variant="outline" className={`text-[10px] capitalize ${o.status === "negotiating" ? "border-amber-400 text-amber-600" : ""}`}>
                    {o.status}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function PendingCommissionsWidget() {
  const { data: commissions = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/broker-commissions"] });
  const pending = commissions
    .filter((c: any) => c.status === "pending" || c.status === "invoiced" || c.status === "partial")
    .sort((a: any, b: any) => {
      const da = a.paymentDueDate ? new Date(a.paymentDueDate).getTime() : Infinity;
      const db = b.paymentDueDate ? new Date(b.paymentDueDate).getTime() : Infinity;
      return da - db;
    }).slice(0, 5);

  const totalPending = pending.reduce((s: number, c: any) => s + (c.netCommission || 0), 0);

  return (
    <Card className="p-5 space-y-3" data-testid="card-pending-commissions">
      <div className="flex items-center justify-between">
        <h2 className="font-serif font-semibold text-base flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-muted-foreground/60" /> Pending Commissions
        </h2>
        <Link href="/broker-commissions">
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">All Commissions <ArrowRight className="w-3 h-3" /></Button>
        </Link>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : pending.length === 0 ? (
        <div className="text-center py-5 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto" />
          <p className="text-sm text-muted-foreground">No pending payments</p>
        </div>
      ) : (
        <div className="space-y-2">
          {totalPending > 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                ${totalPending.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} pending collection
              </span>
            </div>
          )}
          {pending.map((c: any) => {
            const overdue = c.paymentDueDate && new Date(c.paymentDueDate) < new Date() && c.status !== "received";
            return (
              <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors" data-testid={`row-commission-${c.id}`}>
                <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${overdue ? "bg-red-50 dark:bg-red-950/30" : "bg-emerald-50 dark:bg-emerald-950/30"}`}>
                  <DollarSign className={`w-3.5 h-3.5 ${overdue ? "text-red-600" : "text-emerald-600"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.counterparty || c.dealDescription || `Commission #${c.id}`}</p>
                  <p className="text-xs text-muted-foreground">{c.paymentDueDate ? `Due ${fmtDate(c.paymentDueDate)}` : "No due date"}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-sm font-semibold ${overdue ? "text-red-600" : "text-emerald-600"}`}>
                    ${(c.netCommission || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  {overdue && <Badge className="text-[9px] bg-red-100 text-red-700">OVERDUE</Badge>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function BrokerDashboard({ user }: { user: any }) {
  const { data: fixtures, isLoading: fixturesLoading } = useQuery<any[]>({ queryKey: ["/api/fixtures"] });
  const { data: tendersData, isLoading: tendersLoading } = useQuery<any>({ queryKey: ["/api/tenders"] });
  const { data: cargoPositions, isLoading: cargoLoading } = useQuery<any[]>({ queryKey: ["/api/cargo-positions"] });
  const { data: orderSummary, isLoading: orderLoading } = useQuery<any>({ queryKey: ["/api/order-book/summary"] });
  const { data: commissionSummary, isLoading: commissionLoading } = useQuery<any>({ queryKey: ["/api/broker-commissions/summary"] });

  const tenders: any[] = tendersData?.tenders || [];
  const activeFixtures = (fixtures || []).filter((f: any) => f.status === "active" || f.status === "in_progress").length;
  const openTenders = tenders.filter((t: any) => t.status === "open").length;
  const recentFixtures = (fixtures || []).slice(0, 4);
  const recentTenders = tenders.slice(0, 4);

  const fmtMoney = (v: number | undefined) => {
    if (!v) return "$0";
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
    return `$${v.toFixed(0)}`;
  };

  return (
    <div className="space-y-6">
      {/* Row 1 — 4 core KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Fixtures" value={fixturesLoading ? "…" : activeFixtures} loading={fixturesLoading} icon={Handshake} color="var(--maritime-primary)" href="/fixtures" testId="stat-active-fixtures" />
        <StatCard label="Open Tenders" value={tendersLoading ? "…" : openTenders} loading={tendersLoading} icon={Gavel} color="38 92% 40%" href="/tenders" testId="stat-open-tenders" />
        <StatCard label="Open Orders" value={orderLoading ? "…" : (orderSummary?.openCargoOrders ?? 0)} loading={orderLoading} icon={BookOpen} color="217 91% 40%" href="/order-book" testId="stat-open-orders" />
        <StatCard label="Pending Comm." value={commissionLoading ? "…" : fmtMoney(commissionSummary?.pendingPayments)} loading={commissionLoading} icon={DollarSign} color="142 71% 35%" href="/broker-commissions" testId="stat-pending-commissions" />
      </div>

      {/* Row 2 — 4 secondary KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Cargo Positions" value={cargoLoading ? "…" : (cargoPositions || []).length} loading={cargoLoading} icon={Package} color="262 83% 58%" href="/cargo-positions" testId="stat-cargo-positions" />
        <StatCard label="Open Vessel Pos." value={orderLoading ? "…" : (orderSummary?.openVesselPositions ?? 0)} loading={orderLoading} icon={Ship} color="var(--maritime-secondary)" href="/order-book" testId="stat-vessel-positions" />
        <StatCard label="This Month Comm." value={commissionLoading ? "…" : fmtMoney(commissionSummary?.monthlyTotal)} loading={commissionLoading} icon={Calendar} color="var(--maritime-accent)" href="/broker-commissions" testId="stat-monthly-commission" />
        <StatCard label="Fixed This Week" value={orderLoading ? "…" : (orderSummary?.fixedThisWeek ?? 0)} loading={orderLoading} icon={Anchor} color="142 71% 45%" href="/order-book" testId="stat-fixed-week" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Active Orders Widget */}
          <ActiveOrdersWidget />

          {/* Pending Commissions Widget */}
          <PendingCommissionsWidget />

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
                  <Button variant="outline" size="sm" className="mt-1"><Plus className="w-3.5 h-3.5 mr-1.5" /> New Fixture</Button>
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

        {/* Right column */}
        <div className="space-y-6">
          <RecentActivityCard />

          {/* Quick Access — updated with Sprint 9 links */}
          <Card className="p-5 space-y-3">
            <h2 className="font-serif font-semibold text-base">Quick Access</h2>
            <div className="space-y-1.5">
              {[
                { href: "/voyage-estimation", icon: Calculator, label: "Voyage Estimation", desc: "Freight P&L & TCE calculator", color: "var(--maritime-primary)", testId: "qa-voyage-estimation" },
                { href: "/order-book", icon: BookOpen, label: "Order Book", desc: "Cargo orders & vessel positions", color: "217 91% 40%", testId: "qa-order-book" },
                { href: "/broker-commissions", icon: DollarSign, label: "Commissions", desc: "Track earned commissions", color: "142 71% 35%", testId: "qa-commissions" },
                { href: "/contacts", icon: Contact2, label: "Contacts", desc: "Shipowners, charterers, brokers", color: "262 83% 58%", testId: "qa-contacts" },
                { href: "/fixtures", icon: Handshake, label: "New Fixture", desc: "Record charter negotiation", color: "var(--maritime-secondary)", testId: "qa-new-fixture" },
                { href: "/market-data", icon: BarChart3, label: "Market Data", desc: "BDI & Baltic freight rates", color: "38 92% 50%", testId: "qa-market" },
                { href: "/cargo-positions", icon: Package, label: "Cargo Positions", desc: "Browse market cargo ads", color: "var(--maritime-accent)", testId: "qa-cargo" },
                { href: "/tenders", icon: Gavel, label: "Tenders", desc: "Port call tender bids", color: "38 92% 40%", testId: "qa-tenders" },
              ].map((action) => (
                <Link key={action.href} href={action.href}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={action.testId}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `hsl(${action.color} / 0.1)` }}>
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
          <Card className="p-4 space-y-2" data-testid="card-market-snapshot">
            <h2 className="font-serif font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground/60" /> Market Snapshot
            </h2>
            <Link href="/market-data">
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer">
                <span className="text-xs font-medium">Baltic Dry Index</span>
                <Badge variant="outline" className="text-[10px]">View Live</Badge>
              </div>
            </Link>
            <Link href="/voyage-estimation">
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer">
                <span className="text-xs font-medium">Voyage Estimator</span>
                <Badge variant="outline" className="text-[10px] border-sky-400/50 text-sky-500">Open</Badge>
              </div>
            </Link>
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
