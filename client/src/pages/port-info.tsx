import { useState, useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Anchor, Search, MapPin, Globe, Info, Loader2,
  Waves, Building2, X, Users, FileText,
  ExternalLink, Ship, AlertTriangle, ChevronLeft
} from "lucide-react";
import { WeatherPanel } from "@/components/port-weather-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/page-meta";
import type { Port } from "@shared/schema";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

interface Agent {
  id: number; companyName: string; companyType: string;
  contactEmail: string | null; contactPhone: string | null;
  logoUrl: string | null; isVerified: boolean; isFeatured: boolean;
  description: string | null; userId: string;
}
interface Tender {
  id: number; vesselName: string; cargoType: string | null;
  cargoQuantity: string | null; grt: string | null;
  status: string; createdAt: string; expiryHours: number | null;
}
interface PortInfoData {
  port: Port | null;
  extended: {
    lat: number | null; lng: number | null; timezone: string | null;
    maxDraft: number | null; facilities: string[] | string | null;
    city: string | null; country: string | null; displayName: string | null;
  } | null;
  agents: Agent[];
  openTenders: Tender[];
}
function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50 border border-border/50">
      <div className="w-7 h-7 rounded-md bg-[hsl(var(--maritime-accent)/0.15)] flex items-center justify-center flex-shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <div className="font-semibold text-sm mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function PortDetailPanel({
  selectedPort, portInfoData, isLoadingInfo,
  portMapContainerRef, lat, lng, hasCoords, facilityList, onClose, portAlerts,
}: {
  selectedPort: Port;
  portInfoData: PortInfoData | undefined;
  isLoadingInfo: boolean;
  portMapContainerRef: React.RefObject<HTMLDivElement>;
  lat: number | null; lng: number | null; hasCoords: boolean;
  facilityList: string[];
  onClose: () => void;
  portAlerts: any[];
}) {
  const SEVERITY_STYLES: Record<string, string> = {
    info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-300",
    warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-300",
    danger: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-700 dark:text-red-300",
  };
  return (
    <div className="h-full flex flex-col overflow-hidden" data-testid="card-port-detail">
      {/* Detail header */}
      <div className="flex-shrink-0 px-4 py-3 border-b bg-[hsl(var(--maritime-primary))] flex items-center gap-3">
        <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 rounded md:hidden" data-testid="button-back-to-list">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-white text-base truncate">{portInfoData?.port?.name || selectedPort.name}</h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Globe className="w-3 h-3 text-white/60" />
            <span className="text-white/75 text-xs">{portInfoData?.extended?.country || "Turkey"}</span>
            {portInfoData?.extended?.city && <><span className="text-white/40">·</span><span className="text-white/75 text-xs">{portInfoData.extended.city}</span></>}
            {hasCoords && <><span className="text-white/40">·</span><span className="text-white/60 text-[10px] font-mono">{lat!.toFixed(3)}°N {lng!.toFixed(3)}°E</span></>}
          </div>
        </div>
        <Badge className="bg-white/20 text-white border-white/30 font-mono text-xs px-2 py-0.5 flex-shrink-0" data-testid="text-port-locode">
          {selectedPort.code}
        </Badge>
        <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 rounded hidden md:block" data-testid="button-close-detail">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Port Alerts Banner */}
      {portAlerts.length > 0 && (
        <div className="flex-shrink-0 px-4 pt-3 space-y-2" data-testid="port-alert-banner">
          {portAlerts.map((alert: any) => (
            <div key={alert.id} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-sm ${SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info}`} data-testid={`port-alert-${alert.id}`}>
              <span className="flex-shrink-0 mt-0.5">{alert.severity === "danger" ? "🔴" : alert.severity === "warning" ? "⚠️" : "ℹ️"}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-xs">{alert.title}</p>
                <p className="text-xs opacity-80 mt-0.5">{alert.message}</p>
                {(alert.startsAt || alert.endsAt) && (
                  <p className="text-[10px] opacity-60 mt-1">
                    {alert.startsAt && `${new Date(alert.startsAt).toLocaleDateString("tr-TR")}`}
                    {alert.startsAt && alert.endsAt && " – "}
                    {alert.endsAt && `${new Date(alert.endsAt).toLocaleDateString("tr-TR")}`}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingInfo ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <div className="grid grid-cols-2 gap-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}</div>
            <Skeleton className="h-48 w-full" />
          </div>
        ) : portInfoData ? (
          <>
            {/* Info cards */}
            {portInfoData.extended?.maxDraft && (
              <div>
                <InfoCard icon={<Waves className="w-3.5 h-3.5 text-[hsl(var(--maritime-accent))]" />} label="Maks. Draft" value={`${portInfoData.extended.maxDraft}m`} />
              </div>
            )}

            {/* Facilities */}
            {facilityList.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tesisler & Hizmetler</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {facilityList.map((f, i) => <Badge key={i} variant="secondary" className="text-[10px]">{f}</Badge>)}
                </div>
              </div>
            )}

            {/* Map */}
            {hasCoords && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Port Location</p>
                  <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-[10px] text-[hsl(var(--maritime-accent))] hover:underline flex items-center gap-1" data-testid="link-open-map">
                    Open in Maps <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div ref={portMapContainerRef} className="rounded-lg overflow-hidden border border-border h-48" data-testid="map-port-location" />
              </div>
            )}

            {/* Weather */}
            {hasCoords ? <WeatherPanel lat={lat!} lng={lng!} /> : (
              <Card className="p-3 border-dashed">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <p className="text-xs">No coordinates available — weather cannot be displayed.</p>
                </div>
              </Card>
            )}

            {/* Agents */}
            {portInfoData.agents && portInfoData.agents.length > 0 && (
              <Card data-testid="card-port-agents">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-[hsl(var(--maritime-accent))]" />
                    <h3 className="font-semibold text-sm">Agents</h3>
                    <Badge variant="secondary" className="text-[10px]">{portInfoData.agents.length}</Badge>
                  </div>
                  <Link href="/directory"><Button variant="ghost" size="sm" className="text-[10px] h-7 gap-1" data-testid="link-view-all-agents">View All <ExternalLink className="w-2.5 h-2.5" /></Button></Link>
                </div>
                <CardContent className="p-3">
                  <div className="space-y-2">
                    {portInfoData.agents.slice(0, 4).map(agent => (
                      <Link key={agent.id} href={`/directory/${agent.id}`}>
                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`card-agent-${agent.id}`}>
                          <div className="w-8 h-8 rounded-md bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {agent.logoUrl ? <img src={agent.logoUrl} alt={agent.companyName} className="w-full h-full object-contain" /> : <Anchor className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1 flex-wrap">
                              <p className="font-medium text-xs truncate">{agent.companyName}</p>
                              {agent.isVerified && <Badge className="text-[9px] px-1 py-0 bg-blue-100 text-blue-700 border-0">✓</Badge>}
                              {agent.isFeatured && <Badge className="text-[9px] px-1 py-0 bg-amber-100 text-amber-700 border-0">⭐</Badge>}
                            </div>
                            {agent.contactEmail && <p className="text-[10px] text-muted-foreground truncate">{agent.contactEmail}</p>}
                          </div>
                          <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tenders */}
            {portInfoData.openTenders && portInfoData.openTenders.length > 0 && (
              <Card data-testid="card-port-tenders">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[hsl(var(--maritime-accent))]" />
                    <h3 className="font-semibold text-sm">Active Tenders</h3>
                    <Badge variant="secondary" className="text-[10px]">{portInfoData.openTenders.length}</Badge>
                  </div>
                  <Link href="/tenders"><Button variant="ghost" size="sm" className="text-[10px] h-7 gap-1" data-testid="link-view-all-tenders">View All <ExternalLink className="w-2.5 h-2.5" /></Button></Link>
                </div>
                <CardContent className="p-3">
                  <div className="space-y-1.5">
                    {portInfoData.openTenders.map(tender => (
                      <div key={tender.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-muted/30" data-testid={`card-tender-${tender.id}`}>
                        <Ship className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-xs">{tender.vesselName}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {tender.cargoType && <span className="text-[10px] text-muted-foreground">{tender.cargoType}</span>}
                            {tender.grt && <span className="text-[10px] text-muted-foreground">· {tender.grt} GRT</span>}
                          </div>
                        </div>
                        <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">Open</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {portInfoData.agents?.length === 0 && portInfoData.openTenders?.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/30 border border-dashed">
                <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <p className="text-xs text-muted-foreground">No registered agents or active tenders found for this port.</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Anchor className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Port information not found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getCountryFlag(country: string): string {
  if (!country) return "🌍";
  if (country === "Turkey") return "🇹🇷";
  if (country.length === 2) {
    const base = 0x1F1E6;
    const offset = "A".charCodeAt(0);
    return String.fromCodePoint(base + country.charCodeAt(0) - offset) +
           String.fromCodePoint(base + country.charCodeAt(1) - offset);
  }
  return "🌍";
}

export default function PortInfo() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPort, setSelectedPort] = useState<Port | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const isSearching = searchQuery.trim().length >= 2;

  const { data: turkishPorts = [], isLoading: turkishLoading } = useQuery<Port[]>({
    queryKey: ["/api/ports", "Turkey"],
    queryFn: async () => {
      const res = await fetch("/api/ports?country=Turkey");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<Port[]>({
    queryKey: ["/api/ports", "search", searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/ports?q=${encodeURIComponent(searchQuery.trim())}`);
      return res.json();
    },
    enabled: isSearching,
    staleTime: 60 * 1000,
  });

  const portsLoading = isSearching ? searchLoading : turkishLoading;
  const filteredPorts = isSearching ? searchResults : turkishPorts;

  const { data: portInfoData, isLoading: isLoadingInfo } = useQuery<PortInfoData>({
    queryKey: ["/api/port-info", selectedPort?.code],
    queryFn: async () => {
      const res = await fetch(`/api/port-info/${selectedPort!.code}`);
      if (!res.ok) throw new Error("Port not found");
      return res.json();
    },
    enabled: !!selectedPort?.code,
  });

  const { data: activePortAlerts = [] } = useQuery<any[]>({
    queryKey: ["/api/port-alerts", selectedPort?.id],
    queryFn: async () => {
      const url = selectedPort?.id ? `/api/port-alerts?portId=${selectedPort.id}&portName=${encodeURIComponent(selectedPort.name)}` : "/api/port-alerts";
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedPort,
  });

  const handleSelectPort = (port: Port) => {
    setSelectedPort(port);
    setMobileView("detail");
  };

  const handleClose = () => {
    setSelectedPort(null);
    setMobileView("list");
  };

  const facilities = portInfoData?.extended?.facilities;
  const facilityList: string[] = Array.isArray(facilities) ? facilities
    : typeof facilities === "string" ? facilities.split(",").map(f => f.trim()).filter(Boolean) : [];

  const lat = portInfoData?.extended?.lat ?? (portInfoData?.port as any)?.latitude ?? null;
  const lng = portInfoData?.extended?.lng ?? (portInfoData?.port as any)?.longitude ?? null;
  const hasCoords = !!(lat && lng);

  const portMapContainerRef = useRef<HTMLDivElement>(null);
  const portMapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const portMarkerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!hasCoords || !portMapContainerRef.current) return;
    if (portMapInstanceRef.current) {
      portMapInstanceRef.current.flyTo({ center: [lng!, lat!], zoom: 12, duration: 800 });
      portMarkerRef.current?.setLngLat([lng!, lat!]);
      return;
    }
    const map = new mapboxgl.Map({
      container: portMapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [lng!, lat!],
      zoom: 12,
      interactive: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    const marker = new mapboxgl.Marker({ color: "#003D7A" }).setLngLat([lng!, lat!]).addTo(map);
    portMapInstanceRef.current = map;
    portMarkerRef.current = marker;
    return () => {
      map.remove();
      portMapInstanceRef.current = null;
      portMarkerRef.current = null;
    };
  }, [hasCoords, lat, lng]);

  const showList = mobileView === "list" || !selectedPort;
  const showDetail = mobileView === "detail" && !!selectedPort;

  return (
    <div style={{ height: "calc(100vh - 56px)" }} className="flex overflow-hidden">
      <PageMeta title="Port Information | VesselPDA" description="Search Turkish ports — weather, sea conditions and berthing safety analysis." />

      {/* LEFT — Port Table */}
      <div className={`${showDetail ? "hidden md:flex" : "flex"} w-full md:w-[52%] lg:w-[48%] flex-col border-r bg-background overflow-hidden flex-shrink-0`}>

        {/* Table header */}
        <div className="flex-shrink-0 border-b bg-background">
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <div className="w-8 h-8 rounded-lg bg-[hsl(var(--maritime-accent)/0.15)] flex items-center justify-center flex-shrink-0">
              <Anchor className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-serif font-bold text-base tracking-tight" data-testid="text-port-info-title">Port Information</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                {isSearching ? `Search results · ${filteredPorts.length} ports` : `Turkey · ${turkishPorts.length} ports · Search worldwide`}
              </p>
            </div>
            {selectedPort && (
              <Badge className="text-[10px] bg-[hsl(var(--maritime-primary)/0.1)] text-[hsl(var(--maritime-primary))] border-[hsl(var(--maritime-primary)/0.3)] hidden md:flex">
                {selectedPort.name}
              </Badge>
            )}
          </div>
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                data-testid="input-port-search"
                placeholder="Search Turkish or world ports (e.g. Rotterdam, NLRTM)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-8 h-8 text-sm"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" data-testid="button-clear-search">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-0 border-t bg-muted/40 px-4 py-2">
            <div className="w-6" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Port Name</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-24 text-center">LOCODE</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-10 text-center">Coords</p>
          </div>
        </div>

        {/* Scrollable rows */}
        <div className="flex-1 overflow-y-auto" data-testid="list-port-results">
          {portsLoading ? (
            <div>
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} className="grid grid-cols-[auto_1fr_auto_auto] gap-0 px-4 py-2.5 border-b items-center">
                  <div className="w-6" />
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-5 w-16" />
                  <div className="w-10" />
                </div>
              ))}
            </div>
          ) : filteredPorts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Anchor className="w-10 h-10 text-muted-foreground/20 mb-3" />
              {isSearching ? (
                <>
                  <p className="text-sm font-medium text-muted-foreground">No ports found matching "{searchQuery}".</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Try a different name or LOCODE.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-muted-foreground">Loading Turkish ports...</p>
                </>
              )}
            </div>
          ) : (
            filteredPorts.map((port) => {
              const isSelected = selectedPort?.id === port.id;
              const hasPortCoords = !!(port as any).latitude && !!(port as any).longitude;
              const flag = getCountryFlag(port.country || "");
              return (
                <button
                  key={port.id}
                  className={`w-full grid grid-cols-[auto_1fr_auto_auto] gap-0 px-4 py-2.5 text-left border-b transition-colors items-center group ${
                    isSelected
                      ? "bg-[hsl(var(--maritime-primary)/0.07)] border-l-2 border-l-[hsl(var(--maritime-primary))]"
                      : "hover:bg-muted/40 border-l-2 border-l-transparent"
                  }`}
                  onClick={() => handleSelectPort(port)}
                  data-testid={`button-port-result-${port.id}`}
                >
                  <span className="text-sm w-6 flex-shrink-0">{flag}</span>
                  <div className="min-w-0 pr-2">
                    <p className={`text-sm font-medium truncate transition-colors ${
                      isSelected ? "text-[hsl(var(--maritime-primary))] font-semibold" : "group-hover:text-[hsl(var(--maritime-primary))]"
                    }`}>
                      {port.name}
                    </p>
                    {port.country && port.country !== "Turkey" && (
                      <p className="text-[10px] text-muted-foreground truncate">{port.country}</p>
                    )}
                  </div>
                  <div className="w-24 flex justify-center">
                    {port.code ? (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        isSelected
                          ? "bg-[hsl(var(--maritime-primary)/0.1)] text-[hsl(var(--maritime-primary))] border-[hsl(var(--maritime-primary)/0.3)]"
                          : "bg-muted text-muted-foreground border-border"
                      }`}>
                        {port.code}
                      </span>
                    ) : <span className="text-muted-foreground/30 text-xs">—</span>}
                  </div>
                  <div className="w-10 flex justify-center">
                    {hasPortCoords ? (
                      <span className="text-emerald-500" title="Coordinates available">
                        <MapPin className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground/25 text-xs">—</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t px-4 py-2 bg-muted/20 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            {isSearching ? `${filteredPorts.length} results · world search` : `${turkishPorts.length} Turkish ports · search worldwide`}
          </p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5 text-emerald-500" /> With coords</span>
            <span className="flex items-center gap-1"><span className="text-muted-foreground/40">—</span> No coords</span>
          </div>
        </div>
      </div>

      {/* RIGHT — Port Detail */}
      <div className={`${showList && !selectedPort ? "hidden md:flex" : showDetail ? "flex" : "hidden md:flex"} flex-1 flex-col overflow-hidden bg-background`}>
        {!selectedPort ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 rounded-2xl bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center mb-5">
              <Anchor className="w-10 h-10 text-[hsl(var(--maritime-primary)/0.4)]" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-muted-foreground mb-2">Select a Port</h3>
            <p className="text-sm text-muted-foreground/70 max-w-xs leading-relaxed">
              Select a port from the left — view weather, sea conditions, map location and agent information.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2 text-[10px] text-muted-foreground/60">
              <span className="px-2 py-1 rounded-full border border-dashed">🌊 Wave height</span>
              <span className="px-2 py-1 rounded-full border border-dashed">💨 Wind speed</span>
              <span className="px-2 py-1 rounded-full border border-dashed">🗺️ Map</span>
              <span className="px-2 py-1 rounded-full border border-dashed">🚢 Agents</span>
            </div>
          </div>
        ) : (
          <PortDetailPanel
            selectedPort={selectedPort}
            portInfoData={portInfoData}
            isLoadingInfo={isLoadingInfo}
            portMapContainerRef={portMapContainerRef}
            lat={lat}
            lng={lng}
            hasCoords={hasCoords}
            facilityList={facilityList}
            onClose={handleClose}
            portAlerts={activePortAlerts}
          />
        )}
      </div>
    </div>
  );
}
