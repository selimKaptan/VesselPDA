import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3, TrendingUp, TrendingDown, ArrowRight, FileText,
  Lightbulb, Download, AlertCircle, CheckCircle2, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";

interface ComparisonItem {
  description: string;
  category: string;
  estimatedUsd: number;
  actualUsd: number;
  varianceUsd: number;
  variancePercent: number;
  status: "over" | "under" | "exact";
}

interface ComparisonSummary {
  totalEstimatedUsd: number;
  totalActualUsd: number;
  totalVarianceUsd: number;
  totalVariancePercent: number;
  itemsOver: number;
  itemsUnder: number;
  itemsExact: number;
  accuracyScore: number;
}

interface ComparisonData {
  proforma: {
    id: number;
    referenceNumber: string;
    vesselName: string;
    portName: string;
    totalUsd: number;
    createdAt: string;
    status: string;
  };
  fda: {
    id: number;
    referenceNumber: string;
    totalActualUsd: number;
    varianceUsd: number;
    variancePercent: number;
    status: string;
    approvedAt: string | null;
  } | null;
  comparison: ComparisonItem[] | null;
  summary: ComparisonSummary | null;
}

interface HistoryRow {
  proformaId: number;
  fdaId: number;
  proformaRef: string | null;
  fdaRef: string | null;
  vesselName: string | null;
  portName: string | null;
  totalEstimatedUsd: number;
  totalActualUsd: number;
  varianceUsd: number;
  variancePercent: number;
  accuracyScore: number;
  status: string;
  createdAt: string;
}

interface HistoryData {
  history: HistoryRow[];
  averageAccuracy: number | null;
  totalComparisons: number;
}

function AccuracyRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = size * 0.42;
  const stroke = size * 0.1;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 95 ? "#22C55E" : pct >= 90 ? "#F59E0B" : "#EF4444";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor"
        strokeWidth={stroke} className="text-muted/30" />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color}
        strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize={size * 0.18}
        fontWeight="700" fill={color}>
        {pct.toFixed(1)}%
      </text>
    </svg>
  );
}

function accuracyBadgeClass(score: number) {
  if (score >= 95) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (score >= 90) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sign(n: number) {
  return n > 0 ? "+" : "";
}

function buildSuggestions(comparison: ComparisonItem[], summary: ComparisonSummary): string[] {
  const tips: string[] = [];
  const worstOver = [...comparison].sort((a, b) => b.variancePercent - a.variancePercent)[0];
  const worstUnder = [...comparison].sort((a, b) => a.variancePercent - b.variancePercent)[0];
  if (worstOver && worstOver.variancePercent > 5) {
    tips.push(`"${worstOver.description}" was underestimated by ${worstOver.variancePercent.toFixed(1)}%. Consider revising your ${worstOver.category} tariff rates.`);
  }
  if (worstUnder && worstUnder.variancePercent < -5) {
    tips.push(`"${worstUnder.description}" was overestimated by ${Math.abs(worstUnder.variancePercent).toFixed(1)}%. You may be using outdated rates.`);
  }
  if (summary.accuracyScore >= 97) {
    tips.push(`Your overall accuracy of ${summary.accuracyScore}% is excellent. Keep using your current tariff tables.`);
  } else if (summary.accuracyScore >= 90) {
    tips.push(`Your accuracy of ${summary.accuracyScore}% is good. Minor adjustments to ${worstOver?.category || "cost"} estimates could improve precision.`);
  } else {
    tips.push(`Your accuracy of ${summary.accuracyScore}% is below target. Review your tariff tables and historical data to improve estimates.`);
  }
  return tips;
}

function ListMode() {
  const { data, isLoading } = useQuery<HistoryData>({ queryKey: ["/api/da-comparison/history"] });

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  return (
    <div className="space-y-6" data-testid="page-da-comparison">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[hsl(var(--maritime-primary))/10]">
          <BarChart3 className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">DA Comparison</h1>
          <p className="text-sm text-muted-foreground">Proforma vs Final Disbursement accuracy tracking</p>
        </div>
      </div>

      {/* Accuracy gauge card */}
      <Card className="p-6" data-testid="card-accuracy-score">
        <div className="flex items-center gap-6">
          <AccuracyRing score={data?.averageAccuracy ?? 0} size={88} />
          <div>
            <p className="text-lg font-semibold">Average Estimation Accuracy</p>
            <p className="text-muted-foreground text-sm">
              {data?.totalComparisons
                ? `Based on ${data.totalComparisons} completed disbursement${data.totalComparisons !== 1 ? "s" : ""}`
                : "No completed disbursements yet"}
            </p>
            {data?.averageAccuracy != null && (
              <Badge className={`mt-2 ${accuracyBadgeClass(data.averageAccuracy)}`}>
                {data.averageAccuracy >= 95 ? "Excellent" : data.averageAccuracy >= 90 ? "Good" : "Needs improvement"}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* History table */}
      {!data?.history?.length ? (
        <EmptyState
          icon="📊"
          title="No comparisons yet"
          description="Approve a proforma and link an FDA to generate your first DA Comparison report."
          actionLabel="Go to Proformas"
          onAction={() => window.location.href = "/proformas"}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-da-comparison">
              <thead className="bg-muted/50">
                <tr>
                  {["PDA Ref", "Vessel", "Port", "Estimated", "Actual", "Variance", "Accuracy", "Date"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.history.map((row) => (
                  <tr
                    key={row.fdaId}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => window.location.href = `/da-comparison/${row.proformaId}`}
                    data-testid={`row-comparison-${row.fdaId}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{row.proformaRef || `PDA-${row.proformaId}`}</td>
                    <td className="px-4 py-3">{row.vesselName || "—"}</td>
                    <td className="px-4 py-3">{row.portName || "—"}</td>
                    <td className="px-4 py-3 font-mono">${fmt(row.totalEstimatedUsd)}</td>
                    <td className="px-4 py-3 font-mono">${fmt(row.totalActualUsd)}</td>
                    <td className="px-4 py-3 font-mono">
                      <span className={row.varianceUsd > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
                        {sign(row.varianceUsd)}${fmt(Math.abs(row.varianceUsd))}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${accuracyBadgeClass(row.accuracyScore)}`}>
                        {row.accuracyScore.toFixed(1)}%
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(row.createdAt).toLocaleDateString("en-GB")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function DetailMode({ proformaId }: { proformaId: string }) {
  const [chartOpen, setChartOpen] = useState(true);

  const { data, isLoading } = useQuery<ComparisonData>({
    queryKey: ["/api/da-comparison", parseInt(proformaId)],
    queryFn: async () => {
      const res = await fetch(`/api/da-comparison/${proformaId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load comparison");
      return res.json();
    },
  });

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[0,1,2,3].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );

  if (!data) return (
    <div className="text-center py-16 text-muted-foreground">Failed to load comparison data.</div>
  );

  const { proforma, fda, comparison, summary } = data;

  return (
    <div className="space-y-6" data-testid="page-da-comparison">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--maritime-primary))/10]">
            <BarChart3 className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">DA Comparison Report</h1>
            <p className="text-sm text-muted-foreground">
              {proforma.vesselName} — {proforma.portName}
              {" · "}{proforma.referenceNumber}
            </p>
          </div>
        </div>
        {fda && (
          <Button variant="outline" size="sm" className="gap-1.5"
            onClick={() => window.open(`/api/da-comparison/${proformaId}/pdf`, "_blank")}
            data-testid="button-download-pdf">
            <Download className="w-4 h-4" /> Download PDF
          </Button>
        )}
      </div>

      {/* No FDA linked */}
      {!fda && (
        <Card className="p-8 text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="font-medium mb-1">No FDA linked to this PDA yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create a Final Disbursement Account for this proforma to generate the comparison report.
          </p>
          <Button asChild variant="outline">
            <Link href={`/proformas/${proformaId}`}>View Proforma →</Link>
          </Button>
        </Card>
      )}

      {fda && summary && comparison && (
        <>
          {/* 4-card summary grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 bg-sky-50/50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800">
              <p className="text-xs text-muted-foreground mb-1">Estimated Total</p>
              <p className="text-xl font-bold text-sky-700 dark:text-sky-400 font-mono">
                ${fmt(summary.totalEstimatedUsd)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">PDA estimate</p>
            </Card>
            <Card className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
              <p className="text-xs text-muted-foreground mb-1">Actual Total</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                ${fmt(summary.totalActualUsd)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">FDA actual</p>
            </Card>
            <Card className={`p-4 ${summary.totalVarianceUsd > 0
              ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
              : "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"}`}>
              <p className="text-xs text-muted-foreground mb-1">Total Variance</p>
              <p className={`text-xl font-bold font-mono ${summary.totalVarianceUsd > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {sign(summary.totalVarianceUsd)}${fmt(Math.abs(summary.totalVarianceUsd))}
              </p>
              <p className={`text-xs mt-0.5 ${summary.totalVariancePercent > 0 ? "text-red-500" : "text-emerald-500"}`}>
                {sign(summary.totalVariancePercent)}{summary.totalVariancePercent.toFixed(2)}%
              </p>
            </Card>
            <Card className="p-4" data-testid="card-accuracy-score">
              <p className="text-xs text-muted-foreground mb-1">Accuracy Score</p>
              <AccuracyRing score={summary.accuracyScore} size={64} />
            </Card>
          </div>

          {/* Stats strip */}
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400">
              <ArrowUpRight className="w-3.5 h-3.5" />{summary.itemsOver} over budget
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">
              <ArrowDownRight className="w-3.5 h-3.5" />{summary.itemsUnder} under budget
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5" />{summary.itemsExact} exact
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Comparison table */}
              <Card className="overflow-hidden">
                <div className="px-5 py-4 border-b flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Line-Item Comparison</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-da-comparison">
                    <thead className="bg-muted/50">
                      <tr>
                        {["#", "Description", "Category", "Estimated", "Actual", "Variance", "Var %", "Status"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {comparison.map((item, idx) => (
                        <tr key={idx}
                          className={
                            item.status === "over"
                              ? "bg-red-50/50 dark:bg-red-950/10"
                              : item.status === "under"
                              ? "bg-emerald-50/50 dark:bg-emerald-950/10"
                              : ""
                          }>
                          <td className="px-3 py-2.5 text-muted-foreground text-xs">{idx + 1}</td>
                          <td className="px-3 py-2.5 font-medium max-w-[180px]">
                            <span className="line-clamp-2">{item.description}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="secondary" className="text-[10px] px-1.5">
                              {item.category}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">${fmt(item.estimatedUsd)}</td>
                          <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">${fmt(item.actualUsd)}</td>
                          <td className={`px-3 py-2.5 font-mono text-xs whitespace-nowrap font-medium ${item.varianceUsd > 0 ? "text-red-600 dark:text-red-400" : item.varianceUsd < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                            {item.varianceUsd !== 0 && (item.varianceUsd > 0 ? <ArrowUpRight className="inline w-3 h-3 mr-0.5" /> : <ArrowDownRight className="inline w-3 h-3 mr-0.5" />)}
                            {sign(item.varianceUsd)}${fmt(Math.abs(item.varianceUsd))}
                          </td>
                          <td className="px-3 py-2.5 text-xs min-w-[80px]">
                            <div className="space-y-0.5">
                              <span className={item.variancePercent > 0 ? "text-red-600 dark:text-red-400" : item.variancePercent < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                                {sign(item.variancePercent)}{item.variancePercent.toFixed(1)}%
                              </span>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden w-16">
                                <div
                                  className={`h-full rounded-full ${item.varianceUsd > 0 ? "bg-red-400 dark:bg-red-500" : "bg-emerald-400 dark:bg-emerald-500"}`}
                                  style={{ width: `${Math.min(Math.abs(item.variancePercent) * 5, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge className={`text-[10px] px-1.5 ${
                              item.status === "over" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : item.status === "under" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"}`}>
                              {item.status === "over" ? "↑ Over" : item.status === "under" ? "↓ Under" : "✓ Exact"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-border bg-muted/50">
                      <tr>
                        <td colSpan={3} className="px-3 py-2.5 font-bold text-sm">TOTAL</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-sm whitespace-nowrap">${fmt(summary.totalEstimatedUsd)}</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-sm whitespace-nowrap">${fmt(summary.totalActualUsd)}</td>
                        <td className={`px-3 py-2.5 font-mono font-bold text-sm whitespace-nowrap ${summary.totalVarianceUsd > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {sign(summary.totalVarianceUsd)}${fmt(Math.abs(summary.totalVarianceUsd))}
                        </td>
                        <td className={`px-3 py-2.5 font-bold text-sm ${summary.totalVariancePercent > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {sign(summary.totalVariancePercent)}{summary.totalVariancePercent.toFixed(2)}%
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge className={accuracyBadgeClass(summary.accuracyScore)}>
                            {summary.accuracyScore.toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>

              {/* Variance bar chart */}
              <Card className="p-5" data-testid="chart-variance">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm">Variance by Line Item</h3>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setChartOpen(o => !o)}>
                    {chartOpen ? "Hide" : "Show"}
                  </Button>
                </div>
                {chartOpen && (
                  <ResponsiveContainer width="100%" height={Math.max(180, comparison.length * 30)}>
                    <BarChart
                      layout="vertical"
                      data={comparison.map(i => ({
                        name: i.description.length > 26 ? i.description.slice(0, 24) + "…" : i.description,
                        value: parseFloat(i.varianceUsd.toFixed(2)),
                      }))}
                      margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => `$${v >= 0 ? "" : ""}${v.toLocaleString()}`} fontSize={10} />
                      <YAxis type="category" dataKey="name" width={120} fontSize={10} tick={{ fill: "var(--muted-foreground)" }} />
                      <Tooltip
                        formatter={(v: number) => [`${v >= 0 ? "+" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Variance"]}
                        contentStyle={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: 12 }}
                      />
                      <ReferenceLine x={0} stroke="var(--border)" strokeWidth={1.5} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {comparison.map((item, i) => (
                          <Cell key={i} fill={item.varianceUsd > 0 ? "#EF4444" : item.varianceUsd < 0 ? "#22C55E" : "#94A3B8"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>

            {/* Right panel: insights */}
            <div className="space-y-4">
              <Card className="p-5" data-testid="panel-insights">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-red-500" />
                  <h3 className="font-semibold text-sm">Top Overestimates</h3>
                </div>
                {[...comparison].filter(i => i.varianceUsd > 0).sort((a, b) => b.varianceUsd - a.varianceUsd).slice(0, 3).map((item, i) => (
                  <div key={i} className="mb-2.5 pb-2.5 border-b border-border last:border-0 last:pb-0 last:mb-0">
                    <p className="text-sm font-medium line-clamp-1">{item.description}</p>
                    <p className="text-xs text-red-600 dark:text-red-400">+${fmt(item.varianceUsd)} ({sign(item.variancePercent)}{item.variancePercent.toFixed(1)}%)</p>
                  </div>
                ))}
                {comparison.filter(i => i.varianceUsd > 0).length === 0 && (
                  <p className="text-xs text-muted-foreground">No items over budget</p>
                )}
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown className="w-4 h-4 text-emerald-500" />
                  <h3 className="font-semibold text-sm">Top Underestimates</h3>
                </div>
                {[...comparison].filter(i => i.varianceUsd < 0).sort((a, b) => a.varianceUsd - b.varianceUsd).slice(0, 3).map((item, i) => (
                  <div key={i} className="mb-2.5 pb-2.5 border-b border-border last:border-0 last:pb-0 last:mb-0">
                    <p className="text-sm font-medium line-clamp-1">{item.description}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">${fmt(item.varianceUsd)} ({item.variancePercent.toFixed(1)}%)</p>
                  </div>
                ))}
                {comparison.filter(i => i.varianceUsd < 0).length === 0 && (
                  <p className="text-xs text-muted-foreground">No items under budget</p>
                )}
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold text-sm">Suggestions</h3>
                </div>
                <ul className="space-y-2.5">
                  {buildSuggestions(comparison, summary).map((tip, i) => (
                    <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                      <span className="mt-0.5 shrink-0">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              {/* Document links */}
              <Card className="p-4">
                <h3 className="font-semibold text-sm mb-3">Source Documents</h3>
                <div className="space-y-2">
                  <Link href={`/proformas/${proformaId}`}>
                    <Button variant="outline" className="w-full justify-between h-8 text-xs gap-1.5">
                      View PDA <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                  {fda && (
                    <Link href={`/fda/${fda.id}`}>
                      <Button variant="outline" className="w-full justify-between h-8 text-xs gap-1.5">
                        View FDA <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function DaComparison() {
  const params = useParams<{ proformaId?: string }>();
  const proformaId = params?.proformaId;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto pb-20 md:pb-6">
      {proformaId ? <DetailMode proformaId={proformaId} /> : <ListMode />}
    </div>
  );
}
