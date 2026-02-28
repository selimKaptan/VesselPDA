import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Anchor, Search, MapPin, Globe, Info, Loader2,
  Navigation, Clock, Waves, Building2, X, Users, FileText,
  ExternalLink, Ship, DollarSign, Wind, Thermometer,
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Cloud
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Port } from "@shared/schema";

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
interface MarineWeather {
  waveHeight: number; waveDirection: number; wavePeriod: number; windWaveHeight: number;
}
interface CurrentWeather {
  temperature: number; windSpeed: number; windDirection: number; weatherCode: number;
}

function windDir(deg: number): string {
  const dirs = ["K", "KD", "D", "GD", "G", "GB", "B", "KB"];
  return dirs[Math.round(deg / 45) % 8];
}

function wmoDescription(code: number): string {
  if (code === 0) return "Açık Hava";
  if (code <= 3) return "Parçalı Bulutlu";
  if (code <= 48) return "Sisli";
  if (code <= 57) return "Çisenti";
  if (code <= 67) return "Yağmurlu";
  if (code <= 77) return "Karlı";
  if (code <= 82) return "Sağanak Yağışlı";
  if (code <= 99) return "Fırtınalı";
  return "Bilinmiyor";
}

function wmoIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 99) return "⛈️";
  return "🌡️";
}

type SafetyLevel = "excellent" | "good" | "moderate" | "rough" | "dangerous";

function getSafetyLevel(waveHeight: number, windKnots: number): SafetyLevel {
  if (waveHeight < 0.5 && windKnots < 10) return "excellent";
  if (waveHeight < 1.0 && windKnots < 15) return "good";
  if (waveHeight < 1.5 && windKnots < 22) return "moderate";
  if (waveHeight < 2.5 && windKnots < 30) return "rough";
  return "dangerous";
}

const SAFETY_CONFIG: Record<SafetyLevel, {
  label: string; desc: string; color: string; bg: string; border: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  excellent: {
    label: "Mükemmel", desc: "Tüm gemi tipleri için ideal koşullar. Yanaşma operasyonları sorunsuz.",
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    border: "border-emerald-200 dark:border-emerald-800/50",
    Icon: ShieldCheck,
  },
  good: {
    label: "İyi", desc: "Yanaşma operasyonları normaldir. Standart prosedürler yeterli.",
    color: "text-green-700 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/20",
    border: "border-green-200 dark:border-green-800/50",
    Icon: ShieldCheck,
  },
  moderate: {
    label: "Orta", desc: "Dikkatli manevralar gereklidir. Kılavuz kaptan önerilir.",
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-amber-200 dark:border-amber-800/50",
    Icon: ShieldAlert,
  },
  rough: {
    label: "Kötü", desc: "Küçük gemiler için önerilmez. Büyük gemiler dikkatli olmalı.",
    color: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    border: "border-orange-200 dark:border-orange-800/50",
    Icon: ShieldAlert,
  },
  dangerous: {
    label: "Tehlikeli", desc: "Liman operasyonları askıya alınmış olabilir. Acil durum dışında yanaşma önerilmez.",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-red-200 dark:border-red-800/50",
    Icon: ShieldX,
  },
};

function usePortWeather(lat: number | null | undefined, lng: number | null | undefined) {
  const enabled = !!lat && !!lng;

  const { data: marine, isLoading: marineLoading } = useQuery<MarineWeather>({
    queryKey: ["marine-weather", lat, lng],
    queryFn: async () => {
      const res = await fetch(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&current=wave_height,wave_direction,wave_period,wind_wave_height&timezone=Europe%2FIstanbul`
      );
      if (!res.ok) throw new Error("Marine API error");
      const d = await res.json();
      return {
        waveHeight: d.current.wave_height,
        waveDirection: d.current.wave_direction,
        wavePeriod: d.current.wave_period,
        windWaveHeight: d.current.wind_wave_height,
      };
    },
    enabled,
    staleTime: 15 * 60 * 1000,
  });

  const { data: weather, isLoading: weatherLoading } = useQuery<CurrentWeather>({
    queryKey: ["current-weather", lat, lng],
    queryFn: async () => {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code&wind_speed_unit=kn&timezone=Europe%2FIstanbul`
      );
      if (!res.ok) throw new Error("Weather API error");
      const d = await res.json();
      return {
        temperature: d.current.temperature_2m,
        windSpeed: d.current.wind_speed_10m,
        windDirection: d.current.wind_direction_10m,
        weatherCode: d.current.weather_code,
      };
    },
    enabled,
    staleTime: 15 * 60 * 1000,
  });

  return { marine, weather, isLoading: marineLoading || weatherLoading };
}

function WeatherPanel({ lat, lng }: { lat: number; lng: number }) {
  const { marine, weather, isLoading } = usePortWeather(lat, lng);

  if (isLoading) {
    return (
      <Card>
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Cloud className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />
          <h3 className="font-semibold">Hava Durumu & Deniz Koşulları</h3>
        </div>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!marine || !weather) return null;

  const safety = getSafetyLevel(marine.waveHeight, weather.windSpeed);
  const sc = SAFETY_CONFIG[safety];

  const meteoItems = [
    {
      icon: <span className="text-2xl">{wmoIcon(weather.weatherCode)}</span>,
      label: "Hava Durumu",
      value: wmoDescription(weather.weatherCode),
      sub: `${weather.temperature.toFixed(1)}°C`,
    },
    {
      icon: <Wind className="w-5 h-5 text-blue-500" />,
      label: "Rüzgar",
      value: `${weather.windSpeed.toFixed(1)} kn`,
      sub: `Yön: ${windDir(weather.windDirection)}`,
    },
    {
      icon: <Waves className="w-5 h-5 text-cyan-500" />,
      label: "Dalga Yüksekliği",
      value: `${marine.waveHeight.toFixed(2)} m`,
      sub: `Periyot: ${marine.wavePeriod.toFixed(1)} sn`,
    },
    {
      icon: <Thermometer className="w-5 h-5 text-orange-400" />,
      label: "Sıcaklık",
      value: `${weather.temperature.toFixed(1)}°C`,
      sub: `Dalga yönü: ${windDir(marine.waveDirection)}`,
    },
  ];

  return (
    <Card>
      <div className="px-6 py-4 border-b flex items-center gap-2">
        <Cloud className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />
        <h3 className="font-semibold">Hava Durumu & Deniz Koşulları</h3>
        <span className="ml-auto text-xs text-muted-foreground">Open-Meteo · Gerçek zamanlı</span>
      </div>
      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {meteoItems.map((item, i) => (
            <div key={i} className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/40 border border-border/50">
              <div className="flex items-center gap-2">
                {item.icon}
                <span className="text-xs text-muted-foreground font-medium">{item.label}</span>
              </div>
              <p className="text-base font-bold font-serif">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.sub}</p>
            </div>
          ))}
        </div>

        <Separator />

        <div className={`flex items-start gap-4 p-4 rounded-xl border ${sc.bg} ${sc.border}`}>
          <div className="flex-shrink-0 mt-0.5">
            <sc.Icon className={`w-6 h-6 ${sc.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className={`font-semibold text-sm ${sc.color}`}>Yanaşma Güvenliği: {sc.label}</p>
              <Badge className={`text-xs border ${sc.color} ${sc.bg} ${sc.border} font-semibold`}>
                {marine.waveHeight.toFixed(2)}m dalga · {weather.windSpeed.toFixed(1)}kn rüzgar
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{sc.desc}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted-foreground px-1">
          <span className="flex items-center gap-1"><span className="text-emerald-600 font-bold">●</span> Mükemmel: &lt;0.5m / &lt;10kn</span>
          <span className="flex items-center gap-1"><span className="text-amber-500 font-bold">●</span> Orta: &lt;1.5m / &lt;22kn</span>
          <span className="flex items-center gap-1"><span className="text-red-600 font-bold">●</span> Tehlikeli: ≥2.5m / ≥30kn</span>
        </div>
      </CardContent>
    </Card>
  );
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

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

export default function PortInfo() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPort, setSelectedPort] = useState<Port | null>(null);

  const { data: allPorts = [], isLoading: portsLoading } = useQuery<Port[]>({
    queryKey: ["/api/ports"],
    staleTime: 5 * 60 * 1000,
  });

  const filteredPorts = useMemo(() => {
    if (!searchQuery.trim()) return allPorts;
    const q = searchQuery.toLowerCase();
    return allPorts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.country && p.country.toLowerCase().includes(q))
    );
  }, [allPorts, searchQuery]);

  const { data: portInfoData, isLoading: isLoadingInfo } = useQuery<PortInfoData>({
    queryKey: ["/api/port-info", selectedPort?.code],
    queryFn: async () => {
      const res = await fetch(`/api/port-info/${selectedPort!.code}`);
      if (!res.ok) throw new Error("Port not found");
      return res.json();
    },
    enabled: !!selectedPort?.code,
  });

  const handleSelectPort = (port: Port) => {
    setSelectedPort(port);
    setTimeout(() => {
      document.getElementById("port-detail-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleClear = () => {
    setSearchQuery("");
    setSelectedPort(null);
  };

  const facilities = portInfoData?.extended?.facilities;
  const facilityList: string[] = Array.isArray(facilities)
    ? facilities
    : typeof facilities === "string"
    ? facilities.split(",").map(f => f.trim()).filter(Boolean)
    : [];

  const lat = portInfoData?.extended?.lat ?? (portInfoData?.port as any)?.latitude ?? null;
  const lng = portInfoData?.extended?.lng ?? (portInfoData?.port as any)?.longitude ?? null;
  const hasCoords = lat && lng;

  const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.15},${lat - 0.12},${lng + 0.15},${lat + 0.12}&layer=mapnik&marker=${lat},${lng}`
    : null;

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[hsl(var(--maritime-accent)/0.15)] flex items-center justify-center">
          <Anchor className="w-5 h-5 text-[hsl(var(--maritime-accent))]" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-port-info-title">
            Liman Bilgileri
          </h1>
          <p className="text-muted-foreground text-sm">
            Türk limanlarını arayın — hava durumu, deniz koşulları ve yanaşma güvenliği analizi.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          data-testid="input-port-search"
          placeholder="Liman adı veya LOCODE ile ara (ör: Mersin, TRMER)..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-10 pr-10 h-11 text-base"
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-clear-search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Port List */}
      <Card>
        <div className="px-5 py-3 border-b flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">
              {searchQuery ? `${filteredPorts.length} sonuç` : `${allPorts.length} liman`}
            </span>
            {searchQuery && allPorts.length > 0 && (
              <span className="text-xs text-muted-foreground">· "{searchQuery}" araması</span>
            )}
          </div>
          {selectedPort && (
            <Badge className="text-xs bg-[hsl(var(--maritime-primary)/0.1)] text-[hsl(var(--maritime-primary))] border-[hsl(var(--maritime-primary)/0.3)]">
              Seçili: {selectedPort.name}
            </Badge>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto" data-testid="list-port-results">
          {portsLoading ? (
            <div className="space-y-0">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-4 px-5 py-3 border-b last:border-0">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          ) : filteredPorts.length === 0 ? (
            <div className="px-5 py-8 text-center text-muted-foreground">
              <Anchor className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">"{searchQuery}" ile eşleşen liman bulunamadı.</p>
            </div>
          ) : (
            <div>
              {filteredPorts.map((port, idx) => (
                <button
                  key={port.id}
                  className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-colors border-b last:border-0 group ${
                    selectedPort?.id === port.id
                      ? "bg-[hsl(var(--maritime-primary)/0.08)] border-l-2 border-l-[hsl(var(--maritime-primary))]"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => handleSelectPort(port)}
                  data-testid={`button-port-result-${port.id}`}
                >
                  <span className="text-base flex-shrink-0 w-6 text-center">🇹🇷</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${selectedPort?.id === port.id ? "text-[hsl(var(--maritime-primary))]" : ""}`}>
                      {port.name}
                    </p>
                    {port.country && port.country !== "Turkey" && (
                      <p className="text-xs text-muted-foreground">{port.country}</p>
                    )}
                  </div>
                  {port.code && (
                    <Badge variant="outline" className="text-xs font-mono flex-shrink-0">
                      {port.code}
                    </Badge>
                  )}
                  <ExternalLink className={`w-3.5 h-3.5 flex-shrink-0 transition-opacity ${selectedPort?.id === port.id ? "opacity-70 text-[hsl(var(--maritime-primary))]" : "opacity-0 group-hover:opacity-40"}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Port Detail */}
      {selectedPort && (
        <div id="port-detail-section" className="space-y-4" data-testid="card-port-detail">
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
            <>
              {/* Port header card */}
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-r from-[hsl(var(--maritime-primary))] to-[hsl(var(--maritime-secondary))] px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {portInfoData.port?.name || selectedPort.name}
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
                      {selectedPort.code}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {portInfoData.port?.currency && (
                      <InfoCard
                        icon={<DollarSign className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />}
                        label="Para Birimi"
                        value={portInfoData.port.currency}
                      />
                    )}
                    <InfoCard
                      icon={<Clock className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />}
                      label="Saat Dilimi"
                      value={portInfoData.extended?.timezone || "Europe/Istanbul (UTC+3)"}
                    />
                    {portInfoData.extended?.maxDraft && (
                      <InfoCard
                        icon={<Waves className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />}
                        label="Maks. Draft"
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
                        label="Koordinatlar"
                        value={<span className="font-mono text-sm">{lat!.toFixed(4)}°N, {lng!.toFixed(4)}°E</span>}
                      />
                    )}
                    <InfoCard
                      icon={<Ship className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />}
                      label="Ülke"
                      value={portInfoData.extended?.country || "Turkey"}
                    />
                  </div>

                  {facilityList.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tesisler & Hizmetler</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {facilityList.map((facility, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{facility}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {mapSrc && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Liman Konumu</p>
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=13/${lat}/${lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-xs text-[hsl(var(--maritime-accent))] hover:underline flex items-center gap-1"
                          data-testid="link-open-map"
                        >
                          Haritada Aç <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="rounded-lg overflow-hidden border border-border h-56" data-testid="map-port-location">
                        <iframe
                          src={mapSrc}
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          title={`Map of ${portInfoData.port?.name || selectedPort.name}`}
                          loading="lazy"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Weather Panel */}
              {hasCoords ? (
                <WeatherPanel lat={lat!} lng={lng!} />
              ) : (
                <Card className="p-4 border-dashed">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <p className="text-sm">Bu liman için koordinat bilgisi mevcut değil — hava durumu ve deniz koşulları gösterilemiyor.</p>
                  </div>
                </Card>
              )}

              {/* Agents */}
              {portInfoData.agents && portInfoData.agents.length > 0 && (
                <Card data-testid="card-port-agents">
                  <div className="px-6 py-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />
                      <h3 className="font-semibold">Bu Limandaki Acenteler</h3>
                      <Badge variant="secondary" className="text-xs">{portInfoData.agents.length}</Badge>
                    </div>
                    <Link href="/directory">
                      <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="link-view-all-agents">
                        Tümünü Gör <ExternalLink className="w-3 h-3" />
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
                            {portInfoData.agents.length - 6} acente daha gör
                          </Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Tenders */}
              {portInfoData.openTenders && portInfoData.openTenders.length > 0 && (
                <Card data-testid="card-port-tenders">
                  <div className="px-6 py-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />
                      <h3 className="font-semibold">Aktif Tenderlar</h3>
                      <Badge variant="secondary" className="text-xs">{portInfoData.openTenders.length}</Badge>
                    </div>
                    <Link href="/tenders">
                      <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="link-view-all-tenders">
                        Tümünü Gör <ExternalLink className="w-3 h-3" />
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
                              {tender.cargoType && <span className="text-xs text-muted-foreground">{tender.cargoType}</span>}
                              {tender.cargoQuantity && <span className="text-xs text-muted-foreground">· {tender.cargoQuantity}</span>}
                              {tender.grt && <span className="text-xs text-muted-foreground">· {tender.grt} GRT</span>}
                            </div>
                          </div>
                          <Badge className="bg-green-100 text-green-700 border-0 text-xs flex-shrink-0">Açık</Badge>
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
                    Bu liman için kayıtlı acente veya aktif tender bulunamadı.
                  </p>
                </div>
              )}
            </>
          ) : (
            <Card className="p-8 text-center">
              <Anchor className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">Liman bilgisi bulunamadı.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
