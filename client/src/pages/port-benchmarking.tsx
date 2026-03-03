import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Scale, BarChart2, Radar, TrendingUp, Info, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, Search, X, Ship, Anchor, Globe, Package
} from "lucide-react";
import {
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar as RadarShape, PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, XAxis, YAxis, CartesianGrid
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageMeta } from "@/components/page-meta";
import type { Port } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────
interface BenchmarkRow {
  port_id: number;
  port_name: string;
  code: string;
  vessel_size_category: string;
  purpose_of_call: string;
  avg_total_cost: number | null;
  min_total_cost: number | null;
  max_total_cost: number | null;
  avg_agency_fee: number | null;
  avg_pilotage: number | null;
  avg_tugboat: number | null;
  avg_berthing: number | null;
  avg_port_dues: number | null;
  sample_count: number;
  last_updated: string;
}

interface CompareResult {
  rows: BenchmarkRow[];
  sizeCategory: string;
  purpose: string;
  grt: number;
}

interface PortSummary {
  port_id: number;
  port_name: string;
  code: string;
  total_samples: string;
  min_avg_cost: number;
  max_avg_cost: number;
  last_updated: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const CHART_COLORS = ["#1e40af", "#0891b2", "#7c3aed", "#b45309", "#be185d"];
const LINE_ITEMS = [
  { key: "avg_agency_fee", label: "Agency Fee" },
  { key: "avg_pilotage",   label: "Pilotage" },
  { key: "avg_tugboat",    label: "Tugboat" },
  { key: "avg_berthing",   label: "Berthing" },
  { key: "avg_port_dues",  label: "Port Dues" },
];
const SIZE_CATEGORIES = [
  { value: "auto",   label: "Auto (from GRT)" },
  { value: "small",  label: "Small (0–5,000 GRT)" },
  { value: "medium", label: "Medium (5,000–20,000 GRT)" },
  { value: "large",  label: "Large (20,000–50,000 GRT)" },
  { value: "vlarge", label: "Very Large (50,000+ GRT)" },
];
const PURPOSES = [
  { value: "loading",      label: "Loading" },
  { value: "discharging",  label: "Discharging" },
  { value: "bunkering",    label: "Bunkering" },
  { value: "transit",      label: "Transit" },
];

function fmt(v: number | null, decimals = 0) {
  if (v == null || isNaN(v)) return "—";
  return "$" + Math.round(v).toLocaleString("en-US");
}

function grtToCategory(grt: number) {
  if (grt < 5000) return "small";
  if (grt < 20000) return "medium";
  if (grt < 50000) return "large";
  return "vlarge";
}

// ─── Port Multi-Select ────────────────────────────────────────────────────────
function PortSelector({ selected, onToggle, onClear, ports }: {
  selected: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
  ports: Port[];
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = useMemo(() =>
    ports.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.code || "").toLowerCase().includes(search.toLowerCase())
    ).slice(0, 40)
  , [ports, search]);

  const selectedPorts = ports.filter(p => selected.includes(p.id));

  const handleSelect = (portId: number) => {
    if (!selected.includes(portId) && selected.length >= 5) return;
    onToggle(portId);
  };

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      <Label>Select Ports (2–5)</Label>

      {/* Trigger box */}
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="min-h-10 border rounded-md px-3 py-2 flex flex-wrap gap-1.5 items-center cursor-text bg-background hover:border-foreground/50 transition-colors"
        onClick={() => setOpen(v => !v)}
        data-testid="port-selector"
      >
        {selectedPorts.map(p => (
          <Badge key={p.id} variant="secondary" className="gap-1 text-xs">
            {p.name}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onToggle(p.id); }}
              className="hover:text-destructive"
              aria-label={`Remove ${p.name}`}
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        {selected.length === 0 && (
          <span className="text-muted-foreground text-sm">Click to select ports...</span>
        )}
        {selected.length > 0 && (
          <button
            type="button"
            className="ml-auto text-muted-foreground hover:text-foreground"
            onClick={e => { e.stopPropagation(); onClear(); setOpen(false); }}
            aria-label="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 border rounded-md bg-popover shadow-xl z-50"
          role="listbox"
          aria-multiselectable="true"
          aria-label="Port list"
        >
          <div className="p-2 border-b">
            <Input
              autoFocus
              type="text"
              placeholder="Search ports by name or code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8"
              data-testid="input-port-search"
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-60 overflow-y-auto" data-testid="port-options-list">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground text-center">No ports found</p>
            )}
            {filtered.map(p => {
              const isSelected = selected.includes(p.id);
              const isDisabled = !isSelected && selected.length >= 5;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isDisabled}
                  disabled={isDisabled}
                  onClick={e => { e.stopPropagation(); handleSelect(p.id); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors disabled:opacity-40 ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100"
                      : "hover:bg-muted"
                  }`}
                  data-testid={`option-port-${p.id}`}
                >
                  <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${isSelected ? "bg-blue-600 border-blue-600" : "border-muted-foreground/30"}`}>
                    {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <span className="flex-1 font-medium">{p.name}</span>
                  {p.code && <span className="text-xs text-muted-foreground font-mono">{p.code}</span>}
                </button>
              );
            })}
          </div>
          <div className="p-2 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{selected.length}/5 ports selected</span>
            <Button
              type="button"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-7 text-xs"
              data-testid="button-port-selector-done"
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Comparison Table ─────────────────────────────────────────────────────────
function ComparisonTable({ rows }: { rows: BenchmarkRow[] }) {
  if (!rows.length) return null;

  const allItems = [
    { key: "avg_agency_fee", label: "Agency Fee" },
    { key: "avg_pilotage",   label: "Pilotage" },
    { key: "avg_tugboat",    label: "Tugboat" },
    { key: "avg_berthing",   label: "Berthing" },
    { key: "avg_port_dues",  label: "Port Dues" },
    { key: "avg_total_cost", label: "TOTAL", isTotal: true },
  ];

  const getMinMax = (key: string) => {
    const vals = rows.map(r => (r as any)[key]).filter((v: any) => v != null && v > 0);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  };

  const getCellClass = (value: number | null, key: string) => {
    if (value == null || value === 0) return "";
    const { min, max } = getMinMax(key);
    if (rows.length < 2) return "";
    if (value === min) return "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-semibold";
    if (value === max) return "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300 font-semibold";
    return "";
  };

  return (
    <div className="overflow-x-auto" data-testid="comparison-table">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 text-muted-foreground font-medium w-36">Cost Item</th>
            {rows.map((r, i) => (
              <th key={r.port_id} className="text-right py-2 px-3 font-semibold" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>
                {r.port_name}
                {r.sample_count < 3 && <span className="text-[10px] text-amber-500 block normal-case font-normal">⚠ Insufficient data</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allItems.map(item => (
            <tr key={item.key} className={`border-b last:border-0 ${item.isTotal ? "font-bold bg-muted/30" : "hover:bg-muted/20"}`}>
              <td className="py-2.5 px-3 text-muted-foreground">{item.label}</td>
              {rows.map(r => {
                const val = (r as any)[item.key] as number | null;
                return (
                  <td key={r.port_id} className={`text-right py-2.5 px-3 ${getCellClass(val, item.key)}`}>
                    {r.sample_count < 3 ? <span className="text-muted-foreground/50 text-xs">—</span> : fmt(val)}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t bg-muted/10">
            <td className="py-2 px-3 text-xs text-muted-foreground">Min / Max</td>
            {rows.map(r => (
              <td key={r.port_id} className="text-right py-2 px-3 text-xs text-muted-foreground">
                {r.sample_count < 3 ? "—" : `${fmt(r.min_total_cost)} / ${fmt(r.max_total_cost)}`}
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-2 px-3 text-xs text-muted-foreground">DA Count</td>
            {rows.map(r => (
              <td key={r.port_id} className="text-right py-2 px-3 text-xs text-muted-foreground">
                {r.sample_count} DA{r.sample_count !== 1 ? "s" : ""}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function GroupedBarChart({ rows }: { rows: BenchmarkRow[] }) {
  const data = LINE_ITEMS.map(item => {
    const obj: any = { name: item.label };
    rows.forEach(r => {
      obj[r.port_name] = r.sample_count >= 3 ? Math.round((r as any)[item.key] || 0) : 0;
    });
    return obj;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, undefined]} />
        <Legend />
        {rows.map((r, i) => (
          <Bar key={r.port_id} dataKey={r.port_name} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Radar Chart ──────────────────────────────────────────────────────────────
function CostRadarChart({ rows }: { rows: BenchmarkRow[] }) {
  // Normalize each item to 0–100 relative to max across ports
  const keys = LINE_ITEMS.map(i => i.key);
  const maxPerKey: Record<string, number> = {};
  keys.forEach(k => {
    maxPerKey[k] = Math.max(...rows.map(r => (r as any)[k] || 0), 1);
  });

  const data = LINE_ITEMS.map(item => {
    const obj: any = { subject: item.label };
    rows.forEach(r => {
      const raw = (r as any)[item.key] || 0;
      obj[r.port_name] = r.sample_count >= 3 ? Math.round((raw / maxPerKey[item.key]) * 100) : 0;
    });
    return obj;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        {rows.map((r, i) => (
          <RadarShape
            key={r.port_id}
            name={r.port_name}
            dataKey={r.port_name}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            fillOpacity={0.2}
          />
        ))}
        <Legend />
        <Tooltip formatter={(v: number) => [`${v}% relative`, undefined]} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ─── Port Detail Card ─────────────────────────────────────────────────────────
function PortDetailCard({ row, index }: { row: BenchmarkRow; index: number }) {
  const color = CHART_COLORS[index % CHART_COLORS.length];
  const pieData = LINE_ITEMS
    .map(item => ({ name: item.label, value: Math.round((row as any)[item.key] || 0) }))
    .filter(d => d.value > 0);

  const PIE_COLORS = ["#1e40af", "#0891b2", "#7c3aed", "#b45309", "#be185d"];

  const insufficientData = row.sample_count < 3;

  return (
    <Card className="overflow-hidden" data-testid={`port-detail-${row.port_id}`}>
      <CardHeader className="pb-2" style={{ borderLeft: `4px solid ${color}` }}>
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Anchor className="w-4 h-4" style={{ color }} />
            {row.port_name}
            {row.code && <span className="font-mono text-xs text-muted-foreground">{row.code}</span>}
          </span>
          <Badge variant={insufficientData ? "outline" : "secondary"} className="text-[10px]">
            {row.sample_count} DAs
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        {insufficientData ? (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">Insufficient data — at least 3 DAs needed for reliable benchmarks. Only {row.sample_count} found.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-md p-2">
                <p className="text-[10px] text-muted-foreground">Min</p>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{fmt(row.min_total_cost)}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-md p-2">
                <p className="text-[10px] text-muted-foreground">Avg</p>
                <p className="text-sm font-bold text-blue-700 dark:text-blue-400">{fmt(row.avg_total_cost)}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/20 rounded-md p-2">
                <p className="text-[10px] text-muted-foreground">Max</p>
                <p className="text-sm font-bold text-red-700 dark:text-red-400">{fmt(row.max_total_cost)}</p>
              </div>
            </div>
            {pieData.length > 0 && (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, undefined]} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </>
        )}
        <p className="text-[10px] text-muted-foreground text-right">
          Updated: {row.last_updated ? new Date(row.last_updated).toLocaleDateString() : "—"}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── No Data State ────────────────────────────────────────────────────────────
function NoDataState() {
  return (
    <div className="text-center py-16 px-4">
      <Scale className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
      <p className="text-lg font-semibold text-muted-foreground mb-1">No Benchmark Data Yet</p>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Benchmarks are calculated automatically from historical proforma disbursement accounts. As more DAs are created, 
        comparison data becomes available. Calculations run weekly.
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PortBenchmarking() {
  const [selectedPortIds, setSelectedPortIds] = useState<number[]>([]);
  const [grt, setGrt] = useState("15000");
  const [sizeOverride, setSizeOverride] = useState("auto");
  const [purpose, setPurpose] = useState("loading");
  const [compareTriggered, setCompareTriggered] = useState(false);

  const effectiveSizeCategory = useMemo(() => {
    if (sizeOverride !== "auto") return sizeOverride;
    const g = parseInt(grt) || 10000;
    return grtToCategory(g);
  }, [grt, sizeOverride]);

  const { data: ports = [] } = useQuery<Port[]>({ queryKey: ["/api/ports"] });
  const { data: portsWithData = [], isLoading: summaryLoading } = useQuery<PortSummary[]>({
    queryKey: ["/api/benchmarks/ports"],
  });

  const portIdsParam = selectedPortIds.join(",");
  const { data: compareData, isLoading: compareLoading } = useQuery<CompareResult>({
    queryKey: ["/api/benchmarks/compare", portIdsParam, grt, purpose, effectiveSizeCategory],
    queryFn: () => fetch(
      `/api/benchmarks/compare?ports=${portIdsParam}&grt=${grt}&purpose=${purpose}`,
      { credentials: "include" }
    ).then(r => r.json()),
    enabled: compareTriggered && selectedPortIds.length >= 1,
  });

  const compareRows = compareData?.rows ?? [];

  const togglePort = (id: number) => {
    setCompareTriggered(false);
    setSelectedPortIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const handleCompare = () => {
    if (selectedPortIds.length < 1) return;
    setCompareTriggered(true);
  };

  const validRows = compareRows.filter(r => r.avg_total_cost != null && r.avg_total_cost > 0);
  const hasInsufficientRows = compareRows.some(r => r.sample_count < 3);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <PageMeta title="Port Cost Benchmarking | VesselPDA" />

      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-[hsl(var(--maritime-primary))]/10">
              <Scale className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-serif">Port Cost Benchmarking</h1>
              <p className="text-sm text-muted-foreground">Compare DA costs across Turkish ports — data from anonymized historical proformas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 w-full space-y-6">

        {/* ── Config Panel ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Comparison Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PortSelector
              selected={selectedPortIds}
              onToggle={togglePort}
              onClear={() => { setSelectedPortIds([]); setCompareTriggered(false); }}
              ports={ports}
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>Vessel GRT</Label>
                <Input
                  type="number"
                  min="0"
                  value={grt}
                  onChange={e => { setGrt(e.target.value); setSizeOverride("auto"); setCompareTriggered(false); }}
                  placeholder="e.g. 15000"
                  data-testid="input-grt"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Size Category</Label>
                <Select value={sizeOverride} onValueChange={v => { setSizeOverride(v); setCompareTriggered(false); }}>
                  <SelectTrigger data-testid="select-size-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SIZE_CATEGORIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Purpose of Call</Label>
                <Select value={purpose} onValueChange={v => { setPurpose(v); setCompareTriggered(false); }}>
                  <SelectTrigger data-testid="select-purpose"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PURPOSES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>&nbsp;</Label>
                <Button
                  className="w-full gap-2"
                  onClick={handleCompare}
                  disabled={selectedPortIds.length < 1 || compareLoading}
                  data-testid="button-compare"
                >
                  <BarChart2 className="w-4 h-4" />
                  {compareLoading ? "Loading…" : "Compare Ports"}
                </Button>
              </div>
            </div>

            {effectiveSizeCategory !== "auto" && (
              <p className="text-xs text-muted-foreground">
                Effective category: <strong>{effectiveSizeCategory}</strong> — {parseInt(grt).toLocaleString()} GRT vessel, {purpose}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Ports with Data overview ── */}
        {!compareTriggered && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                Ports with Benchmark Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10" />)}</div>
              ) : portsWithData.length === 0 ? (
                <NoDataState />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left py-2 px-3">Port</th>
                        <th className="text-left py-2 px-3">Code</th>
                        <th className="text-right py-2 px-3">DAs</th>
                        <th className="text-right py-2 px-3">Avg Cost Range</th>
                        <th className="text-right py-2 px-3">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portsWithData.map(p => (
                        <tr key={p.port_id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="py-2.5 px-3 font-medium">{p.port_name}</td>
                          <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{p.code}</td>
                          <td className="py-2.5 px-3 text-right">{p.total_samples}</td>
                          <td className="py-2.5 px-3 text-right text-xs">
                            {fmt(p.min_avg_cost)} – {fmt(p.max_avg_cost)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-xs text-muted-foreground">
                            {new Date(p.last_updated).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Compare Results ── */}
        {compareTriggered && (
          <>
            {compareLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-64" />
                <Skeleton className="h-48" />
              </div>
            ) : compareRows.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Info className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="font-semibold text-muted-foreground">No benchmark data found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    The selected ports don't have benchmark records for {purpose} with {effectiveSizeCategory} vessels yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {hasInsufficientRows && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-amber-700 dark:text-amber-300">
                      Some ports have fewer than 3 DAs — their data is shown as "—" and may not be representative.
                      Benchmarks are anonymous and improve as more proformas are created.
                    </p>
                  </div>
                )}

                {/* Comparison Table */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Scale className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                      Cost Comparison — {purpose.charAt(0).toUpperCase() + purpose.slice(1)} · {effectiveSizeCategory} vessel
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        <span className="text-emerald-600 mr-1">■</span> cheapest &nbsp;
                        <span className="text-red-500 mr-1">■</span> most expensive
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ComparisonTable rows={compareRows} />
                  </CardContent>
                </Card>

                {/* Charts — only if we have at least some valid data */}
                {validRows.length >= 1 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <BarChart2 className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                          Grouped Cost Breakdown
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <GroupedBarChart rows={validRows} />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Radar className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                          Relative Cost Profile
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CostRadarChart rows={validRows} />
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Port Detail Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {compareRows.map((row, i) => (
                    <PortDetailCard key={row.port_id} row={row} index={i} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
