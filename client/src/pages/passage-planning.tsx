import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation, Plus, Trash2, MapPin, Clock, Anchor, Download, ChevronDown, ChevronUp, Edit2, Check, X, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageMeta } from "@/components/page-meta";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fmtDate } from "@/lib/formatDate";
import type { PassagePlan, PassageWaypoint } from "@shared/schema";
import jsPDF from "jspdf";
import { ensureMapboxToken } from "@/lib/mapbox-init";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  active: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

function generatePDF(plan: PassagePlan, waypoints: PassageWaypoint[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PASSAGE PLAN", pageW / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(plan.planName, pageW / 2, y, { align: "center" });
  y += 12;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Voyage Details", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  const details = [
    ["Origin:", plan.origin],
    ["Destination:", plan.destination],
    ["Departure:", plan.departureDate ? fmtDate(plan.departureDate) : "TBD"],
    ["Arrival:", plan.arrivalDate ? fmtDate(plan.arrivalDate) : "TBD"],
    ["Total Distance:", plan.totalDistanceNm ? `${plan.totalDistanceNm.toFixed(0)} NM` : "TBD"],
    ["Total Days:", plan.totalDays ? `${plan.totalDays.toFixed(1)} days` : "TBD"],
  ];
  details.forEach(([label, val]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(val, 55, y);
    y += 5;
  });
  y += 5;

  if (waypoints.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Waypoints", 14, y);
    y += 6;
    const headers = ["#", "Name", "Lat", "Lon", "Crs°", "Dist NM", "Spd kn", "ETD", "ETA"];
    const colW = [8, 35, 20, 20, 14, 18, 14, 22, 22];
    doc.setFontSize(8);
    let x = 14;
    doc.setFont("helvetica", "bold");
    headers.forEach((h, i) => { doc.text(h, x + 1, y); x += colW[i]; });
    y += 2;
    doc.line(14, y, pageW - 14, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    waypoints.forEach(wp => {
      x = 14;
      const row = [
        String(wp.sequence + 1),
        wp.waypointName,
        wp.latitude?.toFixed(4) ?? "",
        wp.longitude?.toFixed(4) ?? "",
        wp.courseToNext?.toFixed(0) ?? "",
        wp.distanceToNextNm?.toFixed(1) ?? "",
        wp.speedKnots?.toFixed(1) ?? "",
        wp.etd ? fmtDate(wp.etd) : "",
        wp.eta ? fmtDate(wp.eta) : "",
      ];
      row.forEach((cell, i) => {
        doc.text(cell, x + 1, y);
        x += colW[i];
      });
      y += 6;
    });
  }

  if (plan.notes) {
    y += 5;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(plan.notes, pageW - 28);
    doc.text(lines, 14, y);
  }

  doc.save(`passage-plan-${plan.planName.replace(/\s+/g, "-")}.pdf`);
}

function WaypointEditor({ planId, waypoints, onClose }: { planId: number; waypoints: PassageWaypoint[]; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ waypointName: "", latitude: "", longitude: "", courseToNext: "", distanceToNextNm: "", speedKnots: "" });

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/passage-plans/${planId}/waypoints`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/passage-plans", planId, "waypoints"] });
      queryClient.invalidateQueries({ queryKey: ["/api/passage-plans"] });
      setForm({ waypointName: "", latitude: "", longitude: "", courseToNext: "", distanceToNextNm: "", speedKnots: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (wid: number) => apiRequest("DELETE", `/api/passage-plans/${planId}/waypoints/${wid}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/passage-plans", planId, "waypoints"] });
      queryClient.invalidateQueries({ queryKey: ["/api/passage-plans"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Waypoints ({waypoints.length})</h3>
        <Button size="sm" variant="ghost" onClick={onClose} className="text-xs">
          <X className="w-3.5 h-3.5 mr-1" /> Close
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-2 px-2 text-muted-foreground font-medium">#</th>
              <th className="text-left py-2 px-2 text-muted-foreground font-medium">Waypoint</th>
              <th className="text-left py-2 px-2 text-muted-foreground font-medium">Lat</th>
              <th className="text-left py-2 px-2 text-muted-foreground font-medium">Lon</th>
              <th className="text-left py-2 px-2 text-muted-foreground font-medium">Course°</th>
              <th className="text-left py-2 px-2 text-muted-foreground font-medium">Dist NM</th>
              <th className="text-left py-2 px-2 text-muted-foreground font-medium">Speed kn</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {waypoints.map((wp, i) => (
              <tr key={wp.id} className="border-b border-border/30 hover:bg-muted/20" data-testid={`waypoint-row-${wp.id}`}>
                <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                <td className="py-2 px-2 font-medium">{wp.waypointName}</td>
                <td className="py-2 px-2 text-muted-foreground">{wp.latitude?.toFixed(4) ?? "—"}</td>
                <td className="py-2 px-2 text-muted-foreground">{wp.longitude?.toFixed(4) ?? "—"}</td>
                <td className="py-2 px-2 text-muted-foreground">{wp.courseToNext ?? "—"}</td>
                <td className="py-2 px-2 text-muted-foreground">{wp.distanceToNextNm ?? "—"}</td>
                <td className="py-2 px-2 text-muted-foreground">{wp.speedKnots ?? "—"}</td>
                <td className="py-2 px-2">
                  <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => deleteMutation.mutate(wp.id)}>
                    <Trash2 className="w-3 h-3 text-destructive/60" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border border-border/50 rounded-lg p-3 space-y-2 bg-muted/10">
        <p className="text-xs font-medium text-muted-foreground">Add Waypoint</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Input placeholder="Waypoint name *" value={form.waypointName} onChange={e => setForm(f => ({ ...f, waypointName: e.target.value }))} className="h-8 text-xs" data-testid="input-waypoint-name" />
          <Input placeholder="Latitude" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} className="h-8 text-xs" data-testid="input-waypoint-lat" />
          <Input placeholder="Longitude" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} className="h-8 text-xs" data-testid="input-waypoint-lon" />
          <Input placeholder="Course to next (°)" value={form.courseToNext} onChange={e => setForm(f => ({ ...f, courseToNext: e.target.value }))} className="h-8 text-xs" data-testid="input-waypoint-course" />
          <Input placeholder="Distance to next (NM)" value={form.distanceToNextNm} onChange={e => setForm(f => ({ ...f, distanceToNextNm: e.target.value }))} className="h-8 text-xs" data-testid="input-waypoint-dist" />
          <Input placeholder="Speed (kn)" value={form.speedKnots} onChange={e => setForm(f => ({ ...f, speedKnots: e.target.value }))} className="h-8 text-xs" data-testid="input-waypoint-speed" />
        </div>
        <Button
          size="sm"
          onClick={() => {
            if (!form.waypointName) return;
            addMutation.mutate({
              waypointName: form.waypointName,
              sequence: waypoints.length,
              latitude: form.latitude ? parseFloat(form.latitude) : null,
              longitude: form.longitude ? parseFloat(form.longitude) : null,
              courseToNext: form.courseToNext ? parseFloat(form.courseToNext) : null,
              distanceToNextNm: form.distanceToNextNm ? parseFloat(form.distanceToNextNm) : null,
              speedKnots: form.speedKnots ? parseFloat(form.speedKnots) : null,
            });
          }}
          disabled={!form.waypointName || addMutation.isPending}
          className="w-full text-xs"
          data-testid="button-add-waypoint"
        >
          {addMutation.isPending ? "Adding..." : "Add Waypoint"}
        </Button>
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: PassagePlan;
  selected: boolean;
  onSelect: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const { data: waypoints = [] } = useQuery<PassageWaypoint[]>({
    queryKey: ["/api/passage-plans", plan.id, "waypoints"],
    queryFn: async () => {
      const res = await fetch(`/api/passage-plans/${plan.id}/waypoints`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/passage-plans/${plan.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/passage-plans"] });
      toast({ title: "Plan deleted" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/passage-plans/${plan.id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/passage-plans"] }),
  });

  return (
    <Card
      className={`overflow-hidden transition-all cursor-pointer ${selected ? "ring-2 ring-blue-500 border-blue-500/50" : "hover:border-border"}`}
      onClick={() => onSelect(plan.id)}
      data-testid={`card-plan-${plan.id}`}
    >
      <div className="p-4 flex items-start gap-3">
        <div className="mt-0.5 w-8 h-8 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0">
          <Navigation className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{plan.planName}</h3>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[plan.status || "draft"]}`}>
              {plan.status || "draft"}
            </Badge>
            {waypoints.length > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-500/30">
                {waypoints.length} waypoints
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{plan.origin} → {plan.destination}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {plan.departureDate && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="w-3 h-3" />
                {fmtDate(plan.departureDate)}
              </span>
            )}
            {plan.totalDistanceNm && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Anchor className="w-3 h-3" />
                {plan.totalDistanceNm.toFixed(0)} NM
              </span>
            )}
            {plan.totalDays && (
              <span className="text-xs text-muted-foreground">
                ~{plan.totalDays.toFixed(1)} days
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <Button
            size="icon"
            variant="ghost"
            className="w-7 h-7"
            onClick={e => { e.stopPropagation(); generatePDF(plan, waypoints); }}
            title="Export PDF"
            data-testid={`button-pdf-plan-${plan.id}`}
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="w-7 h-7 text-destructive/60 hover:text-destructive"
            onClick={e => { e.stopPropagation(); deleteMutation.mutate(); }}
            data-testid={`button-delete-plan-${plan.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <button
            onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            data-testid={`button-expand-plan-${plan.id}`}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border/50 p-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-muted-foreground">Status:</span>
            <Select value={plan.status || "draft"} onValueChange={s => statusMutation.mutate(s)}>
              <SelectTrigger className="h-7 w-32 text-xs" data-testid={`select-plan-status-${plan.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <WaypointEditor planId={plan.id} waypoints={waypoints} onClose={() => setExpanded(false)} />
        </div>
      )}
    </Card>
  );
}

export default function PassagePlanningPage() {
  const { toast } = useToast();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ planName: "", origin: "", destination: "", departureDate: "", arrivalDate: "", notes: "" });
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);

  const { data: plans, isLoading } = useQuery<PassagePlan[]>({
    queryKey: ["/api/passage-plans"],
  });

  const { data: selectedWaypoints = [] } = useQuery<PassageWaypoint[]>({
    queryKey: ["/api/passage-plans", selectedPlanId, "waypoints"],
    queryFn: async () => {
      const res = await fetch(`/api/passage-plans/${selectedPlanId}/waypoints`);
      return res.json();
    },
    enabled: !!selectedPlanId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/passage-plans", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/passage-plans"] });
      setShowNew(false);
      setForm({ planName: "", origin: "", destination: "", departureDate: "", arrivalDate: "", notes: "" });
      toast({ title: "Passage plan created" });
    },
  });

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!mapboxgl.supported()) return;
    let destroyed = false;
    ensureMapboxToken().then((token) => {
      if (destroyed || !token || !mapContainerRef.current || mapRef.current) return;
      try {
        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/dark-v11",
          center: [28.97, 41.01],
          zoom: 4,
        });
        map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");
        map.addControl(new mapboxgl.ScaleControl({ maxWidth: 80, unit: "nautical" }), "bottom-left");
        mapRef.current = map;
      } catch { /* ignore */ }
    });
    return () => {
      destroyed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const clearMap = () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      popupsRef.current.forEach(p => p.remove());
      popupsRef.current = [];
      if (map.getLayer("route-line")) map.removeLayer("route-line");
      if (map.getLayer("route-line-bg")) map.removeLayer("route-line-bg");
      if (map.getSource("route")) map.removeSource("route");
    };

    const plotWaypoints = () => {
      clearMap();

      const validWps = selectedWaypoints.filter(wp => wp.latitude != null && wp.longitude != null);
      if (validWps.length === 0) return;

      validWps.forEach((wp, i) => {
        const el = document.createElement("div");
        el.style.cssText = `
          width: 28px; height: 28px; border-radius: 50%;
          background: #3b82f6; border: 2px solid #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: #fff;
          font-family: system-ui; cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        `;
        el.textContent = String(i + 1);

        const popup = new mapboxgl.Popup({ offset: 16, closeButton: true, maxWidth: "220px" })
          .setHTML(`
            <div style="font-size:12px;font-family:system-ui;line-height:1.6;padding:2px 0">
              <div style="font-weight:700;font-size:13px;margin-bottom:4px;color:#1e293b">${wp.waypointName}</div>
              <div style="color:#64748b">Lat: ${wp.latitude?.toFixed(4)}</div>
              <div style="color:#64748b">Lon: ${wp.longitude?.toFixed(4)}</div>
              ${wp.courseToNext != null ? `<div style="color:#64748b">Course: ${wp.courseToNext}°</div>` : ""}
              ${wp.distanceToNextNm != null ? `<div style="color:#64748b">Distance: ${wp.distanceToNextNm} NM</div>` : ""}
              ${wp.speedKnots != null ? `<div style="color:#64748b">Speed: ${wp.speedKnots} kn</div>` : ""}
            </div>
          `);

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([wp.longitude!, wp.latitude!])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
        popupsRef.current.push(popup);
      });

      if (validWps.length >= 2) {
        const coords = validWps.map(wp => [wp.longitude!, wp.latitude!]);

        if (map.isStyleLoaded()) {
          addRouteLine(coords);
        } else {
          map.once("load", () => addRouteLine(coords));
        }
      }

      const bounds = new mapboxgl.LngLatBounds();
      validWps.forEach(wp => bounds.extend([wp.longitude!, wp.latitude!]));
      map.fitBounds(bounds, { padding: 80, maxZoom: 8, duration: 800 });
    };

    const addRouteLine = (coords: number[][]) => {
      if (map.getSource("route")) {
        (map.getSource("route") as mapboxgl.GeoJSONSource).setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coords },
        });
      } else {
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: coords },
          },
        });
        map.addLayer({
          id: "route-line-bg",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#1e3a5f", "line-width": 5, "line-opacity": 0.6 },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#3b82f6",
            "line-width": 2.5,
            "line-opacity": 0.9,
            "line-dasharray": [2, 1.5],
          },
        });
      }
    };

    if (map.isStyleLoaded()) {
      plotWaypoints();
    } else {
      map.once("load", plotWaypoints);
    }

  }, [selectedWaypoints, selectedPlanId]);

  const handleSelectPlan = (id: number) => {
    setSelectedPlanId(prev => prev === id ? null : id);
  };

  return (
    <div className="flex overflow-hidden bg-background" style={{ height: "calc(100vh - 56px)" }}>
      <PageMeta title="Passage Planning | VesselPDA" description="Create and manage voyage passage plans with waypoints" />

      {/* ── Left Panel: Plans List ────────────────────────────────────── */}
      <div className="w-[400px] flex-shrink-0 flex flex-col border-r border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)]">
              <Navigation className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
            </div>
            <div>
              <h1 className="text-sm font-bold font-serif">Passage Planning</h1>
              <p className="text-[10px] text-muted-foreground">Manage voyage route plans</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setShowNew(true)}
            data-testid="button-new-plan"
            className="h-7 px-2.5 text-xs bg-[hsl(var(--maritime-primary))] text-white hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Plan
          </Button>
        </div>

        {/* Plan list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />)}
            </div>
          ) : !plans || plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 space-y-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--maritime-primary)/0.08)] border border-[hsl(var(--maritime-primary)/0.15)] flex items-center justify-center">
                <Navigation className="w-6 h-6 text-[hsl(var(--maritime-primary))]" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">No passage plans yet</h3>
                <p className="text-xs text-muted-foreground mt-1">Create your first plan to visualize routes on the map.</p>
              </div>
              <Button size="sm" onClick={() => setShowNew(true)} data-testid="button-first-plan">
                <Plus className="w-4 h-4 mr-1.5" /> Create First Plan
              </Button>
            </div>
          ) : (
            plans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selectedPlanId === plan.id}
                onSelect={handleSelectPlan}
              />
            ))
          )}
        </div>

        {/* Map hint */}
        {plans && plans.length > 0 && !selectedPlanId && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border bg-muted/20 flex-shrink-0">
            <Map className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground">Click a plan to view its route on the map</p>
          </div>
        )}
        {selectedPlanId && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border bg-blue-900/20 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
            <p className="text-[11px] text-blue-300">
              {selectedWaypoints.filter(w => w.latitude != null).length} waypoint{selectedWaypoints.filter(w => w.latitude != null).length !== 1 ? "s" : ""} plotted on map
            </p>
          </div>
        )}
      </div>

      {/* ── Right Panel: Mapbox Map ───────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden" data-testid="passage-map-container">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Map overlay: no plan selected hint */}
        {!selectedPlanId && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-xl px-5 py-4 text-center max-w-xs">
              <Navigation className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-200">Select a passage plan</p>
              <p className="text-xs text-slate-400 mt-1">Choose a plan from the left panel to see its route on the map</p>
            </div>
          </div>
        )}
      </div>

      {/* ── New Plan Dialog ───────────────────────────────────────────── */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Passage Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Plan Name *</Label>
              <Input value={form.planName} onChange={e => setForm(f => ({ ...f, planName: e.target.value }))} placeholder="e.g. Istanbul → Novorossiysk" data-testid="input-plan-name" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Origin Port *</Label>
                <Input value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))} placeholder="TRIST — Istanbul" data-testid="input-plan-origin" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Destination Port *</Label>
                <Input value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} placeholder="UANOV — Novorossiysk" data-testid="input-plan-dest" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Departure Date</Label>
                <Input type="datetime-local" value={form.departureDate} onChange={e => setForm(f => ({ ...f, departureDate: e.target.value }))} data-testid="input-plan-departure" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Estimated Arrival</Label>
                <Input type="datetime-local" value={form.arrivalDate} onChange={e => setForm(f => ({ ...f, arrivalDate: e.target.value }))} data-testid="input-plan-arrival" className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Additional remarks, speed restrictions, weather notes..." data-testid="input-plan-notes" className="mt-1 resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.planName || !form.origin || !form.destination || createMutation.isPending}
              data-testid="button-create-plan"
            >
              Create Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
