import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Ship, Anchor, DollarSign, AlertTriangle, Plus, FileText, Navigation,
  Calendar, Bell, TrendingUp, TrendingDown, Minus, Briefcase, Users,
  Clock, CheckCircle2, ArrowRight, Activity, Gavel, Package,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ["#38BDF8", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" },
  labelStyle: { color: "#94a3b8" },
  itemStyle: { color: "#f1f5f9" },
};

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n?.toLocaleString() ?? 0}`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function fmtMonth(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function voyageStatusBadge(status: string) {
  const map: Record<string, string> = {
    planned: "bg-blue-500/10 text-blue-500",
    active: "bg-emerald-500/10 text-emerald-500",
    in_progress: "bg-emerald-500/10 text-emerald-500",
    completed: "bg-slate-500/10 text-slate-400",
    cancelled: "bg-red-500/10 text-red-500",
  };
  return map[status] || "bg-slate-500/10 text-slate-400";
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ─── QUICK ACTIONS ────────────────────────────────────────────────────────────
function QuickActions({ role }: { role: string }) {
  const actions = [
    { label: "New Proforma", href: "/proformas/new", icon: FileText, show: ["shipowner", "agent", "admin"] },
    { label: "New Voyage", href: "/voyages", icon: Navigation, show: ["shipowner", "agent", "admin", "master"] },
    { label: "New Tender", href: "/tenders", icon: Gavel, show: ["shipowner", "admin"] },
    { label: "Track Vessel", href: "/vessel-track", icon: Ship, show: ["shipowner", "agent", "admin", "master", "broker"] },
    { label: "Laytime Calc", href: "/laytime-calculator", icon: Clock, show: ["agent", "shipowner", "admin"] },
    { label: "Cargo Positions", href: "/cargo-positions", icon: Package, show: ["broker", "admin"] },
  ].filter(a => a.show.includes(role));

  return (
    <div className="flex flex-wrap gap-2" data-testid="section-quick-actions">
      {actions.map(a => (
        <Link key={a.href} href={a.href}>
          <Button variant="outline" size="sm" className="gap-2 h-9 text-xs font-medium hover:bg-[hsl(var(--maritime-primary)/0.08)] hover:border-[hsl(var(--maritime-primary)/0.4)]" data-testid={`button-quick-${a.label.toLowerCase().replace(/\s/g, "-")}`}>
            <a.icon className="w-3.5 h-3.5" />
            {a.label}
          </Button>
        </Link>
      ))}
    </div>
  );
}

// ─── FLEET OVERVIEW ───────────────────────────────────────────────────────────
function FleetOverview({ data }: { data: any }) {
  const fleet = data?.fleet;
  if (!fleet) return null;
  const statusColors: Record<string, string> = {
    idle: "bg-slate-400",
    sailing: "bg-blue-500",
    at_port: "bg-emerald-500",
    drydock: "bg-amber-500",
    laid_up: "bg-red-500",
  };
  const counts = fleet.statusCounts || {};
  return (
    <Card data-testid="card-fleet-overview">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Ship className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
          Fleet Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-3xl font-bold">{fleet.totalVessels}</span>
          <span className="text-sm text-muted-foreground">vessels</span>
        </div>
        <div className="space-y-2">
          {Object.entries(counts).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${statusColors[status] || "bg-slate-400"}`} />
                <span className="text-muted-foreground capitalize">{status.replace(/_/g, " ")}</span>
              </div>
              <span className="font-semibold">{String(count)}</span>
            </div>
          ))}
          {Object.keys(counts).length === 0 && (
            <p className="text-xs text-muted-foreground">No status data</p>
          )}
        </div>
        <Link href="/vessels">
          <Button variant="ghost" size="sm" className="w-full mt-3 h-7 text-xs text-muted-foreground hover:text-foreground gap-1">
            Manage Fleet <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── FINANCIAL SUMMARY ────────────────────────────────────────────────────────
function FinancialSummary({ data }: { data: any }) {
  const inv = data?.financial?.invoices || {};
  const cards = [
    { label: "Total Invoiced", value: fmt(inv.totalInvoiced || 0), color: "text-foreground", bg: "bg-slate-500/10", icon: DollarSign },
    { label: "Collected", value: fmt(inv.totalPaid || 0), color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
    { label: "Pending", value: fmt(inv.totalPending || 0), color: "text-amber-500", bg: "bg-amber-500/10", icon: Clock },
    { label: "Overdue", value: fmt(inv.totalOverdue || 0), color: "text-red-500", bg: "bg-red-500/10", icon: AlertTriangle, highlight: (inv.overdueCount || 0) > 0 },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="section-financial-summary">
      {cards.map(c => (
        <Card key={c.label} className={c.highlight ? "border-red-500/30" : ""}>
          <CardContent className="p-4">
            <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center mb-2`}>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${c.color}`}>{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── ACTIVE VOYAGES ───────────────────────────────────────────────────────────
function ActiveVoyages({ data }: { data: any }) {
  const voyages = data?.voyages?.active || [];
  return (
    <Card data-testid="card-active-voyages">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Navigation className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
            Active Voyages
            {voyages.length > 0 && <Badge variant="secondary" className="text-xs">{voyages.length}</Badge>}
          </CardTitle>
          <Link href="/voyages">
            <span className="text-xs text-sky-400 hover:underline cursor-pointer">View all →</span>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {voyages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No active voyages</p>
        ) : (
          <div className="space-y-2">
            {voyages.slice(0, 6).map((v: any) => (
              <Link key={v.id} href={`/voyages/${v.id}`}>
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer" data-testid={`row-voyage-${v.id}`}>
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Ship className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{v.vesselName}</p>
                    <p className="text-xs text-muted-foreground truncate">{v.portName || "—"} · ETA {fmtDate(v.eta)}</p>
                  </div>
                  <Badge className={`text-xs shrink-0 ${voyageStatusBadge(v.status)}`}>
                    {v.status?.replace(/_/g, " ")}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── CERTIFICATE ALERTS ───────────────────────────────────────────────────────
function CertificateAlerts({ data }: { data: any }) {
  const certs = data?.alerts?.expiringCertificates || [];
  if (certs.length === 0) return null;
  return (
    <Card className="border-amber-500/30" data-testid="card-certificate-alerts">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Certificate Alerts
          <Badge className="bg-amber-500/10 text-amber-500 text-xs">{certs.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {certs.slice(0, 5).map((c: any) => {
            const days = daysUntil(c.expiresAt);
            const isExpired = days < 0;
            const isUrgent = days <= 7;
            return (
              <div key={c.id} className={`flex items-center justify-between p-2 rounded-lg ${isExpired ? "bg-red-500/10" : isUrgent ? "bg-amber-500/10" : "bg-amber-500/5"}`} data-testid={`row-cert-${c.id}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.vesselName}</p>
                </div>
                <Badge className={`shrink-0 text-xs ml-2 ${isExpired ? "bg-red-500/10 text-red-500" : isUrgent ? "bg-amber-500/10 text-amber-500" : "bg-amber-500/10 text-amber-400"}`}>
                  {isExpired ? "Expired" : `${days}d left`}
                </Badge>
              </div>
            );
          })}
        </div>
        <Link href="/vessel-certificates">
          <Button variant="ghost" size="sm" className="w-full mt-2 h-7 text-xs text-muted-foreground hover:text-foreground gap-1">
            Manage Certificates <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── UPCOMING PORT CALLS ──────────────────────────────────────────────────────
function UpcomingPortCalls({ data }: { data: any }) {
  const portCalls = data?.alerts?.upcomingPortCalls || [];
  if (portCalls.length === 0) return null;
  return (
    <Card data-testid="card-upcoming-port-calls-hub">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Anchor className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
            Upcoming Port Calls
          </CardTitle>
          <Link href="/port-calls">
            <span className="text-xs text-sky-400 hover:underline cursor-pointer">View all →</span>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {portCalls.map((pc: any) => (
            <div key={pc.id} className="flex items-center gap-3 py-1.5" data-testid={`row-portcall-${pc.id}`}>
              <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{pc.vesselName}</p>
                <p className="text-xs text-muted-foreground truncate">{pc.portName}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground">{fmtDate(pc.eta)}</p>
                <Badge className="bg-blue-500/10 text-blue-400 text-xs">{pc.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── PDA vs FDA VARIANCE CHART ────────────────────────────────────────────────
function VarianceTrendChart({ data }: { data: any }) {
  const trend = (data?.financial?.varianceTrend || []).map((f: any) => ({
    ref: f.referenceNumber || f.portName?.slice(0, 8) || `FDA-${f.id}`,
    variance: Number(f.variancePercent || 0).toFixed(1),
    estimated: Math.round(f.totalEstimatedUsd || 0),
    actual: Math.round(f.totalActualUsd || 0),
  })).reverse();

  return (
    <Card data-testid="chart-variance-trend">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
          PDA vs FDA Variance Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        {trend.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No FDA data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trend} margin={{ left: -10, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="ref" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit="%" width={36} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Variance"]} />
              <Line type="monotone" dataKey="variance" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3, fill: "#F59E0B" }} name="Variance %" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ─── MONTHLY REVENUE CHART ────────────────────────────────────────────────────
function MonthlyRevenueChart({ data }: { data: any }) {
  const raw = data?.financial?.monthlyRevenue || [];
  const chartData = raw.map((r: any) => ({
    month: r.month ? fmtMonth(r.month) : "?",
    Paid: Math.round(r.paid || 0),
    Invoiced: Math.round(r.invoiced || 0),
  }));

  return (
    <Card data-testid="chart-monthly-revenue">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
          Monthly Revenue (12 Months)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No invoice data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ left: -10, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={40} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [fmt(v), ""]} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="Invoiced" fill="#38BDF8" radius={[3, 3, 0, 0]} opacity={0.5} />
              <Bar dataKey="Paid" fill="#22C55E" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ─── EXPENSE BY CATEGORY PIE CHART ────────────────────────────────────────────
function ExpenseByCategoryChart({ data }: { data: any }) {
  const raw = data?.financial?.expenseByCategory || [];
  const chartData = raw
    .filter((r: any) => r.total > 0)
    .map((r: any) => ({ name: r.category || "Other", value: Math.round(r.total) }))
    .slice(0, 8);

  return (
    <Card data-testid="chart-expense-category">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
          Expense by Category (30d)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No expense data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value"
                label={({ name, percent }) => percent > 0.07 ? `${(percent * 100).toFixed(0)}%` : ""}
                labelLine={false}>
                {chartData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [fmt(v), ""]} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: "10px" }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ─── KPI CARDS ────────────────────────────────────────────────────────────────
function KpiCards({ kpi }: { kpi: any }) {
  if (!kpi) return null;
  const cards = [
    {
      label: "PDA Accuracy", value: `${kpi.pdaAccuracy?.accuracyRate ?? 0}%`,
      sub: `Avg variance: ${kpi.pdaAccuracy?.averageVariance ?? 0}%`,
      icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10",
    },
    {
      label: "Avg Port Stay", value: `${kpi.portStay?.averageDays ?? 0}d`,
      sub: `${kpi.portStay?.voyageCount ?? 0} voyages`,
      icon: Anchor, color: "text-blue-400", bg: "bg-blue-500/10",
    },
    {
      label: "Collection Rate", value: `${kpi.collection?.rate ?? 0}%`,
      sub: `Avg ${kpi.collection?.avgCollectionDays ?? 0}d`,
      icon: DollarSign, color: "text-sky-400", bg: "bg-sky-500/10",
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-3" data-testid="section-kpi-cards">
      {cards.map(c => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <div className={`w-7 h-7 rounded-md ${c.bg} flex items-center justify-center mb-2`}>
              <c.icon className={`w-3.5 h-3.5 ${c.color}`} />
            </div>
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── AGENT WIDGETS ────────────────────────────────────────────────────────────
function AgentWidgets({ data }: { data: any }) {
  const tenders = data?.agentTenders;
  const nominations = data?.nominations;
  if (!tenders && !nominations) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="section-agent-widgets">
      {nominations?.pendingCount > 0 && (
        <Card className="border-amber-500/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending Nominations</p>
              <p className="text-2xl font-bold text-amber-500">{nominations.pendingCount}</p>
            </div>
            <Link href="/nominations" className="ml-auto">
              <Button size="sm" variant="outline" className="h-8 text-xs">Review</Button>
            </Link>
          </CardContent>
        </Card>
      )}
      {tenders && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Gavel className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              <span className="text-sm font-semibold">Tender Activity</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Active Bids", val: tenders.activeBidsCount, color: "text-blue-400" },
                { label: "Won", val: tenders.wonBidsCount, color: "text-emerald-500" },
                { label: "Total", val: tenders.totalBidsCount, color: "text-foreground" },
              ].map(s => (
                <div key={s.label}>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── BROKER WIDGETS ───────────────────────────────────────────────────────────
function BrokerWidgets({ data }: { data: any }) {
  const broker = data?.broker;
  if (!broker) return null;
  return (
    <Card data-testid="card-broker-fixtures">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
          Fixture Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", val: broker.total, color: "text-foreground" },
            { label: "Negotiating", val: broker.negotiating, color: "text-amber-500" },
            { label: "Active", val: broker.active, color: "text-emerald-500" },
            { label: "Completed", val: broker.completed, color: "text-slate-400" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.val ?? 0}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
        <Link href="/fixtures">
          <Button variant="ghost" size="sm" className="w-full mt-3 h-7 text-xs text-muted-foreground hover:text-foreground gap-1">
            View Fixtures <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ─── SHIPOWNER TENDER WIDGET ──────────────────────────────────────────────────
function ShipownerTenderWidget({ data }: { data: any }) {
  const tenders = data?.tenders;
  if (!tenders) return null;
  return (
    <Card data-testid="card-shipowner-tenders">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gavel className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
          <span className="text-sm font-semibold">My Tenders</span>
          <Link href="/tenders" className="ml-auto">
            <span className="text-xs text-sky-400 hover:underline cursor-pointer">View all →</span>
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Total", val: tenders.total, color: "text-foreground" },
            { label: "Open", val: tenders.open, color: "text-blue-400" },
            { label: "Nominated", val: tenders.nominated, color: "text-emerald-500" },
          ].map(s => (
            <div key={s.label}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.val ?? 0}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── NOTIFICATIONS SUMMARY ────────────────────────────────────────────────────
function NotificationsSummary({ data }: { data: any }) {
  const notifs = data?.notifications?.unread || [];
  if (notifs.length === 0) return null;
  return (
    <Card data-testid="card-notifications-summary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
            Notifications
            <Badge className="bg-red-500/10 text-red-500 text-xs">{notifs.length}</Badge>
          </CardTitle>
          <Link href="/notifications">
            <span className="text-xs text-sky-400 hover:underline cursor-pointer">View all →</span>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {notifs.slice(0, 4).map((n: any) => (
            <div key={n.id} className="flex gap-3 py-1" data-testid={`row-notification-${n.id}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{n.title}</p>
                <p className="text-xs text-muted-foreground truncate">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── LOADING SKELETON ─────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="col-span-2 h-52 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export function DashboardHub({ role }: { role: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/v1/dashboard"],
  });

  const { data: kpi } = useQuery<any>({
    queryKey: ["/api/v1/dashboard/kpi", "30d"],
    queryFn: () => fetch("/api/v1/dashboard/kpi?period=30d", { credentials: "include" }).then(r => r.json()),
  });

  if (isLoading) return <DashboardSkeleton />;

  const showFleet = ["shipowner", "admin", "master"].includes(role);
  const showAgent = role === "agent";
  const showBroker = role === "broker";
  const showShipownerTender = role === "shipowner";

  return (
    <div className="space-y-4" data-testid="section-dashboard-hub">
      {/* Quick Actions */}
      <QuickActions role={role} />

      {/* KPI Cards */}
      <KpiCards kpi={kpi} />

      {/* Financial Summary */}
      <FinancialSummary data={data} />

      {/* Row: Fleet (left) + Active Voyages (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {showFleet && (
          <div className="space-y-4">
            <FleetOverview data={data} />
            {showShipownerTender && <ShipownerTenderWidget data={data} />}
          </div>
        )}
        <div className={showFleet ? "lg:col-span-2" : "lg:col-span-3"}>
          <ActiveVoyages data={data} />
        </div>
      </div>

      {/* Row: Cert Alerts + Upcoming Port Calls + Notifications */}
      {(data?.alerts?.expiringCertificates?.length > 0 || data?.alerts?.upcomingPortCalls?.length > 0 || data?.notifications?.unread?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CertificateAlerts data={data} />
          <UpcomingPortCalls data={data} />
          <NotificationsSummary data={data} />
        </div>
      )}

      {/* Role-specific widgets */}
      {showAgent && <AgentWidgets data={data} />}
      {showBroker && <BrokerWidgets data={data} />}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <VarianceTrendChart data={data} />
        <MonthlyRevenueChart data={data} />
        <ExpenseByCategoryChart data={data} />
      </div>
    </div>
  );
}
