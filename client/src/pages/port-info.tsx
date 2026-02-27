import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import {
  Anchor, Search, MapPin, Globe, Info, Loader2,
  Navigation, Clock, Waves, Building2, X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Port } from "@shared/schema";

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
  } | null;
}

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
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
    if (!v) {
      setSelectedLocode(null);
    }
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

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
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
            </Card>
          ) : portInfoData ? (
            <Card data-testid="card-port-detail" className="overflow-hidden">
              <div className="bg-gradient-to-r from-[hsl(var(--maritime-primary))] to-[hsl(var(--maritime-secondary))] px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {portInfoData.port?.name || searchQuery}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
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
                    </div>
                  </div>
                  {selectedLocode && (
                    <Badge
                      className="bg-white/20 text-white border-white/30 font-mono text-sm px-3 py-1"
                      data-testid="text-port-locode"
                    >
                      {selectedLocode}
                    </Badge>
                  )}
                </div>
              </div>

              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {portInfoData.port?.currency && (
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                      <div className="w-8 h-8 rounded-md bg-[hsl(var(--maritime-accent)/0.15)] flex items-center justify-center flex-shrink-0">
                        <span className="text-[hsl(var(--maritime-accent))] font-bold text-sm">$</span>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Currency</p>
                        <p className="font-semibold mt-0.5">{portInfoData.port.currency}</p>
                      </div>
                    </div>
                  )}

                  {portInfoData.extended?.timezone && (
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                      <div className="w-8 h-8 rounded-md bg-[hsl(var(--maritime-accent)/0.15)] flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Timezone</p>
                        <p className="font-semibold mt-0.5">{portInfoData.extended.timezone}</p>
                      </div>
                    </div>
                  )}

                  {portInfoData.extended?.maxDraft && (
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                      <div className="w-8 h-8 rounded-md bg-[hsl(var(--maritime-accent)/0.15)] flex items-center justify-center flex-shrink-0">
                        <Waves className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Max Draft</p>
                        <p className="font-semibold mt-0.5">{portInfoData.extended.maxDraft}m</p>
                      </div>
                    </div>
                  )}

                  {portInfoData.extended?.lat && portInfoData.extended?.lng && (
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                      <div className="w-8 h-8 rounded-md bg-[hsl(var(--maritime-accent)/0.15)] flex items-center justify-center flex-shrink-0">
                        <Navigation className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Coordinates</p>
                        <p className="font-semibold mt-0.5 font-mono text-sm">
                          {portInfoData.extended.lat.toFixed(4)}°N, {portInfoData.extended.lng.toFixed(4)}°E
                        </p>
                      </div>
                    </div>
                  )}

                  {portInfoData.port?.code && (
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                      <div className="w-8 h-8 rounded-md bg-[hsl(var(--maritime-accent)/0.15)] flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">LOCODE</p>
                        <p className="font-semibold mt-0.5 font-mono" data-testid="text-port-country">
                          {portInfoData.port.code}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {facilityList.length > 0 && (
                  <div className="mt-6">
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

                {!portInfoData.extended && (
                  <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-muted/30 border border-dashed">
                    <Info className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Extended port data (coordinates, timezone, facilities) is not available for this port.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
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
          <p className="text-sm mt-1">Enter a port name or LOCODE to view maritime details.</p>
        </div>
      )}
    </div>
  );
}
