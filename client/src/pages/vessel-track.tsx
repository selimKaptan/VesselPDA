import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigation, Search, X, Ship, MapPin, ArrowRight, AlertTriangle, Loader2, List, Map as MapIcon, ChevronDown, ChevronUp, SlidersHorizontal, Clock, Satellite } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { PageMeta } from "@/components/page-meta";
import { fmtDate, fmtDateTime } from "@/lib/formatDate";

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
    const etaStr = fmtDateTime(v.eta);
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

interface TrackFleetItem {
  id: number;
  name: string;
  color: string;
  vessel_count: number;
  vessel_mmsis: string[];
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
  const [committedSearch, setCommittedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [fleetFilter, setFleetFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "speed" | "type">("name");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const PAGE_SIZE = 10;

  const { data: fleets = [] } = useQuery<TrackFleetItem[]>({ queryKey: ["/api/fleets"] });

  const commitSearch = () => {
    setCommittedSearch(search);
    setPage(1);
  };

  const toggleStatus = (s: string) => {
    setStatusFilters(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
    setPage(1);
  };

  const activeFleetMmsis = useMemo(() => {
    if (fleetFilter === null) return null;
    const f = fleets.find(fl => fl.id === fleetFilter);
    return f ? new Set(f.vessel_mmsis) : null;
  }, [fleetFilter, fleets]);

  const filtered = useMemo(() => {
    let list = [...positions];
    if (committedSearch.trim()) {
      const q = committedSearch.toLowerCase();
      list = list.filter(v =>
        (v.vesselName || v.name || "").toLowerCase().includes(q) ||
        (v.mmsi || "").includes(q) ||
        (v.imo || "").toLowerCase().includes(q)
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
    if (activeFleetMmsis) {
      list = list.filter(v => v.mmsi && activeFleetMmsis.has(v.mmsi));
    }
    list.sort((a, b) => {
      if (sortBy === "speed") return (b.speed || 0) - (a.speed || 0);
      if (sortBy === "type") return (a.vesselType || "").localeCompare(b.vesselType || "");
      return (a.vesselName || a.name || "").localeCompare(b.vesselName || b.name || "");
    });
    return list;
  }, [positions, committedSearch, typeFilter, statusFilters, sortBy, activeFleetMmsis]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;
  const activeFilterCount = (typeFilter ? 1 : 0) + statusFilters.size + (fleetFilter !== null ? 1 : 0);

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

          {/* My Fleets */}
          {fleets.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">My Fleets</p>
                {fleetFilter !== null && (
                  <button onClick={() => { setFleetFilter(null); setPage(1); }} className="text-[10px] text-blue-600 hover:underline">
                    Clear
                  </button>
                )}
              </div>
              <div className="space-y-0.5">
                {fleets.map(f => (
                  <button
                    key={f.id}
                    onClick={() => { setFleetFilter(fleetFilter === f.id ? null : f.id); setPage(1); }}
                    data-testid={`track-fleet-filter-${f.id}`}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                      fleetFilter === f.id ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: f.color }} />
                    <span className="flex-1 text-left truncate">{f.name}</span>
                    <span className="text-[10px] opacity-60">({f.vessel_count})</span>
                    {fleetFilter === f.id && <span className="ml-auto text-[hsl(var(--maritime-primary))]">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
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
          <div className="flex items-center gap-2 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by name, MMSI or IMO..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitSearch(); }}
                className="pl-9 pr-8 h-9"
                data-testid="input-list-search"
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); setCommittedSearch(""); setPage(1); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-clear-list-search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Button
              onClick={commitSearch}
              size="sm"
              className="h-9 px-4 font-semibold flex-shrink-0"
              style={{ background: "#003D7A" }}
              data-testid="button-list-search"
            >
              <Search className="w-3.5 h-3.5 mr-1.5" />
              Search
            </Button>
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
                                ? fmtDateTime(v.eta)
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
  const userRole = (user as any)?.userRole || "shipowner";
  const activeRole = (user as any)?.activeRole || userRole;
  const isAdmin = userRole === "admin";
  const effectiveRole = isAdmin ? activeRole : userRole;
  const isAgent = effectiveRole === "agent";

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [demoBarDismissed, setDemoBarDismissed] = useState(false);
  const [mapSearch, setMapSearch] = useState("");
  const [mapSearchResults, setMapSearchResults] = useState<AISVessel[]>([]);
  const [isMapSearching, setIsMapSearching] = useState(false);
  const mapSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [datalasticSearchResults, setDatalasticSearchResults] = useState<{name:string;imo:string|null;mmsi:string|null;flag:string;vessel_type:string;latitude:number;longitude:number}[]>([]);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [selectedHistoryMmsi, setSelectedHistoryMmsi] = useState<string | null>(null);
  const [historyRange, setHistoryRange] = useState<"1" | "3" | "7">("1");
  const [useDatalasticTrack, setUseDatalasticTrack] = useState(false);
  const historyPopupRef = useRef<L.Popup | null>(null);
  const historyPolylineRef = useRef<L.Polyline | null>(null);
  const historyCirclesRef = useRef<L.CircleMarker[]>([]);

  const { data: aisStatus } = useQuery<{ connected: boolean; vesselCount: number; mode: "live" | "demo" }>({
    queryKey: ["/api/vessel-track/status"],
    refetchInterval: 30000,
  });
  const isLive = aisStatus?.mode === "live";
  const refetchInterval = isLive ? 15000 : 60000;

  const { data: positions = [] } = useQuery<AISVessel[]>({ queryKey: ["/api/vessel-track/positions"], refetchInterval });
  const { data: fleet = [] } = useQuery<AISVessel[]>({ queryKey: ["/api/vessel-track/fleet"], refetchInterval });
  const { data: agencyVessels = [] } = useQuery<AISVessel[]>({ queryKey: ["/api/vessel-track/agency-vessels"], enabled: isAgent || isAdmin, refetchInterval });

  const historyDays = historyRange === "1" ? 1 : historyRange === "3" ? 3 : 7;
  const { data: historyData } = useQuery<{
    type: string; count: number; features: any[]; line: any | null;
  }>({
    queryKey: ["/api/vessel-track/history", selectedHistoryMmsi, historyRange],
    queryFn: async () => {
      const res = await fetch(
        `/api/vessel-track/history/${encodeURIComponent(selectedHistoryMmsi!)}?days=${historyDays}`,
        { credentials: "include" }
      );
      return res.json();
    },
    enabled: !!selectedHistoryMmsi && !useDatalasticTrack,
    staleTime: 60000,
  });

  const { data: datalasticTrackData, isFetching: fetchingDatalasticTrack } = useQuery<{
    type: string; count: number; features: any[]; line: any | null; source?: string;
  }>({
    queryKey: ["/api/vessel-track/datalastic-track", selectedHistoryMmsi],
    queryFn: async () => {
      const res = await fetch(
        `/api/vessel-track/datalastic-track?mmsi=${encodeURIComponent(selectedHistoryMmsi!)}`,
        { credentials: "include" }
      );
      return res.json();
    },
    enabled: !!selectedHistoryMmsi && useDatalasticTrack,
    staleTime: 300000,
  });

  const activeHistoryData = useDatalasticTrack ? datalasticTrackData : historyData;

  const handleFocus = useCallback((v: AISVessel) => {
    const id = String(v.mmsi || v.id || "");
    setFlyTarget([v.lat, v.lng]);
    setHighlightedId(id);
  }, []);

  const doSearch = useCallback(async (q: string, setResults: (r: AISVessel[]) => void, setLoading: (b: boolean) => void) => {
    if (!q.trim()) { setResults([]); setDatalasticSearchResults([]); return; }
    setLoading(true);
    setDatalasticSearchResults([]);
    try {
      const res = await fetch(`/api/vessel-track/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
      const data = await res.json();
      const aisResults = Array.isArray(data) ? data : [];
      setResults(aisResults);
      if (aisResults.length === 0 && /^\d{7,9}$/.test(q.trim())) {
        const type = q.trim().length === 9 ? "mmsi" : "imo";
        try {
          const dr = await fetch(`/api/vessel-track/datalastic-search?q=${encodeURIComponent(q)}&type=${type}`, { credentials: "include" });
          if (dr.ok) {
            const dd = await dr.json();
            if (Array.isArray(dd)) setDatalasticSearchResults(dd);
          } else {
            console.warn("Datalastic search returned", dr.status, await dr.text().catch(() => ""));
          }
        } catch (e) {
          console.warn("Datalastic search error:", e);
        } finally {
          setLoading(false);
        }
        return;
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mapSearchTimeout.current) clearTimeout(mapSearchTimeout.current);
    mapSearchTimeout.current = setTimeout(() => doSearch(mapSearch, setMapSearchResults, setIsMapSearching), 300);
    return () => { if (mapSearchTimeout.current) clearTimeout(mapSearchTimeout.current); };
  }, [mapSearch, doSearch]);

  const allMapVessels: AISVessel[] = [
    ...positions,
    ...fleet.filter(f => !positions.some(p => p.mmsi && p.mmsi === f.mmsi)),
    ...agencyVessels.filter(a => !positions.some(p => p.mmsi && p.mmsi === (a as any).mmsi)),
  ];

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [38.5, 35.5],
      zoom: 6,
      zoomControl: false,
    });

    // CartoDB dark tiles — free, no API key required
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    // OpenSeaMap maritime symbols overlay
    L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openseamap.org" target="_blank">OpenSeaMap</a> contributors',
      opacity: 0.85,
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);
    L.control.scale({ maxWidth: 100, imperial: false, position: "bottomleft" }).addTo(map);

    mapRef.current = map;

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update vessel markers whenever vessels or highlight changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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
      const svgHtml = createShipSvg(v.heading, v.status, isHighlighted);
      const svgSize = isHighlighted ? 32 : 26;

      const existing = markersRef.current.get(id);
      if (existing) {
        existing.setLatLng([v.lat, v.lng]);
        existing.setIcon(L.divIcon({
          html: svgHtml,
          iconSize: [svgSize, svgSize],
          iconAnchor: [svgSize / 2, svgSize / 2],
          className: "",
        }));
        return;
      }

      const icon = L.divIcon({
        html: svgHtml,
        iconSize: [svgSize, svgSize],
        iconAnchor: [svgSize / 2, svgSize / 2],
        className: "",
      });

      const marker = L.marker([v.lat, v.lng], { icon })
        .addTo(map)
        .bindPopup(createPopupHtml(v), { maxWidth: 260 })
        .on("click", () => {
          setHighlightedId(id);
          setFlyTarget([v.lat, v.lng]);
          setSelectedHistoryMmsi(v.mmsi || null);
          if (v.mmsi) setHistoryRange("1");
        });

      markersRef.current.set(id, marker);
    });
  }, [allMapVessels, highlightedId]);

  // flyTo when target changes
  useEffect(() => {
    if (flyTarget && mapRef.current) {
      mapRef.current.flyTo([flyTarget[0], flyTarget[1]], 10, { animate: true, duration: 1.2 });
    }
  }, [flyTarget]);

  // History route layers (Leaflet polyline + circle markers)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function safeRemove() {
      if (historyPolylineRef.current) { historyPolylineRef.current.remove(); historyPolylineRef.current = null; }
      historyCirclesRef.current.forEach(c => c.remove());
      historyCirclesRef.current = [];
      if (historyPopupRef.current) { map.closePopup(historyPopupRef.current); historyPopupRef.current = null; }
    }

    if (!selectedHistoryMmsi || !activeHistoryData || activeHistoryData.count === 0 || !activeHistoryData.line) {
      safeRemove();
      return;
    }

    safeRemove();

    const lineColor = useDatalasticTrack ? "#A78BFA" : "#60A5FA";
    const ptColor = useDatalasticTrack ? "#EDE9FE" : "#BFDBFE";
    const strokeColor = useDatalasticTrack ? "#7C3AED" : "#2563EB";

    // Draw polyline
    if (activeHistoryData.line?.geometry?.coordinates?.length >= 2) {
      const coords: [number, number][] = activeHistoryData.line.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng]
      );
      historyPolylineRef.current = L.polyline(coords, {
        color: lineColor, weight: 2.5, opacity: 0.85,
      }).addTo(map);
    }

    // Draw point markers
    activeHistoryData.features.forEach((f: any) => {
      const [lng, lat] = f.geometry.coordinates;
      const { speed, timestamp, destination } = f.properties as any;
      const dateStr = timestamp ? fmtDateTime(timestamp) : "—";
      const popupHtml = `<div style="font-size:11px;font-family:system-ui;line-height:1.6;min-width:130px">
        <div style="font-weight:700;color:#1d4ed8;margin-bottom:3px">${dateStr}</div>
        ${speed != null ? `<div>Speed: <strong>${speed} kn</strong></div>` : ""}
        ${destination ? `<div>Dest: ${destination}</div>` : ""}
      </div>`;

      const circle = L.circleMarker([lat, lng], {
        radius: 5,
        fillColor: ptColor,
        color: strokeColor,
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.9,
      })
        .on("mouseover", function() {
          const popup = L.popup({ closeButton: false })
            .setLatLng([lat, lng])
            .setContent(popupHtml)
            .openOn(map);
          historyPopupRef.current = popup;
        })
        .on("mouseout", function() {
          if (historyPopupRef.current) { map.closePopup(historyPopupRef.current); historyPopupRef.current = null; }
        })
        .addTo(map);

      historyCirclesRef.current.push(circle);
    });

    return safeRemove;
  }, [selectedHistoryMmsi, activeHistoryData, useDatalasticTrack]);

  // Resize map when switching back to map view
  useEffect(() => {
    if (viewMode === "map" && mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 50);
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
        {/* Title + badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center">
            <Navigation className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
          </div>
          <span className="font-serif font-bold text-sm tracking-tight whitespace-nowrap">Vessel Track</span>
          <span className="text-[10px] text-muted-foreground hidden lg:inline whitespace-nowrap">
            {allMapVessels.length} vessels
          </span>
          {isLive ? (
            <Badge variant="outline" className="text-[10px] font-bold border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 flex items-center gap-1 flex-shrink-0" data-testid="badge-ais-status">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE AIS
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] font-bold border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/20 flex items-center gap-1 flex-shrink-0" data-testid="badge-ais-status">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              DEMO
            </Badge>
          )}
        </div>

        {/* Search bar — only shown in map mode */}
        {viewMode === "map" && (
          <div className="flex-1 relative max-w-sm" data-testid="topbar-search">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name, MMSI or IMO..."
              value={mapSearch}
              onChange={(e) => setMapSearch(e.target.value)}
              className="pl-8 pr-7 h-8 text-xs"
              data-testid="input-map-search"
            />
            {isMapSearching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            {mapSearch && !isMapSearching && (
              <button
                onClick={() => { setMapSearch(""); setMapSearchResults([]); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                data-testid="button-clear-map-search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {mapSearch && (
              <div className="absolute left-0 right-0 top-full z-[2000] mt-1 bg-background border rounded-lg shadow-xl overflow-hidden" data-testid="map-search-results">
                {mapSearchResults.length === 0 && datalasticSearchResults.length === 0 && !isMapSearching ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    "{mapSearch}" için gemi bulunamadı.{/^\d{7,9}$/.test(mapSearch.trim()) ? "" : " IMO veya MMSI ile aratmayı deneyin."}
                  </p>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-border">
                    {mapSearchResults.slice(0, 20).map((v) => {
                      const vName = v.name || v.vesselName || "Unknown";
                      return (
                        <button
                          key={v.mmsi || String(v.id)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
                          onClick={() => { handleFocus(v); setMapSearch(""); setMapSearchResults([]); setDatalasticSearchResults([]); }}
                          data-testid={`search-result-${v.mmsi}`}
                        >
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${v.status === "underway" ? "bg-blue-500" : v.status === "anchored" ? "bg-amber-500" : "bg-emerald-500"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{vName}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{v.flag} · {v.vesselType}{v.mmsi ? ` · ${v.mmsi}` : ""}</p>
                          </div>
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        </button>
                      );
                    })}
                    {datalasticSearchResults.length > 0 && (
                      <>
                        {mapSearchResults.length > 0 && <div className="px-3 py-1 bg-muted/30 text-[10px] text-muted-foreground font-medium flex items-center gap-1"><Satellite className="w-3 h-3" /> Datalastic</div>}
                        {mapSearchResults.length === 0 && <div className="px-3 py-1 bg-violet-500/10 text-[10px] text-violet-400 font-medium flex items-center gap-1"><Satellite className="w-3 h-3" /> Datalastic Sonuçları</div>}
                        {datalasticSearchResults.map((v, i) => (
                          <button
                            key={v.imo || v.mmsi || i}
                            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-violet-500/10 transition-colors text-left"
                            onClick={() => {
                              if (v.latitude && v.longitude) {
                                setFlyTarget([v.latitude, v.longitude]);
                              }
                              setMapSearch("");
                              setMapSearchResults([]);
                              setDatalasticSearchResults([]);
                            }}
                            data-testid={`datalastic-result-${v.imo || i}`}
                          >
                            <Satellite className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate">{v.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{v.flag} · {v.vessel_type}{v.imo ? ` · IMO ${v.imo}` : ""}{v.mmsi ? ` · ${v.mmsi}` : ""}</p>
                            </div>
                            <MapPin className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex-1" />

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
            <MapIcon className="w-3.5 h-3.5" />
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

      {/* Map view — full width, hidden in list mode */}
      <div className={`${viewMode === "list" ? "hidden" : "flex-1"} relative overflow-hidden`} data-testid="panel-map">
        {/* Map error overlay */}
        {mapError && (
          <div className="absolute inset-0 z-[3000] flex items-center justify-center bg-background/90">
            <div className="text-center p-6 max-w-md rounded-xl border bg-card shadow-xl">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <p className="text-sm font-semibold mb-2">Harita Yüklenemedi</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{mapError}</p>
              <a href="https://account.mapbox.com/access-tokens" target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-block text-xs text-blue-400 underline hover:text-blue-300">
                account.mapbox.com/access-tokens →
              </a>
            </div>
          </div>
        )}
        {/* Demo data banner — only show when not live */}
        {!demoBarDismissed && !isLive && (
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

        {/* History route control panel */}
        {selectedHistoryMmsi && (
          <div className="absolute top-3 left-3 z-[1000] bg-background/95 backdrop-blur border rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 flex-wrap max-w-sm" data-testid="panel-history-controls">
            <Clock className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-foreground whitespace-nowrap">Route History</span>
            {!useDatalasticTrack && (
              <div className="flex gap-1">
                {(["1", "3", "7"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setHistoryRange(d)}
                    data-testid={`button-history-range-${d}`}
                    className={`px-2 py-0.5 text-[11px] rounded font-semibold transition-colors ${
                      historyRange === d
                        ? "bg-blue-600 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {d === "1" ? "24h" : d === "3" ? "3d" : "7d"}
                  </button>
                ))}
              </div>
            )}
            {activeHistoryData && (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {useDatalasticTrack && <span>🛰 </span>}{activeHistoryData.count} pts
              </span>
            )}
            <button
              onClick={() => { setUseDatalasticTrack(v => !v); }}
              data-testid="button-toggle-datalastic-track"
              title={useDatalasticTrack ? "AIS geçmişine dön" : "Datalastic geçmiş rotası"}
              className={`px-2 py-0.5 text-[11px] rounded font-semibold transition-colors flex items-center gap-1 ${
                useDatalasticTrack
                  ? "bg-violet-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-violet-600 hover:text-white"
              }`}
            >
              {fetchingDatalasticTrack ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <span>🛰</span>}
              {useDatalasticTrack ? "Datalastic ✓" : "Datalastic"}
            </button>
            <button
              onClick={() => { setSelectedHistoryMmsi(null); setUseDatalasticTrack(false); }}
              data-testid="button-clear-history"
              className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
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
  );
}
