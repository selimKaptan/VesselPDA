import { useQuery } from "@tanstack/react-query";
import {
  Cloud, Wind, Waves, Thermometer,
  ShieldCheck, ShieldAlert, ShieldX,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

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
  good:      { label: "İyi",      desc: "Yanaşma operasyonları normaldir. Standart prosedürler yeterli.",        color: "text-green-700 dark:text-green-400",   bg: "bg-green-50 dark:bg-green-950/20",   border: "border-green-200 dark:border-green-800/50",   Icon: ShieldCheck },
  moderate:  { label: "Orta",     desc: "Dikkatli manevralar gereklidir. Kılavuz kaptan önerilir.",               color: "text-amber-700 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-950/20",   border: "border-amber-200 dark:border-amber-800/50",   Icon: ShieldAlert },
  rough:     { label: "Kötü",     desc: "Küçük gemiler için önerilmez. Büyük gemiler dikkatli olmalı.",           color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/20", border: "border-orange-200 dark:border-orange-800/50", Icon: ShieldAlert },
  dangerous: { label: "Tehlikeli",desc: "Liman operasyonları askıya alınmış olabilir. Acil durum dışında yanaşma önerilmez.", color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20", border: "border-red-200 dark:border-red-800/50", Icon: ShieldX },
};

export function usePortWeather(lat: number | null | undefined, lng: number | null | undefined) {
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

export function WeatherPanel({ lat, lng }: { lat: number; lng: number }) {
  const { marine, weather, isLoading } = usePortWeather(lat, lng);
  if (isLoading) return (
    <Card>
      <div className="px-5 py-3 border-b flex items-center gap-2">
        <Cloud className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />
        <h3 className="font-semibold text-sm">Hava Durumu & Deniz Koşulları</h3>
      </div>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      </CardContent>
    </Card>
  );
  if (!marine || !weather) return null;
  const safety = getSafetyLevel(marine.waveHeight, weather.windSpeed);
  const sc = SAFETY_CONFIG[safety];
  const score = getSafetyScore(marine.waveHeight, weather.windSpeed);
  const meteoItems = [
    { icon: <span className="text-xl">{wmoIcon(weather.weatherCode)}</span>, label: "Hava",      value: wmoDescription(weather.weatherCode),    sub: `${weather.temperature.toFixed(1)}°C` },
    { icon: <Wind className="w-4 h-4 text-blue-500" />,       label: "Rüzgar",    value: `${weather.windSpeed.toFixed(1)} kn`,   sub: `Yön: ${windDir(weather.windDirection)}` },
    { icon: <Waves className="w-4 h-4 text-cyan-500" />,      label: "Dalga",     value: `${marine.waveHeight.toFixed(2)} m`,    sub: `Periyot: ${marine.wavePeriod.toFixed(1)}s` },
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
