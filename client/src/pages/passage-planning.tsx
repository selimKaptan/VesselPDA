import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Navigation, Plus, Trash2, MapPin, Clock, Anchor, Download, Search,
  Ship, ChevronUp, ChevronDown, Copy, Save, Gauge, Fuel, AlertTriangle,
  RefreshCw, Map as MapIcon, List
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { PageMeta } from "@/components/page-meta";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const mkIcon = (color: string) => L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  active: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

function fmt(dt: string | Date | null | undefined): string {
  if (!dt) return "—";
  const d = new Date(dt);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtShort(dt: string | Date | null | undefined): string {
  if (!dt) return "—";
  const d = new Date(dt);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function generatePDF(plan: any, waypoints: any[], fuelData: any) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("PASSAGE PLAN", pageW / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(11);
  doc.text(plan.title || `${plan.departurePort} → ${plan.destinationPort}`, pageW / 2, y, { align: "center" });
  y += 12;

  doc.setDrawColor(100, 100, 100);
  doc.line(14, y, pageW - 14, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Vessel Information", 14, y); y += 5;
  doc.setFont("helvetica", "normal");
  const vinfo = [
    ["Vessel Name:", plan.vesselName || "—"], ["IMO:", plan.imoNumber || "—"],
    ["Flag:", plan.flag || "—"], ["Type:", plan.vesselType || "—"],
    ["DWT:", plan.deadweight ? `${plan.deadweight.toLocaleString()} MT` : "—"],
    ["GRT:", plan.grossTonnage ? `${plan.grossTonnage.toLocaleString()} GT` : "—"],
  ];
  vinfo.forEach(([l, v]) => {
    doc.setFont("helvetica", "bold"); doc.text(l, 14, y);
    doc.setFont("helvetica", "normal"); doc.text(String(v), 55, y);
    y += 4.5;
  });
  y += 4;

  doc.setFont("helvetica", "bold"); doc.text("Route Summary", 14, y); y += 5;
  doc.setFont("helvetica", "normal");
  const rinfo = [
    ["Departure:", `${plan.departurePort || "—"}  ${plan.departureDate ? fmt(plan.departureDate) : ""}`],
    ["Destination:", `${plan.destinationPort || "—"}  ${plan.arrivalDate ? fmt(plan.arrivalDate) : ""}`],
    ["Total Distance:", plan.totalDistanceNm ? `${plan.totalDistanceNm.toFixed(0)} NM` : "—"],
    ["Total Duration:", plan.totalDays ? `${Math.floor(plan.totalDays)} days ${Math.round((plan.totalDays % 1) * 24)}h` : "—"],
    ["Planned Speed:", plan.plannedSpeed ? `${plan.plannedSpeed} knots` : "—"],
  ];
  rinfo.forEach(([l, v]) => {
    doc.setFont("helvetica", "bold"); doc.text(l, 14, y);
    doc.setFont("helvetica", "normal"); doc.text(String(v), 55, y);
    y += 4.5;
  });
  y += 4;

  if (fuelData) {
    doc.setFont("helvetica", "bold"); doc.text("Fuel Consumption", 14, y); y += 5;
    doc.setFont("helvetica", "normal");
    [
      ["HFO:", `${fuelData.totalHfoConsumption} MT (${fuelData.dailyHfoConsumption} MT/day)`],
      ["MGO:", `${fuelData.totalMgoConsumption} MT (${fuelData.dailyMgoConsumption} MT/day)`],
      ["Total Fuel:", `${fuelData.totalFuelConsumption} MT`],
      ["ECA Days:", `${fuelData.ecaZoneDays} days`],
      ["Est. Cost:", `$${fuelData.estimatedFuelCost?.toLocaleString()}`],
    ].forEach(([l, v]) => {
      doc.setFont("helvetica", "bold"); doc.text(l, 14, y);
      doc.setFont("helvetica", "normal"); doc.text(String(v), 55, y);
      y += 4.5;
    });
    y += 4;
  }

  if (waypoints.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold"); doc.text("Waypoints", 14, y); y += 5;
    const headers = ["#", "Name", "Type", "Lat", "Lon", "Crs°", "Dist NM", "Spd kn", "ETA"];
    const colW =   [7,   40,     14,     16,    16,    14,    16,      13,      28];
    doc.setFontSize(7.5);
    let x = 14;
    doc.setFont("helvetica", "bold");
    headers.forEach((h, i) => { doc.text(h, x + 1, y); x += colW[i]; });
    y += 2; doc.line(14, y, pageW - 14, y); y += 3;
    doc.setFont("helvetica", "normal");
    waypoints.forEach((wp, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      x = 14;
      const row = [
        String(idx + 1), wp.name || "—",
        wp.isPort ? "Port" : wp.isCanal ? "Canal" : wp.isStrait ? "Strait" : "WP",
        wp.latitude?.toFixed(3) ?? "—", wp.longitude?.toFixed(3) ?? "—",
        wp.courseToNext?.toFixed(0) ?? "—", wp.distanceToNextNm?.toFixed(1) ?? "—",
        wp.speedKnots?.toFixed(1) ?? "—", wp.eta ? fmtShort(wp.eta) : "—",
      ];
      row.forEach((cell, i) => { doc.text(cell, x + 1, y); x += colW[i]; });
      y += 4.5;
    });
  }

  doc.save(`passage-plan-${(plan.title || "plan").replace(/\s+/g, "-")}.pdf`);
}

function PortSearch({ label, value, onChange, onSelect, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  onSelect: (p: { name: string; lat: number; lon: number; id?: number }) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const timer = useRef<any>(null);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(value), 300);
    return () => clearTimeout(timer.current);
  }, [value]);

  const { data: results = [] } = useQuery<any[]>({
    queryKey: ["/api/ports", debounced],
    queryFn: () => debounced.length >= 2 ? fetch(`/api/ports?q=${encodeURIComponent(debounced)}`).then(r => r.json()) : Promise.resolve([]),
    enabled: debounced.length >= 2,
  });

  return (
    <div className="relative">
      <Label className="text-xs text-slate-400 mb-1 block">{label}</Label>
      <div className="relative">
        <MapPin className="absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-400" />
        <Input
          className="pl-7 h-8 text-sm bg-slate-800 border-slate-600"
          placeholder={placeholder || "Port ara..."}
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => value.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          data-testid={`input-port-${label.toLowerCase().replace(/\s/g, "-")}`}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {results.slice(0, 8).map((p: any) => (
            <button key={p.id} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-700 flex flex-col"
              onMouseDown={() => { onSelect({ name: p.name, lat: parseFloat(p.latitude), lon: parseFloat(p.longitude), id: p.id }); setOpen(false); }}>
              <span className="font-medium text-slate-200">{p.name}</span>
              {p.country && <span className="text-slate-400">{p.country} {p.unlocode ? `· ${p.unlocode}` : ""}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface VesselPosition {
  lat: number; lon: number; name: string;
  speed?: number; course?: number; destination?: string;
}

function MapPanel({ waypoints, routeGeometry, onWpClick, vesselPosition }: {
  waypoints: any[]; routeGeometry: number[][];
  onWpClick?: (idx: number) => void;
  vesselPosition?: VesselPosition | null;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Layer[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const vesselMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [20, 20], zoom: 3, zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap", maxZoom: 18,
    }).addTo(map);
    L.tileLayer("https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png", {
      opacity: 0.6, maxZoom: 18,
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Vessel live position marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (vesselMarkerRef.current) { map.removeLayer(vesselMarkerRef.current); vesselMarkerRef.current = null; }
    if (!vesselPosition?.lat || !vesselPosition?.lon) return;

    const shipIcon = L.divIcon({
      html: `<div style="font-size:22px;filter:drop-shadow(1px 1px 3px rgba(0,0,0,0.7));line-height:1">🚢</div>`,
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const popup = `<b>${vesselPosition.name}</b><br/>📍 Current Position<br/>${vesselPosition.speed != null ? `Speed: <b>${vesselPosition.speed} kn</b><br/>` : ""}${vesselPosition.course != null ? `Course: <b>${vesselPosition.course}°</b><br/>` : ""}${vesselPosition.destination ? `Dest: <b>${vesselPosition.destination}</b>` : ""}`;
    const m = L.marker([vesselPosition.lat, vesselPosition.lon], { icon: shipIcon, zIndexOffset: 1000 })
      .bindPopup(popup)
      .addTo(map);
    vesselMarkerRef.current = m;

    if (waypoints.length === 0) {
      map.setView([vesselPosition.lat, vesselPosition.lon], 6);
    }
  }, [vesselPosition]);

  // Route waypoints & polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    if (polylineRef.current) { map.removeLayer(polylineRef.current); polylineRef.current = null; }

    if (waypoints.length === 0) return;

    const portWps = waypoints.filter(w => w.isPort);

    waypoints.forEach((wp, idx) => {
      if (!wp.latitude || !wp.longitude) return;
      let color = "#64748b";
      if (wp.isPort) {
        const portIdx = portWps.indexOf(wp);
        if (portIdx === 0) color = "#22c55e";
        else if (portIdx === portWps.length - 1) color = "#ef4444";
        else color = "#3b82f6";
      } else if (wp.isCanal) color = "#f97316";
      else if (wp.isStrait) color = "#f59e0b";

      const marker = L.marker([wp.latitude, wp.longitude], { icon: mkIcon(color) })
        .bindPopup(`<b>${wp.name}</b><br/>${wp.isPort ? "Port" : wp.isCanal ? "Canal" : "Strait"}${wp.distanceToNextNm ? `<br/>${wp.distanceToNextNm} NM` : ""}${wp.eta ? `<br/>ETA: ${fmtShort(wp.eta)}` : ""}`)
        .addTo(map)
        .on("click", () => onWpClick?.(idx));
      markersRef.current.push(marker);
    });

    const lineCoords: [number, number][] = routeGeometry.length > 0
      ? routeGeometry.map(([lat, lon]) => [lat, lon])
      : waypoints.filter(w => w.latitude && w.longitude).map(w => [w.latitude, w.longitude]);

    if (lineCoords.length > 1) {
      const poly = L.polyline(lineCoords, { color: "#3b82f6", weight: 2.5, opacity: 0.85, dashArray: "8, 5" }).addTo(map);
      polylineRef.current = poly;
    }

    // Gemiden kalkış limanına gri kesikli çizgi
    if (vesselPosition?.lat && vesselPosition?.lon) {
      const firstPort = waypoints.find(wp => wp.isPort);
      if (firstPort?.latitude && firstPort?.longitude) {
        const approachLine = L.polyline(
          [[vesselPosition.lat, vesselPosition.lon], [firstPort.latitude, firstPort.longitude]],
          { color: "#9ca3af", weight: 1.8, opacity: 0.6, dashArray: "4, 8" }
        ).addTo(map);
        markersRef.current.push(approachLine);
      }
    }

    // Fit bounds — tüm rotayı kapsayacak şekilde zoom
    const allPoints: [number, number][] = waypoints
      .filter(wp => wp.latitude && wp.longitude)
      .map(wp => [wp.latitude, wp.longitude] as [number, number]);
    if (vesselPosition?.lat && vesselPosition?.lon) {
      allPoints.push([vesselPosition.lat, vesselPosition.lon]);
    }
    if (allPoints.length > 1) {
      try {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds.pad(0.15), { maxZoom: 8 });
      } catch {}
    } else if (allPoints.length === 1) {
      map.setView(allPoints[0], 6);
    }
  }, [waypoints, routeGeometry]);

  return (
    <div ref={containerRef} className="w-full h-full" data-testid="map-container" />
  );
}

export default function PassagePlanning() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"new" | "plans">("new");

  const [vessel, setVessel] = useState<any>(null);
  const [imoInput, setImoInput] = useState("");
  const [imoLoading, setImoLoading] = useState(false);
  const [vesselPosition, setVesselPosition] = useState<VesselPosition | null>(null);

  const [depPort, setDepPort] = useState({ name: "", lat: 0, lon: 0, id: 0, search: "" });
  const [destPort, setDestPort] = useState({ name: "", lat: 0, lon: 0, id: 0, search: "" });
  const [intermPorts, setIntermPorts] = useState<{ name: string; lat: number; lon: number; id: number; portStayHours: number; search: string }[]>([]);
  const [depDate, setDepDate] = useState("");
  const [speed, setSpeed] = useState(12);

  const [routeResult, setRouteResult] = useState<any>(null);
  const [fuelResult, setFuelResult] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [focusedWp, setFocusedWp] = useState<number | null>(null);

  const { data: plans = [], refetch: refetchPlans } = useQuery<any[]>({
    queryKey: ["/api/v1/passage-plans"],
  });

  const imoTimer = useRef<any>(null);

  const fetchVesselPosition = async (imo: string, vesselName: string) => {
    try {
      const r = await fetch(`/api/vessels/live-position?imo=${imo}`);
      if (r.ok) {
        const d = await r.json();
        if (d && d.latitude && d.longitude) {
          setVesselPosition({
            lat: parseFloat(d.latitude),
            lon: parseFloat(d.longitude),
            name: vesselName,
            speed: d.speed,
            course: d.course,
            destination: d.aisDestination || d.destination,
          });
        }
      }
    } catch {}
  };

  const lookupVessel = async (imo: string) => {
    if (!imo || imo.length < 7) return;
    setImoLoading(true);
    setVesselPosition(null);
    try {
      const r1 = await fetch(`/api/vessels/lookup?imo=${imo}`);
      if (r1.ok) {
        const v = await r1.json();
        if (v && v.name) {
          setVessel(v);
          setImoLoading(false);
          fetchVesselPosition(imo, v.name);
          return;
        }
      }
      const r2 = await fetch(`/api/datalastic/vessel-info/${imo}`);
      if (r2.ok) {
        const v = await r2.json();
        if (v) {
          setVessel(v);
          setImoLoading(false);
          fetchVesselPosition(imo, v.name || v.vessel_name || imo);
          return;
        }
      }
      toast({ title: "Gemi bulunamadı", description: `IMO ${imo} ile gemi bulunamadı.`, variant: "destructive" });
    } catch (e) {
      toast({ title: "Hata", description: "Gemi aranırken hata oluştu.", variant: "destructive" });
    }
    setImoLoading(false);
  };

  const handleImoChange = (v: string) => {
    setImoInput(v);
    clearTimeout(imoTimer.current);
    imoTimer.current = setTimeout(() => lookupVessel(v.trim()), 800);
  };

  const addIntermPort = () => {
    setIntermPorts(prev => [...prev, { name: "", lat: 0, lon: 0, id: 0, portStayHours: 0, search: "" }]);
  };

  const removeIntermPort = (i: number) => setIntermPorts(prev => prev.filter((_, idx) => idx !== i));

  const moveIntermPort = (i: number, dir: -1 | 1) => {
    setIntermPorts(prev => {
      const arr = [...prev];
      const t = arr[i + dir];
      arr[i + dir] = arr[i];
      arr[i] = t;
      return arr;
    });
  };

  const canCalculate = depPort.name && destPort.name && depPort.lat && destPort.lat;

  const calculate = async () => {
    if (!canCalculate) {
      toast({ title: "Eksik bilgi", description: "Kalkış ve varış limanı seçin.", variant: "destructive" });
      return;
    }
    setCalculating(true);
    try {
      const routeRes = await apiRequest("POST", "/api/v1/passage-plans/calculate-route", {
        departureLat: depPort.lat, departureLon: depPort.lon,
        destinationLat: destPort.lat, destinationLon: destPort.lon,
        departurePort: depPort.name, destinationPort: destPort.name,
        intermediatePorts: intermPorts.filter(p => p.name).map(p => ({
          name: p.name, lat: p.lat, lon: p.lon, portStayHours: p.portStayHours,
        })),
        plannedSpeed: speed,
        departureDate: depDate || new Date().toISOString(),
      });
      const route = await routeRes.json();
      setRouteResult(route);

      const fuelRes = await apiRequest("POST", "/api/v1/passage-plans/calculate-fuel", {
        totalDays: route.summary.totalDays,
        ecaZoneDays: route.summary.ecaZoneDays,
        plannedSpeed: speed,
        deadweight: vessel?.deadweight || vessel?.dwt || 50000,
      });
      const fuel = await fuelRes.json();
      setFuelResult(fuel);
    } catch (e: any) {
      toast({ title: "Hesaplama hatası", description: e.message, variant: "destructive" });
    }
    setCalculating(false);
  };

  const recalcEtas = useCallback(() => {
    if (!routeResult) return;
    const wps = [...routeResult.waypoints];
    const depTime = depDate ? new Date(depDate) : new Date();
    let cur = new Date(depTime);
    for (const wp of wps) {
      wp.eta = new Date(cur);
      cur = new Date(cur.getTime() + ((wp.legTimeHours || 0) + (wp.portStayHours || 0)) * 3600000);
      wp.etd = new Date(cur);
    }
    const total = wps.reduce((s, w) => s + (w.legTimeHours || 0) + (w.portStayHours || 0), 0);
    setRouteResult((prev: any) => ({
      ...prev, waypoints: wps,
      summary: { ...prev.summary, arrivalDate: wps[wps.length - 1]?.etd?.toISOString() || null, totalHours: total, totalDays: Math.round(total / 24 * 10) / 10 },
    }));
  }, [routeResult, depDate]);

  useEffect(() => { if (routeResult) recalcEtas(); }, [depDate]);

  const savePlan = async () => {
    if (!routeResult) { toast({ title: "Önce rotayı hesaplayın", variant: "destructive" }); return; }
    try {
      const payload = {
        title: `${depPort.name} → ${destPort.name}`,
        vesselName: vessel?.name || vessel?.vessel_name,
        imoNumber: vessel?.imo || vessel?.imo_number || imoInput,
        mmsi: vessel?.mmsi,
        vesselType: vessel?.vessel_type || vessel?.type,
        flag: vessel?.flag,
        grossTonnage: vessel?.gross_tonnage || vessel?.grossTonnage,
        deadweight: vessel?.deadweight || vessel?.dwt,
        loa: vessel?.length_overall || vessel?.loa,
        beam: vessel?.beam,
        departurePort: depPort.name, departureLat: depPort.lat, departureLon: depPort.lon,
        destinationPort: destPort.name, destinationLat: destPort.lat, destinationLon: destPort.lon,
        departureDate: depDate || new Date().toISOString(),
        arrivalDate: routeResult.summary.arrivalDate,
        totalDistanceNm: routeResult.summary.totalDistanceNm,
        totalDays: routeResult.summary.totalDays,
        totalHours: routeResult.summary.totalHours,
        plannedSpeed: speed,
        dailyHfoConsumption: fuelResult?.dailyHfoConsumption,
        dailyMgoConsumption: fuelResult?.dailyMgoConsumption,
        totalHfoConsumption: fuelResult?.totalHfoConsumption,
        totalMgoConsumption: fuelResult?.totalMgoConsumption,
        ecaZoneDays: routeResult.summary.ecaZoneDays,
        estimatedFuelCost: fuelResult?.estimatedFuelCost,
        straitsAndCanals: routeResult.summary.straitsAndCanals,
        routeGeometry: routeResult.routeGeometry,
        intermediatePorts: intermPorts.filter(p => p.name),
        status: "draft",
        waypoints: routeResult.waypoints,
      };
      if (selectedPlan?.id) {
        await apiRequest("PATCH", `/api/v1/passage-plans/${selectedPlan.id}`, payload);
        toast({ title: "Plan güncellendi" });
      } else {
        const r = await apiRequest("POST", "/api/v1/passage-plans", payload);
        const saved = await r.json();
        setSelectedPlan(saved);
        toast({ title: "Plan kaydedildi" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/v1/passage-plans"] });
      refetchPlans();
    } catch (e: any) {
      toast({ title: "Kayıt hatası", description: e.message, variant: "destructive" });
    }
  };

  const loadPlan = (plan: any) => {
    setSelectedPlan(plan);
    setActiveTab("new");
    setImoInput(plan.imoNumber || "");
    if (plan.vesselName) setVessel({ name: plan.vesselName, imo: plan.imoNumber, flag: plan.flag, vessel_type: plan.vesselType, deadweight: plan.deadweight, gross_tonnage: plan.grossTonnage });
    setDepPort({ name: plan.departurePort || "", lat: plan.departureLat || 0, lon: plan.departureLon || 0, id: 0, search: plan.departurePort || "" });
    setDestPort({ name: plan.destinationPort || "", lat: plan.destinationLat || 0, lon: plan.destinationLon || 0, id: 0, search: plan.destinationPort || "" });
    setSpeed(plan.plannedSpeed || 12);
    if (plan.departureDate) setDepDate(new Date(plan.departureDate).toISOString().slice(0, 16));
    if (plan.waypoints && plan.waypoints.length > 0) {
      setRouteResult({
        waypoints: plan.waypoints,
        routeGeometry: (plan.routeGeometry as any) || [],
        summary: {
          totalDistanceNm: plan.totalDistanceNm, totalDays: plan.totalDays,
          totalHours: plan.totalHours, plannedSpeed: plan.plannedSpeed,
          straitsAndCanals: (plan.straitsAndCanals as any) || [],
          ecaZoneDays: plan.ecaZoneDays, arrivalDate: plan.arrivalDate,
        },
      });
      setFuelResult({
        dailyHfoConsumption: plan.dailyHfoConsumption, dailyMgoConsumption: plan.dailyMgoConsumption,
        totalHfoConsumption: plan.totalHfoConsumption, totalMgoConsumption: plan.totalMgoConsumption,
        totalFuelConsumption: (plan.totalHfoConsumption || 0) + (plan.totalMgoConsumption || 0),
        ecaZoneDays: plan.ecaZoneDays, estimatedFuelCost: plan.estimatedFuelCost,
        fuelPrices: { hfo: 450, mgo: 750 },
      });
    }
  };

  const duplicatePlan = async (id: number) => {
    try {
      await apiRequest("POST", `/api/v1/passage-plans/${id}/duplicate`, {});
      queryClient.invalidateQueries({ queryKey: ["/api/v1/passage-plans"] });
      refetchPlans();
      toast({ title: "Plan kopyalandı" });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    }
  };

  const deletePlan = async (id: number) => {
    try {
      await apiRequest("DELETE", `/api/v1/passage-plans/${id}`, {});
      queryClient.invalidateQueries({ queryKey: ["/api/v1/passage-plans"] });
      refetchPlans();
      if (selectedPlan?.id === id) setSelectedPlan(null);
      toast({ title: "Plan silindi" });
    } catch (e: any) {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    }
  };

  const summary = routeResult?.summary;
  const waypoints: any[] = routeResult?.waypoints || [];
  const routeGeo: number[][] = routeResult?.routeGeometry || [];

  const straits: any[] = summary?.straitsAndCanals || [];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      <PageMeta title="Passage Planning | VesselPDA" description="Deniz yolu rota planlama ve yakıt hesaplama" />

      <div className="flex h-full overflow-hidden">
        {/* LEFT PANEL */}
        <div className="w-[420px] min-w-[420px] flex flex-col h-full border-r border-slate-800 overflow-y-auto bg-slate-950">
          <div className="px-4 pt-4 pb-2 flex items-center gap-2 border-b border-slate-800">
            <Navigation className="h-5 w-5 text-blue-400" />
            <h1 className="text-base font-semibold">Passage Planning</h1>
          </div>

          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="flex-1 flex flex-col">
            <div className="px-4 pt-2">
              <TabsList className="w-full bg-slate-900">
                <TabsTrigger value="new" className="flex-1 text-xs" data-testid="tab-new-plan">New Plan</TabsTrigger>
                <TabsTrigger value="plans" className="flex-1 text-xs" data-testid="tab-my-plans">My Plans ({plans.length})</TabsTrigger>
              </TabsList>
            </div>

            {/* ─── NEW PLAN TAB ─────────────────────── */}
            <TabsContent value="new" className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 mt-0">

              {/* A) VESSEL */}
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-slate-300">
                    <Ship className="h-3.5 w-3.5 text-blue-400" /> Gemi Seçimi
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  {vessel ? (
                    <div className="bg-slate-800 rounded-md p-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-blue-300">{vessel.name || vessel.vessel_name}</span>
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { setVessel(null); setImoInput(""); setVesselPosition(null); }}>
                          Değiştir
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 text-xs text-slate-400">
                        {vessel.flag && <span>🏴 {vessel.flag}</span>}
                        {(vessel.vessel_type || vessel.type) && <span>⚓ {vessel.vessel_type || vessel.type}</span>}
                        {(vessel.deadweight || vessel.dwt) && <span>DWT {((vessel.deadweight || vessel.dwt) || 0).toLocaleString()} MT</span>}
                        {(vessel.gross_tonnage || vessel.grossTonnage) && <span>GRT {((vessel.gross_tonnage || vessel.grossTonnage) || 0).toLocaleString()}</span>}
                        {(vessel.length_overall || vessel.loa) && <span>LOA {vessel.length_overall || vessel.loa}m</span>}
                        {vessel.beam && <span>Beam {vessel.beam}m</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-400">IMO Numarası</Label>
                      <div className="flex gap-2">
                        <Input
                          className="h-8 text-sm bg-slate-800 border-slate-600 flex-1"
                          placeholder="9999999"
                          value={imoInput}
                          onChange={e => handleImoChange(e.target.value)}
                          data-testid="input-imo"
                        />
                        <Button size="sm" className="h-8 px-3" onClick={() => lookupVessel(imoInput.trim())} disabled={imoLoading} data-testid="button-search-vessel">
                          {imoLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* B) ROUTE */}
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-slate-300">
                    <MapPin className="h-3.5 w-3.5 text-emerald-400" /> Rota Seçimi
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-3">
                  <PortSearch label="Kalkış Limanı" value={depPort.search}
                    onChange={v => setDepPort(p => ({ ...p, search: v, name: v }))}
                    onSelect={p => setDepPort({ name: p.name, lat: p.lat, lon: p.lon, id: p.id || 0, search: p.name })} />
                  {depPort.name && <div className="text-xs text-slate-500 -mt-1.5">
                    {depPort.lat.toFixed(4)}°N {depPort.lon.toFixed(4)}°E
                  </div>}

                  {/* Intermediate Ports */}
                  {intermPorts.map((ip, i) => (
                    <div key={i} className="border border-slate-700 rounded-md p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-medium">Ara Liman {i + 1}</span>
                        <div className="flex gap-1">
                          {i > 0 && <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveIntermPort(i, -1)}><ChevronUp className="h-3 w-3" /></Button>}
                          {i < intermPorts.length - 1 && <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveIntermPort(i, 1)}><ChevronDown className="h-3 w-3" /></Button>}
                          <Button size="icon" variant="ghost" className="h-5 w-5 text-red-400" onClick={() => removeIntermPort(i)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                      <PortSearch label={`Liman`} value={ip.search}
                        onChange={v => setIntermPorts(prev => prev.map((p, idx) => idx === i ? { ...p, search: v, name: v } : p))}
                        onSelect={p => setIntermPorts(prev => prev.map((pt, idx) => idx === i ? { ...pt, name: p.name, lat: p.lat, lon: p.lon, id: p.id || 0, search: p.name } : pt))} />
                      <div>
                        <Label className="text-xs text-slate-400">Kalış süresi (saat)</Label>
                        <Input className="h-7 text-xs bg-slate-800 border-slate-600 mt-1" type="number" min="0" placeholder="0"
                          value={ip.portStayHours || ""}
                          onChange={e => setIntermPorts(prev => prev.map((p, idx) => idx === i ? { ...p, portStayHours: parseFloat(e.target.value) || 0 } : p))} />
                      </div>
                    </div>
                  ))}

                  <Button size="sm" variant="outline" className="w-full h-7 text-xs border-slate-600 border-dashed" onClick={addIntermPort} data-testid="button-add-interm">
                    <Plus className="h-3 w-3 mr-1" /> Ara Liman Ekle
                  </Button>

                  <PortSearch label="Varış Limanı" value={destPort.search}
                    onChange={v => setDestPort(p => ({ ...p, search: v, name: v }))}
                    onSelect={p => setDestPort({ name: p.name, lat: p.lat, lon: p.lon, id: p.id || 0, search: p.name })} />
                  {destPort.name && <div className="text-xs text-slate-500 -mt-1.5">
                    {destPort.lat.toFixed(4)}°N {destPort.lon.toFixed(4)}°E
                  </div>}

                  <div>
                    <Label className="text-xs text-slate-400 mb-1 block">Kalkış Tarihi</Label>
                    <Input type="datetime-local" className="h-8 text-xs bg-slate-800 border-slate-600"
                      value={depDate} onChange={e => setDepDate(e.target.value)} data-testid="input-departure-date" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-xs text-slate-400 flex items-center gap-1"><Gauge className="h-3 w-3" /> Planlanan Hız</Label>
                      <span className="text-sm font-semibold text-blue-300">{speed} knot</span>
                    </div>
                    <Slider min={6} max={22} step={0.5} value={[speed]}
                      onValueChange={([v]) => setSpeed(v)} className="py-1" data-testid="slider-speed" />
                    <div className="flex justify-between text-xs text-slate-500 mt-0.5"><span>6 kn</span><span>22 kn</span></div>
                  </div>
                </CardContent>
              </Card>

              {/* C) CALCULATE */}
              <Button className="w-full h-10 text-sm font-semibold bg-blue-600 hover:bg-blue-700" onClick={calculate}
                disabled={calculating || !canCalculate} data-testid="button-calculate">
                {calculating ? (<><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Hesaplanıyor...</>) : (<><Navigation className="h-4 w-4 mr-2" />Rotayı Hesapla</>)}
              </Button>

              {/* D) RESULTS */}
              {routeResult && summary && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: <MapIcon className="h-3.5 w-3.5 text-blue-400" />, label: "Toplam Mesafe", value: `${summary.totalDistanceNm?.toFixed(0)} NM` },
                      { icon: <Clock className="h-3.5 w-3.5 text-purple-400" />, label: "Tahmini Süre", value: `${Math.floor(summary.totalDays || 0)} gün ${Math.round(((summary.totalDays || 0) % 1) * 24)}s` },
                      { icon: <Gauge className="h-3.5 w-3.5 text-green-400" />, label: "Hız", value: `${speed} knot` },
                      { icon: <Anchor className="h-3.5 w-3.5 text-red-400" />, label: "Tahmini Varış", value: summary.arrivalDate ? fmt(summary.arrivalDate).split(" ").slice(0, 2).join(" ") : "—" },
                    ].map(c => (
                      <div key={c.label} className="bg-slate-900 rounded-md p-2.5 border border-slate-700">
                        <div className="flex items-center gap-1 mb-0.5">{c.icon}<span className="text-xs text-slate-400">{c.label}</span></div>
                        <div className="text-sm font-bold text-slate-100">{c.value}</div>
                      </div>
                    ))}
                  </div>

                  {fuelResult && (
                    <Card className="bg-slate-900 border-slate-700">
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-slate-300">
                          <Fuel className="h-3.5 w-3.5 text-amber-400" /> Yakıt Hesabı
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-1.5">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-800 rounded p-2">
                            <div className="text-slate-400">HFO</div>
                            <div className="font-bold text-slate-100">{fuelResult.totalHfoConsumption} MT</div>
                            <div className="text-slate-500">{fuelResult.dailyHfoConsumption} MT/gün</div>
                          </div>
                          <div className="bg-slate-800 rounded p-2">
                            <div className="text-slate-400">MGO (ECA)</div>
                            <div className="font-bold text-slate-100">{fuelResult.totalMgoConsumption} MT</div>
                            <div className="text-slate-500">{fuelResult.dailyMgoConsumption} MT/gün</div>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Toplam Yakıt</span>
                          <span className="font-semibold text-slate-100">{fuelResult.totalFuelConsumption} MT</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">ECA Bölge Günleri</span>
                          <span className="text-amber-400">{fuelResult.ecaZoneDays} gün</span>
                        </div>
                        <div className="flex justify-between text-xs border-t border-slate-700 pt-1.5 mt-1.5">
                          <span className="text-slate-400">💰 Tahmini Yakıt Maliyeti</span>
                          <span className="font-bold text-emerald-400">${fuelResult.estimatedFuelCost?.toLocaleString()}</span>
                        </div>
                        <div className="text-xs text-slate-500">HFO ${fuelResult.fuelPrices?.hfo}/ton · MGO ${fuelResult.fuelPrices?.mgo}/ton</div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Straits */}
                  {straits.length > 0 ? (
                    <Card className="bg-slate-900 border-slate-700">
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-slate-300">
                          <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" /> Geçilecek Boğaz / Kanallar
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3">
                        <div className="flex flex-wrap gap-1.5">
                          {straits.map((s: any, i: number) => (
                            <Badge key={i} className={`text-xs px-2 py-0.5 ${s.type === "canal" ? "bg-orange-500/20 text-orange-300 border-orange-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}`}>
                              {s.type === "canal" ? "🟡" : "🔵"} {s.name} (~{s.transitHours}h)
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="text-xs text-slate-500 text-center py-1">Bu rotada boğaz/kanal geçişi yok</div>
                  )}

                  {/* Waypoint Table */}
                  {waypoints.length > 0 && (
                    <Card className="bg-slate-900 border-slate-700">
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-slate-300">
                          <List className="h-3.5 w-3.5 text-blue-400" /> Waypoint'ler
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-700">
                                {["#", "Ad", "Tip", "Lat", "Lon", "Kurs°", "NM", "kn", "ETA"].map(h => (
                                  <th key={h} className="px-2 py-1.5 text-left text-slate-400 font-medium whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {waypoints.map((wp, idx) => {
                                const rowBg = wp.isPort ? "bg-blue-950/40 hover:bg-blue-950/60" : wp.isCanal ? "bg-orange-950/30 hover:bg-orange-950/50" : wp.isStrait ? "bg-amber-950/30 hover:bg-amber-950/50" : "hover:bg-slate-800/50";
                                return (
                                  <tr key={idx} className={`border-b border-slate-800 cursor-pointer transition-colors ${rowBg} ${focusedWp === idx ? "ring-1 ring-inset ring-blue-500" : ""}`}
                                    onClick={() => setFocusedWp(focusedWp === idx ? null : idx)}
                                    data-testid={`row-waypoint-${idx}`}>
                                    <td className="px-2 py-1.5 text-slate-400">{idx + 1}</td>
                                    <td className="px-2 py-1.5 font-medium text-slate-200 whitespace-nowrap max-w-[80px] truncate" title={wp.name}>{wp.name}</td>
                                    <td className="px-2 py-1.5">
                                      {wp.isPort ? <Badge className="text-xs px-1 py-0 bg-blue-500/20 text-blue-300 border-blue-500/30">Port</Badge>
                                        : wp.isCanal ? <Badge className="text-xs px-1 py-0 bg-orange-500/20 text-orange-300 border-orange-500/30">Canal</Badge>
                                          : wp.isStrait ? <Badge className="text-xs px-1 py-0 bg-amber-500/20 text-amber-300 border-amber-500/30">Strait</Badge>
                                            : <Badge className="text-xs px-1 py-0 bg-slate-500/20 text-slate-400">WP</Badge>}
                                    </td>
                                    <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">{wp.latitude?.toFixed(2)}</td>
                                    <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">{wp.longitude?.toFixed(2)}</td>
                                    <td className="px-2 py-1.5 text-slate-400">{wp.courseToNext?.toFixed(0) ?? "—"}</td>
                                    <td className="px-2 py-1.5 text-slate-300">{wp.distanceToNextNm?.toFixed(0) ?? "—"}</td>
                                    <td className="px-2 py-1.5 text-slate-400">{wp.speedKnots?.toFixed(0) ?? "—"}</td>
                                    <td className="px-2 py-1.5 text-slate-400 whitespace-nowrap">{wp.eta ? fmtShort(wp.eta) : "—"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* F) ACTIONS */}
                  <div className="flex gap-2">
                    <Button className="flex-1 h-8 text-xs bg-emerald-700 hover:bg-emerald-600" onClick={savePlan} data-testid="button-save-plan">
                      <Save className="h-3.5 w-3.5 mr-1" /> Kaydet
                    </Button>
                    <Button variant="outline" className="flex-1 h-8 text-xs border-slate-600" onClick={() => generatePDF({ ...selectedPlan, title: selectedPlan?.title || `${depPort.name} → ${destPort.name}`, departurePort: depPort.name, destinationPort: destPort.name, departureDate: depDate, arrivalDate: summary?.arrivalDate, totalDistanceNm: summary?.totalDistanceNm, totalDays: summary?.totalDays, plannedSpeed: speed, vesselName: vessel?.name || vessel?.vessel_name, imoNumber: imoInput, flag: vessel?.flag, vesselType: vessel?.vessel_type, deadweight: vessel?.deadweight, grossTonnage: vessel?.gross_tonnage }, waypoints, fuelResult)}
                      data-testid="button-export-pdf">
                      <Download className="h-3.5 w-3.5 mr-1" /> PDF
                    </Button>
                    {selectedPlan?.id && (
                      <Button variant="outline" className="h-8 text-xs border-slate-600 px-3" onClick={() => duplicatePlan(selectedPlan.id)} data-testid="button-duplicate">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ─── MY PLANS TAB ─────────────────────── */}
            <TabsContent value="plans" className="flex-1 overflow-y-auto px-4 pb-4 mt-0">
              {plans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Navigation className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">Henüz kayıtlı plan yok</p>
                  <Button className="mt-4 text-xs h-8" onClick={() => setActiveTab("new")} variant="outline">Yeni Plan Oluştur</Button>
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  {plans.map((plan: any) => (
                    <div key={plan.id} className="bg-slate-900 border border-slate-700 rounded-md p-3 hover:border-slate-600 transition-colors" data-testid={`card-plan-${plan.id}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-200 truncate">{plan.title || `${plan.departurePort} → ${plan.destinationPort}`}</div>
                          {plan.vesselName && <div className="text-xs text-slate-400">{plan.vesselName}</div>}
                        </div>
                        <Badge className={`text-xs shrink-0 ${STATUS_COLORS[plan.status || "draft"]}`}>{plan.status || "draft"}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 text-xs text-slate-500 mb-2">
                        {plan.totalDistanceNm && <span>📍 {plan.totalDistanceNm.toFixed(0)} NM</span>}
                        {plan.totalDays && <span>⏱ {plan.totalDays.toFixed(1)} gün</span>}
                        {plan.plannedSpeed && <span>⚡ {plan.plannedSpeed} kn</span>}
                        {plan.departureDate && <span>📅 {fmt(plan.departureDate)}</span>}
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="h-6 text-xs px-2 border-slate-600 flex-1"
                          onClick={() => loadPlan(plan)} data-testid={`button-load-plan-${plan.id}`}>
                          Yükle & Düzenle
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => duplicatePlan(plan.id)}><Copy className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-red-400 hover:text-red-300" onClick={() => deletePlan(plan.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* RIGHT PANEL — MAP */}
        <div className="flex-1 relative">
          {waypoints.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
              <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 text-center max-w-xs border border-slate-700">
                <Navigation className="h-10 w-10 mx-auto mb-3 text-blue-400 opacity-60" />
                <p className="text-sm text-slate-300 font-medium">Rota haritada görünecek</p>
                <p className="text-xs text-slate-500 mt-1">Kalkış ve varış limanı seçip "Rotayı Hesapla" butonuna basın</p>
              </div>
            </div>
          )}
          <MapPanel
            waypoints={waypoints}
            routeGeometry={routeGeo}
            onWpClick={setFocusedWp}
            vesselPosition={vesselPosition}
          />
        </div>
      </div>
    </div>
  );
}
