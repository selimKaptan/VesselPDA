import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const CHART_COLORS = ["#38BDF8", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" },
  labelStyle: { color: "#94a3b8" },
  itemStyle: { color: "#f1f5f9" },
};

function formatMonth(ym: string) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const m = parseInt(ym.split("-")[1]) - 1;
  return months[m] || ym;
}

export function ProformaTrendChart() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/stats/trends"] });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  const chartData = (data?.proformaTrend || []).map((d: any) => ({
    month: formatMonth(d.month),
    count: Number(d.count),
    totalUsd: Math.round(Number(d.total_usd)),
  }));

  if (chartData.length === 0) {
    return (
      <Card className="p-4 flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">No proforma data yet</p>
      </Card>
    );
  }

  return (
    <Card className="p-4" data-testid="chart-proforma-trend">
      <h3 className="text-sm font-semibold mb-3">Proforma Trend (6 Months)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorProforma" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={30} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Area type="monotone" dataKey="count" stroke="#38BDF8" strokeWidth={2} fill="url(#colorProforma)" name="Proformas" dot={{ r: 3, fill: "#38BDF8" }} />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function TenderTrendChart() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/stats/trends"] });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  const chartData = (data?.tenderTrend || []).map((d: any) => ({
    month: formatMonth(d.month),
    total: Number(d.count),
    completed: Number(d.completed),
  }));

  if (chartData.length === 0) {
    return (
      <Card className="p-4 flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">No tender data yet</p>
      </Card>
    );
  }

  return (
    <Card className="p-4" data-testid="chart-tender-trend">
      <h3 className="text-sm font-semibold mb-3">Tenders (6 Months)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={30} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: "11px" }} />
          <Bar dataKey="total" fill="#38BDF8" name="Total" radius={[4, 4, 0, 0]} />
          <Bar dataKey="completed" fill="#22C55E" name="Nominated" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function VoyageTrendChart() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/stats/trends"] });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  const chartData = (data?.voyageTrend || []).map((d: any) => ({
    month: formatMonth(d.month),
    total: Number(d.count),
    completed: Number(d.completed),
  }));

  if (chartData.length === 0) {
    return (
      <Card className="p-4 flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">No voyage data yet</p>
      </Card>
    );
  }

  return (
    <Card className="p-4" data-testid="chart-voyage-trend">
      <h3 className="text-sm font-semibold mb-3">Voyages (6 Months)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={30} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Legend iconSize={10} wrapperStyle={{ fontSize: "11px" }} />
          <Line type="monotone" dataKey="total" stroke="#F59E0B" strokeWidth={2} name="Total" dot={{ r: 3, fill: "#F59E0B" }} />
          <Line type="monotone" dataKey="completed" stroke="#22C55E" strokeWidth={2} name="Completed" dot={{ r: 3, fill: "#22C55E" }} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function StatusDistributionChart({ title, data, testId }: { title: string; data: any[]; testId?: string }) {
  if (!data || data.length === 0) {
    return (
      <Card className="p-4 flex items-center justify-center h-52">
        <p className="text-sm text-muted-foreground">No data yet</p>
      </Card>
    );
  }

  const chartData = data.map((d: any) => ({
    name: (d.status || "unknown").replace(/_/g, " "),
    value: Number(d.count),
  }));

  return (
    <Card className="p-4" data-testid={testId || "chart-status-distribution"}>
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
            label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""}
            labelLine={false}
          >
            {chartData.map((_, index) => (
              <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip {...TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function BidWinRateChart({ total, won }: { total: number; won: number }) {
  if (total === 0) return null;
  const lost = total - won;
  const chartData = [
    { name: "Won", value: won },
    { name: "Pending / Lost", value: lost },
  ];

  return (
    <Card className="p-4" data-testid="chart-bid-win-rate">
      <h3 className="text-sm font-semibold mb-3">Bid Win Rate</h3>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
            <Cell fill="#22C55E" />
            <Cell fill="#334155" />
          </Pie>
          <Tooltip {...TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
