import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Ship, Anchor, Clock,
  List, LayoutGrid, AlignLeft, X, ArrowRight, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { EmptyState } from "@/components/empty-state";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, parseISO, differenceInCalendarDays, addMonths, subMonths, addDays } from "date-fns";

const VESSEL_COLORS = ["#38BDF8","#22C55E","#F59E0B","#8B5CF6","#EC4899","#EF4444","#14B8A6","#F97316"];

interface ScheduleEvent {
  id: number;
  vesselId: number | null;
  vesselName: string;
  vesselFlag: string;
  portName: string;
  portCode: string;
  operation: string;
  status: string;
  eta: string | null;
  etd: string | null;
  durationDays: number;
  color: string;
  hasNor: boolean;
  hasSof: boolean;
  hasPda: boolean;
  hasFda: boolean;
}

interface VesselInfo {
  id: number;
  name: string;
  flag: string;
  color: string;
}

type ViewMode = "month" | "timeline" | "list";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  planned:     { label: "Planned",     className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
  in_progress: { label: "In Progress", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  completed:   { label: "Completed",   className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  cancelled:   { label: "Cancelled",   className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
};

function DocBadge({ label, has }: { label: string; has: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${has ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-600"}`}>
      {has ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} {label}
    </span>
  );
}

function EventPopover({ event, onClose }: { event: ScheduleEvent; onClose: () => void }) {
  const [, navigate] = useLocation();
  const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.planned;
  const eta = event.eta ? parseISO(event.eta) : null;
  const etd = event.etd ? parseISO(event.etd) : null;

  return (
    <Card className="absolute z-50 w-72 p-4 shadow-2xl border-2 space-y-3 bg-card" style={{ borderColor: event.color }}>
      <button onClick={onClose} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: event.color }} />
        <span className="font-semibold text-sm">{event.vesselName}</span>
        {event.vesselFlag && <span className="text-xs text-muted-foreground">{event.vesselFlag}</span>}
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex gap-2"><Anchor className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" /><span>{event.portName} {event.portCode && <span className="text-muted-foreground">({event.portCode})</span>}</span></div>
        <div className="flex gap-2"><Ship className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" /><span>{event.operation}</span></div>
        {eta && <div className="flex gap-2"><Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" /><span>ETA: {format(eta, "dd MMM yyyy HH:mm")}</span></div>}
        {etd && <div className="flex gap-2"><Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" /><span>ETD: {format(etd, "dd MMM yyyy HH:mm")}</span></div>}
        <div className="flex gap-2"><Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" /><span>{event.durationDays} day{event.durationDays !== 1 ? "s" : ""}</span></div>
      </div>
      <Badge className={`text-[10px] px-2 py-0.5 border-0 ${statusCfg.className}`}>{statusCfg.label}</Badge>
      <div className="flex gap-3 pt-1 border-t border-border/50">
        <DocBadge label="NOR" has={event.hasNor} />
        <DocBadge label="SOF" has={event.hasSof} />
        <DocBadge label="PDA" has={event.hasPda} />
        <DocBadge label="FDA" has={event.hasFda} />
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="h-7 text-xs flex-1" onClick={() => navigate(`/voyages/${event.id}`)}>
          View Voyage <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
        {!event.hasPda && (
          <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => navigate(`/proformas/new?vesselId=${event.vesselId}`)}>
            Create PDA
          </Button>
        )}
      </div>
    </Card>
  );
}

function MonthView({ events, currentDate, onDayClick }: {
  events: ScheduleEvent[];
  currentDate: Date;
  onDayClick: (date: Date) => void;
}) {
  const [popoverEvent, setPopoverEvent] = useState<{ event: ScheduleEvent; row: number; col: number } | null>(null);
  const [, navigate] = useLocation();

  const calStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
  const calEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  function getEventsForDay(day: Date): ScheduleEvent[] {
    return events.filter(e => {
      if (!e.eta) return false;
      const start = parseISO(e.eta);
      const end = e.etd ? parseISO(e.etd) : start;
      return day >= start && day <= end;
    });
  }

  const weekHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="overflow-hidden">
      <div className="grid grid-cols-7 mb-1">
        {weekHeaders.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodays = isToday(day);
          const row = Math.floor(idx / 7);
          const col = idx % 7;

          return (
            <div
              key={day.toISOString()}
              className={`bg-card min-h-[100px] p-1.5 relative cursor-pointer hover:bg-muted/30 transition-colors ${!isCurrentMonth ? "opacity-40" : ""} ${isTodays ? "ring-2 ring-inset ring-sky-400 bg-sky-50/30 dark:bg-sky-950/20" : ""}`}
              onClick={() => onDayClick(day)}
              data-testid={`day-cell-${format(day, "yyyy-MM-dd")}`}
            >
              <span className={`text-xs font-medium block mb-1 ${isTodays ? "text-sky-500 font-bold" : "text-muted-foreground"}`}>
                {format(day, "d")}
              </span>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(e => (
                  <div
                    key={e.id}
                    className={`rounded px-1 py-0.5 text-[10px] font-medium truncate cursor-pointer hover:opacity-80 transition-opacity ${e.status === "in_progress" ? "animate-pulse" : ""}`}
                    style={{ backgroundColor: `${e.color}30`, borderLeft: `2px solid ${e.color}`, color: e.color }}
                    onClick={(ev) => { ev.stopPropagation(); setPopoverEvent({ event: e, row, col }); }}
                    data-testid={`event-pill-${e.id}`}
                  >
                    {e.vesselName.split(" ").pop()} · {e.portCode || e.portName.substring(0, 4).toUpperCase()}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} more</div>
                )}
              </div>
              {popoverEvent && popoverEvent.event && getEventsForDay(day).some(e => e.id === popoverEvent.event.id) && isSameDay(day, parseISO(popoverEvent.event.eta!)) && (
                <div className={`absolute ${popoverEvent.col >= 5 ? "right-0" : "left-0"} ${popoverEvent.row >= 3 ? "bottom-full" : "top-full"} mt-1 mb-1 z-50`}>
                  <EventPopover event={popoverEvent.event} onClose={() => setPopoverEvent(null)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineView({ events, vessels }: { events: ScheduleEvent[]; vessels: VesselInfo[] }) {
  const [zoom, setZoom] = useState<"week" | "month" | "3months">("month");
  const [, navigate] = useLocation();
  const today = new Date();

  const daysVisible = zoom === "week" ? 7 : zoom === "month" ? 30 : 90;
  const startDate = useMemo(() => {
    if (zoom === "week") return startOfWeek(today, { weekStartsOn: 1 });
    const d = new Date(today);
    d.setDate(1);
    return d;
  }, [zoom, today.toDateString()]);

  const pxPerDay = zoom === "week" ? 80 : zoom === "month" ? 32 : 12;
  const totalWidth = daysVisible * pxPerDay;

  const dateHeaders: Date[] = [];
  for (let i = 0; i < daysVisible; i++) {
    dateHeaders.push(addDays(startDate, i));
  }

  const todayOffset = differenceInCalendarDays(today, startDate);
  const todayPx = todayOffset * pxPerDay;

  const uniqueVessels = vessels.length > 0 ? vessels : Array.from(
    new Map(events.map(e => [e.vesselId, { id: e.vesselId!, name: e.vesselName, flag: e.vesselFlag, color: e.color }])).values()
  ).filter(v => v.id);

  function getBarStyle(event: ScheduleEvent) {
    if (!event.eta) return null;
    const start = parseISO(event.eta);
    const end = event.etd ? parseISO(event.etd) : start;
    const left = differenceInCalendarDays(start, startDate) * pxPerDay;
    const width = Math.max(pxPerDay, (differenceInCalendarDays(end, start) + 1) * pxPerDay);
    if (left + width < 0 || left > totalWidth) return null;
    const clampedLeft = Math.max(0, left);
    const clampedWidth = Math.min(width, totalWidth - clampedLeft);
    return { left: clampedLeft, width: clampedWidth };
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">Zoom:</span>
        {(["week", "month", "3months"] as const).map(z => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${zoom === z ? "bg-[hsl(var(--maritime-primary))] text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {z === "week" ? "Week" : z === "month" ? "Month" : "3 Months"}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <div style={{ minWidth: `${totalWidth + 128}px` }}>
          <div className="flex border-b border-border bg-muted/40">
            <div className="w-32 flex-shrink-0 px-3 py-2 text-xs font-semibold text-muted-foreground">Vessel</div>
            <div className="flex-1 relative" style={{ width: totalWidth }}>
              <div className="flex">
                {dateHeaders.filter((_, i) => {
                  if (zoom === "week") return true;
                  if (zoom === "month") return i % 5 === 0;
                  return i % 15 === 0;
                }).map((d, i) => (
                  <div
                    key={i}
                    className="text-[10px] text-muted-foreground py-2 border-l border-border/50 px-1"
                    style={{ width: zoom === "week" ? pxPerDay * 1 : zoom === "month" ? pxPerDay * 5 : pxPerDay * 15 }}
                  >
                    {format(d, zoom === "week" ? "EEE d" : "d MMM")}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {uniqueVessels.map((vessel) => {
            const vesselEvents = events.filter(e => e.vesselId === vessel.id);
            return (
              <div key={vessel.id} className="flex border-b border-border/50 hover:bg-muted/20 transition-colors" style={{ minHeight: 48 }}>
                <div className="w-32 flex-shrink-0 px-3 py-2 flex items-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: vessel.color }} />
                    <span className="text-xs font-medium truncate">{vessel.name}</span>
                  </div>
                </div>
                <div className="flex-1 relative" style={{ width: totalWidth, minHeight: 48 }}>
                  {todayOffset >= 0 && todayOffset <= daysVisible && (
                    <div className="absolute top-0 bottom-0 w-px bg-red-500 opacity-50 z-10" style={{ left: todayPx }} />
                  )}
                  {vesselEvents.map(event => {
                    const bar = getBarStyle(event);
                    if (!bar) return null;
                    const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.planned;
                    return (
                      <div
                        key={event.id}
                        className={`absolute top-2 h-8 rounded-md cursor-pointer hover:opacity-90 transition-opacity flex items-center px-2 overflow-hidden ${event.status === "in_progress" ? "animate-pulse" : ""}`}
                        style={{ left: bar.left, width: bar.width, backgroundColor: `${event.color}30`, border: `1px solid ${event.color}` }}
                        onClick={() => navigate(`/voyages/${event.id}`)}
                        title={`${event.vesselName} → ${event.portName} (${event.operation})`}
                      >
                        <span className="text-[10px] font-medium truncate" style={{ color: event.color }}>
                          {event.portName} · {event.operation}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {uniqueVessels.length === 0 && (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              No vessels with schedule data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ListView({ events }: { events: ScheduleEvent[] }) {
  const [, navigate] = useLocation();
  const sorted = [...events].sort((a, b) => {
    if (!a.eta) return 1;
    if (!b.eta) return -1;
    return new Date(a.eta).getTime() - new Date(b.eta).getTime();
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-border" data-testid="table-schedule-list">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 border-b border-border">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Vessel</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Port</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Operation</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">ETA</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">ETD</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Duration</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Documents</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(event => {
            const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.planned;
            const eta = event.eta ? parseISO(event.eta) : null;
            const etd = event.etd ? parseISO(event.etd) : null;
            return (
              <tr
                key={event.id}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/voyages/${event.id}`)}
                data-testid={`row-voyage-${event.id}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: event.color }} />
                    <span className="font-medium">{event.vesselName}</span>
                    {event.vesselFlag && <span className="text-xs text-muted-foreground">{event.vesselFlag}</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span>{event.portName}</span>
                  {event.portCode && <span className="text-xs text-muted-foreground ml-1">({event.portCode})</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{event.operation}</td>
                <td className="px-4 py-3 text-muted-foreground">{eta ? format(eta, "dd MMM yyyy") : "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{etd ? format(etd, "dd MMM yyyy") : "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{event.durationDays}d</td>
                <td className="px-4 py-3">
                  <Badge className={`text-[10px] px-2 py-0 border-0 ${statusCfg.className}`}>{statusCfg.label}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <DocBadge label="NOR" has={event.hasNor} />
                    <DocBadge label="SOF" has={event.hasSof} />
                    <DocBadge label="PDA" has={event.hasPda} />
                    <DocBadge label="FDA" has={event.hasFda} />
                  </div>
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                No port calls match the current filter
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function VesselSchedule() {
  const { toast } = useToast();
  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedVesselId, setSelectedVesselId] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addPrefilledDate, setAddPrefilledDate] = useState("");
  const [addForm, setAddForm] = useState({
    vesselId: "",
    portId: "",
    purposeOfCall: "Loading",
    eta: "",
    etd: "",
    notes: "",
  });

  const from = format(subMonths(startOfMonth(currentDate), 2), "yyyy-MM-dd");
  const to = format(addMonths(endOfMonth(currentDate), 3), "yyyy-MM-dd");

  const scheduleParams = new URLSearchParams({ from, to });
  if (selectedVesselId !== "all") scheduleParams.set("vesselId", selectedVesselId);

  const { data: scheduleData, isLoading } = useQuery<{ events: ScheduleEvent[]; vessels: VesselInfo[] }>({
    queryKey: ["/api/vessel-schedule", selectedVesselId, from, to],
    queryFn: async () => {
      const res = await fetch(`/api/vessel-schedule?${scheduleParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch schedule");
      return res.json();
    },
  });

  const { data: vesselsList = [] } = useQuery<any[]>({ queryKey: ["/api/vessels"] });
  const { data: portsList = [] } = useQuery<any[]>({ queryKey: ["/api/ports"] });

  const events: ScheduleEvent[] = scheduleData?.events || [];
  const vessels: VesselInfo[] = scheduleData?.vessels || [];

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/voyages", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessel-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voyages"] });
      setShowAddDialog(false);
      setAddForm({ vesselId: "", portId: "", purposeOfCall: "Loading", eta: "", etd: "", notes: "" });
      toast({ title: "Port call added", description: "New voyage created and added to schedule." });
    },
    onError: () => toast({ title: "Error", description: "Could not create port call", variant: "destructive" }),
  });

  function handleDayClick(date: Date) {
    const dateStr = format(date, "yyyy-MM-dd");
    setAddPrefilledDate(dateStr);
    setAddForm(f => ({ ...f, eta: `${dateStr}T08:00`, etd: `${dateStr}T17:00` }));
    setShowAddDialog(true);
  }

  function handleAddSubmit() {
    if (!addForm.vesselId || !addForm.portId) {
      toast({ title: "Required fields missing", description: "Please select vessel and port.", variant: "destructive" });
      return;
    }
    const selectedVessel = vesselsList.find((v: any) => String(v.id) === addForm.vesselId);
    createMutation.mutate({
      vesselId: parseInt(addForm.vesselId),
      portId: parseInt(addForm.portId),
      purposeOfCall: addForm.purposeOfCall,
      eta: addForm.eta ? new Date(addForm.eta).toISOString() : null,
      etd: addForm.etd ? new Date(addForm.etd).toISOString() : null,
      notes: addForm.notes || null,
      status: "planned",
      vesselName: selectedVessel?.name || "",
      imoNumber: selectedVessel?.imoNumber || "",
      flag: selectedVessel?.flag || "",
      vesselType: selectedVessel?.vesselType || "",
      grt: selectedVessel?.grt || null,
    });
  }

  const filteredEvents = selectedVesselId === "all"
    ? events
    : events.filter(e => e.vesselId === parseInt(selectedVesselId));

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5" data-testid="page-vessel-schedule">
      <PageMeta title="Vessel Schedule | VesselPDA" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[hsl(var(--maritime-primary))]" />
            Vessel Schedule
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Fleet port call calendar — past &amp; upcoming</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
            <SelectTrigger className="w-44 h-9 text-sm" data-testid="select-vessel-filter">
              <SelectValue placeholder="All Vessels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vessels</SelectItem>
              {vessels.map(v => (
                <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2 h-9" data-testid="button-add-port-call">
            <Plus className="w-4 h-4" /> Add Port Call
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="hidden md:flex gap-1 bg-muted p-1 rounded-lg">
          <button
            onClick={() => setView("month")}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${view === "month" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="toggle-view-month"
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Month
          </button>
          <button
            onClick={() => setView("timeline")}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${view === "timeline" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="toggle-view-timeline"
          >
            <AlignLeft className="w-3.5 h-3.5" /> Timeline
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${view === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="toggle-view-list"
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
        </div>
        <div className="flex md:hidden gap-1 bg-muted p-1 rounded-lg">
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${view === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="toggle-view-list-mobile"
          >
            <List className="w-3.5 h-3.5" /> List
          </button>
        </div>

        {(view === "month" || view === "timeline") && (
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentDate(d => subMonths(d, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">{format(currentDate, "MMMM yyyy")}</span>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentDate(d => addMonths(d, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <div className="grid grid-cols-7 gap-px">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-none" />
            ))}
          </div>
        </div>
      ) : filteredEvents.length === 0 && view !== "list" ? (
        <EmptyState
          icon="🗓️"
          title="No Port Calls Scheduled"
          description="No voyages found for the selected period and vessel filter. Add your first port call to see it on the calendar."
          actionLabel="Add Port Call"
          onAction={() => setShowAddDialog(true)}
        />
      ) : (
        <>
          {view === "month" && (
            <MonthView
              events={filteredEvents.filter(e => {
                if (!e.eta) return false;
                const eta = parseISO(e.eta);
                const start = startOfMonth(currentDate);
                const end = endOfMonth(currentDate);
                const evEnd = e.etd ? parseISO(e.etd) : eta;
                return eta <= end && evEnd >= start;
              })}
              currentDate={currentDate}
              onDayClick={handleDayClick}
            />
          )}
          {view === "timeline" && (
            <TimelineView
              events={filteredEvents}
              vessels={vessels.filter(v => selectedVesselId === "all" || String(v.id) === selectedVesselId)}
            />
          )}
          {view === "list" && (
            <ListView events={filteredEvents} />
          )}
        </>
      )}

      <div className="flex gap-4 flex-wrap text-xs text-muted-foreground pt-2">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border-0 ${cfg.className}`}>{cfg.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1 ml-auto">
          {vessels.map(v => (
            <div key={v.id} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.color }} />
              <span className="text-[11px]">{v.name}</span>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg" data-testid="dialog-add-port-call">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Port Call
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vessel *</Label>
                <Select value={addForm.vesselId} onValueChange={v => setAddForm(f => ({ ...f, vesselId: v }))}>
                  <SelectTrigger data-testid="select-add-vessel">
                    <SelectValue placeholder="Select vessel" />
                  </SelectTrigger>
                  <SelectContent>
                    {vesselsList.map((v: any) => (
                      <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Port *</Label>
                <Select value={addForm.portId} onValueChange={v => setAddForm(f => ({ ...f, portId: v }))}>
                  <SelectTrigger data-testid="select-add-port">
                    <SelectValue placeholder="Select port" />
                  </SelectTrigger>
                  <SelectContent>
                    {(portsList as any[]).slice(0, 100).map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name} {p.code ? `(${p.code})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Operation</Label>
              <Select value={addForm.purposeOfCall} onValueChange={v => setAddForm(f => ({ ...f, purposeOfCall: v }))}>
                <SelectTrigger data-testid="select-add-operation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Loading">Loading</SelectItem>
                  <SelectItem value="Discharging">Discharging</SelectItem>
                  <SelectItem value="Transit">Transit</SelectItem>
                  <SelectItem value="Bunkering">Bunkering</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ETA</Label>
                <Input
                  type="datetime-local"
                  value={addForm.eta}
                  onChange={e => setAddForm(f => ({ ...f, eta: e.target.value }))}
                  data-testid="input-add-eta"
                />
              </div>
              <div className="space-y-1.5">
                <Label>ETD</Label>
                <Input
                  type="datetime-local"
                  value={addForm.etd}
                  onChange={e => setAddForm(f => ({ ...f, etd: e.target.value }))}
                  data-testid="input-add-etd"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                value={addForm.notes}
                onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional information..."
                rows={2}
                data-testid="input-add-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              onClick={handleAddSubmit}
              disabled={createMutation.isPending || !addForm.vesselId || !addForm.portId}
              data-testid="button-submit-port-call"
            >
              {createMutation.isPending ? "Adding..." : "Add Port Call"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
