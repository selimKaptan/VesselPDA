import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { BarChart2, TrendingUp, Ship, Anchor, FileText, DollarSign, Activity, FileDown, Calendar as CalendarIcon, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageMeta } from "@/components/page-meta";
import { exportToCsv } from "@/lib/export-csv";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

const PERIOD_OPTIONS = [
  { label: "3 Months", value: "3" },
  { label: "6 Months", value: "6" },
  { label: "12 Months", value: "12" },
  { label: "Custom", value: "custom" },
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

function KpiCard({ icon: Icon, label, value, subValue, color = "text-foreground", trend }: {
  icon: any; label: string; value: string | number; subValue?: string; color?: string; trend?: number;
}) {
  const isPositive = trend && trend > 0;
  const isNegative = trend && trend < 0;

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 flex flex-col gap-2" data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center gap-4">
        <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-1">
        {subValue && <p className="text-[10px] text-muted-foreground">{subValue}</p>}
        {trend !== undefined && (
          <div className={cn(
            "flex items-center text-[10px] font-medium",
            isPositive ? "text-emerald-500" : isNegative ? "text-rose-500" : "text-muted-foreground"
          )}>
            {isPositive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : isNegative ? <ArrowDownRight className="w-3 h-3 mr-0.5" /> : <Minus className="w-3 h-3 mr-0.5" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
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

import { FeatureTooltip } from "@/components/feature-tooltip";

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("6");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const queryParams = new URLSearchParams();
  if (period !== "custom") {
    queryParams.append("period", period);
  } else if (dateRange?.from && dateRange?.to) {
    queryParams.append("from", dateRange.from.toISOString());
    queryParams.append("to", dateRange.to.toISOString());
  }

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/analytics/overview", period, dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/overview?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
  });

  const { data: vesselComparison, isLoading: vesselLoading } = useQuery<any[]>({
    queryKey: ["/api/analytics/vessel-comparison", period, dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/vessel-comparison?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load vessel comparison");
      return res.json();
    },
  });

  const { data: portComparison, isLoading: portLoading } = useQuery<any[]>({
    queryKey: ["/api/analytics/port-comparison", period, dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/port-comparison?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load port comparison");
      return res.json();
    },
  });

  const [, setLocation] = useLocation();

  const kpis = data?.kpis || {};
  const prevKpis = data?.previousKpis || {};

  const calculateTrend = (current: number, previous: number) => {
    if (!previous || previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const trends = {
    totalVoyages: calculateTrend(kpis.totalVoyages, prevKpis.totalVoyages),
    totalPdaValueUsd: calculateTrend(kpis.totalPdaValueUsd, prevKpis.totalPdaValueUsd),
    avgFdaVariancePct: calculateTrend(kpis.avgFdaVariancePct, prevKpis.avgFdaVariancePct),
    totalInvoicesPaid: calculateTrend(kpis.totalInvoicesPaid, prevKpis.totalInvoicesPaid),
    totalInvoicesPending: calculateTrend(kpis.totalInvoicesPending, prevKpis.totalInvoicesPending),
  };
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
            <FeatureTooltip id="analytics-intro" content="This is your financial command center. All voyage profitability and expenses are summarized here.">
              <h1 className="text-2xl font-bold tracking-tight">Analytics & Reports</h1>
            </FeatureTooltip>
            <p className="text-sm text-muted-foreground">Operational performance overview</p>
            </div>
          </div>
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-full sm:w-auto overflow-x-auto" data-testid="period-selector">
            {PERIOD_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                variant={period === opt.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setPeriod(opt.value)}
                className="h-7 text-xs flex-1 sm:flex-none"
                data-testid={`period-${opt.value}`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          {period === "custom" && (
            <div className="w-full sm:w-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "h-9 justify-start text-left font-normal w-full sm:w-[240px]",
                      !dateRange && "text-muted-foreground"
                    )}
                    data-testid="button-date-range"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4" data-testid="section-kpis">
          <KpiCard icon={Ship} label="Total Voyages" value={isLoading ? "—" : kpis.totalVoyages ?? 0} trend={isLoading ? undefined : trends.totalVoyages} />
          <KpiCard icon={FileText} label="PDA Value" value={isLoading ? "—" : fmtUSD(kpis.totalPdaValueUsd || 0)} trend={isLoading ? undefined : trends.totalPdaValueUsd} />
          <KpiCard icon={Activity} label="Avg FDA Variance" value={isLoading ? "—" : `${(kpis.avgFdaVariancePct || 0).toFixed(1)}%`} subValue="vs estimated" trend={isLoading ? undefined : trends.avgFdaVariancePct} />
          <KpiCard icon={DollarSign} label="Invoices Collected" value={isLoading ? "—" : fmtUSD(kpis.totalInvoicesPaid || 0)} color="text-emerald-500" trend={isLoading ? undefined : trends.totalInvoicesPaid} />
          <KpiCard icon={TrendingUp} label="Invoices Pending" value={isLoading ? "—" : fmtUSD(kpis.totalInvoicesPending || 0)} color="text-amber-500" trend={isLoading ? undefined : trends.totalInvoicesPending} />
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Monthly Voyages */}
          <div className="rounded-xl border border-border bg-card p-5" data-testid="chart-monthly-voyages">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Ship className="w-4 h-4 text-primary" /> Monthly Voyages
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => exportToCsv("monthly_voyages.csv", monthlyVoyages)}
                title="Export to CSV"
              >
                <FileDown className="h-4 w-4" />
              </Button>
            </div>
            {monthlyVoyages.length === 0 && !isLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No voyage data for this period</div>
            ) : (
              <div className="h-[180px] sm:h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyVoyages} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="count"
                      name="Voyages"
                      fill="hsl(214 60% 35%)"
                      radius={[4, 4, 0, 0]}
                      className="cursor-pointer"
                      onClick={(data) => {
                        if (data?.month) {
                          setLocation(`/voyages?month=${data.month}`);
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Invoice Revenue */}
          <div className="rounded-xl border border-border bg-card p-5" data-testid="chart-invoice-revenue">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" /> Invoice Revenue
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => exportToCsv("monthly_revenue.csv", monthlyRevenue)}
                title="Export to CSV"
              >
                <FileDown className="h-4 w-4" />
              </Button>
            </div>
            {monthlyRevenue.length === 0 && !isLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No invoice data for this period</div>
            ) : (
              <div className="h-[180px] sm:h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
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
              </div>
            )}
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Top Ports */}
          <div className="rounded-xl border border-border bg-card p-5" data-testid="chart-top-ports">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Anchor className="w-4 h-4 text-primary" /> Top Ports by Voyage Count
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => exportToCsv("top_ports.csv", topPorts)}
                title="Export to CSV"
              >
                <FileDown className="h-4 w-4" />
              </Button>
            </div>
            {topPorts.length === 0 && !isLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No port data for this period</div>
            ) : (
              <div className="h-[180px] sm:h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topPorts} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis dataKey="portName" type="category" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="count"
                      name="Voyages"
                      fill="hsl(214 60% 35%)"
                      radius={[0, 4, 4, 0]}
                      className="cursor-pointer"
                      onClick={(data) => {
                        if (data?.portName) {
                          setLocation(`/voyages?port=${encodeURIComponent(data.portName)}`);
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Invoice Status Pie */}
          <div className="rounded-xl border border-border bg-card p-5" data-testid="chart-invoice-status">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Invoice Status Distribution
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => exportToCsv("invoice_status.csv", invoiceStatus)}
                title="Export to CSV"
              >
                <FileDown className="h-4 w-4" />
              </Button>
            </div>
            {invoiceStatus.length === 0 && !isLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No invoice data for this period</div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="h-[180px] sm:h-[200px] w-full sm:w-[55%]">
                  <ResponsiveContainer width="100%" height="100%">
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
                        className="cursor-pointer"
                        onClick={(data) => {
                          if (data?.status) {
                            setLocation(`/invoices?status=${data.status}`);
                          }
                        }}
                      >
                        {invoiceStatus.map((entry: any, i: number) => (
                          <Cell key={i} fill={STATUS_PIE_COLORS[entry.status] || `hsl(${i * 60}, 60%, 50%)`} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any, name: any) => [v, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 w-full space-y-2">
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
                  <div
                    key={i}
                    className="space-y-1 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => {
                      if (s.status) {
                        setLocation(`/voyages?status=${s.status}`);
                      }
                    }}
                  >
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

          {/* Port Performance Comparison */}
          <div className="rounded-xl border border-border bg-card p-5" data-testid="chart-port-comparison">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Anchor className="w-4 h-4 text-primary" /> Port Performance Comparison
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => exportToCsv("port_performance.csv", portComparison || [])}
                title="Export to CSV"
              >
                <FileDown className="h-4 w-4" />
              </Button>
            </div>
            {(!portComparison || portComparison.length === 0) && !portLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No port performance data</div>
            ) : (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={portComparison} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} label={{ value: 'Avg Turnaround (Days)', position: 'insideBottom', offset: -5, fontSize: 10 }} />
                    <YAxis dataKey="portName" type="category" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="avgTurnaroundDays"
                      name="Avg Turnaround (Days)"
                      fill="#3b82f6"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Vessel Profitability Comparison */}
        <div className="grid grid-cols-1 gap-6">
          <div className="rounded-xl border border-border bg-card p-5" data-testid="chart-vessel-comparison">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Ship className="w-4 h-4 text-primary" /> Vessel Profitability & Comparison
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => exportToCsv("vessel_comparison.csv", vesselComparison || [])}
                title="Export to CSV"
              >
                <FileDown className="h-4 w-4" />
              </Button>
            </div>
            {(!vesselComparison || vesselComparison.length === 0) && !vesselLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No vessel comparison data</div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vesselComparison} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="vesselName" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmtUSD(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="totalPDA" name="Total PDA ($)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="totalFDA" name="Total FDA ($)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="netBalance" name="Net Balance ($)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
