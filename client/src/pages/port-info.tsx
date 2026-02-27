import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Anchor, Search, MapPin, Globe, Info, Loader2,
  Navigation, Clock, Waves, Building2, X, Users, FileText,
  ExternalLink, Ship, DollarSign
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Port } from "@shared/schema";

interface Agent {
  id: number;
  companyName: string;
  companyType: string;
  contactEmail: string | null;
  contactPhone: string | null;
  logoUrl: string | null;
  isVerified: boolean;
  isFeatured: boolean;
  description: string | null;
  userId: string;
}

interface Tender {
  id: number;
  vesselName: string;
  cargoType: string | null;
  cargoQuantity: string | null;
  grt: string | null;
  status: string;
  createdAt: string;
  expiryHours: number | null;
}

interface PortInfoData {
  port: Port | null;
  extended: {
    lat: number | null;
    lng: number | null;
    timezone: string | null;
    maxDraft: number | null;
    facilities: string[] | string | null;
    city: string | null;
    country: string | null;
    displayName: string | null;
  } | null;
  agents: Agent[];
  openTenders: Tender[];
}

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border/50">
      <div className="w-8 h-8 rounded-md bg-[hsl(var(--maritime-accent)/0.15)] flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <div className="font-semibold mt-0.5">{value}</div>
      </div>
    </div>
  );
}

export default function PortInfo() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedLocode, setSelectedLocode] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const debouncedSet = useCallback(
    debounce((v: string) => setDebouncedQuery(v), 300),
    []
  );

  const handleSearch = (v: string) => {
    setSearchQuery(v);
    debouncedSet(v);
    setShowDropdown(true);
    if (!v) setSelectedLocode(null);
  };

  const { data: searchResults, isLoading: isSearching } = useQuery<Port[]>({
    queryKey: ["/api/ports", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const res = await fetch(`/api/ports?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  const { data: portInfoData, isLoading: isLoadingInfo } = useQuery<PortInfoData>({
    queryKey: ["/api/port-info", selectedLocode],
    queryFn: async () => {
      const res = await fetch(`/api/port-info/${selectedLocode}`);
      if (!res.ok) throw new Error("Port not found");
      return res.json();
    },
    enabled: !!selectedLocode,
  });

  const handleSelectPort = (port: Port) => {
    setSelectedLocode(port.code || null);
    setSearchQuery(port.name);
    setShowDropdown(false);
  };

  const handleClear = () => {
    setSearchQuery("");
    setDebouncedQuery("");
    setSelectedLocode(null);
    setShowDropdown(false);
  };

  const showResults = showDropdown && debouncedQuery.length >= 2 && !selectedLocode;
  const facilities = portInfoData?.extended?.facilities;
  const facilityList: string[] = Array.isArray(facilities)
    ? facilities
    : typeof facilities === "string"
    ? facilities.split(",").map(f => f.trim()).filter(Boolean)
    : [];

  const lat = portInfoData?.extended?.lat;
  const lng = portInfoData?.extended?.lng;
  const hasCoords = lat && lng;

  const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.15},${lat - 0.12},${lng + 0.15},${lat + 0.12}&layer=mapnik&marker=${lat},${lng}`
    : null;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[hsl(var(--maritime-accent)/0.15)] flex items-center justify-center">
          <Anchor className="w-5 h-5 text-[hsl(var(--maritime-accent))]" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-port-info-title">
            Port Information
          </h1>
          <p className="text-muted-foreground text-sm">
            Search Turkish ports and access detailed maritime information.
          </p>
        </div>
      </div>

      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            data-testid="input-port-search"
            placeholder="Search by port name or LOCODE (e.g. Mersin, TRMER)..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            className="pl-10 pr-10 h-11 text-base"
          />
          {searchQuery && (
            <button
              onClick={handleClear}
              className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-clear-search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {showResults && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 w-full bg-background border rounded-lg shadow-lg max-h-72 overflow-y-auto"
            data-testid="list-port-results"
          >
            {isSearching ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Searching...
              </div>
            ) : searchResults && searchResults.length > 0 ? (
              searchResults.map(port => (
                <button
                  key={port.id}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left border-b last:border-0"
                  onClick={() => handleSelectPort(port)}
                  data-testid={`button-port-result-${port.id}`}
                >
                  <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{port.name}</p>
                    <p className="text-xs text-muted-foreground">{port.country}</p>
                  </div>
                  {port.code && (
                    <Badge variant="outline" className="text-xs font-mono flex-shrink-0">
                      {port.code}
                    </Badge>
                  )}
                </button>
              ))
            ) : debouncedQuery.length >= 2 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                No ports found matching "{debouncedQuery}"
              </div>
            ) : null}
          </div>
        )}
      </div>

      {selectedLocode && (
        <>
          {isLoadingInfo ? (
            <Card className="p-6 space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-40" />
              <div className="grid grid-cols-2 gap-4 pt-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
              </div>
              <Skeleton className="h-48 w-full" />
            </Card>
          ) : portInfoData ? (
            <div className="space-y-4" data-testid="card-port-detail">
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-r from-[hsl(var(--maritime-primary))] to-[hsl(var(--maritime-secondary))] px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {portInfoData.port?.name || searchQuery}
                      </h2>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Globe className="w-3.5 h-3.5 text-white/70" />
                        <span className="text-white/80 text-sm">
                          {portInfoData.extended?.country || portInfoData.port?.country || "Turkey"}
                        </span>
                        {portInfoData.extended?.city && (
                          <>
                            <span className="text-white/40">·</span>
                            <span className="text-white/80 text-sm">{portInfoData.extended.city}</span>
                          </>
                        )}
                        {hasCoords && (
                          <>
                            <span className="text-white/40">·</span>
                            <span className="text-white/60 text-xs font-mono">
                              {lat!.toFixed(4)}°N, {lng!.toFixed(4)}°E
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge
                      className="bg-white/20 text-white border-white/30 font-mono text-sm px-3 py-1 flex-shrink-0"
                      data-testid="text-port-locode"
                    >
                      {selectedLocode}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {portInfoData.port?.currency && (
                      <InfoCard
                        icon={<DollarSign className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />}
                        label="Currency"
                        value={portInfoData.port.currency}
                      />
                    )}
                    <InfoCard
                      icon={<Clock className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />}
                      label="Timezone"
                      value={portInfoData.extended?.timezone || "Europe/Istanbul (UTC+3)"}
                    />
                    {portInfoData.extended?.maxDraft && (
                      <InfoCard
                        icon={<Waves className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />}
                        label="Max Draft"
                        value={`${portInfoData.extended.maxDraft}m`}
                      />
                    )}
                    {portInfoData.port?.code && (
                      <InfoCard
                        icon={<MapPin className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />}
                        label="UN/LOCODE"
                        value={<span className="font-mono">{portInfoData.port.code}</span>}
                      />
                    )}
                    {hasCoords && (
                      <InfoCard
                        icon={<Navigation className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />}
                        label="Coordinates"
                        value={
                          <span className="font-mono text-sm">
                            {lat!.toFixed(4)}°N, {lng!.toFixed(4)}°E
                          </span>
                        }
                      />
                    )}
                    <InfoCard
                      icon={<Ship className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />}
                      label="Country"
                      value={portInfoData.extended?.country || "Turkey"}
                    />
                  </div>

                  {facilityList.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Facilities & Services</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {facilityList.map((facility, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {facility}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {mapSrc && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Port Location</p>
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=13/${lat}/${lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-xs text-[hsl(var(--maritime-accent))] hover:underline flex items-center gap-1"
                          data-testid="link-open-map"
                        >
                          Open in Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="rounded-lg overflow-hidden border border-border h-56" data-testid="map-port-location">
                        <iframe
                          src={mapSrc}
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          title={`Map of ${portInfoData.port?.name || searchQuery}`}
                          loading="lazy"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {portInfoData.agents && portInfoData.agents.length > 0 && (
                <Card data-testid="card-port-agents">
                  <div className="px-6 py-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />
                      <h3 className="font-semibold">Ship Agents at This Port</h3>
                      <Badge variant="secondary" className="text-xs">{portInfoData.agents.length}</Badge>
                    </div>
                    <Link href="/directory">
                      <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="link-view-all-agents">
                        View All <ExternalLink className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {portInfoData.agents.slice(0, 6).map(agent => (
                        <Link key={agent.id} href={`/directory/${agent.id}`}>
                          <div
                            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                            data-testid={`card-agent-${agent.id}`}
                          >
                            <div className="w-10 h-10 rounded-md bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {agent.logoUrl ? (
                                <img src={agent.logoUrl} alt={agent.companyName} className="w-full h-full object-contain" />
                              ) : (
                                <Anchor className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-medium text-sm truncate">{agent.companyName}</p>
                                {agent.isVerified && (
                                  <Badge className="text-[10px] px-1 py-0 bg-blue-100 text-blue-700 border-0">✓ Verified</Badge>
                                )}
                                {agent.isFeatured && (
                                  <Badge className="text-[10px] px-1 py-0 bg-amber-100 text-amber-700 border-0">Featured</Badge>
                                )}
                              </div>
                              {agent.contactEmail && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{agent.contactEmail}</p>
                              )}
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          </div>
                        </Link>
                      ))}
                    </div>
                    {portInfoData.agents.length > 6 && (
                      <div className="mt-3 text-center">
                        <Link href="/directory">
                          <Button variant="outline" size="sm" className="text-xs">
                            View {portInfoData.agents.length - 6} more agents
                          </Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {portInfoData.openTenders && portInfoData.openTenders.length > 0 && (
                <Card data-testid="card-port-tenders">
                  <div className="px-6 py-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />
                      <h3 className="font-semibold">Active Tenders at This Port</h3>
                      <Badge variant="secondary" className="text-xs">{portInfoData.openTenders.length}</Badge>
                    </div>
                    <Link href="/tenders">
                      <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="link-view-all-tenders">
                        View All <ExternalLink className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      {portInfoData.openTenders.map(tender => (
                        <div
                          key={tender.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                          data-testid={`card-tender-${tender.id}`}
                        >
                          <Ship className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">{tender.vesselName}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {tender.cargoType && (
                                <span className="text-xs text-muted-foreground">{tender.cargoType}</span>
                              )}
                              {tender.cargoQuantity && (
                                <span className="text-xs text-muted-foreground">· {tender.cargoQuantity}</span>
                              )}
                              {tender.grt && (
                                <span className="text-xs text-muted-foreground">· {tender.grt} GRT</span>
                              )}
                            </div>
                          </div>
                          <Badge className="bg-green-100 text-green-700 border-0 text-xs flex-shrink-0">Open</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {portInfoData.agents?.length === 0 && portInfoData.openTenders?.length === 0 && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-muted/30 border border-dashed">
                  <Info className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    No registered agents or active tenders found for this port yet.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Anchor className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">Port not found in database.</p>
            </Card>
          )}
        </>
      )}

      {!selectedLocode && !searchQuery && (
        <div className="text-center py-16 text-muted-foreground">
          <Anchor className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium">Search for a port</p>
          <p className="text-sm mt-1">Enter a port name or LOCODE to view maritime details, agents, and active tenders.</p>
        </div>
      )}
    </div>
  );
}
