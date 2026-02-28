import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation, Search, Plus, X, Anchor, Ship, MapPin, ArrowRight, AlertTriangle, ChevronRight, Loader2, List, Map, Filter, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { PageMeta } from "@/components/page-meta";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { VesselWatchlistItem } from "@shared/schema";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

interface AISVessel {
  id?: string | number;
  mmsi: string | null;
  name?: string;
  vesselName?: string;
  flag: string;
  vesselType: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  destination: string;
  eta: string | null;
  status: "underway" | "anchored" | "moored";
  isOwnVessel?: boolean;
  isAgencyVessel?: boolean;
  imo?: string | null;
}

function seededRandom(seed: number): number {
  let t = (seed ^ 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const STATUS_COLORS: Record<string, string> = {
  underway: "#0077BE",
  anchored: "#F59E0B",
  moored: "#10B981",
};

const STATUS_LABELS: Record<string, string> = {
  underway: "Underway",
  anchored: "Anchored",
  moored: "Moored",
};

function createShipSvg(heading: number, status: string, highlight = false): string {
  const color = highlight ? "#FBBF24" : (STATUS_COLORS[status] || "#6B7280");
  const size = highlight ? 22 : 16;
  const strokeColor = highlight ? "#FDE68A" : "white";
  const strokeWidth = highlight ? "2" : "1.5";
  const total = size + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" viewBox="0 0 ${total} ${total}">
    <g transform="translate(${total / 2},${total / 2}) rotate(${heading})">
      <polygon points="0,${-size / 2} ${size / 3},${size / 3} 0,${size / 4} ${-size / 3},${size / 3}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
    </g>
  </svg>`;
}

function createPopupHtml(v: AISVessel): string {
  const name = v.vesselName || v.name || "Unknown";
  const statusLabel = STATUS_LABELS[v.status] || v.status;
  const statusColor = v.status === "underway" ? "#3B82F6" : v.status === "anchored" ? "#F59E0B" : "#10B981";

  let rows = "";
  if (v.mmsi) rows += `<tr><td style="color:#9ca3af;padding:2px 10px 2px 0;white-space:nowrap">MMSI</td><td style="font-family:monospace;font-size:11px">${v.mmsi}</td></tr>`;
  rows += `<tr><td style="color:#9ca3af;padding:2px 10px 2px 0">Flag</td><td>${v.flag}</td></tr>`;
  rows += `<tr><td style="color:#9ca3af;padding:2px 10px 2px 0">Type</td><td>${v.vesselType}</td></tr>`;
  rows += `<tr><td style="color:#9ca3af;padding:2px 10px 2px 0">Status</td><td style="color:${statusColor};font-weight:600">${statusLabel}</td></tr>`;
  if (v.speed !== undefined && v.speed > 0) rows += `<tr><td style="color:#9ca3af;padding:2px 10px 2px 0">Speed</td><td>${v.speed} kn</td></tr>`;
  if (v.heading !== undefined && v.speed > 0) rows += `<tr><td style="color:#9ca3af;padding:2px 10px 2px 0">Heading</td><td>${v.heading}°</td></tr>`;
  if (v.destination) rows += `<tr><td style="color:#9ca3af;padding:2px 10px 2px 0">Dest.</td><td style="font-weight:600">${v.destination}</td></tr>`;
  if (v.eta) {
    const etaStr = new Date(v.eta).toLocaleDateString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    rows += `<tr><td style="color:#9ca3af;padding:2px 10px 2px 0">ETA</td><td>${etaStr}</td></tr>`;
  }

  return `<div style="min-width:200px;font-size:12px;font-family:system-ui,-apple-system,sans-serif;line-height:1.4">
    <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;border-bottom:1px solid #f3f4f6;padding-bottom:6px">
      <span style="width:9px;height:9px;border-radius:50%;background:${statusColor};flex-shrink:0;display:inline-block;box-shadow:0 0 4px ${statusColor}66"></span>
      <strong style="font-size:13px;color:#111827">${name}</strong>
    </div>
    <table style="border-collapse:collapse;font-size:11px;width:100%;color:#374151"><tbody>${rows}</tbody></table>
  </div>`;
}

function VesselCard({
  vessel,
  onFocus,
  onRemove,
  highlighted,
}: {
  vessel: AISVessel;
  onFocus: (v: AISVessel) => void;
  onRemove?: () => void;
  highlighted?: boolean;
}) {
  const name = vessel.vesselName || vessel.name || "Unknown";
  const statusColor = vessel.status === "underway" ? "bg-blue-500/10 text-blue-600 border-blue-200"
    : vessel.status === "anchored" ? "bg-amber-500/10 text-amber-600 border-amber-200"
    : "bg-emerald-500/10 text-emerald-600 border-emerald-200";

  return (
    <div
      onClick={() => onFocus(vessel)}
      data-testid={`card-vessel-${vessel.mmsi || vessel.id}`}
      className={`p-3 rounded-lg border cursor-pointer transition-all duration-150 hover:shadow-sm group ${
        highlighted ? "border-[hsl(var(--maritime-primary))] bg-[hsl(var(--maritime-primary)/0.04)]" : "border-border bg-card hover:border-[hsl(var(--maritime-primary)/0.4)]"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
          vessel.status === "underway" ? "bg-blue-500" : vessel.status === "anchored" ? "bg-amber-500" : "bg-emerald-500"
        }`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="font-semibold text-sm truncate leading-tight">{name}</p>
            {onRemove && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                data-testid={`button-remove-watchlist-${vessel.mmsi || vessel.id}`}
                className="text-muted-foreground/50 hover:text-red-500 transition-colors flex-shrink-0 p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-xs text-muted-foreground">{vessel.flag}</span>
            <span className="text-xs text-muted-foreground/50">·</span>
            <span className="text-xs text-muted-foreground truncate">{vessel.vesselType}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${statusColor}`}>
              {STATUS_LABELS[vessel.status]}
            </span>
            {vessel.speed > 0 && (
              <span className="text-[10px] text-muted-foreground font-mono">{vessel.speed} kn</span>
            )}
            {vessel.heading !== undefined && vessel.speed > 0 && (
              <span className="text-[10px] text-muted-foreground font-mono">{vessel.heading}°</span>
            )}
          </div>
          {vessel.destination && (
            <div className="flex items-center gap-1 mt-1">
              <ArrowRight className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
              <span className="text-[11px] text-muted-foreground truncate">{vessel.destination}</span>
              {vessel.eta && (
                <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                  · {new Date(vessel.eta).toLocaleDateString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onFocus(vessel); }}
          data-testid={`button-focus-${vessel.mmsi || vessel.id}`}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[hsl(var(--maritime-primary))] flex-shrink-0 p-1 hover:bg-[hsl(var(--maritime-primary)/0.08)] rounded"
          title="Focus on map"
        >
          <MapPin className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

const VESSEL_TYPES = [
  "Container", "Tanker", "Gas Carrier", "Bulk Carrier", "General Cargo",
  "Ro-Ro", "Passenger", "Offshore", "Tugs & Harbor Craft", "Bunkering",
  "Special Craft", "Fishing", "Pleasure craft", "Unspecified",
];

const STATUS_OPTIONS = ["underway", "anchored", "moored"] as const;

function VesselListView({
  positions,
  onShowOnMap,
}: {
  positions: AISVessel[];
  onShowOnMap: (v: AISVessel) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"name" | "speed" | "type">("name");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const PAGE_SIZE = 10;

  const toggleStatus = (s: string) => {
    setStatusFilters(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
    setPage(1);
  };

  const filtered = useMemo(() => {
    let list = [...positions];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(v =>
        (v.vesselName || v.name || "").toLowerCase().includes(q) ||
        (v.mmsi || "").includes(q)
      );
    }
    if (typeFilter) {
      list = list.filter(v => {
        const t = (v.vesselType || "").toLowerCase();
        return t.includes(typeFilter.toLowerCase());
      });
    }
    if (statusFilters.size > 0) {
      list = list.filter(v => statusFilters.has(v.status));
    }
    list.sort((a, b) => {
      if (sortBy === "speed") return (b.speed || 0) - (a.speed || 0);
      if (sortBy === "type") return (a.vesselType || "").localeCompare(b.vesselType || "");
      return (a.vesselName || a.name || "").localeCompare(b.vesselName || b.name || "");
    });
    return list;
  }, [positions, search, typeFilter, statusFilters, sortBy]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;
  const activeFilterCount = (typeFilter ? 1 : 0) + statusFilters.size;

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Left sidebar — filters */}
      <div className="w-52 flex-shrink-0 border-r flex flex-col overflow-hidden bg-muted/20">
        <div className="px-4 py-3 border-b flex items-center gap-2 flex-shrink-0">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Filters</span>
          {activeFilterCount > 0 && (
            <Badge className="ml-auto text-[10px] px-1.5 py-0 h-4" style={{ background: "#003D7A" }}>
              {activeFilterCount}
            </Badge>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {/* Vessel Type */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Vessel Type</p>
              {typeFilter && (
                <button onClick={() => { setTypeFilter(null); setPage(1); }} className="text-[10px] text-blue-600 hover:underline">
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-0.5">
              {VESSEL_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => { setTypeFilter(typeFilter === t ? null : t); setPage(1); }}
                  data-testid={`filter-type-${t}`}
                  className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                    typeFilter === t
                      ? "bg-[hsl(var(--maritime-primary))] text-white font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Status</p>
              {statusFilters.size > 0 && (
                <button onClick={() => { setStatusFilters(new Set()); setPage(1); }} className="text-[10px] text-blue-600 hover:underline">
                  Clear
                </button>
              )}
            </div>
            <div className="space-y-1">
              {STATUS_OPTIONS.map(s => {
                const dot = s === "underway" ? "bg-blue-500" : s === "anchored" ? "bg-amber-500" : "bg-emerald-500";
                const label = STATUS_LABELS[s];
                const active = statusFilters.has(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleStatus(s)}
                    data-testid={`filter-status-${s}`}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                      active ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                    {label}
                    {active && <span className="ml-auto text-[hsl(var(--maritime-primary))]">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex-shrink-0">
          <h1 className="text-2xl font-bold tracking-tight">Search and Track Ships</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Showing{" "}
            <span className="font-medium text-foreground">
              ({Math.min(1, filtered.length)} to {Math.min(paginated.length, filtered.length)} of {filtered.length} vessels)
            </span>
          </p>
        </div>

        {/* Search + Sort bar */}
        <div className="px-6 py-3 border-b flex-shrink-0 flex items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by vessel name or MMSI..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9"
              data-testid="input-list-search"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                data-testid="button-clear-list-search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Sort by</span>
            <div className="flex border rounded-md overflow-hidden">
              {([["name", "Name"], ["speed", "Speed"], ["type", "Type"]] as const).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setSortBy(v)}
                  data-testid={`sort-${v}`}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    sortBy === v ? "bg-[hsl(var(--maritime-primary))] text-white" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Vessel list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Ship className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-muted-foreground">No vessels match your filters</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Try adjusting the search or filters</p>
            </div>
          ) : (
            <div className="divide-y">
              {paginated.map((v) => {
                const id = String(v.mmsi || v.id || "");
                const name = v.vesselName || v.name || "Unknown";
                const isExpanded = expandedId === id;
                const statusDot = v.status === "underway" ? "bg-blue-500" : v.status === "anchored" ? "bg-amber-500" : "bg-emerald-500";
                const statusBadge = v.status === "underway"
                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300"
                  : v.status === "anchored"
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300";

                return (
                  <div key={id} data-testid={`list-vessel-${id}`}>
                    {/* Row */}
                    <button
                      className="w-full flex items-center gap-3 px-6 py-3.5 hover:bg-muted/40 transition-colors text-left"
                      onClick={() => setExpandedId(isExpanded ? null : id)}
                      data-testid={`button-expand-${id}`}
                    >
                      <span className="text-2xl leading-none flex-shrink-0">{v.flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">{name}</span>
                          {v.mmsi && (
                            <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground border flex-shrink-0">
                              {v.mmsi}
                            </span>
                          )}
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 ${statusBadge}`}>
                            {STATUS_LABELS[v.status]}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{v.vesselType}</p>
                      </div>
                      <div className="flex-shrink-0 ml-2 text-muted-foreground">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-6 pb-4 bg-muted/20 border-t">
                        <div className="grid grid-cols-3 gap-4 pt-4 mb-4">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">ETA</p>
                            <p className="text-sm font-medium">
                              {v.eta
                                ? new Date(v.eta).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Destination</p>
                            <p className="text-sm font-medium truncate">{v.destination || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Speed / Heading</p>
                            <p className="text-sm font-medium">
                              {v.speed > 0 ? `${v.speed} kn` : "—"}
                              {v.heading !== undefined && v.speed > 0 ? ` · ${v.heading}°` : ""}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="font-semibold gap-1.5"
                          style={{ background: "#003D7A" }}
                          onClick={() => onShowOnMap(v)}
                          data-testid={`button-show-on-map-${id}`}
                        >
                          Show on Map <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center py-6">
              <Button
                variant="outline"
                onClick={() => setPage(p => p + 1)}
                data-testid="button-load-more"
                className="px-8"
              >
                Load more ({filtered.length - paginated.length} remaining)
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VesselTrack() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRole = (user as any)?.userRole || "shipowner";
  const activeRole = (user as any)?.activeRole || userRole;
  const isAdmin = userRole === "admin";
  const effectiveRole = isAdmin ? activeRole : userRole;
  const isAgent = effectiveRole === "agent";

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const mapReadyRef = useRef(false);

  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [demoBarDismissed, setDemoBarDismissed] = useState(false);
  const [panelSearch, setPanelSearch] = useState("");
  const [panelResults, setPanelResults] = useState<AISVessel[]>([]);
  const [isPanelSearching, setIsPanelSearching] = useState(false);
  const [wlSearch, setWlSearch] = useState("");
  const [wlResults, setWlResults] = useState<AISVessel[]>([]);
  const [isWlSearching, setIsWlSearching] = useState(false);
  const panelSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wlSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: aisStatus } = useQuery<{ connected: boolean; vesselCount: number; mode: "live" | "demo" }>({
    queryKey: ["/api/vessel-track/status"],
    refetchInterval: 30000,
  });
  const isLive = aisStatus?.mode === "live";
  const refetchInterval = isLive ? 15000 : 60000;

  const { data: positions = [] } = useQuery<AISVessel[]>({ queryKey: ["/api/vessel-track/positions"], refetchInterval });
  const { data: fleet = [] } = useQuery<AISVessel[]>({ queryKey: ["/api/vessel-track/fleet"], refetchInterval });
  const { data: agencyVessels = [] } = useQuery<AISVessel[]>({ queryKey: ["/api/vessel-track/agency-vessels"], enabled: isAgent || isAdmin, refetchInterval });
  const { data: watchlist = [] } = useQuery<VesselWatchlistItem[]>({ queryKey: ["/api/vessel-track/watchlist"] });

  const removeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/vessel-track/watchlist/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessel-track/watchlist"] });
      toast({ title: "Removed from watchlist" });
    },
  });

  const addMutation = useMutation({
    mutationFn: (v: Partial<AISVessel>) => apiRequest("POST", "/api/vessel-track/watchlist", {
      vesselName: v.vesselName || v.name,
      mmsi: v.mmsi,
      flag: v.flag,
      vesselType: v.vesselType,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessel-track/watchlist"] });
      toast({ title: "Added to watchlist" });
    },
  });

  const handleFocus = useCallback((v: AISVessel) => {
    const id = String(v.mmsi || v.id || "");
    setFlyTarget([v.lat, v.lng]);
    setHighlightedId(id);
  }, []);

  const doSearch = useCallback(async (q: string, setResults: (r: AISVessel[]) => void, setLoading: (b: boolean) => void) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/vessel-track/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (panelSearchTimeout.current) clearTimeout(panelSearchTimeout.current);
    panelSearchTimeout.current = setTimeout(() => doSearch(panelSearch, setPanelResults, setIsPanelSearching), 300);
    return () => { if (panelSearchTimeout.current) clearTimeout(panelSearchTimeout.current); };
  }, [panelSearch, doSearch]);

  useEffect(() => {
    if (wlSearchTimeout.current) clearTimeout(wlSearchTimeout.current);
    wlSearchTimeout.current = setTimeout(() => doSearch(wlSearch, setWlResults, setIsWlSearching), 300);
    return () => { if (wlSearchTimeout.current) clearTimeout(wlSearchTimeout.current); };
  }, [wlSearch, doSearch]);

  const watchlistOnMap: AISVessel[] = useMemo(() =>
    (watchlist as VesselWatchlistItem[]).map((w) => {
      const match = positions.find(p => p.mmsi === w.mmsi);
      if (match) return { ...match, id: `wl-${w.id}` };
      const idx = w.id % Math.max(positions.length, 1);
      const base = positions[idx] || positions[0];
      const r1 = seededRandom(w.id * 3000 + 1);
      const r2 = seededRandom(w.id * 3000 + 2);
      const r3 = seededRandom(w.id * 3000 + 3);
      const r4 = seededRandom(w.id * 3000 + 4);
      return {
        id: `wl-${w.id}`,
        mmsi: w.mmsi,
        vesselName: w.vesselName,
        flag: w.flag || "🌐",
        vesselType: w.vesselType || "Unknown",
        lat: base?.lat ? base.lat + (r1 - 0.5) * 3 : 39 + r1 * 3,
        lng: base?.lng ? base.lng + (r2 - 0.5) * 3 : 28 + r2 * 6,
        heading: Math.floor(r3 * 360),
        speed: Math.round(r4 * 12 * 10) / 10,
        destination: "Unknown",
        eta: null,
        status: "underway" as const,
      };
    }),
  [watchlist, positions]);

  const allMapVessels: AISVessel[] = [
    ...positions,
    ...fleet.filter(f => !positions.some(p => p.mmsi && p.mmsi === f.mmsi)),
    ...agencyVessels.filter(a => !positions.some(p => p.mmsi && p.mmsi === (a as any).mmsi)),
  ];

  const defaultTab = isAgent ? "agency" : "fleet";
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [35.5, 38.5],
      zoom: 6,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100, unit: "nautical" }), "bottom-left");
    map.on("load", () => {
      mapReadyRef.current = true;

      // Su katmanlarını lacivert yap — dark-v11 varsayılan rengi çok koyu/gri
      const fillWaterLayers = ["water", "water-shadow"];
      fillWaterLayers.forEach(layerId => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, "fill-color", "#0d2d48");
        }
      });
      if (map.getLayer("waterway")) {
        map.setPaintProperty("waterway", "line-color", "#0e3352");
      }
      if (map.getLayer("waterway-shadow")) {
        map.setPaintProperty("waterway-shadow", "line-color", "#0e3352");
      }

      // OpenSeaMap denizcilik sembolleri
      map.addSource("openseamap", {
        type: "raster",
        tiles: ["https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© <a href='https://www.openseamap.org' target='_blank'>OpenSeaMap</a> contributors",
      });
      map.addLayer({
        id: "openseamap-layer",
        type: "raster",
        source: "openseamap",
        paint: { "raster-opacity": 0.9 },
      });
    });
    mapRef.current = map;
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
    };
  }, []);

  // Update vessel markers whenever vessels or highlight changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const addMarkersWhenReady = () => {
      // Remove stale markers
      const currentIds = new Set(allMapVessels.map((v, i) => String(v.mmsi || v.id || i)));
      markersRef.current.forEach((marker, id) => {
        if (!currentIds.has(id)) {
          marker.remove();
          markersRef.current.delete(id);
        }
      });

      // Add/update markers
      allMapVessels.forEach((v, i) => {
        const id = String(v.mmsi || v.id || i);
        const isHighlighted = highlightedId === id;

        const existing = markersRef.current.get(id);
        if (existing) {
          existing.setLngLat([v.lng, v.lat]);
          const el = existing.getElement();
          el.innerHTML = createShipSvg(v.heading, v.status, isHighlighted);
          el.style.zIndex = isHighlighted ? "10" : "1";
          return;
        }

        const el = document.createElement("div");
        el.innerHTML = createShipSvg(v.heading, v.status, isHighlighted);
        el.style.cursor = "pointer";
        el.style.zIndex = isHighlighted ? "10" : "1";

        const popup = new mapboxgl.Popup({
          offset: 14,
          closeButton: true,
          maxWidth: "260px",
          className: "vessel-popup",
        }).setHTML(createPopupHtml(v));

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([v.lng, v.lat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener("click", () => {
          setHighlightedId(id);
          setFlyTarget([v.lat, v.lng]);
        });

        markersRef.current.set(id, marker);
      });
    };

    if (map.loaded()) {
      addMarkersWhenReady();
    } else {
      map.once("load", addMarkersWhenReady);
    }
  }, [allMapVessels, highlightedId]);

  // flyTo when target changes
  useEffect(() => {
    if (flyTarget && mapRef.current) {
      mapRef.current.flyTo({
        center: [flyTarget[1], flyTarget[0]],
        zoom: 10,
        duration: 1200,
        essential: true,
      });
    }
  }, [flyTarget]);

  // Resize map when switching back to map view
  useEffect(() => {
    if (viewMode === "map" && mapRef.current) {
      setTimeout(() => mapRef.current?.resize(), 50);
    }
  }, [viewMode]);

  const handleShowOnMap = useCallback((v: AISVessel) => {
    setViewMode("map");
    handleFocus(v);
  }, [handleFocus]);

  return (
    <div className="flex flex-col h-full" style={{ height: "calc(100vh - 56px)" }}>
      <PageMeta title="Vessel Track | VesselPDA" description="Track live vessel positions in Turkish waters with AIS data." />

      {/* Top bar with view toggle */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-background flex-shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-7 h-7 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0">
            <Navigation className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
          </div>
          <span className="font-serif font-bold text-sm tracking-tight">Vessel Track</span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {allMapVessels.length} vessels
          </span>
          {isLive ? (
            <Badge variant="outline" className="text-[10px] font-bold border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 flex items-center gap-1" data-testid="badge-ais-status">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE AIS
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] font-bold border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/20 flex items-center gap-1" data-testid="badge-ais-status">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              DEMO
            </Badge>
          )}
        </div>

        {/* Map / List toggle */}
        <div className="flex border rounded-lg overflow-hidden flex-shrink-0" data-testid="toggle-view-mode">
          <button
            onClick={() => setViewMode("map")}
            data-testid="button-view-map"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === "map"
                ? "bg-[hsl(var(--maritime-primary))] text-white"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            Map
          </button>
          <button
            onClick={() => setViewMode("list")}
            data-testid="button-view-list"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-l ${
              viewMode === "list"
                ? "bg-[hsl(var(--maritime-primary))] text-white"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            List
          </button>
        </div>
      </div>

      {/* List view */}
      {viewMode === "list" && (
        <div className="flex-1 overflow-hidden">
          <VesselListView positions={allMapVessels} onShowOnMap={handleShowOnMap} />
        </div>
      )}

      {/* Map view (kept mounted, hidden when in list mode) */}
      <div className={`${viewMode === "list" ? "hidden" : "flex"} flex-1 flex-row overflow-hidden`}>
        {/* Left panel */}
        <div className={`${mobileView === 'map' ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-shrink-0 md:border-r flex-col bg-background overflow-hidden`} data-testid="panel-vessel-list">
        {/* Mobile map toggle */}
        <div className="flex md:hidden border-b flex-shrink-0">
          <button
            onClick={() => setMobileView('list')}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${mobileView === 'list' ? 'bg-[hsl(var(--maritime-primary))] text-white' : 'text-muted-foreground hover:bg-muted'}`}
          >
            List
          </button>
          <button
            onClick={() => setMobileView('map')}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${mobileView === 'map' ? 'bg-[hsl(var(--maritime-primary))] text-white' : 'text-muted-foreground hover:bg-muted'}`}
          >
            Map
          </button>
        </div>

        {/* Vessel Search Bar */}
        <div className="px-3 py-2 border-b flex-shrink-0 relative" data-testid="panel-search">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name, MMSI or IMO..."
              value={panelSearch}
              onChange={(e) => setPanelSearch(e.target.value)}
              className="pl-8 pr-7 h-8 text-xs"
              data-testid="input-panel-search"
            />
            {isPanelSearching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            {panelSearch && !isPanelSearching && (
              <button
                onClick={() => { setPanelSearch(""); setPanelResults([]); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                data-testid="button-clear-panel-search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {panelSearch && (
            <div className="absolute left-3 right-3 top-full z-50 mt-0.5 bg-background border rounded-lg shadow-xl overflow-hidden" data-testid="panel-search-results">
              {panelResults.length === 0 && !isPanelSearching ? (
                <p className="text-xs text-muted-foreground text-center py-4">No vessels found for "{panelSearch}"</p>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-border">
                  {panelResults.slice(0, 20).map((v) => {
                    const vName = v.name || v.vesselName || "Unknown";
                    const watched = (watchlist as VesselWatchlistItem[]).some(w => w.mmsi === v.mmsi && v.mmsi);
                    return (
                      <div key={v.mmsi} className="flex items-center gap-2 px-2.5 py-2 hover:bg-muted/40 transition-colors" data-testid={`search-result-${v.mmsi}`}>
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${v.status === "underway" ? "bg-blue-500" : v.status === "anchored" ? "bg-amber-500" : "bg-emerald-500"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{vName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{v.flag} · {v.vesselType}{v.mmsi ? ` · ${v.mmsi}` : ""}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-1.5 gap-0.5"
                            onClick={() => { handleFocus(v); setPanelSearch(""); setPanelResults([]); }}
                            data-testid={`button-focus-result-${v.mmsi}`}
                            title="Focus on map"
                          >
                            <MapPin className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant={watched ? "outline" : "default"}
                            className="h-6 text-[10px] px-1.5"
                            disabled={watched || addMutation.isPending}
                            onClick={() => addMutation.mutate(v)}
                            data-testid={`button-add-result-${v.mmsi}`}
                            title="Add to watchlist"
                          >
                            {watched ? "✓" : <Plus className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <Tabs defaultValue={defaultTab} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="mx-3 mt-3 flex-shrink-0 h-9" data-testid="tabs-vessel-track">
            {!isAgent && (
              <TabsTrigger value="fleet" className="flex-1 text-xs" data-testid="tab-fleet">
                My Fleet
                {fleet.length > 0 && <span className="ml-1.5 text-[9px] bg-[hsl(var(--maritime-primary)/0.15)] text-[hsl(var(--maritime-primary))] px-1 py-0.5 rounded-full font-bold">{fleet.length}</span>}
              </TabsTrigger>
            )}
            {(isAgent || isAdmin) && (
              <TabsTrigger value="agency" className="flex-1 text-xs" data-testid="tab-agency">
                Agency
                {agencyVessels.length > 0 && <span className="ml-1.5 text-[9px] bg-emerald-500/15 text-emerald-600 px-1 py-0.5 rounded-full font-bold">{agencyVessels.length}</span>}
              </TabsTrigger>
            )}
            <TabsTrigger value="watchlist" className="flex-1 text-xs" data-testid="tab-watchlist">
              Watchlist
              {watchlist.length > 0 && <span className="ml-1.5 text-[9px] bg-amber-500/15 text-amber-600 px-1 py-0.5 rounded-full font-bold">{watchlist.length}</span>}
            </TabsTrigger>
          </TabsList>

          {/* My Fleet Tab */}
          {!isAgent && (
            <TabsContent value="fleet" className="flex-1 overflow-y-auto px-3 pb-3 mt-2 space-y-2" data-testid="content-fleet">
              {fleet.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Ship className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground">No vessels in your fleet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1 px-4">Add vessels on the Vessels page and they'll appear here with demo positions</p>
                  <a href="/vessels" className="mt-3 text-xs text-[hsl(var(--maritime-primary))] hover:underline flex items-center gap-1">
                    Go to Vessels <ChevronRight className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                fleet.map((v) => (
                  <VesselCard
                    key={String(v.id)}
                    vessel={v}
                    onFocus={handleFocus}
                    highlighted={highlightedId === String(v.mmsi || v.id)}
                  />
                ))
              )}
            </TabsContent>
          )}

          {/* Agency Vessels Tab */}
          {(isAgent || isAdmin) && (
            <TabsContent value="agency" className="flex-1 overflow-y-auto px-3 pb-3 mt-2 space-y-2" data-testid="content-agency">
              {agencyVessels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Anchor className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground">No agency vessels yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1 px-4">Vessels from tenders where you've been nominated as agent will appear here</p>
                </div>
              ) : (
                agencyVessels.map((v) => (
                  <VesselCard
                    key={String(v.id)}
                    vessel={v}
                    onFocus={handleFocus}
                    highlighted={highlightedId === String(v.mmsi || v.id)}
                  />
                ))
              )}
            </TabsContent>
          )}

          {/* Watchlist Tab */}
          <TabsContent value="watchlist" className="flex-1 flex flex-col overflow-hidden mt-0" data-testid="content-watchlist">
            <div className="px-3 py-2 border-b flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Add vessel by name, MMSI or IMO..."
                  value={wlSearch}
                  onChange={(e) => setWlSearch(e.target.value)}
                  className="pl-8 pr-7 h-8 text-xs"
                  data-testid="input-watchlist-search"
                />
                {isWlSearching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                {wlSearch && !isWlSearching && (
                  <button onClick={() => { setWlSearch(""); setWlResults([]); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {wlSearch && (
                <div className="mt-1 border rounded-lg overflow-hidden" data-testid="watchlist-search-results">
                  {wlResults.length === 0 && !isWlSearching ? (
                    <p className="text-xs text-muted-foreground text-center py-3">No vessels found</p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto divide-y divide-border">
                      {wlResults.slice(0, 10).map((v) => {
                        const vName = v.name || v.vesselName || "Unknown";
                        const watched = (watchlist as VesselWatchlistItem[]).some(w => w.mmsi === v.mmsi && v.mmsi);
                        return (
                          <div key={v.mmsi} className="flex items-center gap-2 px-2.5 py-2 hover:bg-muted/40 transition-colors" data-testid={`wl-result-${v.mmsi}`}>
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${v.status === "underway" ? "bg-blue-500" : v.status === "anchored" ? "bg-amber-500" : "bg-emerald-500"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate">{vName}</p>
                              <p className="text-[10px] text-muted-foreground truncate font-mono">{v.mmsi}</p>
                            </div>
                            <Button
                              size="sm"
                              variant={watched ? "outline" : "default"}
                              className="h-6 text-[10px] px-2 flex-shrink-0"
                              disabled={watched || addMutation.isPending}
                              onClick={() => { addMutation.mutate(v); setWlSearch(""); setWlResults([]); }}
                              data-testid={`button-wl-add-${v.mmsi}`}
                            >
                              {watched ? "✓" : <><Plus className="w-3 h-3" /> Add</>}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2 space-y-2">
              {watchlist.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Navigation className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground">Watchlist is empty</p>
                  <p className="text-xs text-muted-foreground/70 mt-1 px-4">Use the search box above to find and add vessels</p>
                </div>
              ) : (
                watchlistOnMap.map((v, i) => {
                  const wlItem = (watchlist as VesselWatchlistItem[])[i];
                  return (
                    <VesselCard
                      key={String(v.id)}
                      vessel={v}
                      onFocus={handleFocus}
                      highlighted={highlightedId === String(v.mmsi || v.id)}
                      onRemove={() => wlItem && removeMutation.mutate(wlItem.id)}
                    />
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Map panel */}
      <div className={`${mobileView === 'list' ? 'hidden md:block' : 'block'} flex-1 relative overflow-hidden`} data-testid="panel-map" style={mobileView === 'map' ? { height: 'calc(100vh - 56px - 40px)' } : undefined}>
        {/* Demo data banner */}
        {!demoBarDismissed && (
          <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-amber-50 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center gap-2 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span className="text-amber-800 dark:text-amber-300 flex-1">
              Showing <strong>demo positions</strong> — real-time AIS tracking is available when you connect your AIS API key
            </span>
            <button
              onClick={() => setDemoBarDismissed(true)}
              data-testid="button-dismiss-demo-banner"
              className="text-amber-600 hover:text-amber-800 ml-auto flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div
          ref={mapContainerRef}
          style={{ height: "100%", width: "100%" }}
          data-testid="map-container"
        />
      </div>
      </div>
    </div>
  );
}
