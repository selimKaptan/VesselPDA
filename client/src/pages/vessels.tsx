import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import JSZip from "jszip";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef } from "react";
import { PortLookupInput } from "@/components/port-lookup-input";
import {
  Ship, Plus, Trash2, Edit2, Search, Loader2, RefreshCw,
  ArrowRight, Anchor, MapPin, Calendar,
  FileText, ChevronRight, Activity, ChevronDown,
  LayoutGrid, Map as MapIcon, List, Grid3X3, MoreHorizontal,
  ShieldCheck, Pencil, AlertTriangle, CheckCircle2, Clock,
  ChevronLeft, Download, Upload, Eye, X,
  Layers, Users2, FileSpreadsheet, FolderLock,
  Shield, ClipboardCheck, Building2, Zap, Gauge, Navigation2, Wrench,
  Fuel, Truck, Snowflake, Box, Flame,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { PageMeta } from "@/components/page-meta";
import type { Vessel } from "@shared/schema";
import { useLocation, Link } from "wouter";
import { EmptyState } from "@/components/empty-state";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { fmtDate } from "@/lib/formatDate";

import { ensureMapboxToken } from "@/lib/mapbox-init";

// ─── Config ───────────────────────────────────────────────────────────────────

const vesselTypes = [
  "Bulk Carrier", "Container Ship", "General Cargo", "Tanker", "Ro-Ro",
  "Passenger", "Chemical Tanker", "LPG Carrier", "LNG Carrier", "Reefer",
];

const flags = [
  "Turkey", "Malta", "Panama", "Liberia", "Marshall Islands", "Bahamas",
  "Greece", "Cyprus", "Singapore", "Hong Kong", "Norway", "United Kingdom",
];

const FLAG_EMOJI: Record<string, string> = {
  "Turkey": "🇹🇷", "Malta": "🇲🇹", "Panama": "🇵🇦", "Liberia": "🇱🇷",
  "Marshall Islands": "🇲🇭", "Bahamas": "🇧🇸", "Greece": "🇬🇷",
  "Cyprus": "🇨🇾", "Singapore": "🇸🇬", "Hong Kong": "🇭🇰",
  "Norway": "🇳🇴", "United Kingdom": "🇬🇧",
};

// ─── Fleet Group Types ────────────────────────────────────────────────────────

interface FleetItem {
  id: number;
  name: string;
  description: string | null;
  color: string;
  vessel_count: number;
  vessel_ids: number[];
  vessel_mmsis: string[];
  created_at: string;
}

const FLEET_COLOR_PALETTE = [
  "#2563EB", "#DC2626", "#16A34A", "#D97706",
  "#7C3AED", "#0891B2", "#BE185D", "#65A30D",
  "#EA580C", "#0F766E",
];

// ─── Fleet Status Config ──────────────────────────────────────────────────────

type FleetStatusKey =
  | "anchored" | "ballast_to_load" | "laden_to_discharge"
  | "anchor_spot" | "loading" | "discharging" | "moored" | "idle";

type StatusCfg = {
  bar: string;
  badge: string;
  dot: string;
  label: string;
  emoji: string;
  group: "underway" | "anchored" | "port" | "idle";
};

const FLEET_STATUS_CFG: Record<FleetStatusKey, StatusCfg> = {
  ballast_to_load: {
    bar: "#3b82f6",
    badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
    dot: "bg-blue-500", label: "Ballast to Load Port", emoji: "🔵", group: "underway",
  },
  laden_to_discharge: {
    bar: "#10b981",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
    dot: "bg-emerald-500", label: "Laden to Discharge Port", emoji: "🟢", group: "underway",
  },
  anchored: {
    bar: "#f59e0b",
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
    dot: "bg-amber-500", label: "At Anchor", emoji: "⚓", group: "anchored",
  },
  anchor_spot: {
    bar: "#f97316",
    badge: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800",
    dot: "bg-orange-500", label: "At Anchor – Awaiting Spot", emoji: "🟠", group: "anchored",
  },
  loading: {
    bar: "#6366f1",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800",
    dot: "bg-indigo-500", label: "Loading", emoji: "🟣", group: "port",
  },
  discharging: {
    bar: "#f43f5e",
    badge: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800",
    dot: "bg-rose-500", label: "Discharging", emoji: "🔴", group: "port",
  },
  moored: {
    bar: "#64748b",
    badge: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-600",
    dot: "bg-slate-500", label: "Moored at Port", emoji: "🚢", group: "port",
  },
  idle: {
    bar: "#94a3b8",
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground", label: "Status Not Set", emoji: "—", group: "idle",
  },
};

const ALL_STATUSES = Object.entries(FLEET_STATUS_CFG) as [FleetStatusKey, StatusCfg][];

function getCfg(status: string | null | undefined): StatusCfg {
  return FLEET_STATUS_CFG[(status as FleetStatusKey) ?? "idle"] ?? FLEET_STATUS_CFG.idle;
}

function getProgress(voyage: any): number {
  if (!voyage?.etd || !voyage?.eta) return 0;
  const now = Date.now();
  const start = new Date(voyage.etd).getTime();
  const end = new Date(voyage.eta).getTime();
  if (end <= start) return 0;
  return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
}

// ─── Types ────────────────────────────────────────────────────────────────────

type VesselFormData = {
  name: string; flag: string; vesselType: string; imoNumber: string;
  mmsi: string; callSign: string; yearBuilt: string; grt: string; nrt: string; dwt: string; loa: string; beam: string;
  datalasticUuid: string; enginePower: string; engineType: string; classificationSociety: string;
};

const emptyForm = (): VesselFormData => ({
  name: "", flag: "", vesselType: "", imoNumber: "", mmsi: "", callSign: "", yearBuilt: "",
  grt: "", nrt: "", dwt: "", loa: "", beam: "",
  datalasticUuid: "", enginePower: "", engineType: "", classificationSociety: "",
});

const vesselToForm = (v: Vessel): VesselFormData => ({
  name: v.name || "", flag: v.flag || "", vesselType: v.vesselType || "",
  imoNumber: v.imoNumber || "", mmsi: (v as any).mmsi || "", callSign: v.callSign || "",
  yearBuilt: (v as any).yearBuilt != null ? String((v as any).yearBuilt) : "",
  grt: v.grt != null ? String(v.grt) : "", nrt: v.nrt != null ? String(v.nrt) : "",
  dwt: v.dwt != null ? String(v.dwt) : "", loa: v.loa != null ? String(v.loa) : "",
  beam: v.beam != null ? String(v.beam) : "",
  datalasticUuid: (v as any).datalasticUuid || "",
  enginePower: (v as any).enginePower != null ? String((v as any).enginePower) : "",
  engineType: (v as any).engineType || "",
  classificationSociety: (v as any).classificationSociety || "",
});

type LookupResult = {
  name: string; flag: string; vesselType: string; imoNumber: string; mmsi: string | null;
  callSign: string | null; grt: number | null; nrt: number | null;
  dwt: number | null; loa: number | null; beam: number | null;
  datalasticUuid?: string; yearBuilt?: number | null;
  enginePower?: number | null; engineType?: string | null; classificationSociety?: string | null;
};

// ─── VesselForm ───────────────────────────────────────────────────────────────

function VesselForm({
  vessel, onSave, onCancel, isSaving,
}: {
  vessel?: Vessel | null;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<VesselFormData>(vessel ? vesselToForm(vessel) : emptyForm());
  const [lookupDone, setLookupDone] = useState(false);
  const [finderQuery, setFinderQuery] = useState("");
  const [finderType, setFinderType] = useState<"imo" | "mmsi">("imo");
  const [finderResults, setFinderResults] = useState<LookupResult[]>([]);
  const [showFinder, setShowFinder] = useState(false);

  const set = (field: keyof VesselFormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  function applyLookupResult(data: LookupResult) {
    setForm((f) => ({
      ...f,
      name: data.name || f.name,
      flag: data.flag || f.flag,
      vesselType: data.vesselType || f.vesselType,
      imoNumber: data.imoNumber || f.imoNumber,
      mmsi: data.mmsi || f.mmsi,
      callSign: data.callSign || f.callSign,
      yearBuilt: data.yearBuilt != null ? String(data.yearBuilt) : f.yearBuilt,
      grt: data.grt != null ? String(data.grt) : f.grt,
      nrt: data.nrt != null ? String(data.nrt) : f.nrt,
      dwt: data.dwt != null ? String(data.dwt) : f.dwt,
      loa: data.loa != null ? String(data.loa) : f.loa,
      beam: data.beam != null ? String(data.beam) : f.beam,
      datalasticUuid: data.datalasticUuid || f.datalasticUuid,
      enginePower: data.enginePower != null ? String(data.enginePower) : f.enginePower,
      engineType: data.engineType || f.engineType,
      classificationSociety: data.classificationSociety || f.classificationSociety,
    }));
    setLookupDone(true);
  }

  const lookupMutation = useMutation({
    mutationFn: async (imo: string) => {
      const res = await apiRequest("GET", `/api/vessels/lookup?imo=${encodeURIComponent(imo)}`);
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Lookup failed"); }
      return res.json() as Promise<LookupResult>;
    },
    onSuccess: (data) => {
      applyLookupResult(data);
      toast({ title: "Gemi bilgileri dolduruldu", description: `Bulundu: ${data.name}` });
    },
    onError: (err: Error) => {
      toast({ title: "Sorgulama başarısız", description: err.message, variant: "destructive" });
    },
  });

  const finderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/vessels/finder?q=${encodeURIComponent(finderQuery)}&type=${finderType}`);
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Search failed"); }
      return res.json() as Promise<LookupResult[]>;
    },
    onSuccess: (data) => {
      setFinderResults(data);
      if (!data.length) toast({ title: "Sonuç bulunamadı", description: "Farklı bir terim deneyin" });
    },
    onError: (err: Error) => {
      toast({ title: "Arama başarısız", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: form.name, flag: form.flag || null, vesselType: form.vesselType || null,
      grt: form.grt ? parseFloat(form.grt) : null,
      nrt: form.nrt ? parseFloat(form.nrt) : null,
      dwt: form.dwt ? parseFloat(form.dwt) : null,
      loa: form.loa ? parseFloat(form.loa) : null,
      beam: form.beam ? parseFloat(form.beam) : null,
      imoNumber: form.imoNumber || null,
      mmsi: form.mmsi || null,
      callSign: form.callSign || null,
      yearBuilt: form.yearBuilt ? parseInt(form.yearBuilt) : null,
      datalasticUuid: form.datalasticUuid || null,
      enginePower: form.enginePower ? parseFloat(form.enginePower) : null,
      engineType: form.engineType || null,
      classificationSociety: form.classificationSociety || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Datalastic Vessel Finder */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-blue-300">Datalastic Gemi Arama</span>
          <Button type="button" variant="ghost" size="sm" className="ml-auto h-6 text-xs text-muted-foreground"
            onClick={() => setShowFinder(v => !v)}>
            {showFinder ? "Gizle" : "Göster"}
          </Button>
        </div>
        {showFinder && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Select value={finderType} onValueChange={v => setFinderType(v as any)}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="imo">IMO</SelectItem>
                  <SelectItem value="mmsi">MMSI</SelectItem>
                </SelectContent>
              </Select>
              <Input value={finderQuery} onChange={e => { setFinderQuery(e.target.value); setFinderResults([]); }}
                placeholder={finderType === "imo" ? "Örn: 9808742" : "Örn: 271000001"}
                className="flex-1 h-8 text-sm" data-testid="input-vessel-finder"
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), finderMutation.mutate())} />
              <Button type="button" size="sm" className="h-8" onClick={() => finderMutation.mutate()}
                disabled={!finderQuery.trim() || finderMutation.isPending} data-testid="button-vessel-search">
                {finderMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              </Button>
            </div>
            {finderResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded border border-slate-700 bg-slate-900 divide-y divide-slate-800">
                {finderResults.map((r, i) => (
                  <button key={i} type="button" onClick={() => { applyLookupResult(r); setFinderResults([]); setShowFinder(false); toast({ title: "Gemi bilgileri dolduruldu", description: r.name }); }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-800 transition-colors" data-testid={`button-finder-result-${i}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{r.name}</span>
                      <span className="text-xs text-slate-400">{r.flag}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">IMO: {r.imoNumber || "—"} · MMSI: {r.mmsi || "—"} · {r.vesselType}</div>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500">IMO veya MMSI ile arayın, seçince form otomatik dolar</p>
          </div>
        )}
        {lookupDone && <div className="flex items-center gap-1.5 text-xs text-green-400"><span>✓</span> Datalastic ile dolduruldu</div>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="imoNumber">
            IMO Number
            {lookupDone && <Badge variant="secondary" className="ml-2 text-[10px]">Auto-filled</Badge>}
          </Label>
          <div className="flex gap-2">
            <Input id="imoNumber" placeholder="e.g. 9321483" value={form.imoNumber}
              onChange={(e) => { set("imoNumber", e.target.value); setLookupDone(false); }}
              className="flex-1" data-testid="input-imo" />
            <Button type="button" variant="outline" size="icon"
              title="IMO ile Datalastic'ten otomatik doldur"
              disabled={!form.imoNumber.trim() || lookupMutation.isPending}
              onClick={() => lookupMutation.mutate(form.imoNumber.trim())}
              data-testid="button-lookup-imo">
              {lookupMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Search className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">IMO girin ve <Search className="w-3 h-3 inline" /> ile otomatik doldurun</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Vessel Name *</Label>
          <Input id="name" placeholder="MV CHELSEA 2" value={form.name}
            onChange={(e) => set("name", e.target.value)} required data-testid="input-vessel-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="flag">Flag *</Label>
          <Input 
            id="flag" 
            placeholder="e.g. Panama" 
            value={form.flag}
            onChange={(e) => set("flag", e.target.value)}
            required
            data-testid="input-flag"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vesselType">Vessel Type *</Label>
          <Select value={form.vesselType} onValueChange={(v) => set("vesselType", v)} required>
            <SelectTrigger data-testid="select-vessel-type"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {vesselTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="grt">GRT *</Label>
          <Input id="grt" type="number" step="0.01" placeholder="5166" value={form.grt}
            onChange={(e) => set("grt", e.target.value)} required data-testid="input-grt" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nrt">NRT *</Label>
          <Input id="nrt" type="number" step="0.01" placeholder="2906" value={form.nrt}
            onChange={(e) => set("nrt", e.target.value)} required data-testid="input-nrt" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dwt">DWT</Label>
          <Input id="dwt" type="number" step="0.01" placeholder="8500" value={form.dwt}
            onChange={(e) => set("dwt", e.target.value)} data-testid="input-dwt" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loa">LOA (m)</Label>
          <Input id="loa" type="number" step="0.01" placeholder="118.5" value={form.loa}
            onChange={(e) => set("loa", e.target.value)} data-testid="input-loa" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="beam">Beam (m)</Label>
          <Input id="beam" type="number" step="0.01" placeholder="17.2" value={form.beam}
            onChange={(e) => set("beam", e.target.value)} data-testid="input-beam" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="callSign">Call Sign</Label>
          <Input id="callSign" placeholder="9HA4567" value={form.callSign}
            onChange={(e) => set("callSign", e.target.value)} data-testid="input-callsign" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="yearBuilt">Year Built</Label>
          <Input id="yearBuilt" type="number" placeholder="e.g. 2005" value={form.yearBuilt}
            onChange={(e) => set("yearBuilt", e.target.value)} data-testid="input-year-built" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mmsi">MMSI</Label>
          <Input id="mmsi" placeholder="e.g. 271000001" value={form.mmsi}
            onChange={(e) => set("mmsi", e.target.value)} data-testid="input-mmsi" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="classificationSociety">Classification Society</Label>
          <Input id="classificationSociety" placeholder="e.g. Bureau Veritas" value={form.classificationSociety}
            onChange={(e) => set("classificationSociety", e.target.value)} data-testid="input-class-society" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="engineType">Engine Type</Label>
          <Input id="engineType" placeholder="e.g. MAN B&W" value={form.engineType}
            onChange={(e) => set("engineType", e.target.value)} data-testid="input-engine-type" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="enginePower">Engine Power (kW)</Label>
          <Input id="enginePower" type="number" placeholder="e.g. 4900" value={form.enginePower}
            onChange={(e) => set("enginePower", e.target.value)} data-testid="input-engine-power" />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-vessel">Cancel</Button>
        <Button type="submit" disabled={isSaving} data-testid="button-save-vessel">
          {isSaving ? "Saving..." : vessel ? "Update" : "Add Vessel"}
        </Button>
      </div>
    </form>
  );
}

// ─── DatalasticPanel ──────────────────────────────────────────────────────────

function DatalasticFetchSection({
  title, icon, imoNumber, endpoint, enabled, onFetch, children, isLoading, isError, error, isEmpty, emptyText,
}: {
  title: string; icon: React.ReactNode; imoNumber: string | null | undefined;
  endpoint: string; enabled: boolean; onFetch: () => void;
  children?: React.ReactNode; isLoading?: boolean; isError?: boolean;
  error?: Error | null; isEmpty?: boolean; emptyText?: string;
}) {
  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="flex items-center gap-1.5 pb-2 border-b mb-2">
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
        {isLoading && <Loader2 className="w-3 h-3 animate-spin ml-auto text-muted-foreground" />}
        {!enabled && imoNumber && (
          <Button size="sm" variant="outline"
            className="ml-auto h-6 text-[10px] gap-1 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
            onClick={onFetch} data-testid={`button-fetch-${endpoint}`}>
            <Download className="w-2.5 h-2.5" /> Datalastic'ten Getir
          </Button>
        )}
      </div>
      {!imoNumber ? (
        <p className="text-xs text-muted-foreground py-1">IMO numarası gerekli.</p>
      ) : !enabled ? (
        <p className="text-xs text-muted-foreground py-1">Butona tıklayarak veri çekin.</p>
      ) : isError ? (
        <p className="text-xs text-muted-foreground py-1">{(error as Error)?.message ?? "Veri alınamadı."}</p>
      ) : isLoading ? (
        <div className="py-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Alınıyor...
        </div>
      ) : isEmpty ? (
        <p className="text-xs text-muted-foreground py-1">{emptyText ?? "Veri bulunamadı."}</p>
      ) : children}
    </div>
  );
}

function DatalasticPanel({ vessel }: { vessel: Vessel }) {
  const [showEngine, setShowEngine] = useState(false);
  const [showOwnership, setShowOwnership] = useState(false);
  const [showClassification, setShowClassification] = useState(false);
  const [showInspections, setShowInspections] = useState(false);
  const [showDrydock, setShowDrydock] = useState(false);
  const [showCasualties, setShowCasualties] = useState(false);

  const imo = vessel.imoNumber ?? null;

  const engineQuery = useQuery({
    queryKey: ["/api/datalastic/vessel-engine", imo],
    queryFn: async () => {
      const res = await fetch(`/api/datalastic/vessel-engine/${imo}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Hata"); }
      return res.json();
    },
    enabled: showEngine && !!imo, retry: false,
  });

  const ownershipQuery = useQuery({
    queryKey: ["/api/datalastic/vessel-ownership", imo],
    queryFn: async () => {
      const res = await fetch(`/api/datalastic/vessel-ownership/${imo}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Hata"); }
      return res.json();
    },
    enabled: showOwnership && !!imo, retry: false,
  });

  const classificationQuery = useQuery({
    queryKey: ["/api/datalastic/classification", imo],
    queryFn: async () => {
      const res = await fetch(`/api/datalastic/classification/${imo}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Hata"); }
      return res.json();
    },
    enabled: showClassification && !!imo, retry: false,
  });

  const inspectionsQuery = useQuery({
    queryKey: ["/api/datalastic/inspections", imo],
    queryFn: async () => {
      const res = await fetch(`/api/datalastic/inspections/${imo}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Hata"); }
      return res.json() as Promise<any[]>;
    },
    enabled: showInspections && !!imo, retry: false,
  });

  const drydockQuery = useQuery({
    queryKey: ["/api/datalastic/drydock", imo],
    queryFn: async () => {
      const res = await fetch(`/api/datalastic/drydock/${imo}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Hata"); }
      return res.json() as Promise<any[]>;
    },
    enabled: showDrydock && !!imo, retry: false,
  });

  const casualtiesQuery = useQuery({
    queryKey: ["/api/datalastic/casualties", imo],
    queryFn: async () => {
      const res = await fetch(`/api/datalastic/casualties/${imo}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Hata"); }
      return res.json() as Promise<any[]>;
    },
    enabled: showCasualties && !!imo, retry: false,
  });

  const posQuery = useQuery({
    queryKey: ["/api/vessels/live-position", vessel.imoNumber, (vessel as any).mmsi],
    queryFn: async () => {
      const param = vessel.imoNumber ? `imo=${vessel.imoNumber}` : `mmsi=${(vessel as any).mmsi}`;
      const res = await fetch(`/api/vessels/live-position?${param}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json() as Promise<{
        latitude: number; longitude: number; speed: number; course: number;
        heading: number; destination: string | null; eta: string | null;
        navigation_status: string | null; timestamp: string; port_name: string | null; country: string | null;
      }>;
    },
    enabled: !!(vessel.imoNumber || (vessel as any).mmsi),
    retry: false,
  });

  const portCallQuery = useQuery({
    queryKey: ["/api/vessels/port-call-history", vessel.imoNumber],
    queryFn: async () => {
      const res = await fetch(`/api/vessels/port-call-history?imo=${vessel.imoNumber}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json() as Promise<{
        port_name: string; country: string; locode: string | null;
        arrival: string | null; departure: string | null; terminal: string | null;
      }[]>;
    },
    enabled: !!vessel.imoNumber,
    retry: false,
  });

  const trackVesselLink = vessel.imoNumber
    ? `/vessel-track?searchImo=${vessel.imoNumber}`
    : null;

  return (
    <div className="space-y-4" data-testid="datalastic-panel">
      {/* Header */}
      <div className="flex items-center gap-2 pb-1 border-b">
        <span className="text-base">🛰</span>
        <span className="text-sm font-bold">Datalastic Canlı Veri</span>
        {trackVesselLink && (
          <Link href={trackVesselLink} className="ml-auto">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-blue-500/30 text-blue-400">
              <MapPin className="w-3 h-3" /> Haritada Göster
            </Button>
          </Link>
        )}
      </div>

      {/* Live Position */}
      <div className="rounded-lg border bg-card/50 p-3">
        <div className="flex items-center gap-1.5 pb-2 border-b mb-2">
          <MapPin className="w-3 h-3 text-primary" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Canlı Konum</p>
          {posQuery.isLoading && <Loader2 className="w-3 h-3 animate-spin ml-auto text-muted-foreground" />}
        </div>
        {posQuery.isError ? (
          <p className="text-xs text-muted-foreground py-2">{(posQuery.error as Error).message}</p>
        ) : posQuery.data ? (
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Enlem", value: posQuery.data.latitude?.toFixed(4) ?? "—" },
              { label: "Boylam", value: posQuery.data.longitude?.toFixed(4) ?? "—" },
              { label: "Sürat", value: posQuery.data.speed != null ? `${posQuery.data.speed} kn` : "—" },
              { label: "Rota", value: posQuery.data.course != null ? `${posQuery.data.course}°` : "—" },
              { label: "Varış Yeri", value: posQuery.data.destination || "—" },
              { label: "ETA", value: posQuery.data.eta ? new Date(posQuery.data.eta).toLocaleDateString("tr-TR") : "—" },
              { label: "Durum", value: posQuery.data.navigation_status || "—" },
              { label: "Güncelleme", value: posQuery.data.timestamp ? new Date(posQuery.data.timestamp).toLocaleString("tr-TR") : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground shrink-0">{label}</span>
                <span className="font-semibold text-right truncate">{value}</span>
              </div>
            ))}
          </div>
        ) : posQuery.isLoading ? (
          <div className="py-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Konum alınıyor...
          </div>
        ) : !vessel.imoNumber && !(vessel as any).mmsi ? (
          <p className="text-xs text-muted-foreground py-2">Bu gemi için IMO veya MMSI numarası girilmemiş.</p>
        ) : null}
      </div>

      {/* Port Call History */}
      <div className="rounded-lg border bg-card/50 p-3">
        <div className="flex items-center gap-1.5 pb-2 border-b mb-2">
          <Ship className="w-3 h-3 text-primary" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Liman Çağrısı Geçmişi</p>
          {portCallQuery.isLoading && <Loader2 className="w-3 h-3 animate-spin ml-auto text-muted-foreground" />}
        </div>
        {portCallQuery.isError ? (
          <p className="text-xs text-muted-foreground py-2">{(portCallQuery.error as Error).message}</p>
        ) : portCallQuery.data && portCallQuery.data.length > 0 ? (
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {portCallQuery.data.map((call, i) => (
              <div key={i} className="flex items-start justify-between gap-2 text-xs border-b border-border/50 pb-1.5 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{call.port_name || "—"}</p>
                  <p className="text-muted-foreground">{call.country || ""}{call.locode ? ` (${call.locode})` : ""}</p>
                  {call.terminal && <p className="text-muted-foreground text-[10px]">{call.terminal}</p>}
                </div>
                <div className="text-right shrink-0">
                  {call.arrival && <p className="text-green-400 text-[10px]">▶ {new Date(call.arrival).toLocaleDateString("tr-TR")}</p>}
                  {call.departure && <p className="text-red-400 text-[10px]">◀ {new Date(call.departure).toLocaleDateString("tr-TR")}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : portCallQuery.isLoading ? (
          <div className="py-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Geçmiş alınıyor...
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-2">
            {!vessel.imoNumber ? "IMO numarası gerekli." : "Liman çağrısı geçmişi bulunamadı."}
          </p>
        )}
      </div>

      {/* ── Engine Data ─────────────────────────────────────────── */}
      <DatalasticFetchSection
        title="Motor Bilgileri" icon={<Zap className="w-3 h-3 text-yellow-400" />}
        imoNumber={imo} endpoint="vessel-engine" enabled={showEngine} onFetch={() => setShowEngine(true)}
        isLoading={engineQuery.isLoading} isError={engineQuery.isError} error={engineQuery.error as Error}
        isEmpty={!engineQuery.data}
        emptyText="Motor verisi bulunamadı."
      >
        {engineQuery.data && (
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Motor Tipi", value: engineQuery.data.engine_type ?? engineQuery.data.main_engine_type ?? "—" },
              { label: "Güç (kW)", value: engineQuery.data.power_kw ?? engineQuery.data.engine_power ?? "—" },
              { label: "Yakıt Tipi", value: engineQuery.data.fuel_type ?? "—" },
              { label: "Silindir Sayısı", value: engineQuery.data.cylinders ?? "—" },
              { label: "Üretici", value: engineQuery.data.engine_builder ?? engineQuery.data.manufacturer ?? "—" },
              { label: "Model", value: engineQuery.data.engine_model ?? engineQuery.data.model ?? "—" },
              { label: "RPM", value: engineQuery.data.rpm ?? "—" },
              { label: "Stroke Tipi", value: engineQuery.data.stroke_type ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground shrink-0">{label}</span>
                <span className="font-semibold text-right truncate">{String(value)}</span>
              </div>
            ))}
          </div>
        )}
      </DatalasticFetchSection>

      {/* ── Classification ──────────────────────────────────────── */}
      <DatalasticFetchSection
        title="Klas Bilgileri" icon={<Shield className="w-3 h-3 text-blue-400" />}
        imoNumber={imo} endpoint="classification" enabled={showClassification} onFetch={() => setShowClassification(true)}
        isLoading={classificationQuery.isLoading} isError={classificationQuery.isError} error={classificationQuery.error as Error}
        isEmpty={!classificationQuery.data}
        emptyText="Klas verisi bulunamadı."
      >
        {classificationQuery.data && (
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Klas Kuruluşu", value: classificationQuery.data.classification_society ?? classificationQuery.data.society ?? "—" },
              { label: "Notasyon", value: classificationQuery.data.class_notation ?? classificationQuery.data.notation ?? "—" },
              { label: "Son Sörvey", value: classificationQuery.data.last_survey_date ? new Date(classificationQuery.data.last_survey_date).toLocaleDateString("tr-TR") : "—" },
              { label: "Sonraki Sörvey", value: classificationQuery.data.next_survey_date ? new Date(classificationQuery.data.next_survey_date).toLocaleDateString("tr-TR") : "—" },
              { label: "Sörvey Tipi", value: classificationQuery.data.survey_type ?? "—" },
              { label: "Durum", value: classificationQuery.data.class_status ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground shrink-0">{label}</span>
                <span className="font-semibold text-right truncate">{String(value)}</span>
              </div>
            ))}
          </div>
        )}
      </DatalasticFetchSection>

      {/* ── PSC Inspections ─────────────────────────────────────── */}
      <DatalasticFetchSection
        title="PSC Denetimleri" icon={<ClipboardCheck className="w-3 h-3 text-orange-400" />}
        imoNumber={imo} endpoint="inspections" enabled={showInspections} onFetch={() => setShowInspections(true)}
        isLoading={inspectionsQuery.isLoading} isError={inspectionsQuery.isError} error={inspectionsQuery.error as Error}
        isEmpty={!inspectionsQuery.data || inspectionsQuery.data.length === 0}
        emptyText="PSC denetimi geçmişi bulunamadı."
      >
        {inspectionsQuery.data && inspectionsQuery.data.length > 0 && (
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {inspectionsQuery.data.slice(0, 15).map((insp: any, i: number) => (
              <div key={i} className="flex items-start justify-between gap-2 text-xs border-b border-border/50 pb-1.5 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{insp.port_name ?? insp.port ?? "—"}</p>
                  <p className="text-muted-foreground text-[10px]">{insp.inspection_type ?? insp.authority ?? ""}</p>
                  {insp.deficiencies != null && (
                    <span className={`text-[10px] font-medium ${insp.deficiencies > 0 ? "text-red-400" : "text-green-400"}`}>
                      {insp.deficiencies > 0 ? `⚠ ${insp.deficiencies} eksiklik` : "✓ Temiz"}
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {insp.inspection_date && (
                    <p className="text-muted-foreground text-[10px]">{new Date(insp.inspection_date).toLocaleDateString("tr-TR")}</p>
                  )}
                  {insp.detained && <span className="text-red-400 text-[10px] font-bold">GÖZALTI</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </DatalasticFetchSection>

      {/* ── Vessel Ownership ────────────────────────────────────── */}
      <DatalasticFetchSection
        title="Sahiplik Geçmişi" icon={<Building2 className="w-3 h-3 text-green-400" />}
        imoNumber={imo} endpoint="vessel-ownership" enabled={showOwnership} onFetch={() => setShowOwnership(true)}
        isLoading={ownershipQuery.isLoading} isError={ownershipQuery.isError} error={ownershipQuery.error as Error}
        isEmpty={!ownershipQuery.data}
        emptyText="Sahiplik verisi bulunamadı."
      >
        {ownershipQuery.data && (
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Kayıtlı Sahip", value: ownershipQuery.data.registered_owner ?? ownershipQuery.data.owner ?? "—" },
              { label: "İşletmeci", value: ownershipQuery.data.operator ?? "—" },
              { label: "Teknik Yönetici", value: ownershipQuery.data.technical_manager ?? ownershipQuery.data.manager ?? "—" },
              { label: "Donatan", value: ownershipQuery.data.shipowner ?? ownershipQuery.data.beneficial_owner ?? "—" },
              { label: "Bayrak", value: ownershipQuery.data.flag ?? ownershipQuery.data.flag_state ?? "—" },
              { label: "Liman Devleti", value: ownershipQuery.data.port_of_registry ?? ownershipQuery.data.home_port ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground shrink-0">{label}</span>
                <span className="font-semibold text-right truncate max-w-[120px]" title={String(value)}>{String(value)}</span>
              </div>
            ))}
          </div>
        )}
      </DatalasticFetchSection>

      {/* ── Drydock History ─────────────────────────────────────── */}
      <DatalasticFetchSection
        title="Havuz Geçmişi" icon={<Anchor className="w-3 h-3 text-cyan-400" />}
        imoNumber={imo} endpoint="drydock" enabled={showDrydock} onFetch={() => setShowDrydock(true)}
        isLoading={drydockQuery.isLoading} isError={drydockQuery.isError} error={drydockQuery.error as Error}
        isEmpty={!drydockQuery.data || drydockQuery.data.length === 0}
        emptyText="Havuz geçmişi bulunamadı."
      >
        {drydockQuery.data && drydockQuery.data.length > 0 && (
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {drydockQuery.data.map((dd: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-2 text-xs border-b border-border/50 pb-1.5 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-semibold">{dd.shipyard ?? dd.yard_name ?? dd.type ?? `Havuz #${i + 1}`}</p>
                  <p className="text-muted-foreground text-[10px]">{dd.country ?? dd.location ?? ""}</p>
                </div>
                <div className="text-right shrink-0 text-[10px] text-muted-foreground">
                  {dd.in_date || dd.start_date ? <p>▶ {new Date(dd.in_date ?? dd.start_date).toLocaleDateString("tr-TR")}</p> : null}
                  {dd.out_date || dd.end_date ? <p>◀ {new Date(dd.out_date ?? dd.end_date).toLocaleDateString("tr-TR")}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </DatalasticFetchSection>

      {/* ── Casualty History ────────────────────────────────────── */}
      <DatalasticFetchSection
        title="Kaza Geçmişi" icon={<AlertTriangle className="w-3 h-3 text-red-400" />}
        imoNumber={imo} endpoint="casualties" enabled={showCasualties} onFetch={() => setShowCasualties(true)}
        isLoading={casualtiesQuery.isLoading} isError={casualtiesQuery.isError} error={casualtiesQuery.error as Error}
        isEmpty={!casualtiesQuery.data || casualtiesQuery.data.length === 0}
        emptyText="Kaza geçmişi bulunamadı."
      >
        {casualtiesQuery.data && casualtiesQuery.data.length > 0 && (
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {casualtiesQuery.data.map((cas: any, i: number) => (
              <div key={i} className="flex items-start justify-between gap-2 text-xs border-b border-border/50 pb-1.5 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-semibold text-red-300 truncate">{cas.casualty_type ?? cas.type ?? `Kaza #${i + 1}`}</p>
                  <p className="text-muted-foreground text-[10px] truncate">{cas.location ?? cas.area ?? "—"}</p>
                  {cas.description && <p className="text-[10px] text-muted-foreground line-clamp-2">{cas.description}</p>}
                </div>
                <div className="text-right shrink-0 text-[10px] text-muted-foreground">
                  {cas.date && <p>{new Date(cas.date).toLocaleDateString("tr-TR")}</p>}
                  {cas.severity && <span className={`font-medium ${cas.severity === "Very Serious" || cas.severity === "Total Loss" ? "text-red-400" : "text-orange-400"}`}>{cas.severity}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </DatalasticFetchSection>

    </div>
  );
}

// ─── Inline Status Selector ───────────────────────────────────────────────────

function FleetStatusSelector({ vessel, onUpdated }: { vessel: Vessel; onUpdated?: () => void }) {
  const { toast } = useToast();
  const cfg = getCfg(vessel.fleetStatus);

  const mutation = useMutation({
    mutationFn: async (fleetStatus: string) => {
      const res = await apiRequest("PATCH", `/api/vessels/${vessel.id}`, { fleetStatus });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels"] });
      onUpdated?.();
    },
    onError: () => {
      toast({ title: "Status update failed", variant: "destructive" });
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-all hover:opacity-80 ${cfg.badge}`}
          onClick={(e) => e.stopPropagation()}
          data-testid={`status-selector-${vessel.id}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
          <span className="max-w-[140px] truncate">{cfg.label}</span>
          <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 z-50" onClick={(e) => e.stopPropagation()}>
        {ALL_STATUSES.map(([key, s]) => (
          <DropdownMenuItem
            key={key}
            className={`gap-2.5 cursor-pointer ${vessel.fleetStatus === key ? "font-bold bg-muted" : ""}`}
            onSelect={() => { if (vessel.fleetStatus !== key) mutation.mutate(key); }}
            data-testid={`status-option-${key}`}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
            <span className="text-sm">{s.emoji} {s.label}</span>
            {vessel.fleetStatus === key && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Fleet Map ────────────────────────────────────────────────────────────────

function FleetMap({
  vessels,
  vesselVoyageMap,
  onVesselClick,
}: {
  vessels: Vessel[];
  vesselVoyageMap: Map<number, any>;
  onVesselClick: (v: Vessel) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());

  // init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!mapboxgl.supported()) return;
    let destroyed = false;
    ensureMapboxToken().then((token) => {
      if (destroyed || !token || !mapContainerRef.current || mapRef.current) return;
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/navigation-night-v1",
        center: [35.0, 39.0],
        zoom: 5,
      });
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");
      map.addControl(new mapboxgl.ScaleControl({ maxWidth: 80, unit: "nautical" }), "bottom-left");
      mapRef.current = map;
    });
    return () => {
      destroyed = true;
      if (mapRef.current) {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current.clear();
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // update markers when vessels/voyages change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const addMarkers = () => {
      // remove old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      vessels.forEach((vessel) => {
        const voyage = vesselVoyageMap.get(vessel.id);
        const lat = voyage?.portLat;
        const lng = voyage?.portLng;
        if (!lat || !lng) return;

        const cfg = getCfg(vessel.fleetStatus);
        const flag = FLAG_EMOJI[vessel.flag || ""] || "🏳️";

        // marker element
        const el = document.createElement("div");
        el.style.cssText = `
          width: 40px; height: 40px; border-radius: 50%;
          background: #1e293b; border: 3px solid ${cfg.bar};
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          transition: transform 0.15s ease;
        `;
        el.innerHTML = "🚢";
        el.title = vessel.name;

        el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.2)"; });
        el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
        el.addEventListener("click", () => onVesselClick(vessel));

        const popup = new mapboxgl.Popup({
          offset: 24,
          closeButton: false,
          className: "fleet-popup",
        }).setHTML(`
          <div style="padding:8px 10px; min-width:160px; font-family:sans-serif;">
            <div style="font-weight:700; font-size:13px; margin-bottom:4px;">${flag} ${vessel.name}</div>
            <div style="font-size:11px; color:#94a3b8; margin-bottom:2px;">${vessel.vesselType || "—"}</div>
            <div style="display:flex; align-items:center; gap:5px; margin-top:6px;">
              <span style="width:8px;height:8px;border-radius:50%;background:${cfg.bar};flex-shrink:0;"></span>
              <span style="font-size:11px; font-weight:600;">${cfg.label}</span>
            </div>
            <div style="font-size:11px; color:#94a3b8; margin-top:4px;">📍 ${voyage?.portName || "—"}</div>
          </div>
        `);

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.set(vessel.id, marker);
      });
    };

    if (map.isStyleLoaded()) {
      addMarkers();
    } else {
      map.once("load", addMarkers);
    }
  }, [vessels, vesselVoyageMap, onVesselClick]);

  const visibleCount = vessels.filter((v) => {
    const voy = vesselVoyageMap.get(v.id);
    return voy?.portLat && voy?.portLng;
  }).length;

  return (
    <div className="space-y-3">
      {visibleCount < vessels.length && (
        <div className="flex items-center gap-2 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-xl px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
          <span className="text-base flex-shrink-0">⚠️</span>
          <span>
            <strong>{vessels.length - visibleCount}</strong> vessel(s) cannot be shown on map — no voyage assigned or no port coordinates available.
            <strong> {visibleCount}</strong> vessel(s) shown.
          </span>
        </div>
      )}
      {visibleCount === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-muted/20 rounded-2xl border-2 border-dashed border-border">
          <MapIcon className="w-12 h-12 mb-3 opacity-20" />
          <p className="font-semibold">No vessels to show on map</p>
          <p className="text-sm mt-1">Assign voyages to vessels — the port location will appear on the map.</p>
        </div>
      )}
      <div
        ref={mapContainerRef}
        className="w-full rounded-2xl overflow-hidden border border-border"
        style={{ height: "600px", display: visibleCount === 0 ? "none" : "block" }}
        data-testid="fleet-map-container"
      />
    </div>
  );
}

// ─── Q88 Badge ───────────────────────────────────────────────────────────────

function VesselQ88Badge({ vesselId }: { vesselId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/vessels", vesselId, "q88"],
    queryFn: () => fetch(`/api/vessels/${vesselId}/q88`).then(r => r.ok ? r.json() : null),
    staleTime: 60000,
    retry: false,
  });
  if (isLoading) return null;
  if (!data) return (
    <Link to={`/vessel-q88/${vesselId}`} onClick={(e: any) => e.stopPropagation()}>
      <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-300 dark:border-slate-600 cursor-pointer hover:border-sky-400 hover:text-sky-500 transition-colors" data-testid={`badge-q88-none-${vesselId}`}>
        No Q88
      </Badge>
    </Link>
  );
  if (data.status === "complete" || data.status === "shared") return (
    <Link to={`/vessel-q88/${vesselId}`} onClick={(e: any) => e.stopPropagation()}>
      <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 cursor-pointer" data-testid={`badge-q88-complete-${vesselId}`}>
        Q88 ✓
      </Badge>
    </Link>
  );
  return (
    <Link to={`/vessel-q88/${vesselId}`} onClick={(e: any) => e.stopPropagation()}>
      <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800 cursor-pointer" data-testid={`badge-q88-draft-${vesselId}`}>
        Q88 Draft
      </Badge>
    </Link>
  );
}

// ─── Vessel Card ──────────────────────────────────────────────────────────────

const VESSEL_TYPE_ICON: Record<string, typeof Ship> = {
  "Bulk Carrier": Anchor,
  "Container Ship": Box,
  "General Cargo": Ship,
  "Tanker": Fuel,
  "Chemical Tanker": Fuel,
  "Ro-Ro": Truck,
  "Passenger": Users2,
  "LPG Carrier": Flame,
  "LNG Carrier": Flame,
  "Reefer": Snowflake,
};

function VesselCard({ vessel, voyage, certWarning, onSelect, onEdit, onDelete, fleets, onAddToFleet, onRemoveFromFleet }: {
  vessel: Vessel;
  voyage: any;
  certWarning?: "expired" | "expiring_soon" | null;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  fleets: FleetItem[];
  onAddToFleet: (fleetId: number) => void;
  onRemoveFromFleet: (fleetId: number) => void;
}) {
  const cfg = getCfg(vessel.fleetStatus);
  const progress = getProgress(voyage);
  const flag = FLAG_EMOJI[vessel.flag || ""] || "🏳️";
  const TypeIcon = VESSEL_TYPE_ICON[vessel.vesselType || ""] || Ship;
  const isActive = cfg.group !== "idle";

  const locationLine = (() => {
    if (!voyage) return null;
    const grp = cfg.group;
    if (grp === "underway" && voyage.portName) return `Underway to ${voyage.portName}`;
    if (voyage.portName) return voyage.portName;
    return null;
  })();

  const cardShadow = isActive
    ? `0 0 0 1px ${cfg.bar}30, 0 4px 20px ${cfg.bar}15`
    : "0 1px 4px rgba(0,0,0,0.08)";

  return (
    <TooltipProvider delayDuration={200}>
    <div
      className="group relative bg-card rounded-2xl border border-border/60 hover:border-[hsl(var(--maritime-primary)/0.5)] transition-all duration-200 cursor-pointer overflow-hidden"
      style={{ boxShadow: cardShadow }}
      onClick={onSelect}
      data-testid={`card-vessel-${vessel.id}`}
    >
      {/* Top status bar */}
      <div className="h-1" style={{ background: cfg.bar }} />

      {/* Certificate warning badge */}
      {certWarning && (
        <div className="absolute top-2.5 right-2.5 z-10" data-testid={`badge-cert-warning-${vessel.id}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                certWarning === "expired"
                  ? "bg-red-500/15 text-red-400 border border-red-500/30"
                  : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
              }`}>
                <AlertTriangle className="w-3 h-3" />
                {certWarning === "expired" ? "!" : "⏳"}
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              {certWarning === "expired" ? "Süresi dolmuş sertifika var" : "30 gün içinde dolacak sertifika var"}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      <div className="p-4">
        {/* Header row: type icon + flag + name + status badge */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 select-none relative"
            style={{ background: `${cfg.bar}18` }}
          >
            <TypeIcon className="w-5 h-5" style={{ color: cfg.bar }} />
            <span className="absolute -bottom-0.5 -right-0.5 text-[11px] leading-none select-none">{flag}</span>
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="font-bold text-sm leading-tight truncate" data-testid={`text-vessel-name-${vessel.id}`}>
              {vessel.name}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{vessel.vesselType || "—"}</p>
          </div>
          <div className="flex-shrink-0 pt-0.5" onClick={e => e.stopPropagation()}>
            <FleetStatusSelector vessel={vessel} />
          </div>
        </div>

        {/* Location line */}
        <div className="flex items-center gap-1.5 mb-3 min-h-[16px]">
          {locationLine ? (
            <>
              <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate">{locationLine}</span>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground/40">—</span>
          )}
        </div>

        {/* Progress bar — only if voyage has dates */}
        {voyage && (voyage.eta || voyage.etd) && (
          <div className="mb-3">
            <div className="h-1 bg-muted/50 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: cfg.bar }} />
            </div>
            <div className="flex justify-between mt-1">
              {voyage.etd && <span className="text-[10px] text-muted-foreground">ETD {fmtDate(voyage.etd)}</span>}
              {voyage.eta && <span className="text-[10px] text-muted-foreground ml-auto">ETA {fmtDate(voyage.eta)}</span>}
            </div>
          </div>
        )}

        {/* Stats: GRT | DWT | IMO */}
        <div className="grid grid-cols-3 divide-x divide-border/50 pt-2.5 border-t border-border/50">
          {[
            { label: "GRT", value: vessel.grt ? vessel.grt.toLocaleString() : "—" },
            { label: "DWT", value: vessel.dwt ? vessel.dwt.toLocaleString() : "—" },
            { label: "IMO", value: vessel.imoNumber || "—" },
          ].map(s => (
            <div key={s.label} className="text-center px-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{s.label}</p>
              <p className="text-xs font-semibold mt-0.5 truncate">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Hover quick actions overlay — icon-only with tooltips */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 pb-3 pt-8 bg-gradient-to-t from-background/95 via-background/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none group-hover:pointer-events-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={e => { e.stopPropagation(); onSelect(); }}
              className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors shadow-md"
              data-testid={`button-view-vessel-${vessel.id}`}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">View</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={e => { e.stopPropagation(); onEdit(); }}
              className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors shadow-md"
              data-testid={`button-edit-vessel-${vessel.id}`}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Edit</TooltipContent>
        </Tooltip>
        {vessel.imoNumber && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/vessel-report/${vessel.imoNumber}`}
                onClick={e => e.stopPropagation()}
                className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors shadow-md cursor-pointer"
                data-testid={`button-track-vessel-${vessel.id}`}
              >
                <Navigation2 className="w-3.5 h-3.5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Track</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/pms"
              onClick={e => e.stopPropagation()}
              className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors shadow-md cursor-pointer"
              data-testid={`button-pms-vessel-${vessel.id}`}
            >
              <Wrench className="w-3.5 h-3.5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">PMS</TooltipContent>
        </Tooltip>
        {fleets.length > 0 && (
          <div onClick={e => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors shadow-md" data-testid={`button-fleet-vessel-${vessel.id}`}>
                  <Layers className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[150px]">
                {fleets.map(f => {
                  const inFleet = f.vessel_ids.includes(vessel.id);
                  return (
                    <DropdownMenuItem key={f.id} onClick={() => inFleet ? onRemoveFromFleet(f.id) : onAddToFleet(f.id)} className="gap-2 text-xs" data-testid={`fleet-option-${f.id}-vessel-${vessel.id}`}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: f.color }} />
                      <span className="flex-1 truncate">{f.name}</span>
                      {inFleet && <span className="text-emerald-500 text-[10px]">✓</span>}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type FilterGroup = "all" | "underway" | "anchored" | "port" | "idle";

const FILTER_TABS: { key: FilterGroup; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "underway", label: "Underway" },
  { key: "anchored", label: "At Anchor" },
  { key: "port",     label: "At Port" },
  { key: "idle",     label: "Unspecified" },
];

// ── Certificate helpers ───────────────────────────────────────────────────────
const VESSEL_CERT_TYPES = [
  { key: "ship_registry",       label: "Ship Registry Certificate" },
  { key: "load_line",           label: "Load Line Certificate" },
  { key: "tonnage_1969",        label: "International Tonnage Certificate (1969)" },
  { key: "safe_manning",        label: "Minimum Safe Manning Certificate" },
  { key: "safety_equipment",    label: "Safety Equipment Certificate & Form E" },
  { key: "safety_construction", label: "Safety Construction Certificate" },
  { key: "safety_radio",        label: "Safety Radio Certificate" },
  { key: "oil_pollution",       label: "Oil Pollution Prevention Certificate" },
  { key: "sewage_pollution",    label: "Sewage Pollution Prevention Certificate" },
  { key: "csr",                 label: "Continuous Synopsis Record (CSR)" },
  { key: "safety_management",   label: "Safety Management Certificate (ISM)" },
  { key: "ship_security",       label: "Ship Security Certificate (ISPS)" },
  { key: "clc_bunker",          label: "CLC 92 & Bunker 2001 Certificate" },
  { key: "pni",                 label: "P&I Certificate" },
  { key: "class_cert",          label: "Class Certificate" },
  { key: "sanitation",          label: "Ship Sanitation Exemption Certificate" },
  { key: "ballast",             label: "Ballast Water Management Certificate" },
  { key: "bimco_shipman",       label: "BIMCO SHIPMAN 2009" },
] as const;

const CERT_TYPES: Record<string, string> = Object.fromEntries(VESSEL_CERT_TYPES.map(c => [c.key, c.label]));

const defaultCertForm = {
  name: "", certType: "ship_registry", issuedAt: "", expiresAt: "",
  issuingAuthority: "", certificateNumber: "", notes: "",
};

function certStatusFromExpiry(expiresAt: string | null): "valid" | "expiring_soon" | "expired" | "no_date" {
  if (!expiresAt) return "no_date";
  const exp = new Date(expiresAt);
  const now = new Date();
  if (exp < now) return "expired";
  const soon = new Date();
  soon.setDate(soon.getDate() + 60);
  if (exp < soon) return "expiring_soon";
  return "valid";
}

function certStatusBadge(status: string, expiresAt: string | null) {
  const computed = certStatusFromExpiry(expiresAt);
  if (computed === "expired" || status === "expired")
    return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 gap-1 text-[10px]"><AlertTriangle className="w-3 h-3" />Expired</Badge>;
  if (computed === "expiring_soon" || status === "expiring_soon")
    return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 gap-1 text-[10px]"><Clock className="w-3 h-3" />Expiring Soon</Badge>;
  if (computed === "no_date")
    return <Badge className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 gap-1 text-[10px]"><Clock className="w-3 h-3" />No Expiry Set</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 gap-1 text-[10px]"><CheckCircle2 className="w-3 h-3" />Valid</Badge>;
}

export default function Vessels() {
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid");
  const [sortBy, setSortBy] = useState<"name" | "status" | "dwt" | "updated">("name");
  const [showForm, setShowForm] = useState(false);
  const [editingVessel, setEditingVessel] = useState<Vessel | null>(null);
  const [deleteVesselId, setDeleteVesselId] = useState<number | null>(null);
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [detailTab, setDetailTab] = useState<"general" | "voyage" | "technical" | "certificates" | "crew" | "datalastic">("general");
  const [statusFilter, setStatusFilter] = useState<FilterGroup>("all");
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  // Certificate state
  const [certDialogOpen, setCertDialogOpen] = useState(false);
  const [editCert, setEditCert] = useState<any>(null);
  const [certDeleteTarget, setCertDeleteTarget] = useState<{ id: number; vesselId: number } | null>(null);
  const [certForm, setCertForm] = useState({ ...defaultCertForm });
  const [certUploading, setCertUploading] = useState<string | null>(null);
  const [certDragOver, setCertDragOver] = useState<string | null>(null);
  const [certUploadTarget, setCertUploadTarget] = useState<{ key: string; label: string; vesselId: number } | null>(null);
  const certFileInputRef = useRef<HTMLInputElement>(null);
  const [certDownloadingAll, setCertDownloadingAll] = useState(false);

  // Crew state
  const defaultCrewForm = { firstName: "", lastName: "", rank: "", nationality: "", contractEndDate: "", passportNumber: "", passportExpiry: "", seamansBookNumber: "", seamansBookExpiry: "", medicalFitnessExpiry: "", status: "on_board" };
  const [crewDialogOpen, setCrewDialogOpen] = useState(false);
  const [editCrewMember, setEditCrewMember] = useState<any>(null);
  const [crewDeleteTarget, setCrewDeleteTarget] = useState<{ id: number; vesselId: number } | null>(null);
  const [crewForm, setCrewForm] = useState({ ...defaultCrewForm });
  const [crewFileUploading, setCrewFileUploading] = useState<{ id: number; field: "passport" | "seamansBook" | "medicalFitness" } | null>(null);
  const [location] = useLocation();

  useEffect(() => {
    if (location.includes("new=true")) setShowForm(true);
  }, [location]);

  const [fleetFilter, setFleetFilter] = useState<number | null>(null);
  const [showFleetDialog, setShowFleetDialog] = useState(false);
  const [editingFleet, setEditingFleet] = useState<FleetItem | null>(null);
  const [fleetForm, setFleetForm] = useState({ name: "", description: "", color: "#2563EB" });

  const { data: vessels = [], isLoading } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"], refetchInterval: 60000 });
  const { data: voyages = [] } = useQuery<any[]>({ queryKey: ["/api/voyages"] });
  const { data: fleets = [] } = useQuery<FleetItem[]>({ queryKey: ["/api/fleets"] });

  const vesselVoyageMap = useMemo(() => {
    const map = new Map<number, any>();
    const priority: Record<string, number> = { active: 3, planned: 2, completed: 1, cancelled: 0 };
    (voyages as any[]).forEach((v) => {
      if (v.vesselId) {
        const existing = map.get(v.vesselId);
        if (!existing || (priority[v.status] ?? 0) > (priority[existing.status] ?? 0)) {
          map.set(v.vesselId, v);
        }
      }
    });
    return map;
  }, [voyages]);

  const { data: expiringCertsData = [] } = useQuery<{ vesselId: number; expiresAt: string | null }[]>({
    queryKey: ["/api/certificates/expiring", 30],
    queryFn: async () => {
      const res = await fetch("/api/certificates/expiring?days=30&includeExpired=1");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 120_000,
  });

  const certWarningMap = useMemo(() => {
    const m = new Map<number, "expired" | "expiring_soon">();
    const now = new Date();
    for (const c of expiringCertsData) {
      if (!c.vesselId || !c.expiresAt) continue;
      const exp = new Date(c.expiresAt);
      const level = exp < now ? "expired" : "expiring_soon";
      const existing = m.get(c.vesselId);
      if (!existing || level === "expired") m.set(c.vesselId, level);
    }
    return m;
  }, [expiringCertsData]);

  const selectedVesselFresh = useMemo(
    () => vessels.find((v) => v.id === selectedVessel?.id) ?? null,
    [vessels, selectedVessel?.id],
  );

  const selectedVoyage = selectedVesselFresh ? vesselVoyageMap.get(selectedVesselFresh.id) ?? null : null;

  // Certificate query — only loads when the certificate tab is open
  const { data: vesselCerts = [], isLoading: certsLoading } = useQuery<any[]>({
    queryKey: ["/api/vessels", selectedVessel?.id, "certificates"],
    queryFn: async () => {
      const res = await fetch(`/api/vessels/${selectedVessel!.id}/certificates`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedVessel && detailTab === "certificates",
  });

  // PMS summary — loads for flyout general tab
  const { data: pmsDashboard } = useQuery<any>({
    queryKey: ["/api/vessels", selectedVessel?.id, "pms-dashboard"],
    queryFn: async () => {
      const res = await fetch(`/api/vessels/${selectedVessel!.id}/pms-dashboard`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedVessel && detailTab === "general",
  });

  const certSaveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...certForm,
        issuedAt: certForm.issuedAt || null,
        expiresAt: certForm.expiresAt || null,
        issuingAuthority: certForm.issuingAuthority || null,
        certificateNumber: certForm.certificateNumber || null,
        notes: certForm.notes || null,
      };
      if (editCert?.id) {
        return apiRequest("PATCH", `/api/vessels/${editCert.vesselId}/certificates/${editCert.id}`, payload);
      }
      return apiRequest("POST", `/api/vessels/${editCert.vesselId}/certificates`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels", selectedVessel?.id, "certificates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/expiring"] });
      toast({ title: editCert?.id ? "Certificate updated" : "Certificate added" });
      setCertDialogOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Operation failed", variant: "destructive" }),
  });

  const certDeleteMutation = useMutation({
    mutationFn: async ({ id, vesselId }: { id: number; vesselId: number }) =>
      apiRequest("DELETE", `/api/vessels/${vesselId}/certificates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels", selectedVessel?.id, "certificates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/expiring"] });
      toast({ title: "Certificate deleted" });
      setCertDeleteTarget(null);
    },
  });

  // ── Certificate file handlers ─────────────────────────────────────────────
  const handleCertFileSelect = async (certTypeKey: string, certLabel: string, file: File, vesselId: number) => {
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "PDF only", description: "Please upload a PDF file", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10 MB", variant: "destructive" });
      return;
    }
    setCertUploading(certTypeKey);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/files/upload?folder=certificates", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url: fileUrl, fileSize } = await uploadRes.json();
      const existingCert = vesselCerts.find((c: any) => c.certType === certTypeKey);
      if (existingCert?.id) {
        await apiRequest("PATCH", `/api/vessels/${vesselId}/certificates/${existingCert.id}`, { fileUrl, fileName: file.name, fileSize });
      } else {
        await apiRequest("POST", `/api/vessels/${vesselId}/certificates`, {
          name: certLabel, certType: certTypeKey, fileUrl, fileName: file.name, fileSize,
          issuedAt: null, expiresAt: null, issuingAuthority: null, certificateNumber: null, notes: null,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/vessels", selectedVessel?.id, "certificates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/expiring"] });
      toast({ title: "PDF uploaded", description: `${certLabel} saved successfully` });
    } catch {
      toast({ title: "Upload failed", description: "Please try again", variant: "destructive" });
    } finally {
      setCertUploading(null);
    }
  };

  const handleCertDownload = (cert: any) => {
    const href = cert.fileUrl || cert.fileBase64;
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    a.download = cert.fileName || `${cert.name}.pdf`;
    a.click();
  };

  const handleCertPreview = (cert: any) => {
    const href = cert.fileUrl || cert.fileBase64;
    if (!href) return;
    window.open(href, "_blank");
  };

  const handleCertRemoveFile = async (cert: any, vesselId: number) => {
    try {
      await apiRequest("PATCH", `/api/vessels/${vesselId}/certificates/${cert.id}`, { fileBase64: null, fileUrl: null, fileName: null });
      queryClient.invalidateQueries({ queryKey: ["/api/vessels", selectedVessel?.id, "certificates"] });
      toast({ title: "File removed" });
    } catch {
      toast({ title: "Error", description: "Failed to remove file", variant: "destructive" });
    }
  };

  const handleDownloadAllCerts = async (vesselName: string) => {
    const uploadedCerts = VESSEL_CERT_TYPES
      .map(({ key, label }) => ({ key, label, cert: vesselCerts.find((c: any) => c.certType === key && (c.fileBase64 || c.fileUrl)) }))
      .filter(({ cert }) => !!cert);

    if (uploadedCerts.length === 0) return;

    setCertDownloadingAll(true);
    try {
      const zip = new JSZip();
      for (const { label, cert } of uploadedCerts) {
        const fileName = cert.fileName || `${label}.pdf`;
        if (cert.fileUrl) {
          const response = await fetch(cert.fileUrl);
          const arrayBuffer = await response.arrayBuffer();
          zip.file(fileName, arrayBuffer);
        } else if (cert.fileBase64) {
          const base64Data = cert.fileBase64.includes(",") ? cert.fileBase64.split(",")[1] : cert.fileBase64;
          zip.file(fileName, base64Data, { base64: true });
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const date = new Date().toISOString().slice(0, 10);
      const safeName = vesselName.replace(/[^a-z0-9]/gi, "_");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}_certificates_${date}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: `${uploadedCerts.length} certificate(s) bundled into ZIP` });
    } catch {
      toast({ title: "Download failed", description: "Could not create ZIP file", variant: "destructive" });
    } finally {
      setCertDownloadingAll(false);
    }
  };

  const handleCrewFileRemove = async (member: any, field: "passport" | "seamansBook" | "medicalFitness") => {
    const payload = field === "passport"
      ? { passportFileBase64: null, passportFileName: null }
      : field === "seamansBook"
      ? { seamansBookFileBase64: null, seamansBookFileName: null }
      : { medicalFitnessFileBase64: null, medicalFitnessFileName: null };
    await apiRequest("PATCH", `/api/vessels/${member.vesselId}/crew/${member.id}`, payload);
    queryClient.invalidateQueries({ queryKey: ["/api/vessels", member.vesselId, "crew"] });
    toast({ title: "File removed" });
  };

  // Crew query and mutations
  const { data: vesselCrewList = [], isLoading: crewLoading } = useQuery<any[]>({
    queryKey: ["/api/vessels", selectedVessel?.id, "crew"],
    queryFn: async () => {
      const res = await fetch(`/api/vessels/${selectedVessel!.id}/crew`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedVessel && detailTab === "crew",
  });

  const crewSaveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...crewForm,
        contractEndDate: crewForm.contractEndDate || null,
        passportExpiry: crewForm.passportExpiry || null,
        seamansBookExpiry: crewForm.seamansBookExpiry || null,
        passportNumber: crewForm.passportNumber || null,
        seamansBookNumber: crewForm.seamansBookNumber || null,
        rank: crewForm.rank || null,
        nationality: crewForm.nationality || null,
        medicalFitnessExpiry: (crewForm as any).medicalFitnessExpiry || null,
        status: (crewForm as any).status || "on_board",
      };
      if (editCrewMember?.id) {
        return apiRequest("PATCH", `/api/vessels/${editCrewMember.vesselId}/crew/${editCrewMember.id}`, payload);
      }
      return apiRequest("POST", `/api/vessels/${editCrewMember.vesselId}/crew`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels", selectedVessel?.id, "crew"] });
      toast({ title: editCrewMember?.id ? "Crew member updated" : "Crew member added" });
      setCrewDialogOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Operation failed", variant: "destructive" }),
  });

  const crewDeleteMutation = useMutation({
    mutationFn: async ({ id, vesselId }: { id: number; vesselId: number }) =>
      apiRequest("DELETE", `/api/vessels/${vesselId}/crew/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels", selectedVessel?.id, "crew"] });
      toast({ title: "Crew member deleted" });
      setCrewDeleteTarget(null);
    },
  });

  const syncStatusMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/vessels/sync-statuses"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels"] });
      toast({ title: "Statüler güncellendi", description: data?.updated > 0 ? `${data.updated} gemi güncellendi` : "Değişiklik yok" });
    },
    onError: () => toast({ title: "Hata", description: "Senkronizasyon başarısız", variant: "destructive" }),
  });

  const activeFleet = fleetFilter !== null ? fleets.find(f => f.id === fleetFilter) ?? null : null;

  const filtered = useMemo(() => vessels.filter((v) => {
    if (search.trim() && !v.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (fleetFilter !== null) {
      const fleet = fleets.find(f => f.id === fleetFilter);
      if (!fleet || !fleet.vessel_ids.includes(v.id)) return false;
    }
    if (statusFilter === "all") return true;
    return getCfg(v.fleetStatus).group === statusFilter;
  }), [vessels, statusFilter, search, fleetFilter, fleets]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === "name") arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "status") arr.sort((a, b) => (a.fleetStatus || "").localeCompare(b.fleetStatus || ""));
    else if (sortBy === "dwt") arr.sort((a, b) => (b.dwt || 0) - (a.dwt || 0));
    return arr;
  }, [filtered, sortBy]);

  const stats = useMemo(() => ({
    total:    vessels.length,
    underway: vessels.filter(v => getCfg(v.fleetStatus).group === "underway").length,
    anchored: vessels.filter(v => getCfg(v.fleetStatus).group === "anchored").length,
    port:     vessels.filter(v => getCfg(v.fleetStatus).group === "port").length,
    idle:     vessels.filter(v => getCfg(v.fleetStatus).group === "idle").length,
  }), [vessels]);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/vessels", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels"] });
      setShowForm(false);
      toast({ title: "Vessel added" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) { setTimeout(() => { window.location.href = "/login"; }, 500); return; }
      toast({ title: "Failed to add vessel", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/vessels/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels"] });
      setEditingVessel(null);
      toast({ title: "Vessel updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/vessels/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels"] });
      toast({ title: "Vessel deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    },
  });

  const createFleetMutation = useMutation({
    mutationFn: async (body: { name: string; description: string; color: string }) =>
      (await apiRequest("POST", "/api/fleets", body)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleets"] });
      toast({ title: "Fleet created" });
      setShowFleetDialog(false);
    },
    onError: () => toast({ title: "Failed to create fleet", variant: "destructive" }),
  });

  const updateFleetMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: { name: string; description: string; color: string } }) =>
      (await apiRequest("PUT", `/api/fleets/${id}`, body)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleets"] });
      toast({ title: "Fleet updated" });
      setShowFleetDialog(false);
      setEditingFleet(null);
    },
    onError: () => toast({ title: "Failed to update fleet", variant: "destructive" }),
  });

  const deleteFleetMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/fleets/${id}`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleets"] });
      if (fleetFilter === id) setFleetFilter(null);
      toast({ title: "Fleet deleted" });
    },
    onError: () => toast({ title: "Failed to delete fleet", variant: "destructive" }),
  });

  const addToFleetMutation = useMutation({
    mutationFn: async ({ fleetId, vesselId }: { fleetId: number; vesselId: number }) =>
      apiRequest("POST", `/api/fleets/${fleetId}/vessels`, { vesselId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/fleets"] }),
    onError: () => toast({ title: "Failed to add vessel to fleet", variant: "destructive" }),
  });

  const removeFromFleetMutation = useMutation({
    mutationFn: async ({ fleetId, vesselId }: { fleetId: number; vesselId: number }) =>
      apiRequest("DELETE", `/api/fleets/${fleetId}/vessels/${vesselId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/fleets"] }),
    onError: () => toast({ title: "Failed to remove vessel from fleet", variant: "destructive" }),
  });

  const handleSave = (data: Record<string, unknown>) => {
    if (editingVessel) updateMutation.mutate({ id: editingVessel.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div className="px-4 py-5 space-y-5 max-w-7xl mx-auto">
      <PageMeta title="Fleet | VesselPDA" description="Manage and track your fleet vessels." />

      <PageBreadcrumb items={[{ label: "Fleet" }]} className="mb-1" />

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-bold text-xl tracking-tight" data-testid="text-vessels-title">Fleet</h1>
        <div className="flex items-center gap-2">
          {/* View toggle: Grid / List / Map */}
          <div className="flex items-center bg-muted/50 p-0.5 rounded-lg border border-border gap-0.5">
            {([
              { mode: "grid" as const, icon: Grid3X3, label: "Grid", testId: "toggle-grid-view" },
              { mode: "list" as const, icon: List,    label: "List", testId: "toggle-list-view" },
              { mode: "map"  as const, icon: MapIcon, label: "Map",  testId: "toggle-map-view"  },
            ]).map(({ mode, icon: Icon, label, testId }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  viewMode === mode ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={testId}
                title={label}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => syncStatusMutation.mutate()}
            disabled={syncStatusMutation.isPending}
            className="gap-1.5 text-xs hidden sm:flex"
            data-testid="button-sync-vessel-statuses"
            title="Sync statuses from port calls"
          >
            {syncStatusMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sync
          </Button>
          <Button onClick={() => { setEditingVessel(null); setShowForm(true); }} className="gap-1.5" size="sm" data-testid="button-add-vessel">
            <Plus className="w-4 h-4" /> Add Vessel
          </Button>
        </div>
      </div>

      {/* ── KPI Bar ── */}
      {!isLoading && vessels.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {([
            { key: "all" as FilterGroup,      label: "Total",    value: stats.total,    color: "text-foreground",    bg: "bg-muted/40" },
            { key: "underway" as FilterGroup, label: "Underway", value: stats.underway, color: "text-blue-500",      bg: "bg-blue-500/8" },
            { key: "port" as FilterGroup,     label: "At Port",  value: stats.port,     color: "text-indigo-500",    bg: "bg-indigo-500/8" },
            { key: "anchored" as FilterGroup, label: "At Anchor",value: stats.anchored, color: "text-amber-500",     bg: "bg-amber-500/8" },
            { key: "idle" as FilterGroup,     label: "Idle",     value: stats.idle,     color: "text-muted-foreground", bg: "bg-muted/30" },
          ]).map(({ key, label, value, color, bg }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left ${bg} ${
                statusFilter === key ? "border-[hsl(var(--maritime-primary)/0.5)] ring-1 ring-[hsl(var(--maritime-primary)/0.2)]" : "border-border/50 hover:border-border"
              }`}
              data-testid={`kpi-${key}`}
            >
              <span className={`text-2xl font-black leading-none ${color}`}>{value}</span>
              <span className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Fleet Strip + Filter Bar (shared across list/grid) ── */}
      {viewMode !== "map" && (
        <>
          {/* Fleet Strip */}
          {(fleets.length > 0 || true) && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setFleetFilter(null)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 border transition-all ${
                  fleetFilter === null
                    ? "bg-[hsl(var(--maritime-primary))] text-white border-transparent"
                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-[hsl(var(--maritime-primary)/0.4)]"
                }`}
                data-testid="fleet-filter-all"
              >
                <Ship className="w-3 h-3" />
                All Vessels
                <span className="opacity-70">({vessels.length})</span>
              </button>
              {fleets.map((f) => (
                <div key={f.id} className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => setFleetFilter(fleetFilter === f.id ? null : f.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      fleetFilter === f.id
                        ? "text-white border-transparent"
                        : "bg-background border-border text-muted-foreground hover:text-foreground"
                    }`}
                    style={fleetFilter === f.id ? { background: f.color, borderColor: f.color } : {}}
                    data-testid={`fleet-filter-${f.id}`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: fleetFilter === f.id ? "white" : f.color }} />
                    {f.name}
                    <span className="opacity-70">({f.vessel_count})</span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors" data-testid={`fleet-menu-${f.id}`}>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => { setEditingFleet(f); setFleetForm({ name: f.name, description: f.description || "", color: f.color }); setShowFleetDialog(true); }} className="gap-2 text-xs">
                        <Edit2 className="w-3 h-3" /> Edit Fleet
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteFleetMutation.mutate(f.id)} className="gap-2 text-xs text-destructive focus:text-destructive">
                        <Trash2 className="w-3 h-3" /> Delete Fleet
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              <button
                onClick={() => { setEditingFleet(null); setFleetForm({ name: "", description: "", color: "#2563EB" }); setShowFleetDialog(true); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-[hsl(var(--maritime-primary)/0.4)] transition-all flex-shrink-0"
                data-testid="button-create-fleet"
              >
                <Plus className="w-3 h-3" /> New Fleet
              </button>
            </div>
          )}

          {/* Active fleet indicator */}
          {activeFleet && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: `${activeFleet.color}18`, border: `1px solid ${activeFleet.color}40` }}>
              <span className="w-2 h-2 rounded-full" style={{ background: activeFleet.color }} />
              <span className="font-medium" style={{ color: activeFleet.color }}>Filtered by fleet:</span>
              <span className="text-foreground font-semibold">{activeFleet.name}</span>
              <span className="text-muted-foreground">— {filtered.length} vessel{filtered.length !== 1 ? "s" : ""}</span>
              <button onClick={() => setFleetFilter(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Filter bar: status chips + search + sort */}
          {vessels.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              {/* Status chips */}
              <div className="flex gap-1 flex-wrap">
                {FILTER_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      statusFilter === key
                        ? "bg-foreground text-background border-foreground"
                        : "bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                    }`}
                    data-testid={`filter-${key}`}
                  >
                    {label}
                    {key !== "all" && (
                      <span className="ml-1 opacity-60">
                        {key === "underway" ? stats.underway : key === "port" ? stats.port : key === "anchored" ? stats.anchored : stats.idle}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 ml-auto flex-shrink-0">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search..." className="pl-8 h-8 text-sm w-36 sm:w-48"
                    data-testid="input-search-vessel"
                  />
                </div>
                {/* Sort */}
                <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="h-8 text-xs w-32" data-testid="select-sort-vessels">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name A–Z</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="dwt">DWT (High→Low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Vessels: Grid or List */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
            </div>
          ) : sorted.length > 0 ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {sorted.map((vessel) => (
                  <VesselCard
                    key={vessel.id}
                    vessel={vessel}
                    voyage={vesselVoyageMap.get(vessel.id) ?? null}
                    certWarning={certWarningMap.get(vessel.id) ?? null}
                    onSelect={() => { setSelectedVessel(vessel); setDetailTab("general"); }}
                    onEdit={() => setEditingVessel(vessel)}
                    onDelete={() => setDeleteVesselId(vessel.id)}
                    fleets={fleets}
                    onAddToFleet={(fleetId) => addToFleetMutation.mutate({ fleetId, vesselId: vessel.id })}
                    onRemoveFromFleet={(fleetId) => removeFromFleetMutation.mutate({ fleetId, vesselId: vessel.id })}
                  />
                ))}
              </div>
            ) : (
              /* List view: compact rows */
              <div className="space-y-1.5">
                {sorted.map((vessel) => {
                  const voy = vesselVoyageMap.get(vessel.id) ?? null;
                  const cfg2 = getCfg(vessel.fleetStatus);
                  const flag2 = FLAG_EMOJI[vessel.flag || ""] || "🏳️";
                  return (
                    <div
                      key={vessel.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 bg-card hover:border-[hsl(var(--maritime-primary)/0.4)] hover:bg-muted/20 transition-all cursor-pointer group"
                      onClick={() => { setSelectedVessel(vessel); setDetailTab("general"); }}
                      data-testid={`row-vessel-${vessel.id}`}
                    >
                      <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: cfg2.bar }} />
                      <span className="text-base flex-shrink-0">{flag2}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{vessel.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{vessel.vesselType || "—"}</p>
                      </div>
                      <div className="hidden md:block flex-1 min-w-0 text-[11px] text-muted-foreground truncate">
                        {voy?.portName ? (
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3 flex-shrink-0" />{voy.portName}</span>
                        ) : <span>—</span>}
                      </div>
                      <div className="hidden lg:flex items-center gap-3 flex-shrink-0 text-[11px] text-muted-foreground">
                        <span>DWT {vessel.dwt ? vessel.dwt.toLocaleString() : "—"}</span>
                        <span>IMO {vessel.imoNumber || "—"}</span>
                      </div>
                      <div onClick={e => e.stopPropagation()}>
                        <FleetStatusSelector vessel={vessel} />
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            )
          ) : vessels.length === 0 ? (
            <EmptyState
              icon="🚢"
              title="No Vessels Added"
              description="Add your fleet vessels to quickly create proformas and track their positions."
              actionLabel="+ Add Vessel"
              onAction={() => setShowForm(true)}
              secondaryLabel="Search by IMO"
              tips={[
                "You can auto-fill vessel particulars using an IMO number.",
                "Assign vessels to voyages to track their position on the fleet map.",
                "Upload certificates to receive expiration alerts."
              ]}
            />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No results found</p>
              <button className="text-sm text-[hsl(var(--maritime-primary))] mt-2 hover:underline"
                onClick={() => { setSearch(""); setStatusFilter("all"); }}>
                Clear filters
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Map Mode ── */}
      {viewMode === "map" && !isLoading && (
        <FleetMap
          vessels={vessels}
          vesselVoyageMap={vesselVoyageMap}
          onVesselClick={(v) => { setSelectedVessel(v); setDetailTab("general"); }}
        />
      )}
      {viewMode === "map" && isLoading && (
        <Skeleton className="w-full h-[600px] rounded-2xl" />
      )}

      {/* ── Detail Flyout (right-side panel) ──────────────────────────── */}
      {selectedVessel && selectedVesselFresh && (() => {
          const v = selectedVesselFresh;
          const voy = selectedVoyage;
          const cfg = getCfg(v.fleetStatus);
          const flag = FLAG_EMOJI[v.flag || ""] || "🏳️";
          const progress = getProgress(voy);

          return (
            <div
              className="fixed top-14 right-0 bottom-0 w-full sm:w-[480px] bg-background z-40 flex flex-col overflow-hidden border-l shadow-2xl"
            >
              <div className="px-6 pt-5 pb-4 border-b flex-shrink-0">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => setSelectedVessel(null)}
                      className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors flex-shrink-0"
                      title="Go back"
                      data-testid="button-vessel-detail-back"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="w-10 h-10 bg-[hsl(var(--maritime-primary))] rounded-2xl flex items-center justify-center text-xl flex-shrink-0">🚢</div>
                    <div className="min-w-0">
                      <p className="font-black text-base leading-tight truncate">{flag} {v.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{v.vesselType || "—"} · {v.flag || "—"}</p>
                    </div>
                  </div>
                </div>
                  <div className="flex gap-1 bg-muted/40 p-1 rounded-xl flex-wrap">
                    {(["general", "voyage", "technical", "certificates", "crew", "datalastic"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setDetailTab(tab)}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all min-w-[56px] ${detailTab === tab ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"} ${tab === "datalastic" ? "text-blue-400" : ""}`}
                      >
                        {{ general: "General", voyage: "Voyage", technical: "Technical", certificates: "Certs", crew: "Crew", datalastic: "🛰 Live" }[tab]}
                      </button>
                    ))}
                  </div>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  {/* ── General (Overview) ── */}
                  {detailTab === "general" && (
                    <div className="space-y-4">
                      {/* Vessel key info */}
                      <div className="rounded-xl border bg-muted/20 p-3.5 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Vessel Particulars</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {[
                            { label: "IMO",       value: v.imoNumber || "—" },
                            { label: "Flag",      value: `${flag} ${v.flag || "—"}` },
                            { label: "DWT",       value: v.dwt ? v.dwt.toLocaleString() + " MT" : "—" },
                            { label: "GRT",       value: v.grt ? v.grt.toLocaleString() + " GT" : "—" },
                            { label: "Call Sign", value: v.callSign || "—" },
                            { label: "Built",     value: (v as any).yearBuilt ? String((v as any).yearBuilt) : "—" },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex items-center justify-between gap-1 text-xs">
                              <span className="text-muted-foreground">{label}</span>
                              <span className="font-medium truncate max-w-[50%] text-right">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Active Voyage */}
                      <div className="rounded-xl border bg-muted/20 p-3.5">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active Voyage</p>
                          {voy && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>{voy.status}</span>}
                        </div>
                        {voy ? (
                          <div className="space-y-1.5">
                            {[
                              { label: "Port",    value: voy.portName || "—" },
                              { label: "Purpose", value: voy.purposeOfCall || "—" },
                              { label: "ETA",     value: voy.eta ? fmtDate(voy.eta) : "—" },
                            ].map(({ label, value }) => (
                              <div key={label} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{label}</span>
                                <span className="font-medium">{value}</span>
                              </div>
                            ))}
                            {(voy.eta || voy.etd) && (
                              <div className="mt-2">
                                <div className="h-1 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${progress}%`, background: cfg.bar }} />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5 text-right">{Math.round(progress)}% complete</p>
                              </div>
                            )}
                            <Link href={`/voyages/${voy.id}`}>
                              <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1 mt-1">
                                Open Voyage <ChevronRight className="w-3 h-3" />
                              </Button>
                            </Link>
                          </div>
                        ) : (
                          <div className="text-center py-2">
                            <p className="text-xs text-muted-foreground">No active voyage</p>
                            <Link href="/voyages">
                              <Button size="sm" variant="ghost" className="h-7 text-xs mt-1 gap-1">
                                <Plus className="w-3 h-3" /> New Voyage
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>

                      {/* PMS Summary */}
                      {pmsDashboard && (
                        <div className="rounded-xl border bg-muted/20 p-3.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Maintenance</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: "Overdue", value: pmsDashboard.summary?.overdueJobs || 0, color: pmsDashboard.summary?.overdueJobs > 0 ? "text-rose-500" : "text-muted-foreground" },
                              { label: "Due Soon", value: pmsDashboard.summary?.dueSoonJobs || 0, color: pmsDashboard.summary?.dueSoonJobs > 0 ? "text-amber-500" : "text-muted-foreground" },
                              { label: "Open WO", value: pmsDashboard.summary?.openWorkOrders || 0, color: "text-muted-foreground" },
                            ].map(s => (
                              <div key={s.label} className="text-center">
                                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                              </div>
                            ))}
                          </div>
                          {(pmsDashboard.summary?.criticalDefects || 0) > 0 && (
                            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-500 bg-rose-500/10 rounded-lg px-2.5 py-1.5">
                              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                              {pmsDashboard.summary?.criticalDefects} critical defect{(pmsDashboard.summary?.criticalDefects || 0) > 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      )}

                      {/* View Full Detail */}
                      <div className="flex flex-col gap-2 pt-1">
                        {v.imoNumber && (
                          <Link href={`/vessel-report/${v.imoNumber}`}>
                            <Button className="w-full gap-2" data-testid="button-view-full-detail">
                              <Ship className="w-4 h-4" /> View Full Detail
                            </Button>
                          </Link>
                        )}
                        <div className="flex gap-2">
                          <Link href={`/vessel-q88/${v.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                              <FileSpreadsheet className="w-3.5 h-3.5" /> Q88
                            </Button>
                          </Link>
                          <Link href={`/vessel-vault/${v.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                              <FolderLock className="w-3.5 h-3.5" /> Vault
                            </Button>
                          </Link>
                          <button
                            onClick={() => setEditingVessel(v)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
                            data-testid="button-flyout-edit-vessel"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Sefer ── */}
                  {detailTab === "voyage" && (
                    <>
                      {voy ? (
                        <>
                          <div className="bg-muted/30 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.badge}`}>
                                {voy.status === "active" ? "Active Voyage" : "Planned"}
                              </span>
                              <span className="text-xs text-muted-foreground">{voy.purposeOfCall}</span>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">Departure</p>
                                  <p className="text-sm font-bold">{voy.portName || "—"}</p>
                                  {voy.etd && <p className="text-xs text-muted-foreground">{fmtDate(voy.etd)}</p>}
                                </div>
                                <div className="flex-1 mx-4 relative">
                                  <div className="h-0.5 bg-muted rounded-full" />
                                  <div className="h-0.5 rounded-full absolute top-0 left-0 transition-all"
                                    style={{ width: `${progress}%`, background: cfg.bar }} />
                                  <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">{Math.round(progress)}%</span>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">Arrival</p>
                                  <p className="text-sm font-bold">{voy.portName || "—"}</p>
                                  {voy.eta && <p className="text-xs text-muted-foreground">{fmtDate(voy.eta)}</p>}
                                </div>
                              </div>
                            </div>
                          </div>
                          <Link href={`/voyages/${voy.id}`}>
                            <Button variant="outline" className="w-full gap-2" size="sm">
                              View Voyage Details <ChevronRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        </>
                      ) : (
                        <div className="text-center py-10 text-muted-foreground">
                          <Anchor className="w-10 h-10 mx-auto mb-3 opacity-20" />
                          <p className="font-medium">No active voyage for this vessel</p>
                          <Link href="/voyages">
                            <Button size="sm" className="mt-4 gap-2"><Plus className="w-3.5 h-3.5" /> New Voyage</Button>
                          </Link>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Teknik ── */}
                  {detailTab === "technical" && (
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "IMO No",   value: v.imoNumber || "—" },
                        { label: "Call Sign", value: v.callSign || "—" },
                        { label: "Flag",     value: `${flag} ${v.flag || "—"}` },
                        { label: "Type",     value: v.vesselType || "—" },
                        { label: "GRT",      value: v.grt ? v.grt.toLocaleString("en-US") + " GT" : "—" },
                        { label: "NRT",      value: v.nrt ? v.nrt.toLocaleString("en-US") + " GT" : "—" },
                        { label: "DWT",      value: v.dwt ? v.dwt.toLocaleString("en-US") + " MT" : "—" },
                        { label: "LOA",      value: v.loa ? v.loa + " m" : "—" },
                        { label: "Beam",     value: v.beam ? v.beam + " m" : "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-muted/30 rounded-xl p-3">
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">{label}</p>
                          <p className="text-sm font-bold">{value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Sertifikalar ── */}
                  {detailTab === "certificates" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-primary" />
                          <span className="text-sm font-semibold">Vessel Certificates</span>
                          <Badge variant="outline" className="text-[10px]">
                            {vesselCerts.filter((c: any) => c.fileBase64 || c.fileUrl).length}/{VESSEL_CERT_TYPES.length} uploaded
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs h-7"
                          onClick={() => handleDownloadAllCerts(v.name || "vessel")}
                          disabled={certDownloadingAll || !vesselCerts.some((c: any) => c.fileBase64 || c.fileUrl)}
                          data-testid="button-download-all-certs"
                        >
                          {certDownloadingAll ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating ZIP...</>
                          ) : (
                            <><Download className="w-3.5 h-3.5" /> Download All</>
                          )}
                        </Button>
                      </div>

                      {/* Hidden shared file input */}
                      <input
                        ref={certFileInputRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file && certUploadTarget) {
                            handleCertFileSelect(certUploadTarget.key, certUploadTarget.label, file, certUploadTarget.vesselId);
                          }
                        }}
                      />

                      {certsLoading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2">
                          {VESSEL_CERT_TYPES.map(({ key, label }) => {
                            const cert = vesselCerts.find((c: any) => c.certType === key);
                            const isUploading = certUploading === key;
                            const isDragOver = certDragOver === key;
                            const hasFile = !!(cert?.fileBase64 || cert?.fileUrl);

                            return (
                              <div
                                key={key}
                                className={`rounded-xl border p-3 transition-colors ${isDragOver ? "border-primary bg-primary/5" : "bg-muted/10 hover:bg-muted/20"}`}
                                data-testid={`cert-card-${key}`}
                                onDragOver={e => { e.preventDefault(); setCertDragOver(key); }}
                                onDragLeave={() => setCertDragOver(null)}
                                onDrop={e => {
                                  e.preventDefault();
                                  setCertDragOver(null);
                                  const file = e.dataTransfer.files?.[0];
                                  if (file) handleCertFileSelect(key, label, file, v.id);
                                }}
                              >
                                {/* Card header */}
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold leading-tight truncate" title={label}>{label}</p>
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                      {certStatusBadge(cert?.status ?? "valid", cert?.expiresAt ?? null)}
                                      {cert?.expiresAt && (
                                        <span className="text-[10px] text-muted-foreground">
                                          Exp: {fmtDate(cert.expiresAt)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {/* Edit dates button */}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 shrink-0"
                                    title="Edit dates & details"
                                    onClick={() => {
                                      setEditCert(cert ? cert : { vesselId: v.id, id: null });
                                      setCertForm({
                                        name: cert?.name || label,
                                        certType: key,
                                        issuedAt: cert?.issuedAt ? cert.issuedAt.substring(0, 10) : "",
                                        expiresAt: cert?.expiresAt ? cert.expiresAt.substring(0, 10) : "",
                                        issuingAuthority: cert?.issuingAuthority || "",
                                        certificateNumber: cert?.certificateNumber || "",
                                        notes: cert?.notes || "",
                                      });
                                      setCertDialogOpen(true);
                                    }}
                                    data-testid={`button-edit-cert-${key}`}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                </div>

                                {/* File area */}
                                {hasFile ? (
                                  <div className="flex items-center gap-2 bg-background/60 rounded-lg px-2.5 py-1.5 border">
                                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <span className="text-[11px] truncate flex-1 text-muted-foreground" title={cert.fileName}>{cert.fileName || "certificate.pdf"}</span>
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <Button
                                        size="icon" variant="ghost" className="h-6 w-6"
                                        title="Preview" onClick={() => handleCertPreview(cert)}
                                        data-testid={`button-preview-cert-${key}`}
                                      >
                                        <Eye className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        size="icon" variant="ghost" className="h-6 w-6"
                                        title="Download" onClick={() => handleCertDownload(cert)}
                                        data-testid={`button-download-cert-${key}`}
                                      >
                                        <Download className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                        title="Remove file"
                                        onClick={() => handleCertRemoveFile(cert, v.id)}
                                        data-testid={`button-remove-cert-file-${key}`}
                                      >
                                        <X className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className={`w-full flex items-center justify-center gap-1.5 border border-dashed rounded-lg py-2 text-[11px] transition-colors ${isDragOver ? "border-primary text-primary" : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-primary/70"}`}
                                    onClick={() => {
                                      setCertUploadTarget({ key, label, vesselId: v.id });
                                      setTimeout(() => certFileInputRef.current?.click(), 50);
                                    }}
                                    disabled={isUploading}
                                    data-testid={`button-upload-cert-${key}`}
                                  >
                                    {isUploading ? (
                                      <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</>
                                    ) : (
                                      <><Upload className="w-3 h-3" /> Drop PDF or click to upload</>
                                    )}
                                  </button>
                                )}

                                {/* Replace file button when file exists */}
                                {hasFile && (
                                  <button
                                    type="button"
                                    className="w-full flex items-center justify-center gap-1.5 mt-1.5 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                                    onClick={() => {
                                      setCertUploadTarget({ key, label, vesselId: v.id });
                                      setTimeout(() => certFileInputRef.current?.click(), 50);
                                    }}
                                    disabled={isUploading}
                                    data-testid={`button-replace-cert-${key}`}
                                  >
                                    {isUploading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Upload className="w-2.5 h-2.5" />}
                                    Replace PDF
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Mürettebat ── */}
                  {detailTab === "crew" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-primary" />
                          <span className="text-sm font-semibold">Crew List</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => {
                            if (!vesselCrewList.length) return;
                            const fmtCSV = (v: any) => v ? String(v).replace(/,/g, ";") : "";
                            const fmt = (dt: any) => fmtDate(dt);
                            const header = "Name,Rank,Nationality,Status,Contract End,Passport No,Passport Exp,Seaman Book No,Book Exp,Medical Fitness Exp";
                            const rows = vesselCrewList.map((m: any) =>
                              [fmtCSV(`${m.firstName} ${m.lastName}`), fmtCSV(m.rank), fmtCSV(m.nationality), fmtCSV(m.status === "on_leave" ? "On Leave" : "On Board"), fmt(m.contractEndDate), fmtCSV(m.passportNumber), fmt(m.passportExpiry), fmtCSV(m.seamansBookNumber), fmt(m.seamansBookExpiry), fmt(m.medicalFitnessExpiry)].join(",")
                            );
                            const csv = [header, ...rows].join("\n");
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                            a.download = `crew_export_${v.name || "vessel"}_${new Date().toISOString().slice(0, 10)}.csv`;
                            a.click();
                          }}
                          data-testid="button-export-crew-docs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Export All Docs
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => {
                            setEditCrewMember({ vesselId: v.id, id: null });
                            setCrewForm({ ...defaultCrewForm } as any);
                            setCrewDialogOpen(true);
                          }}
                          data-testid="button-add-crew"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Crew Member
                        </Button>
                      </div>

                      {crewLoading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : vesselCrewList.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                          <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No crew members added yet</p>
                        </div>
                      ) : (() => {
                        const now = new Date();
                        const warn30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                        const dateStatus = (dt: string | null) => {
                          if (!dt) return null;
                          const d = new Date(dt);
                          if (d < now) return "expired";
                          if (d < warn30) return "warning";
                          return "ok";
                        };
                        const daysDiff = (dt: string) => Math.round((new Date(dt).getTime() - Date.now()) / 86400000);
                        const expCell = (dt: string | null, no?: string | null) => {
                          const s = dateStatus(dt);
                          if (!dt && !no) return <span className="text-muted-foreground/40">—</span>;
                          const dateStr = dt ? fmtDate(dt) : "—";
                          const noStr = no ? <span className="block text-[10px] text-muted-foreground/60">{no}</span> : null;
                          if (s === "expired") return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-red-600 dark:text-red-400 font-medium cursor-default">{dateStr}<span className="ml-1 text-[10px]">✕</span>{noStr}</span>
                              </TooltipTrigger>
                              <TooltipContent>Expired {Math.abs(daysDiff(dt!))} days ago</TooltipContent>
                            </Tooltip>
                          );
                          if (s === "warning") return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-amber-600 dark:text-amber-400 font-medium cursor-default">{dateStr}<span className="ml-1 text-[10px]">⚠</span>{noStr}</span>
                              </TooltipTrigger>
                              <TooltipContent>Expires in {daysDiff(dt!)} days</TooltipContent>
                            </Tooltip>
                          );
                          return <span className="text-foreground">{dateStr}{noStr}</span>;
                        };
                        return (
                          <TooltipProvider>
                          <div className="overflow-x-auto rounded-xl border">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-muted/40 border-b">
                                  {["#", "Name", "Rank", "Nationality", "Contract End", "Passport Exp", "Passport Doc", "Seaman's Book Exp", "Seaman's Book Doc", "Medical Fitness Exp", "Medical Fitness Doc", ""].map((h) => (
                                    <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {vesselCrewList.map((member: any, idx: number) => (
                                  <tr
                                    key={member.id}
                                    className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                                    data-testid={`crew-item-${member.id}`}
                                  >
                                    <td className="px-3 py-2.5 text-muted-foreground/60 font-mono">{idx + 1}</td>
                                    <td className="px-3 py-2.5 font-semibold whitespace-nowrap">
                                      {member.firstName} {member.lastName}
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                      {member.rank
                                        ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] font-semibold">{member.rank}</span>
                                        : <span className="text-muted-foreground/40">—</span>}
                                    </td>
                                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                                      {member.nationality || <span className="text-muted-foreground/40">—</span>}
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                      {expCell(member.contractEndDate, null)}
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                      {expCell(member.passportExpiry, member.passportNumber)}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      {crewFileUploading && crewFileUploading.id === member.id && crewFileUploading.field === "passport"
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                                        : member.passportFileBase64
                                          ? <div className="flex items-center gap-0.5">
                                              <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 dark:text-green-400" title={`Preview: ${member.passportFileName || "passport.pdf"}`}
                                                onClick={() => window.open(member.passportFileBase64, "_blank")}
                                                data-testid={`button-preview-passport-${member.id}`}>
                                                <Eye className="w-3 h-3" />
                                              </Button>
                                              <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 dark:text-green-400" title="Download"
                                                onClick={() => { const a = document.createElement("a"); a.href = member.passportFileBase64; a.download = member.passportFileName || "passport.pdf"; a.click(); }}
                                                data-testid={`button-download-passport-${member.id}`}>
                                                <Download className="w-3 h-3" />
                                              </Button>
                                              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground/60 hover:text-destructive" title="Remove file"
                                                onClick={() => handleCrewFileRemove({ ...member, vesselId: v.id }, "passport")}
                                                data-testid={`button-remove-passport-${member.id}`}>
                                                <X className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          : <label className="cursor-pointer inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/40 hover:text-primary hover:bg-accent transition-colors" title="Upload passport PDF" data-testid={`button-upload-passport-${member.id}`}>
                                              <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={async (e) => {
                                                const file = e.target.files?.[0]; if (!file) return;
                                                setCrewFileUploading({ id: member.id, field: "passport" });
                                                try {
                                                  const reader = new FileReader();
                                                  reader.onload = async () => {
                                                    await apiRequest("PATCH", `/api/vessels/${v.id}/crew/${member.id}`, { passportFileBase64: reader.result, passportFileName: file.name });
                                                    queryClient.invalidateQueries({ queryKey: ["/api/vessels", v.id, "crew"] });
                                                    toast({ title: "Passport uploaded" });
                                                    setCrewFileUploading(null);
                                                  };
                                                  reader.readAsDataURL(file);
                                                } catch { toast({ title: "Upload failed", variant: "destructive" }); setCrewFileUploading(null); }
                                                e.target.value = "";
                                              }} />
                                              <Upload className="w-3 h-3" />
                                            </label>
                                      }
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                      {expCell(member.seamansBookExpiry, member.seamansBookNumber)}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      {crewFileUploading && crewFileUploading.id === member.id && crewFileUploading.field === "seamansBook"
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                                        : member.seamansBookFileBase64
                                          ? <div className="flex items-center gap-0.5">
                                              <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 dark:text-green-400" title={`Preview: ${member.seamansBookFileName || "seamans_book.pdf"}`}
                                                onClick={() => window.open(member.seamansBookFileBase64, "_blank")}
                                                data-testid={`button-preview-seamansbook-${member.id}`}>
                                                <Eye className="w-3 h-3" />
                                              </Button>
                                              <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 dark:text-green-400" title="Download"
                                                onClick={() => { const a = document.createElement("a"); a.href = member.seamansBookFileBase64; a.download = member.seamansBookFileName || "seamans_book.pdf"; a.click(); }}
                                                data-testid={`button-download-seamansbook-${member.id}`}>
                                                <Download className="w-3 h-3" />
                                              </Button>
                                              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground/60 hover:text-destructive" title="Remove file"
                                                onClick={() => handleCrewFileRemove({ ...member, vesselId: v.id }, "seamansBook")}
                                                data-testid={`button-remove-seamansbook-${member.id}`}>
                                                <X className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          : <label className="cursor-pointer inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/40 hover:text-primary hover:bg-accent transition-colors" title="Upload seaman's book PDF" data-testid={`button-upload-seamansbook-${member.id}`}>
                                              <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={async (e) => {
                                                const file = e.target.files?.[0]; if (!file) return;
                                                setCrewFileUploading({ id: member.id, field: "seamansBook" });
                                                try {
                                                  const reader = new FileReader();
                                                  reader.onload = async () => {
                                                    await apiRequest("PATCH", `/api/vessels/${v.id}/crew/${member.id}`, { seamansBookFileBase64: reader.result, seamansBookFileName: file.name });
                                                    queryClient.invalidateQueries({ queryKey: ["/api/vessels", v.id, "crew"] });
                                                    toast({ title: "Seaman's Book uploaded" });
                                                    setCrewFileUploading(null);
                                                  };
                                                  reader.readAsDataURL(file);
                                                } catch { toast({ title: "Upload failed", variant: "destructive" }); setCrewFileUploading(null); }
                                                e.target.value = "";
                                              }} />
                                              <Upload className="w-3 h-3" />
                                            </label>
                                      }
                                    </td>
                                    <td className="px-3 py-2.5">
                                      {expCell(member.medicalFitnessExpiry, null)}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      {crewFileUploading && crewFileUploading.id === member.id && crewFileUploading.field === "medicalFitness"
                                        ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                        : (member.medicalFitnessFileBase64 || member.medicalFitnessFileUrl)
                                          ? <div className="flex items-center gap-0.5">
                                              <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 dark:text-green-400" title={`Preview: ${member.medicalFitnessFileName || "medical_fitness.pdf"}`}
                                                onClick={() => window.open(member.medicalFitnessFileBase64 || member.medicalFitnessFileUrl, "_blank")}
                                                data-testid={`button-preview-medicalfitness-${member.id}`}>
                                                <Eye className="w-3 h-3" />
                                              </Button>
                                              <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 dark:text-green-400" title="Download"
                                                onClick={() => { const a = document.createElement("a"); a.href = member.medicalFitnessFileBase64 || member.medicalFitnessFileUrl; a.download = member.medicalFitnessFileName || "medical_fitness.pdf"; a.click(); }}
                                                data-testid={`button-download-medicalfitness-${member.id}`}>
                                                <Download className="w-3 h-3" />
                                              </Button>
                                              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground/60 hover:text-destructive" title="Remove file"
                                                onClick={() => handleCrewFileRemove({ ...member, vesselId: v.id }, "medicalFitness")}
                                                data-testid={`button-remove-medicalfitness-${member.id}`}>
                                                <X className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          : <label className="cursor-pointer inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/40 hover:text-primary hover:bg-accent transition-colors" title="Upload medical fitness PDF" data-testid={`button-upload-medicalfitness-${member.id}`}>
                                              <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={async (e) => {
                                                const file = e.target.files?.[0]; if (!file) return;
                                                setCrewFileUploading({ id: member.id, field: "medicalFitness" });
                                                try {
                                                  const reader = new FileReader();
                                                  reader.onload = async () => {
                                                    await apiRequest("PATCH", `/api/vessels/${v.id}/crew/${member.id}`, { medicalFitnessFileBase64: reader.result, medicalFitnessFileName: file.name });
                                                    queryClient.invalidateQueries({ queryKey: ["/api/vessels", v.id, "crew"] });
                                                    toast({ title: "Medical Fitness doc uploaded" });
                                                    setCrewFileUploading(null);
                                                  };
                                                  reader.readAsDataURL(file);
                                                } catch { toast({ title: "Upload failed", variant: "destructive" }); setCrewFileUploading(null); }
                                                e.target.value = "";
                                              }} />
                                              <Upload className="w-3 h-3" />
                                            </label>
                                      }
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <div className="flex items-center gap-0.5">
                                        <Button
                                          size="icon" variant="ghost" className="h-6 w-6"
                                          onClick={() => {
                                            setEditCrewMember(member);
                                            setCrewForm({
                                              firstName: member.firstName || "",
                                              lastName: member.lastName || "",
                                              rank: member.rank || "",
                                              nationality: member.nationality || "",
                                              contractEndDate: member.contractEndDate ? member.contractEndDate.substring(0, 10) : "",
                                              passportNumber: member.passportNumber || "",
                                              passportExpiry: member.passportExpiry ? member.passportExpiry.substring(0, 10) : "",
                                              seamansBookNumber: member.seamansBookNumber || "",
                                              seamansBookExpiry: member.seamansBookExpiry ? member.seamansBookExpiry.substring(0, 10) : "",
                                              medicalFitnessExpiry: member.medicalFitnessExpiry ? member.medicalFitnessExpiry.substring(0, 10) : "",
                                              status: member.status || "on_board",
                                            } as any);
                                            setCrewDialogOpen(true);
                                          }}
                                          data-testid={`button-edit-crew-${member.id}`}
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive"
                                          onClick={() => setCrewDeleteTarget({ id: member.id, vesselId: v.id })}
                                          data-testid={`button-delete-crew-${member.id}`}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          </TooltipProvider>
                        );
                      })()}
                    </div>
                  )}
                </div>

                  {/* ── Datalastic Live Tab ── */}
                  {detailTab === "datalastic" && (
                    <DatalasticPanel vessel={v} />
                  )}

              {/* ── Sticky Footer Actions ── */}
              <div className="flex-shrink-0 border-t p-4 flex gap-2 bg-background">
                <Button size="sm" variant="outline" className="flex-1 gap-1.5 h-9"
                  onClick={() => { setSelectedVessel(null); setEditingVessel(v); }}
                  data-testid="button-vessel-action-edit">
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </Button>
                <Link href={`/proformas/new?vesselId=${v.id}`} className="flex-1">
                  <Button size="sm" variant="outline"
                    className="w-full gap-1.5 h-9 border-[hsl(var(--maritime-primary)/0.4)] text-[hsl(var(--maritime-primary))]"
                    data-testid="button-vessel-action-pda">
                    <FileText className="w-3.5 h-3.5" /> New PDA
                  </Button>
                </Link>
                <Link href={`/voyages?vesselId=${v.id}`} className="flex-1">
                  <Button size="sm" className="w-full gap-1.5 h-9"
                    data-testid="button-vessel-action-voyage">
                    <Plus className="w-3.5 h-3.5" /> New Voyage
                  </Button>
                </Link>
              </div>
            </div>
          );
        })()}

      {/* ── Add / Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showForm || !!editingVessel} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingVessel(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">{editingVessel ? "Edit Vessel" : "Add New Vessel"}</DialogTitle>
          </DialogHeader>
          <VesselForm
            key={editingVessel?.id ?? "new"}
            vessel={editingVessel}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingVessel(null); }}
            isSaving={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteVesselId} onOpenChange={(open) => { if (!open) setDeleteVesselId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vessel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this vessel? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-vessel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteVesselId) { deleteMutation.mutate(deleteVesselId); setDeleteVesselId(null); } }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-vessel"
            >
              {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Certificate Add/Edit Dialog ───────────────────────────────────── */}
      <Dialog open={certDialogOpen} onOpenChange={setCertDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              {CERT_TYPES[certForm.certType] || "Certificate Details"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Certificate No.</Label>
                <Input
                  value={certForm.certificateNumber}
                  onChange={e => setCertForm(f => ({ ...f, certificateNumber: e.target.value }))}
                  placeholder="optional"
                  data-testid="input-cert-number"
                />
              </div>
              <div>
                <Label>Issuing Authority</Label>
                <Input
                  value={certForm.issuingAuthority}
                  onChange={e => setCertForm(f => ({ ...f, issuingAuthority: e.target.value }))}
                  placeholder="e.g. DNV, Lloyd's..."
                  data-testid="input-cert-authority"
                />
              </div>
              <div>
                <Label>Issue Date</Label>
                <Input type="date" value={certForm.issuedAt} onChange={e => setCertForm(f => ({ ...f, issuedAt: e.target.value }))} data-testid="input-cert-issued" />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input type="date" value={certForm.expiresAt} onChange={e => setCertForm(f => ({ ...f, expiresAt: e.target.value }))} data-testid="input-cert-expires" />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={certForm.notes}
                  onChange={e => setCertForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="optional"
                  data-testid="textarea-cert-notes"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCertDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => certSaveMutation.mutate()}
              disabled={!certForm.name || certSaveMutation.isPending}
              data-testid="button-save-cert"
            >
              {certSaveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Certificate Delete Confirm ────────────────────────────────────── */}
      <AlertDialog open={!!certDeleteTarget} onOpenChange={open => { if (!open) setCertDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Certificate</AlertDialogTitle>
            <AlertDialogDescription>This certificate will be permanently deleted. Are you sure?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => certDeleteTarget && certDeleteMutation.mutate(certDeleteTarget)}
              data-testid="button-confirm-delete-cert"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Crew Add/Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={crewDialogOpen} onOpenChange={setCrewDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editCrewMember?.id ? "Edit Crew Member" : "Add Crew Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name *</Label>
                <Input
                  value={crewForm.firstName}
                  onChange={e => setCrewForm(f => ({ ...f, firstName: e.target.value }))}
                  placeholder="First name"
                  data-testid="input-crew-firstname"
                />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input
                  value={crewForm.lastName}
                  onChange={e => setCrewForm(f => ({ ...f, lastName: e.target.value }))}
                  placeholder="Last name"
                  data-testid="input-crew-lastname"
                />
              </div>
              <div>
                <Label>Rank / Position</Label>
                <Select value={crewForm.rank} onValueChange={v => setCrewForm(f => ({ ...f, rank: v }))}>
                  <SelectTrigger data-testid="select-crew-rank">
                    <SelectValue placeholder="Select rank..." />
                  </SelectTrigger>
                  <SelectContent>
                    {["Captain", "Chief Engineer", "Chief Officer", "2nd Officer", "3rd Officer", "Electrician", "2nd Engineer", "3rd Engineer", "4th Engineer", "Pumpman", "Bosun", "Carpenter", "A.B.", "O.S.", "Deck Hand", "Cook", "Steward"].map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nationality</Label>
                <Input
                  value={crewForm.nationality}
                  onChange={e => setCrewForm(f => ({ ...f, nationality: e.target.value }))}
                  placeholder="e.g. Turkish, Ukrainian..."
                  data-testid="input-crew-nationality"
                />
              </div>
              <div className="col-span-2">
                <Label>Contract End Date</Label>
                <Input
                  type="date"
                  value={crewForm.contractEndDate}
                  onChange={e => setCrewForm(f => ({ ...f, contractEndDate: e.target.value }))}
                  data-testid="input-crew-contract"
                />
              </div>
              <div>
                <Label>Passport No.</Label>
                <Input
                  value={crewForm.passportNumber}
                  onChange={e => setCrewForm(f => ({ ...f, passportNumber: e.target.value }))}
                  placeholder="optional"
                  data-testid="input-crew-passport-no"
                />
              </div>
              <div>
                <Label>Passport Expiry</Label>
                <Input
                  type="date"
                  value={crewForm.passportExpiry}
                  onChange={e => setCrewForm(f => ({ ...f, passportExpiry: e.target.value }))}
                  data-testid="input-crew-passport-expiry"
                />
              </div>
              <div>
                <Label>Seaman's Book No.</Label>
                <Input
                  value={crewForm.seamansBookNumber}
                  onChange={e => setCrewForm(f => ({ ...f, seamansBookNumber: e.target.value }))}
                  placeholder="optional"
                  data-testid="input-crew-seaman-no"
                />
              </div>
              <div>
                <Label>Book Expiry</Label>
                <Input
                  type="date"
                  value={crewForm.seamansBookExpiry}
                  onChange={e => setCrewForm(f => ({ ...f, seamansBookExpiry: e.target.value }))}
                  data-testid="input-crew-seaman-expiry"
                />
              </div>
              <div>
                <Label>Medical Fitness Expiry</Label>
                <Input
                  type="date"
                  value={(crewForm as any).medicalFitnessExpiry || ""}
                  onChange={e => setCrewForm(f => ({ ...f, medicalFitnessExpiry: e.target.value } as any))}
                  data-testid="input-crew-medical-expiry"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={(crewForm as any).status || "on_board"} onValueChange={v => setCrewForm(f => ({ ...f, status: v } as any))}>
                  <SelectTrigger data-testid="select-crew-status">
                    <SelectValue placeholder="Select status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_board">On Board</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCrewDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => crewSaveMutation.mutate()}
              disabled={!crewForm.firstName || !crewForm.lastName || crewSaveMutation.isPending}
              data-testid="button-save-crew"
            >
              {crewSaveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Crew Delete Confirm ───────────────────────────────────────────── */}
      <AlertDialog open={!!crewDeleteTarget} onOpenChange={open => { if (!open) setCrewDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Crew Member</AlertDialogTitle>
            <AlertDialogDescription>This crew member record will be permanently deleted. Are you sure?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => crewDeleteTarget && crewDeleteMutation.mutate(crewDeleteTarget)}
              data-testid="button-confirm-delete-crew"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Fleet Create / Edit Dialog ──────────────────────────────────── */}
      <Dialog open={showFleetDialog} onOpenChange={(open) => { if (!open) { setShowFleetDialog(false); setEditingFleet(null); } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              {editingFleet ? "Edit Fleet" : "Create New Fleet"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Fleet Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Tanker Fleet, Black Sea Fleet..."
                value={fleetForm.name}
                onChange={(e) => setFleetForm(f => ({ ...f, name: e.target.value }))}
                data-testid="input-fleet-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional description..."
                value={fleetForm.description}
                onChange={(e) => setFleetForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                data-testid="input-fleet-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {FLEET_COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFleetForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full transition-transform ${fleetForm.color === c ? "scale-125 ring-2 ring-offset-2 ring-foreground" : "hover:scale-110"}`}
                    style={{ background: c }}
                    data-testid={`fleet-color-${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowFleetDialog(false); setEditingFleet(null); }} data-testid="button-cancel-fleet">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!fleetForm.name.trim()) return;
                if (editingFleet) {
                  updateFleetMutation.mutate({ id: editingFleet.id, body: fleetForm });
                } else {
                  createFleetMutation.mutate(fleetForm);
                }
              }}
              disabled={!fleetForm.name.trim() || createFleetMutation.isPending || updateFleetMutation.isPending}
              data-testid="button-save-fleet"
            >
              {(createFleetMutation.isPending || updateFleetMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingFleet ? "Save Changes" : "Create Fleet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
