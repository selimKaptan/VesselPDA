import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation, Search, Plus, X, Anchor, Ship, MapPin, ArrowRight, AlertTriangle, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { VesselWatchlistItem } from "@shared/schema";

// Fix Leaflet default icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

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

function createShipIcon(heading: number, status: string, highlight = false) {
  const color = highlight ? "#FBBF24" : (STATUS_COLORS[status] || "#6B7280");
  const size = highlight ? 20 : 16;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size + 8}" height="${size + 8}" viewBox="0 0 ${size + 8} ${size + 8}">
    <g transform="translate(${(size + 8) / 2}, ${(size + 8) / 2}) rotate(${heading})">
      <polygon points="0,${-size / 2} ${size / 3},${size / 3} 0,${size / 4} ${-size / 3},${size / 3}" fill="${color}" stroke="white" stroke-width="1.5"/>
    </g>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [size + 8, size + 8],
    iconAnchor: [(size + 8) / 2, (size + 8) / 2],
    popupAnchor: [0, -((size + 8) / 2)],
  });
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, 10, { duration: 1.2 });
    }
  }, [target, map]);
  return null;
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

export default function VesselTrack() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRole = (user as any)?.userRole || "shipowner";
  const activeRole = (user as any)?.activeRole || userRole;
  const isAdmin = userRole === "admin";
  const effectiveRole = isAdmin ? activeRole : userRole;
  const isAgent = effectiveRole === "agent";

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

  return (
    <div className="flex h-full" style={{ height: "calc(100vh - 56px)" }}>

      {/* Left panel */}
      <div className="w-80 flex-shrink-0 border-r flex flex-col bg-background overflow-hidden" data-testid="panel-vessel-list">
        <div className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0">
              <Navigation className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-base tracking-tight">Vessel Track</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                {allMapVessels.length} vessels on map
              </p>
            </div>
            {isLive ? (
              <Badge variant="outline" className="ml-auto text-[10px] font-bold border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 flex items-center gap-1" data-testid="badge-ais-status">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE AIS
              </Badge>
            ) : (
              <Badge variant="outline" className="ml-auto text-[10px] font-bold border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/20 flex items-center gap-1" data-testid="badge-ais-status">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                DEMO
              </Badge>
            )}
          </div>
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
            {/* Inline watchlist search */}
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
            {/* Watchlist items */}
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
      <div className="flex-1 relative overflow-hidden" data-testid="panel-map">
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

        <MapContainer
          center={[38.5, 35.5]}
          zoom={6}
          style={{ height: "100%", width: "100%" }}
          data-testid="map-container"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <FlyTo target={flyTarget} />
          {allMapVessels.map((v, i) => {
            const id = String(v.mmsi || v.id || i);
            const isHighlighted = highlightedId === id;
            const vName = v.vesselName || v.name || "Unknown";
            return (
              <Marker
                key={id}
                position={[v.lat, v.lng]}
                icon={createShipIcon(v.heading, v.status, isHighlighted)}
                data-testid={`marker-vessel-${id}`}
                eventHandlers={{
                  click: () => {
                    setHighlightedId(id);
                    setFlyTarget([v.lat, v.lng]);
                  },
                }}
              >
                <Popup>
                  <div className="min-w-[200px] space-y-2 p-1">
                    <div className="flex items-start gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full mt-0.5 flex-shrink-0 ${
                        v.status === "underway" ? "bg-blue-500" : v.status === "anchored" ? "bg-amber-500" : "bg-emerald-500"
                      }`} />
                      <p className="font-bold text-sm leading-tight">{vName}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                      {v.mmsi && <><span className="text-gray-500">MMSI</span><span className="font-mono">{v.mmsi}</span></>}
                      <span className="text-gray-500">Flag</span><span>{v.flag}</span>
                      <span className="text-gray-500">Type</span><span>{v.vesselType}</span>
                      <span className="text-gray-500">Status</span>
                      <span className={`font-semibold ${v.status === "underway" ? "text-blue-600" : v.status === "anchored" ? "text-amber-600" : "text-emerald-600"}`}>
                        {STATUS_LABELS[v.status]}
                      </span>
                      {v.speed !== undefined && <><span className="text-gray-500">Speed</span><span>{v.speed} kn</span></>}
                      {v.heading !== undefined && <><span className="text-gray-500">Heading</span><span>{v.heading}°</span></>}
                      {v.destination && <><span className="text-gray-500">Dest.</span><span className="font-semibold">{v.destination}</span></>}
                      {v.eta && <><span className="text-gray-500">ETA</span><span>{new Date(v.eta).toLocaleDateString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></>}
                    </div>
                    <p className="text-[9px] text-gray-400 italic">Demo position data</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

    </div>
  );
}
