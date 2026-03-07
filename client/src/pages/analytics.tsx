import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { BarChart2, TrendingUp, Ship, Anchor, FileText, DollarSign, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageMeta } from "@/components/page-meta";

const PERIOD_OPTIONS = [
  { label: "3 Months", value: "3" },
  { label: "6 Months", value: "6" },
  { label: "12 Months", value: "12" },
];

const STATUS_PIE_COLORS: Record<string, string> = {
  paid: "#10b981",
  pending: "#f59e0b",
  overdue: "#ef4444",
  draft: "#64748b",
  sent: "#3b82f6",
  cancelled: "#94a3b8",
};

const VOYAGE_STATUS_COLORS: Record<string, string> = {
  completed: "#10b981",
  in_progress: "#3b82f6",
  scheduled: "#a855f7",
  planned: "#f59e0b",
  cancelled: "#64748b",
};

function fmtUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function KpiCard({ icon: Icon, label, value, subValue, color = "text-foreground" }: {
  icon: any; label: string; value: string | number; subValue?: string; color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 flex items-center gap-4" data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
        {subValue && <p className="text-[10px] text-muted-foreground mt-0.5">{subValue}</p>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === "number" && p.name?.toLowerCase().includes("$") ? fmtUSD(p.value) : p.value}</p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("6");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/analytics/overview", period],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/overview?period=${period}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
  });

  const kpis = data?.kpis || {};
  const monthlyVoyages = data?.monthlyVoyages || [];
  const monthlyRevenue = data?.monthlyInvoiceRevenue || [];
  const topPorts = data?.topPorts || [];
  const invoiceStatus = data?.invoiceStatusBreakdown || [];
  const voyageStatus = data?.voyageStatusBreakdown || [];
  const vesselActivity = data?.vesselActivity || [];

  return (
    <div className="min-h-screen bg-background">
      <PageMeta title="Analytics & Reports | VesselPDA" description="Operational analytics and reporting dashboard" />

      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <BarChart2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Analytics & Reports</h1>
              <p className="text-sm text-muted-foreground">Operational performance overview</p>
            </div>
          </div>
          <div className="flex gap-1 p-1 bg-muted rounded-lg" data-testid="period-selector">
            {PERIOD_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                variant={period === opt.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setPeriod(opt.value)}
                className="h-7 text-xs"
                data-testid={`period-${opt.value}`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4" data-testid="section-kpis">
          <KpiCard icon={Ship} label="Total Voyages" value={isLoading ? "—" : kpis.totalVoyages ?? 0} />
          <KpiCard icon={FileText} label="PDA Value" value={isLoading ? "—" : fmtUSD(kpis.totalPdaValueUsd || 0)} />
          <KpiCard icon={Activity} label="Avg FDA Variance" value={isLoading ? "—" : `${(kpis.avgFdaVariancePct || 0).toFixed(1)}%`} subValue="vs estimated" />
          <KpiCard icon={DollarSign} label="Invoices Collected" value={isLoading ? "—" : fmtUSD(kpis.totalInvoicesPaid || 0)} color="text-emerald-500" />
          <KpiCard icon={TrendingUp} label="Invoices Pending" value={isLoading ? "—" : fmtUSD(kpis.totalInvoicesPending || 0)} color="text-amber-500" />
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Monthly Voyages */}
          <div className="rounded-xl border border-border bg-card p-5" data-testid="chart-monthly-voyages">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Ship className="w-4 h-4 text-primary" /> Monthly Voyages
            </h3>
            {monthlyVoyages.length === 0 && !isLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No voyage data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyVoyages} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Voyages" fill="hsl(214 60% 35%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Invoice Revenue */}
          <div className="rounded-xl border border-border bg-card p-5" data-testid="chart-invoice-revenue">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" /> Invoice Revenue
            </h3>
            {monthlyRevenue.length === 0 && !isLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No invoice data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyRevenue} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmtUSD(v)} />
                  <Tooltip content={<CustomTooltip />} formatter={(v: any) => fmtUSD(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="paid" name="Paid" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="pending" name="Pending" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Top Ports */}
          <div className="rounded-xl border border-border bg-card p-5" data-testid="chart-top-ports">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Anchor className="w-4 h-4 text-primary" /> Top Ports by Voyage Count
            </h3>
            {topPorts.length === 0 && !isLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No port data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topPorts} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis dataKey="portName" type="category" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Voyages" fill="hsl(214 60% 35%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Invoice Status Pie */}
          <div className="rounded-xl border border-border bg-card p-5" data-testid="chart-invoice-status">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Invoice Status Distribution
            </h3>
            {invoiceStatus.length === 0 && !isLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No invoice data for this period</div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie
                      data={invoiceStatus}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {invoiceStatus.map((entry: any, i: number) => (
                        <Cell key={i} fill={STATUS_PIE_COLORS[entry.status] || `hsl(${i * 60}, 60%, 50%)`} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any, name: any) => [v, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {invoiceStatus.map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_PIE_COLORS[s.status] || `hsl(${i * 60}, 60%, 50%)` }} />
                        <span className="capitalize">{s.status}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{s.count}</span>
                        <span className="text-muted-foreground ml-1">{fmtUSD(s.total || 0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Voyage Status Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-card p-5" data-testid="chart-voyage-status">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Voyage Status Breakdown
            </h3>
            <div className="space-y-2.5">
              {voyageStatus.length === 0 && !isLoading ? (
                <p className="text-muted-foreground text-sm text-center py-8">No voyage data for this period</p>
              ) : voyageStatus.map((s: any, i: number) => {
                const total = voyageStatus.reduce((sum: number, x: any) => sum + x.count, 0);
                const pct = total > 0 ? (s.count / total) * 100 : 0;
                const color = VOYAGE_STATUS_COLORS[s.status] || "#94a3b8";
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize font-medium">{(s.status || "unknown").replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">{s.count} voyages ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vessel Activity */}
          {vesselActivity.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5" data-testid="chart-vessel-activity">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Ship className="w-4 h-4 text-primary" /> Vessel Activity
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={vesselActivity} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis dataKey="vesselName" type="category" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="voyageCount" name="Voyages" fill="#a855f7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
