import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Handshake, Ship, Gavel, Package, Navigation, ArrowRight, Plus,
  TrendingUp, FileText, Activity, Clock, CheckCircle2, AlertCircle,
  Anchor, BarChart2, Globe, DollarSign, Users
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({
  label, value, loading, icon: Icon, color, href, testId, sub,
}: {
  label: string; value: React.ReactNode; loading?: boolean;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string; href: string; testId: string; sub?: string;
}) {
  return (
    <Link href={href}>
      <Card
        className="p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group relative overflow-hidden"
        data-testid={testId}
        style={{ borderLeft: `3px solid hsl(${color} / 0.5)` }}
      >
        <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-40"
          style={{ background: `hsl(${color} / 0.05)` }} />
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            {loading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-bold font-serif">{value}</p>}
            {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
          </div>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
            style={{ background: `hsl(${color} / 0.12)` }}
          >
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

function SectionCard({
  title, icon: Icon, href, linkLabel, children, testId,
}: {
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

const FIXTURE_STATUS_COLORS: Record<string, string> = {
  negotiation:  "bg-yellow-100 text-yellow-700 border-yellow-200",
  firm_offer:   "bg-blue-100 text-blue-700 border-blue-200",
  recap_issued: "bg-purple-100 text-purple-700 border-purple-200",
  fixed:        "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled:    "bg-red-100 text-red-700 border-red-200",
};

const VOYAGE_STATUS_ICONS: Record<string, React.ReactNode> = {
  planned:     <Clock className="w-3.5 h-3.5 text-blue-500" />,
  active:      <Activity className="w-3.5 h-3.5 text-emerald-500" />,
  completed:   <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />,
  cancelled:   <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
};

export function BrokerDashboard({ user }: { user: any }) {
  const { data: rawVessels, isLoading: vesselsLoading } = useQuery<any[]>({ queryKey: ["/api/vessels"] });
  const { data: rawVoyages, isLoading: voyagesLoading } = useQuery<any[]>({ queryKey: ["/api/voyages"] });
  const { data: rawFixtures, isLoading: fixturesLoading } = useQuery<any[]>({ queryKey: ["/api/fixtures"] });
  const { data: rawPositions, isLoading: positionsLoading } = useQuery<any[]>({ queryKey: ["/api/cargo-positions"] });
  const { data: rawTenders, isLoading: tendersLoading } = useQuery<any[]>({ queryKey: ["/api/tenders"] });
  const { data: marketIndices } = useQuery<any>({ queryKey: ["/api/market/indices"] });

  const vessels  = Array.isArray(rawVessels)  ? rawVessels  : [];
  const voyages  = Array.isArray(rawVoyages)  ? rawVoyages  : [];
  const fixtures = Array.isArray(rawFixtures) ? rawFixtures : [];
  const positions = Array.isArray(rawPositions) ? rawPositions : [];
  const tenders  = Array.isArray(rawTenders)  ? rawTenders  : [];

  const activeFixtures = fixtures.filter((f) => !["cancelled", "completed"].includes(f.status || ""));
  const openPositions  = positions.filter((p) => p.status === "active" || !p.status);
  const openTenders    = tenders.filter((t) => t.status === "open");
  const activeVoyages  = voyages.filter((v) => v.status === "active" || v.status === "planned");

  const bdiValue = marketIndices?.bdi?.value ?? marketIndices?.BDI ?? null;
  const bdtiValue = marketIndices?.bdti?.value ?? marketIndices?.BDTI ?? null;

  return (
    <div className="space-y-5" data-testid="broker-dashboard">
      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard
          label="My Fleet"
          value={vessels.length}
          loading={vesselsLoading}
          icon={Ship}
          color="var(--maritime-primary)"
          href="/vessels"
          testId="stat-broker-fleet"
        />
        <StatCard
          label="Active Fixtures"
          value={activeFixtures.length}
          loading={fixturesLoading}
          icon={Handshake}
          color="217 91% 45%"
          href="/fixtures"
          testId="stat-broker-fixtures"
          sub={activeFixtures.filter((f) => f.status === "negotiation").length + " in negotiation"}
        />
        <StatCard
          label="Cargo Positions"
          value={openPositions.length}
          loading={positionsLoading}
          icon={Package}
          color="25 95% 53%"
          href="/cargo-board"
          testId="stat-broker-positions"
        />
        <StatCard
          label="Open Tenders"
          value={openTenders.length}
          loading={tendersLoading}
          icon={Gavel}
          color="262 83% 58%"
          href="/tenders"
          testId="stat-broker-tenders"
        />
        <StatCard
          label="Active Voyages"
          value={activeVoyages.length}
          loading={voyagesLoading}
          icon={Navigation}
          color="142 76% 36%"
          href="/voyages"
          testId="stat-broker-voyages"
        />
      </div>

      {/* ── Quick Actions ── */}
      <div className="flex flex-wrap gap-2">
        <Link href="/fixtures/new">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" data-testid="button-new-fixture">
            <Plus className="w-3.5 h-3.5" /> New Fixture
          </Button>
        </Link>
        <Link href="/cargo-board">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" data-testid="button-cargo-board">
            <Package className="w-3.5 h-3.5" /> Cargo Board
          </Button>
        </Link>
        <Link href="/voyages/new">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" data-testid="button-new-voyage-broker">
            <Navigation className="w-3.5 h-3.5" /> New Voyage
          </Button>
        </Link>
        <Link href="/vessel-track">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" data-testid="button-vessel-track-broker">
            <Globe className="w-3.5 h-3.5" /> Vessel Tracking
          </Button>
        </Link>
        <Link href="/market">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" data-testid="button-market-broker">
            <BarChart2 className="w-3.5 h-3.5" /> Market Data
          </Button>
        </Link>
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Active Fixtures */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Active Fixtures"
            icon={Handshake}
            href="/fixtures"
            linkLabel="All Fixtures"
            testId="section-broker-fixtures"
          >
            {fixturesLoading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : activeFixtures.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground gap-2">
                <Handshake className="w-8 h-8 opacity-30" />
                <p className="text-sm">No active fixtures</p>
                <Link href="/fixtures/new">
                  <Button size="sm" variant="outline" className="gap-1 text-xs mt-1" data-testid="button-empty-new-fixture">
                    <Plus className="w-3 h-3" /> Create Fixture
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y">
                {activeFixtures.slice(0, 6).map((f) => (
                  <Link key={f.id} href={`/fixtures/${f.id}`}>
                    <div className="py-3 flex items-center justify-between gap-3 hover:bg-muted/30 -mx-1 px-1 rounded transition-colors cursor-pointer" data-testid={`row-fixture-${f.id}`}>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{f.vesselName || f.vessel_name || "Unnamed Fixture"}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {f.cargoType || f.cargo_type || "—"} · {f.loadPort || f.load_port || "—"} → {f.dischargePort || f.discharge_port || "—"}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${FIXTURE_STATUS_COLORS[f.status] || "bg-slate-100 text-slate-600"}`}>
                        {(f.status || "unknown").replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Market Indices */}
          <SectionCard title="Market Indices" icon={BarChart2} href="/market" linkLabel="Full Data" testId="section-broker-market">
            {bdiValue !== null ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Baltic Dry Index</p>
                    <p className="text-xl font-bold font-serif">{bdiValue?.toLocaleString?.() ?? bdiValue}</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                {bdtiValue !== null && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">BDTI</p>
                      <p className="text-xl font-bold font-serif">{bdtiValue?.toLocaleString?.() ?? bdtiValue}</p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-orange-600" />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-2">Market data loading…</p>
            )}
          </SectionCard>

          {/* Fleet snapshot */}
          <SectionCard title="Fleet" icon={Ship} href="/vessels" linkLabel="Manage Fleet" testId="section-broker-fleet">
            {vesselsLoading ? (
              <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : vessels.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <Ship className="w-7 h-7 mx-auto mb-1 opacity-30" />
                <p className="text-xs">No vessels yet</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {vessels.slice(0, 5).map((v) => (
                  <Link key={v.id} href={`/vessels/${v.id}`}>
                    <div className="flex items-center gap-2 p-2 hover:bg-muted/30 rounded cursor-pointer transition-colors group" data-testid={`row-vessel-broker-${v.id}`}>
                      <div className="w-7 h-7 rounded-md bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0">
                        <Ship className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate group-hover:text-[hsl(var(--maritime-primary))] transition-colors">{v.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{v.vesselType || v.vessel_type || "—"} · {v.flag || "—"}</p>
                      </div>
                      <Anchor className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                  </Link>
                ))}
                {vessels.length > 5 && (
                  <p className="text-[10px] text-center text-muted-foreground pt-1">+{vessels.length - 5} more</p>
                )}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* ── Bottom Row: Cargo Positions + Active Voyages ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Cargo/Position Board */}
        <SectionCard title="Cargo Positions" icon={Package} href="/cargo-board" linkLabel="Full Board" testId="section-broker-positions">
          {positionsLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : openPositions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Package className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
              <p className="text-sm">No open positions</p>
              <Link href="/cargo-board">
                <Button size="sm" variant="outline" className="mt-2 text-xs gap-1" data-testid="button-empty-cargo-board">
                  <Plus className="w-3 h-3" /> Add Position
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {openPositions.slice(0, 5).map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-3" data-testid={`row-position-${p.id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{p.cargoType || p.cargo_type || p.title || "Position"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.loadPort || p.load_port || "—"} → {p.dischargePort || p.discharge_port || "—"}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 flex-shrink-0">
                    Active
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Active Voyages */}
        <SectionCard title="Active Voyages" icon={Navigation} href="/voyages" linkLabel="All Voyages" testId="section-broker-voyages">
          {voyagesLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : activeVoyages.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Navigation className="w-8 h-8 mx-auto mb-1.5 opacity-30" />
              <p className="text-sm">No active voyages</p>
              <Link href="/voyages/new">
                <Button size="sm" variant="outline" className="mt-2 text-xs gap-1" data-testid="button-empty-new-voyage">
                  <Plus className="w-3 h-3" /> New Voyage
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {activeVoyages.slice(0, 5).map((v) => (
                <Link key={v.id} href={`/voyages/${v.id}`}>
                  <div className="py-2.5 flex items-center gap-3 hover:bg-muted/30 -mx-1 px-1 rounded transition-colors cursor-pointer" data-testid={`row-voyage-broker-${v.id}`}>
                    <div className="flex-shrink-0">{VOYAGE_STATUS_ICONS[v.status] || <Activity className="w-3.5 h-3.5 text-slate-400" />}</div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{v.voyageNumber || v.voyage_number || `Voyage #${v.id}`}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {v.vesselName || v.vessel_name || "—"} · {v.status || "—"}
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
