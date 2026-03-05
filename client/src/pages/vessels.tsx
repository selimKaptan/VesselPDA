import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import JSZip from "jszip";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  Ship, Plus, Trash2, Edit2, Search, Loader2,
  ArrowRight, Anchor, MapPin, Calendar,
  FileText, ChevronRight, Activity, ChevronDown,
  LayoutGrid, Map as MapIcon,
  ShieldCheck, Pencil, AlertTriangle, CheckCircle2, Clock,
  ChevronLeft, Download, Upload, Eye, X,
  Layers,
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
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

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

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
  callSign: string; grt: string; nrt: string; dwt: string; loa: string; beam: string;
};

const emptyForm = (): VesselFormData => ({
  name: "", flag: "", vesselType: "", imoNumber: "", callSign: "",
  grt: "", nrt: "", dwt: "", loa: "", beam: "",
});

const vesselToForm = (v: Vessel): VesselFormData => ({
  name: v.name || "", flag: v.flag || "", vesselType: v.vesselType || "",
  imoNumber: v.imoNumber || "", callSign: v.callSign || "",
  grt: v.grt != null ? String(v.grt) : "", nrt: v.nrt != null ? String(v.nrt) : "",
  dwt: v.dwt != null ? String(v.dwt) : "", loa: v.loa != null ? String(v.loa) : "",
  beam: v.beam != null ? String(v.beam) : "",
});

type LookupResult = {
  name: string; flag: string; vesselType: string; imoNumber: string;
  callSign: string; grt: number | null; nrt: number | null;
  dwt: number | null; loa: number | null; beam: number | null;
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

  const set = (field: keyof VesselFormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const lookupMutation = useMutation({
    mutationFn: async (imo: string) => {
      const res = await apiRequest("GET", `/api/vessels/lookup?imo=${encodeURIComponent(imo)}`);
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "Lookup failed"); }
      return res.json() as Promise<LookupResult>;
    },
    onSuccess: (data) => {
      setForm({
        name: data.name || form.name, flag: data.flag || form.flag,
        vesselType: data.vesselType || form.vesselType, imoNumber: data.imoNumber || form.imoNumber,
        callSign: data.callSign || form.callSign,
        grt: data.grt != null ? String(data.grt) : form.grt,
        nrt: data.nrt != null ? String(data.nrt) : form.nrt,
        dwt: data.dwt != null ? String(data.dwt) : form.dwt,
        loa: data.loa != null ? String(data.loa) : form.loa,
        beam: data.beam != null ? String(data.beam) : form.beam,
      });
      setLookupDone(true);
      toast({ title: "Vessel details auto-filled", description: `Found: ${data.name}` });
    },
    onError: (err: Error) => {
      toast({ title: "Lookup failed", description: err.message, variant: "destructive" });
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
      imoNumber: form.imoNumber || null, callSign: form.callSign || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
              title="Auto-fill from vessel registry"
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
          <Select value={form.flag} onValueChange={(v) => set("flag", v)} required>
            <SelectTrigger data-testid="select-flag"><SelectValue placeholder="Select flag" /></SelectTrigger>
            <SelectContent>
              {flags.map((f) => <SelectItem key={f} value={f}>{FLAG_EMOJI[f] || "🏳️"} {f}</SelectItem>)}
            </SelectContent>
          </Select>
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
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [35.0, 39.0],
      zoom: 5,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new mapboxgl.ScaleControl({ maxWidth: 80, unit: "nautical" }), "bottom-left");
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
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

function VesselCard({ vessel, voyage, onSelect, onEdit, onDelete, fleets, onAddToFleet, onRemoveFromFleet }: {
  vessel: Vessel;
  voyage: any;
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

  return (
    <div
      className="bg-card rounded-2xl border-2 border-border hover:border-[hsl(var(--maritime-primary)/0.4)] hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden"
      onClick={onSelect}
      data-testid={`card-vessel-${vessel.id}`}
    >
      <div className="h-1" style={{ background: cfg.bar }} />
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-[hsl(var(--maritime-primary)/0.1)] rounded-xl flex items-center justify-center text-xl flex-shrink-0">🚢</div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm leading-tight truncate" data-testid={`text-vessel-name-${vessel.id}`}>
                {flag} {vessel.name}
              </h3>
              <p className="text-xs text-muted-foreground">{vessel.vesselType || "—"}</p>
            </div>
          </div>
          <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <FleetStatusSelector vessel={vessel} />
          </div>
        </div>

        {/* Port */}
        <div className="bg-muted/40 rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-xs font-medium truncate">{voyage?.portName || "Konum bilinmiyor"}</span>
        </div>

        {/* Progress */}
        {voyage ? (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1 text-xs min-w-0">
                <span className="text-muted-foreground truncate max-w-[70px]">{voyage.portName || "—"}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="font-semibold truncate max-w-[70px]">{voyage.portName || "—"}</span>
              </div>
              <span className="text-[10px] text-muted-foreground capitalize flex-shrink-0 ml-2">{voyage.purposeOfCall || voyage.status}</span>
            </div>
            <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: cfg.bar }} />
            </div>
            <div className="flex justify-between mt-1">
              {voyage.etd && <span className="text-[10px] text-muted-foreground">ETD: {new Date(voyage.etd).toLocaleDateString("tr-TR")}</span>}
              {voyage.eta && <span className="text-[10px] text-muted-foreground">ETA: {new Date(voyage.eta).toLocaleDateString("tr-TR")}</span>}
            </div>
          </div>
        ) : (
          <div className="mb-3 h-10 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Aktif sefer yok</span>
          </div>
        )}

        {/* Q88 Badge */}
        <div className="flex items-center gap-1.5 mb-2.5">
          <VesselQ88Badge vesselId={vessel.id} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {[
            { label: "GRT", value: vessel.grt?.toLocaleString("tr-TR") },
            { label: "DWT", value: vessel.dwt?.toLocaleString("tr-TR") ?? "—" },
            { label: "IMO", value: vessel.imoNumber || "—" },
          ].map((s) => (
            <div key={s.label} className="bg-muted/30 rounded-lg py-2 text-center">
              <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
              <p className="text-[11px] font-bold truncate px-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border/50">
          <div className="flex items-center gap-1">
            <button className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onEdit(); }} data-testid={`button-edit-vessel-${vessel.id}`}>
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }} data-testid={`button-delete-vessel-${vessel.id}`}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            {fleets.length > 0 && (
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                      data-testid={`button-fleet-vessel-${vessel.id}`}
                      title="Add to Fleet"
                    >
                      <Layers className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[160px]">
                    {fleets.map((f) => {
                      const inFleet = f.vessel_ids.includes(vessel.id);
                      return (
                        <DropdownMenuItem
                          key={f.id}
                          onClick={() => inFleet ? onRemoveFromFleet(f.id) : onAddToFleet(f.id)}
                          className="gap-2 text-xs"
                          data-testid={`fleet-option-${f.id}-vessel-${vessel.id}`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: f.color }} />
                          <span className="flex-1 truncate">{f.name}</span>
                          {inFleet && <span className="text-emerald-600 text-[10px] font-bold">✓</span>}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
          <button className="flex items-center gap-1 text-xs text-[hsl(var(--maritime-primary))] font-medium hover:underline"
            onClick={onSelect} data-testid={`button-detail-vessel-${vessel.id}`}>
            Detail <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
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
function fmtDate(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-GB");
}

export default function Vessels() {
  const { state: sidebarState } = useSidebar();
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [showForm, setShowForm] = useState(false);
  const [editingVessel, setEditingVessel] = useState<Vessel | null>(null);
  const [deleteVesselId, setDeleteVesselId] = useState<number | null>(null);
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [detailTab, setDetailTab] = useState<"general" | "voyage" | "technical" | "certificates" | "crew">("general");
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
  const defaultCrewForm = { firstName: "", lastName: "", rank: "", nationality: "", contractEndDate: "", passportNumber: "", passportExpiry: "", seamansBookNumber: "", seamansBookExpiry: "" };
  const [crewDialogOpen, setCrewDialogOpen] = useState(false);
  const [editCrewMember, setEditCrewMember] = useState<any>(null);
  const [crewDeleteTarget, setCrewDeleteTarget] = useState<{ id: number; vesselId: number } | null>(null);
  const [crewForm, setCrewForm] = useState({ ...defaultCrewForm });
  const [crewFileUploading, setCrewFileUploading] = useState<{ id: number; field: "passport" | "seamansBook" } | null>(null);
  const [location] = useLocation();

  useEffect(() => {
    if (location.includes("new=true")) setShowForm(true);
  }, [location]);

  const [fleetFilter, setFleetFilter] = useState<number | null>(null);
  const [showFleetDialog, setShowFleetDialog] = useState(false);
  const [editingFleet, setEditingFleet] = useState<FleetItem | null>(null);
  const [fleetForm, setFleetForm] = useState({ name: "", description: "", color: "#2563EB" });

  const { data: vessels = [], isLoading } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
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

  const handleCrewFileRemove = async (member: any, field: "passport" | "seamansBook") => {
    const payload = field === "passport"
      ? { passportFileBase64: null, passportFileName: null }
      : { seamansBookFileBase64: null, seamansBookFileName: null };
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
    <div className="px-3 py-5 space-y-6 max-w-7xl mx-auto">
      <PageMeta title="Fleet Management | VesselPDA" description="Manage and track the vessels in your fleet." />

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-vessels-title">
            Fleet Management
          </h1>
          <p className="text-muted-foreground text-sm">Update each vessel's status with a single click.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border gap-1">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "list"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="toggle-list-view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              List
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "map"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="toggle-map-view"
            >
              <MapIcon className="w-3.5 h-3.5" />
              Map
            </button>
          </div>
          <Button onClick={() => { setEditingVessel(null); setShowForm(true); }} className="gap-2" data-testid="button-add-vessel">
            <Plus className="w-4 h-4" /> Add Vessel
          </Button>
        </div>
      </div>

      {/* ── List Mode ── */}
      {viewMode === "list" && (
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

          {/* Stat Cards */}
          {!isLoading && vessels.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: "Total Vessels", value: stats.total,    icon: Ship,     color: "bg-[hsl(var(--maritime-primary)/0.1)] text-[hsl(var(--maritime-primary))]", filter: "all" as FilterGroup },
                { label: "Underway",     value: stats.underway, icon: Activity, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400", filter: "underway" as FilterGroup },
                { label: "At Anchor",    value: stats.anchored, icon: Anchor,   color: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",         filter: "anchored" as FilterGroup },
                { label: "In Port",      value: stats.port,     icon: MapPin,   color: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400",     filter: "port" as FilterGroup },
                { label: "Unspecified",  value: stats.idle,     icon: Calendar, color: "bg-muted text-muted-foreground",                                              filter: "idle" as FilterGroup },
              ].map(({ label, value, icon: Icon, color, filter }) => (
                <Card
                  key={label}
                  className={`p-4 flex items-center gap-3 cursor-pointer transition-all hover:shadow-md ${statusFilter === filter ? "ring-2 ring-[hsl(var(--maritime-primary))]" : ""}`}
                  onClick={() => setStatusFilter(filter)}
                  data-testid={`stat-${filter}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-black leading-none">{value}</p>
                    <p className="text-[11px] font-medium text-muted-foreground mt-0.5 leading-tight">{label}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Info Note */}
          {!isLoading && vessels.length > 0 && (
            <div className="flex items-start gap-2.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 rounded-xl px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
              <span className="text-base flex-shrink-0 mt-0.5">ℹ️</span>
              <span>
                Statuses are <strong>manual</strong> — click the badge on any card to update instantly. In map mode, vessels are shown at their current voyage port.
              </span>
            </div>
          )}

          {/* Search + Filter */}
          {vessels.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search vessels..." className="pl-9" data-testid="input-search-vessel" />
              </div>
              <div className="flex gap-1 bg-muted/40 p-1 rounded-xl flex-shrink-0 flex-wrap">
                {FILTER_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    data-testid={`filter-${key}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((vessel) => (
                <VesselCard
                  key={vessel.id}
                  vessel={vessel}
                  voyage={vesselVoyageMap.get(vessel.id) ?? null}
                  onSelect={() => { setSelectedVessel(vessel); setDetailTab("general"); }}
                  onEdit={() => setEditingVessel(vessel)}
                  onDelete={() => setDeleteVesselId(vessel.id)}
                  fleets={fleets}
                  onAddToFleet={(fleetId) => addToFleetMutation.mutate({ fleetId, vesselId: vessel.id })}
                  onRemoveFromFleet={(fleetId) => removeFromFleetMutation.mutate({ fleetId, vesselId: vessel.id })}
                />
              ))}
            </div>
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

      {/* ── Detail Panel ─────────────────────────────────────────────────── */}
      {selectedVessel && selectedVesselFresh && (() => {
          const v = selectedVesselFresh;
          const voy = selectedVoyage;
          const cfg = getCfg(v.fleetStatus);
          const flag = FLAG_EMOJI[v.flag || ""] || "🏳️";
          const progress = getProgress(voy);
          const sidebarLeft = sidebarState === "expanded" ? "16rem" : "3rem";

          return (
            <div
              className="fixed bottom-0 right-0 bg-background z-40 flex flex-col overflow-hidden border-l shadow-2xl"
              style={{ top: "3.5rem", left: sidebarLeft }}
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
                    {(["general", "voyage", "technical", "certificates", "crew"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setDetailTab(tab)}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all min-w-[60px] ${detailTab === tab ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {{ general: "General", voyage: "Voyage", technical: "Technical", certificates: "Certificates", crew: "Crew" }[tab]}
                      </button>
                    ))}
                  </div>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  {/* ── Genel ── */}
                  {detailTab === "general" && (
                    <>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Operation Status</p>
                        <FleetStatusSelector vessel={v} />
                        <p className="text-[11px] text-muted-foreground">Click the badge to change status</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { icon: MapPin,   label: "Location",   value: voy?.portName || "Unknown" },
                          { icon: Activity, label: "Voyage",     value: voy ? (voy.status === "active" ? "Active" : "Planned") : "None" },
                          { icon: Calendar, label: "ETA",        value: voy?.eta ? new Date(voy.eta).toLocaleDateString("en-GB") : "—" },
                          { icon: Calendar, label: "ETD",        value: voy?.etd ? new Date(voy.etd).toLocaleDateString("en-GB") : "—" },
                          { icon: FileText, label: "Purpose",    value: voy?.purposeOfCall || "—" },
                          { icon: Ship,     label: "Call Sign",  value: v.callSign || "—" },
                        ].map(({ icon: Icon, label, value }) => (
                          <div key={label} className="bg-muted/30 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground font-medium">{label}</p>
                            </div>
                            <p className="text-sm font-bold truncate">{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1 flex-wrap">
                        <Button size="sm" variant="outline" className="flex-1 gap-1.5 h-9 min-w-[70px]"
                          onClick={() => { setSelectedVessel(null); setEditingVessel(v); }}>
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </Button>
                        <Link href={`/proformas/new?vesselId=${v.id}`}>
                          <Button size="sm" variant="outline" className="flex-1 gap-1.5 h-9 min-w-[80px] border-[hsl(var(--maritime-primary)/0.4)] text-[hsl(var(--maritime-primary))]">
                            <FileText className="w-3.5 h-3.5" /> New PDA
                          </Button>
                        </Link>
                        <Link href={`/voyages?vesselId=${v.id}`}>
                          <Button size="sm" className="flex-1 gap-1.5 h-9 min-w-[90px]">
                            <Plus className="w-3.5 h-3.5" /> New Voyage
                          </Button>
                        </Link>
                      </div>
                    </>
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
                                  {voy.etd && <p className="text-xs text-muted-foreground">{new Date(voy.etd).toLocaleDateString("en-GB")}</p>}
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
                                  {voy.eta && <p className="text-xs text-muted-foreground">{new Date(voy.eta).toLocaleDateString("en-GB")}</p>}
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
                            setEditCrewMember({ vesselId: v.id, id: null });
                            setCrewForm({ firstName: "", lastName: "", rank: "", nationality: "", contractEndDate: "", passportNumber: "", passportExpiry: "", seamansBookNumber: "", seamansBookExpiry: "" });
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
                        const expCell = (dt: string | null, no?: string | null) => {
                          const s = dateStatus(dt);
                          if (!dt && !no) return <span className="text-muted-foreground/40">—</span>;
                          const dateStr = dt ? fmtDate(dt) : "—";
                          const noStr = no ? <span className="block text-[10px] text-muted-foreground/60">{no}</span> : null;
                          if (s === "expired") return <span className="text-red-600 dark:text-red-400 font-medium">{dateStr}<span className="ml-1 text-[10px]">✕</span>{noStr}</span>;
                          if (s === "warning") return <span className="text-amber-600 dark:text-amber-400 font-medium">{dateStr}<span className="ml-1 text-[10px]">⚠</span>{noStr}</span>;
                          return <span className="text-foreground">{dateStr}{noStr}</span>;
                        };
                        return (
                          <div className="overflow-x-auto rounded-xl border">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-muted/40 border-b">
                                  {["#", "Name", "Rank", "Nationality", "Contract End", "Passport Exp", "Passport Doc", "Seaman's Book Exp", "Seaman's Book Doc", ""].map((h) => (
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
                                            });
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
                        );
                      })()}
                    </div>
                  )}
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
        <DialogContent className="max-w-lg">
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
        <DialogContent className="sm:max-w-md">
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
