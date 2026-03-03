import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  BarChart3, Download, Ship, DollarSign, Anchor, TrendingUp,
  CheckCircle2, XCircle, Clock, AlertTriangle, FileText, Star,
  Target, Users, Loader2, Calendar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageMeta } from "@/components/page-meta";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

type ReportTab = "voyages" | "financial" | "fleet" | "performance";

const CHART_COLORS = ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899", "#84CC16"];

function StatCard({
  label, value, sub, icon: Icon, color = "text-foreground",
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string;
}) {
  return (
    <Card className="p-4 flex items-start gap-3">
      <div className="p-2 rounded-lg bg-muted/60 flex-shrink-0">
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        <p className={`text-xl font-bold font-serif mt-0.5 ${color}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

function DateRangePicker({
  from, to, onFromChange, onToChange,
}: {
  from: string; to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">From</span>
        <input
          type="date"
          value={from}
          onChange={e => onFromChange(e.target.value)}
          className="text-xs border border-border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          data-testid="input-date-from"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">To</span>
        <input
          type="date"
          value={to}
          onChange={e => onToChange(e.target.value)}
          className="text-xs border border-border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          data-testid="input-date-to"
        />
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide mb-3 mt-1">
      {children}
    </h3>
  );
}

async function exportToPDF(title: string, content: string) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("VesselPDA", margin, 20);

  doc.setFontSize(13);
  doc.text(title, margin, 30);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, margin, 38);

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, 42, pageW - margin, 42);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);

  const lines = doc.splitTextToSize(content, pageW - margin * 2);
  let y = 48;
  for (const line of lines) {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, margin, y);
    y += 5;
  }

  doc.save(`${title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── VOYAGE REPORT ───────────────────────────────────────────────────────────

function VoyageReport() {
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(yearAgo);
  const [to, setTo] = useState(today);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const params = new URLSearchParams({ from, to }).toString();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/voyages", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/voyages?${params}`);
      return res.json();
    },
  });

  async function handleExport() {
    if (!data) return;
    setExporting(true);
    try {
      const s = data.stats;
      const rows = (data.list || []).map((v: any) =>
        `${v.vessel_name || "N/A"} | ${v.port_name} | ${v.status} | ${v.purpose_of_call} | ${v.created_at ? new Date(v.created_at).toLocaleDateString("en-GB") : "-"}`
      ).join("\n");
      const content = [
        `Period: ${from} to ${to}`,
        ``,
        `SUMMARY`,
        `Total Voyages: ${s.total}`,
        `Completed: ${s.completed}`,
        `Active: ${s.active}`,
        `Planned: ${s.planned}`,
        `Cancelled: ${s.cancelled}`,
        `Avg Duration: ${s.avgDurationDays != null ? s.avgDurationDays + " days" : "N/A"}`,
        ``,
        `PORT DISTRIBUTION`,
        ...(data.byPort || []).map((p: any) => `${p.portName}: ${p.count} voyages`),
        ``,
        `VOYAGE LIST`,
        `Vessel | Port | Status | Purpose | Date`,
        rows,
      ].join("\n");
      await exportToPDF("Voyage Report", content);
    } finally {
      setExporting(false);
    }
  }

  const s = data?.stats;

  return (
    <div className="space-y-5" data-testid="report-voyages">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting || !data} data-testid="button-export-voyages">
          {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
          Export PDF
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Voyages" value={s?.total ?? 0} icon={Ship} color="text-blue-600" />
          <StatCard label="Completed" value={s?.completed ?? 0} icon={CheckCircle2} color="text-emerald-600" />
          <StatCard label="Active" value={s?.active ?? 0} icon={Clock} color="text-blue-500" />
          <StatCard label="Planned" value={s?.planned ?? 0} icon={Calendar} color="text-violet-600" />
          <StatCard label="Cancelled" value={s?.cancelled ?? 0} icon={XCircle} color="text-red-500" />
          <StatCard
            label="Avg Duration"
            value={s?.avgDurationDays != null ? `${s.avgDurationDays}d` : "—"}
            icon={TrendingUp}
            color="text-amber-600"
          />
        </div>
      )}

      {!isLoading && data?.byPort?.length > 0 && (
        <Card className="p-4">
          <SectionHeading>Port Distribution</SectionHeading>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byPort} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="portName" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" name="Voyages" fill="#2563EB" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {!isLoading && data?.list?.length > 0 && (
        <Card className="p-4">
          <SectionHeading>Voyage List ({data.list.length})</SectionHeading>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>ETD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.list.slice(0, 50).map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium text-xs">{v.vessel_name || "—"}</TableCell>
                    <TableCell className="text-xs">{v.port_name}</TableCell>
                    <TableCell className="text-xs">{v.purpose_of_call}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] ${
                        v.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                        v.status === "active" ? "bg-blue-100 text-blue-700" :
                        v.status === "cancelled" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>{v.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{v.eta ? new Date(v.eta).toLocaleDateString("en-GB") : "—"}</TableCell>
                    <TableCell className="text-xs">{v.etd ? new Date(v.etd).toLocaleDateString("en-GB") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {!isLoading && !data?.list?.length && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No voyages found for the selected period.
        </div>
      )}
    </div>
  );
}

// ─── FINANCIAL REPORT ────────────────────────────────────────────────────────

function FinancialReport() {
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(yearAgo);
  const [to, setTo] = useState(today);
  const [exporting, setExporting] = useState(false);

  const params = new URLSearchParams({ from, to }).toString();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/financial", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/reports/financial?${params}`);
      return res.json();
    },
  });

  async function handleExport() {
    if (!data) return;
    setExporting(true);
    try {
      const p = data.proforma;
      const inv = data.invoices;
      const content = [
        `Period: ${from} to ${to}`,
        ``,
        `PROFORMA SUMMARY`,
        `Total Proformas: ${p.totalCount}`,
        `Total USD: $${p.totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        `Total EUR: €${p.totalEur.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        ``,
        `INVOICE STATUS`,
        `Pending: ${inv.pending.count} (Total: $${inv.pending.total.toFixed(2)})`,
        `Paid: ${inv.paid.count} (Total: $${inv.paid.total.toFixed(2)})`,
        `Cancelled: ${inv.cancelled.count} (Total: $${inv.cancelled.total.toFixed(2)})`,
        ``,
        `MONTHLY BREAKDOWN`,
        ...(data.monthly || []).map((m: any) => `${m.month}: $${m.totalUsd.toLocaleString()} (${m.count} proformas)`),
        ``,
        `PORT COST DISTRIBUTION`,
        ...(data.byPort || []).map((p: any) => `${p.portName}: $${p.totalUsd.toLocaleString()} (${p.count} proformas)`),
      ].join("\n");
      await exportToPDF("Financial Report", content);
    } finally {
      setExporting(false);
    }
  }

  const p = data?.proforma;
  const inv = data?.invoices;

  const invoicePieData = inv ? [
    { name: "Pending", value: inv.pending.count, amount: inv.pending.total },
    { name: "Paid",    value: inv.paid.count,    amount: inv.paid.total },
    { name: "Cancelled", value: inv.cancelled.count, amount: inv.cancelled.total },
  ].filter(d => d.value > 0) : [];
  const invoiceColors = ["#F59E0B", "#10B981", "#EF4444"];

  return (
    <div className="space-y-5" data-testid="report-financial">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting || !data} data-testid="button-export-financial">
          {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
          Export PDF
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Proformas" value={p?.totalCount ?? 0} icon={FileText} color="text-blue-600" />
          <StatCard label="Total (USD)" value={p ? `$${(p.totalUsd).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"} icon={DollarSign} color="text-emerald-600" />
          <StatCard label="Total (EUR)" value={p ? `€${(p.totalEur).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"} icon={DollarSign} color="text-amber-600" />
          <StatCard label="Paid Invoices" value={inv?.paid?.count ?? 0} sub={inv ? `$${inv.paid.total.toFixed(2)}` : undefined} icon={CheckCircle2} color="text-emerald-600" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {!isLoading && data?.monthly?.length > 0 && (
          <Card className="p-4">
            <SectionHeading>Monthly Revenue (USD)</SectionHeading>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.monthly} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]} contentStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="totalUsd" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {!isLoading && invoicePieData.length > 0 && (
          <Card className="p-4">
            <SectionHeading>Invoice Status</SectionHeading>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={invoicePieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
                    {invoicePieData.map((_, i) => <Cell key={i} fill={invoiceColors[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string, entry: any) => [
                    `${v} ($${entry.payload.amount.toFixed(0)})`, entry.payload.name
                  ]} contentStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {invoicePieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: invoiceColors[i] }} />
                    <span className="text-xs">{d.name}: <strong>{d.value}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>

      {!isLoading && data?.byPort?.length > 0 && (
        <Card className="p-4">
          <SectionHeading>Port Cost Distribution (USD)</SectionHeading>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.byPort} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="portName" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Total USD"]} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="totalUsd" name="Total USD" radius={[3, 3, 0, 0]}>
                {(data.byPort || []).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {!isLoading && !data?.monthly?.length && !data?.byPort?.length && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No financial data found for the selected period.
        </div>
      )}
    </div>
  );
}

// ─── FLEET REPORT ────────────────────────────────────────────────────────────

function FleetReport() {
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/fleet"],
    queryFn: async () => {
      const res = await fetch("/api/reports/fleet");
      return res.json();
    },
  });

  async function handleExport() {
    if (!data) return;
    setExporting(true);
    try {
      const s = data.summary;
      const rows = (data.vessels || []).map((v: any) =>
        `${v.name} | ${v.vesselType || "—"} | ${v.flag || "—"} | Voyages: ${v.voyages.totalVoyages} | Certs: ${v.certs.totalCerts} (${v.certs.expired} expired)`
      ).join("\n");
      const content = [
        `FLEET SUMMARY`,
        `Total Vessels: ${s.totalVessels}`,
        `Active Vessels: ${s.activeVessels}`,
        `Utilization Rate: ${s.utilizationRate}%`,
        `Total Certificates: ${s.totalCerts}`,
        `Expiring Soon: ${s.expiringCerts}`,
        `Expired: ${s.expiredCerts}`,
        ``,
        `VESSEL DETAIL`,
        `Name | Type | Flag | Voyages | Certificates`,
        rows,
      ].join("\n");
      await exportToPDF("Fleet Report", content);
    } finally {
      setExporting(false);
    }
  }

  const s = data?.summary;
  const vessels: any[] = data?.vessels || [];

  const voyageChartData = vessels
    .filter(v => v.voyages.totalVoyages > 0)
    .map(v => ({ name: v.name, voyages: v.voyages.totalVoyages, completed: v.voyages.completedVoyages }));

  const certSummary = s ? [
    { name: "Valid", value: s.totalCerts - s.expiredCerts - s.expiringCerts },
    { name: "Expiring", value: s.expiringCerts },
    { name: "Expired", value: s.expiredCerts },
  ].filter(d => d.value > 0) : [];
  const certColors = ["#10B981", "#F59E0B", "#EF4444"];

  return (
    <div className="space-y-5" data-testid="report-fleet">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting || !data} data-testid="button-export-fleet">
          {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
          Export PDF
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Vessels" value={s?.totalVessels ?? 0} icon={Ship} color="text-blue-600" />
          <StatCard label="Active Vessels" value={s?.activeVessels ?? 0} icon={Anchor} color="text-emerald-600" />
          <StatCard label="Utilization" value={s ? `${s.utilizationRate}%` : "—"} icon={TrendingUp} color="text-amber-600" />
          <StatCard label="Total Certs" value={s?.totalCerts ?? 0} icon={FileText} color="text-violet-600" />
          <StatCard label="Expiring (30d)" value={s?.expiringCerts ?? 0} icon={AlertTriangle} color="text-amber-500" />
          <StatCard label="Expired" value={s?.expiredCerts ?? 0} icon={XCircle} color="text-red-500" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {!isLoading && voyageChartData.length > 0 && (
          <Card className="p-4">
            <SectionHeading>Voyages per Vessel</SectionHeading>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={voyageChartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="voyages" name="Total" fill="#2563EB" radius={[3, 3, 0, 0]} />
                <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {!isLoading && certSummary.length > 0 && (
          <Card className="p-4">
            <SectionHeading>Certificate Status</SectionHeading>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={certSummary} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
                    {certSummary.map((_, i) => <Cell key={i} fill={certColors[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {certSummary.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: certColors[i] }} />
                    <span className="text-xs">{d.name}: <strong>{d.value}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>

      {!isLoading && vessels.length > 0 && (
        <Card className="p-4">
          <SectionHeading>Fleet Detail</SectionHeading>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Flag</TableHead>
                  <TableHead>GRT</TableHead>
                  <TableHead>Total Voyages</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Certs</TableHead>
                  <TableHead>Cert Issues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vessels.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium text-xs">{v.name}</TableCell>
                    <TableCell className="text-xs">{v.vesselType || "—"}</TableCell>
                    <TableCell className="text-xs">{v.flag || "—"}</TableCell>
                    <TableCell className="text-xs">{v.grt ? v.grt.toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-xs">{v.voyages.totalVoyages}</TableCell>
                    <TableCell>
                      {v.voyages.activeVoyages > 0 ? (
                        <Badge className="text-[10px] bg-blue-100 text-blue-700">Active</Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs">{v.certs.totalCerts}</TableCell>
                    <TableCell>
                      {v.certs.expired > 0 && <Badge className="text-[10px] bg-red-100 text-red-700 mr-1">{v.certs.expired} exp</Badge>}
                      {v.certs.expiring > 0 && <Badge className="text-[10px] bg-amber-100 text-amber-700">{v.certs.expiring} soon</Badge>}
                      {v.certs.expired === 0 && v.certs.expiring === 0 && <span className="text-[10px] text-emerald-600">OK</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {!isLoading && vessels.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No vessels found in your fleet.
        </div>
      )}
    </div>
  );
}

// ─── PERFORMANCE REPORT ───────────────────────────────────────────────────────

function PerformanceReport() {
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/performance"],
    queryFn: async () => {
      const res = await fetch("/api/reports/performance");
      return res.json();
    },
  });

  async function handleExport() {
    if (!data) return;
    setExporting(true);
    try {
      const b = data.bids;
      const r = data.reviews;
      const content = [
        `TENDER PERFORMANCE`,
        `Total Bids: ${b.total}`,
        `Won: ${b.won}`,
        `Lost: ${b.lost}`,
        `Win Rate: ${b.winRate}%`,
        `Avg Response Time: ${b.avgResponseHours != null ? b.avgResponseHours + " hours" : "N/A"}`,
        ``,
        `CUSTOMER SATISFACTION`,
        `Total Reviews: ${r.total}`,
        `Average Rating: ${r.avgRating != null ? r.avgRating + "/5" : "N/A"}`,
        `Positive: ${r.positive}`,
        `Neutral: ${r.neutral}`,
        `Negative: ${r.negative}`,
        ``,
        `MONTHLY ACTIVITY (last 12 months)`,
        ...(data.monthly || []).map((m: any) => `${m.month}: ${m.count} voyages (${m.completed} completed)`),
      ].join("\n");
      await exportToPDF("Performance Report", content);
    } finally {
      setExporting(false);
    }
  }

  const b = data?.bids;
  const r = data?.reviews;

  const bidsPieData = b && b.total > 0 ? [
    { name: "Won", value: b.won },
    { name: "Lost", value: b.lost },
    { name: "Pending", value: b.total - b.won - b.lost },
  ].filter(d => d.value > 0) : [];
  const bidColors = ["#10B981", "#EF4444", "#F59E0B"];

  return (
    <div className="space-y-5" data-testid="report-performance">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting || !data} data-testid="button-export-performance">
          {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
          Export PDF
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Bids" value={b?.total ?? 0} icon={Target} color="text-blue-600" />
          <StatCard label="Win Rate" value={b ? `${b.winRate}%` : "—"} icon={TrendingUp} color="text-emerald-600" />
          <StatCard
            label="Avg Response"
            value={b?.avgResponseHours != null ? `${b.avgResponseHours}h` : "—"}
            icon={Clock}
            color="text-amber-600"
          />
          <StatCard
            label="Avg Rating"
            value={r?.avgRating != null ? `${r.avgRating}/5` : "—"}
            sub={r?.total ? `${r.total} reviews` : undefined}
            icon={Star}
            color="text-violet-600"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {!isLoading && (
          <Card className="p-4">
            <SectionHeading>Tender Results</SectionHeading>
            {bidsPieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={bidsPieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
                      {bidsPieData.map((_, i) => <Cell key={i} fill={bidColors[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {bidsPieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: bidColors[i] }} />
                      <span className="text-xs">{d.name}: <strong>{d.value}</strong></span>
                    </div>
                  ))}
                  {b && <p className="text-xs text-muted-foreground mt-2">Win Rate: <strong className="text-emerald-600">{b.winRate}%</strong></p>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No tender bids found.</p>
            )}
          </Card>
        )}

        {!isLoading && r && (
          <Card className="p-4">
            <SectionHeading>Customer Satisfaction</SectionHeading>
            {r.total > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold font-serif text-violet-600">{r.avgRating?.toFixed(1) ?? "—"}</span>
                  <div>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} className={`w-4 h-4 ${r.avgRating && n <= Math.round(r.avgRating) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.total} reviews</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: "Positive (4-5★)", value: r.positive, color: "bg-emerald-500" },
                    { label: "Neutral (3★)", value: r.neutral, color: "bg-amber-500" },
                    { label: "Negative (1-2★)", value: r.negative, color: "bg-red-500" },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{item.label}</span>
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full transition-all`}
                          style={{ width: r.total > 0 ? `${(item.value / r.total) * 100}%` : "0%" }} />
                      </div>
                      <span className="text-xs font-medium w-5 text-right">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No reviews yet.</p>
            )}
          </Card>
        )}
      </div>

      {!isLoading && data?.monthly?.length > 0 && (
        <Card className="p-4">
          <SectionHeading>Monthly Voyage Activity (Last 12 Months)</SectionHeading>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.monthly} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" name="Total" fill="#2563EB" radius={[3, 3, 0, 0]} />
              <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

const TABS: { key: ReportTab; label: string; icon: React.ElementType }[] = [
  { key: "voyages",     label: "Voyage Report",      icon: Ship },
  { key: "financial",  label: "Financial Report",    icon: DollarSign },
  { key: "fleet",      label: "Fleet Report",        icon: Anchor },
  { key: "performance",label: "Performance Report",  icon: Target },
];

export default function Reports() {
  const [activeTab, setActiveTab] = useState<ReportTab>("voyages");
  const { user } = useAuth();

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <PageMeta title="Reports | VesselPDA" description="Comprehensive maritime operations reports" />

      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)]">
          <BarChart3 className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
        </div>
        <div>
          <h1 className="text-xl font-bold font-serif text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">Comprehensive analytics for your maritime operations</p>
        </div>
      </div>

      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-report-${key}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "voyages"     && <VoyageReport />}
      {activeTab === "financial"   && <FinancialReport />}
      {activeTab === "fleet"       && <FleetReport />}
      {activeTab === "performance" && <PerformanceReport />}
    </div>
  );
}
