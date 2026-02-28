import { useState, useMemo, useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Anchor, Search, MapPin, Globe, Info, Loader2,
  Waves, Building2, X, Users, FileText,
  ExternalLink, Ship, Wind, Thermometer,
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Cloud, ChevronLeft
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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

function getSafetyScore(waveHeight: number, windKnots: number): number {
  const wavePenalty = Math.min(6, waveHeight * 2.4);
  const windPenalty = Math.min(4, windKnots * 0.133);
  return Math.max(1, Math.min(10, Math.round(10 - wavePenalty - windPenalty)));
}

function SafetyGauge({ score }: { score: number }) {
  const cx = 60, cy = 66, r = 50;

  const toXY = (angleDeg: number, radius = r) => ({
    x: cx + radius * Math.cos((angleDeg * Math.PI) / 180),
    y: cy - radius * Math.sin((angleDeg * Math.PI) / 180),
  });

  const gaugeColor =
    score >= 8 ? "#10b981" :
    score >= 6 ? "#22c55e" :
    score >= 5 ? "#f59e0b" :
    score >= 3 ? "#f97316" : "#ef4444";

  const capped = Math.min(score, 9.98);
  const spanDeg = (capped / 10) * 180;
  const scoreAngleDeg = 180 - spanDeg;

  const bgStart = toXY(180);
  const bgEnd   = toXY(0);
  const scEnd   = toXY(scoreAngleDeg);

  const bgPath    = `M ${bgStart.x.toFixed(2)} ${bgStart.y.toFixed(2)} A ${r} ${r} 0 0 0 ${bgEnd.x.toFixed(2)} ${bgEnd.y.toFixed(2)}`;
  const scorePath = `M ${bgStart.x.toFixed(2)} ${bgStart.y.toFixed(2)} A ${r} ${r} 0 ${spanDeg > 180 ? 1 : 0} 0 ${scEnd.x.toFixed(2)} ${scEnd.y.toFixed(2)}`;

  const needleLen = r - 8;
  const needleTip = toXY(scoreAngleDeg, needleLen);

  const ticks = Array.from({ length: 11 }, (_, i) => {
    const a = 180 - i * 18;
    return { p1: toXY(a, r - 9), p2: toXY(a, r) };
  });

  return (
    <div className="flex flex-col items-center gap-0 flex-shrink-0">
      <svg viewBox="0 0 120 74" className="w-28 h-[60px]">
        <path d={bgPath} fill="none" stroke="#e5e7eb" strokeWidth="9" strokeLinecap="round" />
        <path d={scorePath} fill="none" stroke={gaugeColor} strokeWidth="9" strokeLinecap="round" />
        {ticks.map((t, i) => (
          <line key={i} x1={t.p1.x} y1={t.p1.y} x2={t.p2.x} y2={t.p2.y} stroke="white" strokeWidth="1.5" opacity="0.7" />
        ))}
        <line x1={cx} y1={cy} x2={needleTip.x.toFixed(2)} y2={needleTip.y.toFixed(2)} stroke={gaugeColor} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="4" fill={gaugeColor} />
        <text x={cx} y={cy - 16} textAnchor="middle" fontSize="20" fontWeight="bold" fill={gaugeColor} fontFamily="Georgia, serif">{score}</text>
        <text x={cx + 12} y={cy - 10} textAnchor="middle" fontSize="9" fill="#9ca3af">/10</text>
      </svg>
      <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">Yanaşma Puanı</p>
    </div>
  );
}
const SAFETY_CONFIG: Record<SafetyLevel, {
  label: string; desc: string; color: string; bg: string; border: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  excellent: { label: "Mükemmel", desc: "Tüm gemi tipleri için ideal koşullar. Yanaşma operasyonları sorunsuz.", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20", border: "border-emerald-200 dark:border-emerald-800/50", Icon: ShieldCheck },
  good: { label: "İyi", desc: "Yanaşma operasyonları normaldir. Standart prosedürler yeterli.", color: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/20", border: "border-green-200 dark:border-green-800/50", Icon: ShieldCheck },
  moderate: { label: "Orta", desc: "Dikkatli manevralar gereklidir. Kılavuz kaptan önerilir.", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20", border: "border-amber-200 dark:border-amber-800/50", Icon: ShieldAlert },
  rough: { label: "Kötü", desc: "Küçük gemiler için önerilmez. Büyük gemiler dikkatli olmalı.", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/20", border: "border-orange-200 dark:border-orange-800/50", Icon: ShieldAlert },
  dangerous: { label: "Tehlikeli", desc: "Liman operasyonları askıya alınmış olabilir. Acil durum dışında yanaşma önerilmez.", color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20", border: "border-red-200 dark:border-red-800/50", Icon: ShieldX },
};

function usePortWeather(lat: number | null | undefined, lng: number | null | undefined) {
  const enabled = !!lat && !!lng;
  const { data: marine, isLoading: marineLoading } = useQuery<MarineWeather>({
    queryKey: ["marine-weather", lat, lng],
    queryFn: async () => {
      const res = await fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&current=wave_height,wave_direction,wave_period,wind_wave_height&timezone=Europe%2FIstanbul`);
      if (!res.ok) throw new Error("Marine API error");
      const d = await res.json();
      return { waveHeight: d.current.wave_height, waveDirection: d.current.wave_direction, wavePeriod: d.current.wave_period, windWaveHeight: d.current.wind_wave_height };
    },
    enabled, staleTime: 15 * 60 * 1000,
  });
  const { data: weather, isLoading: weatherLoading } = useQuery<CurrentWeather>({
    queryKey: ["current-weather", lat, lng],
    queryFn: async () => {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code&wind_speed_unit=kn&timezone=Europe%2FIstanbul`);
      if (!res.ok) throw new Error("Weather API error");
      const d = await res.json();
      return { temperature: d.current.temperature_2m, windSpeed: d.current.wind_speed_10m, windDirection: d.current.wind_direction_10m, weatherCode: d.current.weather_code };
    },
    enabled, staleTime: 15 * 60 * 1000,
  });
  return { marine, weather, isLoading: marineLoading || weatherLoading };
}

function WeatherPanel({ lat, lng }: { lat: number; lng: number }) {
  const { marine, weather, isLoading } = usePortWeather(lat, lng);
  if (isLoading) return (
    <Card>
      <div className="px-5 py-3 border-b flex items-center gap-2"><Cloud className="w-4 h-4 text-[hsl(var(--maritime-accent))]" /><h3 className="font-semibold text-sm">Hava Durumu & Deniz Koşulları</h3></div>
      <CardContent className="p-4"><div className="grid grid-cols-2 gap-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div></CardContent>
    </Card>
  );
  if (!marine || !weather) return null;
  const safety = getSafetyLevel(marine.waveHeight, weather.windSpeed);
  const sc = SAFETY_CONFIG[safety];
  const score = getSafetyScore(marine.waveHeight, weather.windSpeed);
  const meteoItems = [
    { icon: <span className="text-xl">{wmoIcon(weather.weatherCode)}</span>, label: "Hava", value: wmoDescription(weather.weatherCode), sub: `${weather.temperature.toFixed(1)}°C` },
    { icon: <Wind className="w-4 h-4 text-blue-500" />, label: "Rüzgar", value: `${weather.windSpeed.toFixed(1)} kn`, sub: `Yön: ${windDir(weather.windDirection)}` },
    { icon: <Waves className="w-4 h-4 text-cyan-500" />, label: "Dalga", value: `${marine.waveHeight.toFixed(2)} m`, sub: `Periyot: ${marine.wavePeriod.toFixed(1)}s` },
    { icon: <Thermometer className="w-4 h-4 text-orange-400" />, label: "Sıcaklık", value: `${weather.temperature.toFixed(1)}°C`, sub: `Dalga yönü: ${windDir(marine.waveDirection)}` },
  ];
  return (
    <Card>
      <div className="px-5 py-3 border-b flex items-center gap-2">
        <Cloud className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />
        <h3 className="font-semibold text-sm">Hava Durumu & Deniz Koşulları</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">Open-Meteo · Gerçek zamanlı</span>
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {meteoItems.map((item, i) => (
            <div key={i} className="flex flex-col gap-1 p-3 rounded-lg bg-muted/40 border border-border/50">
              <div className="flex items-center gap-1.5">{item.icon}<span className="text-[10px] text-muted-foreground font-medium">{item.label}</span></div>
              <p className="text-sm font-bold font-serif">{item.value}</p>
              <p className="text-[10px] text-muted-foreground">{item.sub}</p>
            </div>
          ))}
        </div>
        <Separator />
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${sc.bg} ${sc.border}`}>
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <sc.Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${sc.color}`} />
            <div className="min-w-0">
              <p className={`font-semibold text-xs ${sc.color}`}>Yanaşma Güvenliği: {sc.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sc.desc}</p>
            </div>
          </div>
          <SafetyGauge score={score} />
        </div>
      </CardContent>
    </Card>
  );
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
  portMapContainerRef, lat, lng, hasCoords, facilityList, onClose,
}: {
  selectedPort: Port;
  portInfoData: PortInfoData | undefined;
  isLoadingInfo: boolean;
  portMapContainerRef: React.RefObject<HTMLDivElement>;
  lat: number | null; lng: number | null; hasCoords: boolean;
  facilityList: string[];
  onClose: () => void;
}) {
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Liman Konumu</p>
                  <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-[10px] text-[hsl(var(--maritime-accent))] hover:underline flex items-center gap-1" data-testid="link-open-map">
                    Haritada Aç <ExternalLink className="w-2.5 h-2.5" />
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
                  <p className="text-xs">Koordinat bilgisi mevcut değil — hava durumu gösterilemiyor.</p>
                </div>
              </Card>
            )}

            {/* Agents */}
            {portInfoData.agents && portInfoData.agents.length > 0 && (
              <Card data-testid="card-port-agents">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-[hsl(var(--maritime-accent))]" />
                    <h3 className="font-semibold text-sm">Acenteler</h3>
                    <Badge variant="secondary" className="text-[10px]">{portInfoData.agents.length}</Badge>
                  </div>
                  <Link href="/directory"><Button variant="ghost" size="sm" className="text-[10px] h-7 gap-1" data-testid="link-view-all-agents">Tümünü Gör <ExternalLink className="w-2.5 h-2.5" /></Button></Link>
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
                    <h3 className="font-semibold text-sm">Aktif Tenderlar</h3>
                    <Badge variant="secondary" className="text-[10px]">{portInfoData.openTenders.length}</Badge>
                  </div>
                  <Link href="/tenders"><Button variant="ghost" size="sm" className="text-[10px] h-7 gap-1" data-testid="link-view-all-tenders">Tümünü Gör <ExternalLink className="w-2.5 h-2.5" /></Button></Link>
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
                        <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">Açık</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {portInfoData.agents?.length === 0 && portInfoData.openTenders?.length === 0 && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/30 border border-dashed">
                <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <p className="text-xs text-muted-foreground">Bu liman için kayıtlı acente veya aktif tender bulunamadı.</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Anchor className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Liman bilgisi bulunamadı.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PortInfo() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPort, setSelectedPort] = useState<Port | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

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
      <PageMeta title="Liman Bilgileri | VesselPDA" description="Türk limanlarını arayın — hava durumu, deniz koşulları ve yanaşma güvenliği analizi." />

      {/* LEFT — Port Table */}
      <div className={`${showDetail ? "hidden md:flex" : "flex"} w-full md:w-[52%] lg:w-[48%] flex-col border-r bg-background overflow-hidden flex-shrink-0`}>

        {/* Table header */}
        <div className="flex-shrink-0 border-b bg-background">
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <div className="w-8 h-8 rounded-lg bg-[hsl(var(--maritime-accent)/0.15)] flex items-center justify-center flex-shrink-0">
              <Anchor className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-serif font-bold text-base tracking-tight" data-testid="text-port-info-title">Liman Bilgileri</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Türkiye · {allPorts.length} Liman</p>
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
                placeholder="Liman adı veya LOCODE ile ara (ör: Mersin, TRMER)..."
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
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Port Adı</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-24 text-center">LOCODE</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-10 text-center">Konum</p>
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
              <p className="text-sm font-medium text-muted-foreground">"{searchQuery}" ile eşleşen liman bulunamadı.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Farklı bir arama terimi deneyin.</p>
            </div>
          ) : (
            filteredPorts.map((port) => {
              const isSelected = selectedPort?.id === port.id;
              const hasPortCoords = !!(port as any).latitude && !!(port as any).longitude;
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
                  <span className="text-sm w-6 flex-shrink-0">🇹🇷</span>
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
                      <span className="text-emerald-500" title="Koordinat mevcut">
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
            {searchQuery ? `${filteredPorts.length} / ${allPorts.length} liman gösteriliyor` : `${allPorts.length} liman`}
          </p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5 text-emerald-500" /> Koordinatlı</span>
            <span className="flex items-center gap-1"><span className="text-muted-foreground/40">—</span> Koordinatsız</span>
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
            <h3 className="font-serif text-lg font-semibold text-muted-foreground mb-2">Liman Seçin</h3>
            <p className="text-sm text-muted-foreground/70 max-w-xs leading-relaxed">
              Soldan bir liman seçin — hava durumu, deniz koşulları, harita konumu ve acente bilgilerini görün.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2 text-[10px] text-muted-foreground/60">
              <span className="px-2 py-1 rounded-full border border-dashed">🌊 Dalga yüksekliği</span>
              <span className="px-2 py-1 rounded-full border border-dashed">💨 Rüzgar hızı</span>
              <span className="px-2 py-1 rounded-full border border-dashed">🗺️ Harita</span>
              <span className="px-2 py-1 rounded-full border border-dashed">🚢 Acenteler</span>
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
          />
        )}
      </div>
    </div>
  );
}
