import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation, Plus, Trash2, MapPin, Clock, Anchor, Download, ChevronDown, ChevronUp, Edit2, Check, X } from "lucide-react";
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
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Waypoints", 14, y);
    y += 6;

    const colW = [8, 38, 20, 20, 20, 22, 22, 22, 26];
    const headers = ["#", "Waypoint", "Lat", "Lon", "Course", "Dist (NM)", "Speed (kn)", "ETD", "ETA"];
    doc.setFillColor(30, 60, 100);
    doc.setTextColor(255, 255, 255);
    doc.rect(14, y - 4, pageW - 28, 6, "F");
    let x = 14;
    headers.forEach((h, i) => {
      doc.text(h, x + 1, y);
      x += colW[i];
    });
    doc.setTextColor(0, 0, 0);
    y += 3;

    waypoints.forEach((wp, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const bg = idx % 2 === 0 ? 245 : 255;
      doc.setFillColor(bg, bg, bg);
      doc.rect(14, y - 3.5, pageW - 28, 6, "F");
      doc.setFontSize(8);
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
              latitude: form.latitude || null,
              longitude: form.longitude || null,
              courseToNext: form.courseToNext || null,
              distanceToNextNm: form.distanceToNextNm || null,
              speedKnots: form.speedKnots || null,
            });
          }}
          disabled={!form.waypointName || addMutation.isPending}
          data-testid="button-add-waypoint"
          className="text-xs h-8"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Waypoint
        </Button>
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: PassagePlan }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const { data: waypointsData } = useQuery<PassageWaypoint[]>({
    queryKey: ["/api/passage-plans", plan.id, "waypoints"],
    enabled: expanded,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/passage-plans/${plan.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/passage-plans"] });
      toast({ title: "Passage plan deleted" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/passage-plans/${plan.id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/passage-plans"] }),
  });

  const waypoints = waypointsData || [];

  return (
    <Card className="overflow-hidden border-border/50" data-testid={`plan-card-${plan.id}`}>
      <div
        className="p-4 flex items-start gap-3 cursor-pointer hover:bg-muted/10"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[hsl(var(--maritime-primary)/0.1)] flex-shrink-0">
          <Navigation className="w-4.5 h-4.5 text-[hsl(var(--maritime-primary))]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{plan.planName}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${STATUS_COLORS[plan.status || "draft"]}`}>
              {plan.status?.toUpperCase() || "DRAFT"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {plan.origin} → {plan.destination}
          </p>
          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            {plan.totalDistanceNm && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Anchor className="w-3 h-3" />
                {plan.totalDistanceNm.toFixed(0)} NM
              </span>
            )}
            {plan.departureDate && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Dep: {fmtDate(plan.departureDate)}
              </span>
            )}
            {plan.totalDays && (
              <span className="text-xs text-muted-foreground">
                ~{plan.totalDays.toFixed(1)} days
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
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
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border/50 p-4">
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

  const { data: plans, isLoading } = useQuery<PassagePlan[]>({
    queryKey: ["/api/passage-plans"],
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

  return (
    <div className="min-h-screen bg-background">
      <PageMeta title="Passage Planning | VesselPDA" description="Create and manage voyage passage plans with waypoints" />

      <div className="max-w-4xl mx-auto px-4 py-6 pb-20 md:pb-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[hsl(var(--maritime-primary)/0.1)]">
              <Navigation className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-serif">Passage Planning</h1>
              <p className="text-xs text-muted-foreground">Manage voyage route plans with waypoints and ETAs</p>
            </div>
          </div>
          <Button
            onClick={() => setShowNew(true)}
            data-testid="button-new-plan"
            className="bg-[hsl(var(--maritime-primary))] text-white hover:opacity-90 text-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Plan
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />)}
          </div>
        ) : !plans || plans.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--maritime-primary)/0.08)] border border-[hsl(var(--maritime-primary)/0.15)] flex items-center justify-center mx-auto">
              <Navigation className="w-7 h-7 text-[hsl(var(--maritime-primary))]" />
            </div>
            <div>
              <h3 className="font-semibold">No passage plans yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Create your first passage plan to start tracking voyages with waypoints.</p>
            </div>
            <Button onClick={() => setShowNew(true)} data-testid="button-first-plan">
              <Plus className="w-4 h-4 mr-1.5" /> Create First Plan
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map(plan => <PlanCard key={plan.id} plan={plan} />)}
          </div>
        )}
      </div>

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
