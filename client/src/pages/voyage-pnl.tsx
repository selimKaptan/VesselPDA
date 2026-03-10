import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Download, BarChart2, Anchor, Fuel } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageMeta } from "@/components/page-meta";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";

function fmt(n: number) {
  if (!n && n !== 0) return "—";
  return "$" + Math.abs(Math.round(n)).toLocaleString();
}
function fmtSigned(n: number) {
  if (!n && n !== 0) return "—";
  const s = "$" + Math.abs(Math.round(n)).toLocaleString();
  return n < 0 ? `-${s}` : `+${s}`;
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: "green" | "red" | "blue" | "amber" }) {
  const colors = {
    green: "border-emerald-500/30 bg-emerald-500/5",
    red: "border-red-500/30 bg-red-500/5",
    blue: "border-blue-500/30 bg-blue-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
  };
  const textColors = {
    green: "text-emerald-400",
    red: "text-red-400",
    blue: "text-blue-400",
    amber: "text-amber-400",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`} data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <p className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${textColors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function TableRow({ label, value, bold, highlight }: { label: string; value: number | string; bold?: boolean; highlight?: "green" | "red" }) {
  const isNum = typeof value === "number";
  const displayVal = isNum ? fmt(value as number) : (value || "—");
  const color = highlight === "green" ? "text-emerald-400" : highlight === "red" ? "text-red-400" : isNum && (value as number) < 0 ? "text-red-400" : "text-slate-200";
  return (
    <div className={`flex justify-between py-1.5 border-b border-slate-700/40 last:border-0 ${bold ? "font-semibold" : ""}`}>
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm tabular-nums ${color}`}>{displayVal}</span>
    </div>
  );
}

const PIE_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

export default function VoyagePnl() {
  const { id } = useParams<{ id: string }>();
  const voyageId = parseInt(id);

  const { data: pnl, isLoading } = useQuery<any>({
    queryKey: ["/api/voyages", voyageId, "pnl"],
    queryFn: async () => {
      const res = await fetch(`/api/voyages/${voyageId}/pnl`);
      if (!res.ok) throw new Error("Failed to load P&L");
      return res.json();
    },
    enabled: !!voyageId,
  });

  const isEmpty = pnl && pnl.revenue?.totalRevenue === 0 && pnl.costs?.totalCosts === 0;

  const barData = pnl ? [
    { name: "Revenue", value: pnl.revenue?.totalRevenue || 0, fill: "#10b981" },
    { name: "Costs", value: pnl.costs?.totalCosts || 0, fill: "#ef4444" },
    { name: "Net P&L", value: pnl.pnl?.grossProfit || 0, fill: (pnl.pnl?.grossProfit || 0) >= 0 ? "#3b82f6" : "#f97316" },
  ] : [];

  const pieRaw = pnl?.costs?.expenseByCategory as Record<string, number> | undefined;
  const pieData = pieRaw ? Object.entries(pieRaw).map(([k, v]) => ({ name: k.replace(/_/g, " "), value: Math.round(v) })).filter(x => x.value > 0) : [];

  const pnlStatus = pnl?.pnl?.status;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <PageMeta title={`P&L — ${pnl?.voyage?.vesselName || "Voyage"} | VesselPDA`} description="Voyage Profit & Loss Calculator" />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/voyages/${voyageId}`}>
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Voyage Detail
            </button>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-bold">
              {pnl?.voyage?.vesselName || "Voyage"} · P&L Report
            </h1>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()} data-testid="button-export-pdf">
          <Download className="w-3.5 h-3.5" /> Export
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      )}

      {!isLoading && pnl && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Revenue"
              value={fmt(pnl.revenue.totalRevenue)}
              sub={`Daily: ${fmt(pnl.revenue.dailyRevenue)}/day`}
              color="green"
            />
            <KpiCard
              label="Total Costs"
              value={fmt(pnl.costs.totalCosts)}
              sub={`Daily: ${fmt(pnl.costs.dailyCost)}/day`}
              color="red"
            />
            <KpiCard
              label="Net P&L"
              value={fmtSigned(pnl.pnl.grossProfit)}
              sub={`Margin: ${pnl.pnl.profitMargin}%`}
              color={pnlStatus === "profit" ? "green" : pnlStatus === "loss" ? "red" : "amber"}
            />
            <KpiCard
              label="TCE"
              value={fmt(pnl.pnl.tce) + "/day"}
              sub={`Voyage: ${pnl.voyage.voyageDays} days`}
              color="blue"
            />
          </div>

          {/* P&L Status Banner */}
          <div className={`flex items-center gap-3 rounded-xl px-5 py-3 border ${
            pnlStatus === "profit" ? "bg-emerald-500/10 border-emerald-500/30" :
            pnlStatus === "loss" ? "bg-red-500/10 border-red-500/30" :
            "bg-amber-500/10 border-amber-500/30"
          }`} data-testid="pnl-status-banner">
            {pnlStatus === "profit" ? <TrendingUp className="w-5 h-5 text-emerald-400" /> :
             pnlStatus === "loss" ? <TrendingDown className="w-5 h-5 text-red-400" /> :
             <Minus className="w-5 h-5 text-amber-400" />}
            <div>
              <p className={`font-semibold text-sm ${pnlStatus === "profit" ? "text-emerald-400" : pnlStatus === "loss" ? "text-red-400" : "text-amber-400"}`}>
                {pnlStatus === "profit" ? "Profitable Voyage" : pnlStatus === "loss" ? "Loss-Making Voyage" : "Breakeven"}
              </p>
              <p className="text-xs text-slate-400">
                {pnl.voyage.cargoType && `${pnl.voyage.cargoType}${pnl.voyage.cargoQuantity ? ` · ${Number(pnl.voyage.cargoQuantity).toLocaleString()} MT` : ""} · `}
                {pnl.voyage.voyageDays} days · Status: {pnl.voyage.status}
              </p>
            </div>
          </div>

          {isEmpty ? (
            <Card className="p-12 text-center border-dashed border-slate-700">
              <BarChart2 className="w-12 h-12 mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400 font-medium">No financial data yet</p>
              <p className="text-sm text-slate-600 mt-1">Create a PDA or add port expenses to see the P&L analysis.</p>
              <div className="flex justify-center gap-3 mt-4">
                <Link href={`/proformas/new?voyageId=${voyageId}`}>
                  <Button variant="outline" size="sm">Create PDA</Button>
                </Link>
                <Link href={`/port-expenses?voyageId=${voyageId}`}>
                  <Button variant="outline" size="sm">Add Expenses</Button>
                </Link>
              </div>
            </Card>
          ) : (
            <>
              {/* Revenue & Cost Tables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <h3 className="font-semibold text-sm text-slate-300 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" /> Revenue Breakdown
                  </h3>
                  <div>
                    <TableRow label="Freight Income" value={pnl.revenue.freightIncome} />
                    <TableRow label="Hire Income" value={pnl.revenue.hireIncome} />
                    <TableRow label="Demurrage" value={pnl.revenue.demurrageIncome} highlight="green" />
                    <TableRow label="Despatch Savings" value={pnl.revenue.despatchSavings} highlight="green" />
                    <TableRow label="TOTAL REVENUE" value={pnl.revenue.totalRevenue} bold highlight="green" />
                  </div>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold text-sm text-slate-300 mb-3 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-400" /> Cost Breakdown
                  </h3>
                  <div>
                    <TableRow label="Port Expenses" value={pnl.costs.portExpenses} />
                    <TableRow label="Bunker Cost" value={pnl.costs.bunkerCost} />
                    <TableRow label="Agency Fees" value={pnl.costs.agencyFees} />
                    <TableRow label="Canal / Transit" value={pnl.costs.canalFees} />
                    <TableRow label="Insurance" value={pnl.costs.insuranceCost} />
                    <TableRow label="Off-hire Deduction" value={pnl.costs.offHireDeduction} highlight="red" />
                    <TableRow label="TOTAL COSTS" value={pnl.costs.totalCosts} bold highlight="red" />
                  </div>
                </Card>
              </div>

              {/* Bunker & PDA vs FDA */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <h3 className="font-semibold text-sm text-slate-300 mb-3 flex items-center gap-2">
                    <Fuel className="w-4 h-4 text-amber-400" /> Bunker Summary
                  </h3>
                  <div>
                    <TableRow label="HFO Consumed" value={`${pnl.bunker.consumption.hfo} MT`} />
                    <TableRow label="MGO Consumed" value={`${pnl.bunker.consumption.mgo} MT`} />
                    <TableRow label="LSFO Consumed" value={`${pnl.bunker.consumption.lsfo} MT`} />
                    <TableRow label="Total Consumed" value={`${pnl.bunker.consumption.total} MT`} bold />
                    <TableRow label="Est. Bunker Cost" value={pnl.bunker.totalOrderCost || pnl.costs.bunkerCost} bold />
                  </div>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold text-sm text-slate-300 mb-3 flex items-center gap-2">
                    <Anchor className="w-4 h-4 text-blue-400" /> PDA vs FDA
                  </h3>
                  <div>
                    <TableRow label="PDA (Estimated)" value={pnl.comparison.pdaTotal} />
                    <TableRow label="FDA (Actual)" value={pnl.comparison.fdaTotal} />
                    <TableRow label="Variance" value={pnl.comparison.variance} bold highlight={pnl.comparison.variance > 0 ? "red" : "green"} />
                    <TableRow label="Variance %" value={`${pnl.comparison.variancePercent}%`} />
                  </div>
                  {pnl.comparison.pdaTotal > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>PDA</span><span>FDA</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pnl.comparison.variance > 0 ? "bg-red-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(100, Math.abs(pnl.comparison.variancePercent) + 50)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold text-sm text-slate-300 mb-3">DA Advances</h3>
                  <div>
                    <TableRow label="Requested" value={pnl.advances.requested} />
                    <TableRow label="Received" value={pnl.advances.received} />
                    <TableRow label="Balance" value={pnl.advances.balance} bold highlight={pnl.advances.balance > 0 ? "red" : "green"} />
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-700/40">
                    <p className="text-xs text-slate-500">{pnl.meta.invoiceCount} invoices · {pnl.meta.expenseCount} expenses · {pnl.meta.noonReportCount} noon reports</p>
                  </div>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <h3 className="font-semibold text-sm text-slate-300 mb-4">Revenue vs Costs vs P&L</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${Math.abs(v/1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(v: any) => [`$${Math.abs(Number(v)).toLocaleString()}`, ""]}
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                        labelStyle={{ color: "#94a3b8" }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold text-sm text-slate-300 mb-4">Cost Distribution</h3>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString()}`, ""]} contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[220px] flex items-center justify-center text-slate-600 text-sm">
                      No expense categories to display
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
