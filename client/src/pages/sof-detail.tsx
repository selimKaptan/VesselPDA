import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  ArrowLeft, Download, CheckCircle2, Plus, Trash2, Loader2,
  ClipboardList, Clock, Ship, Anchor
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PageMeta } from "@/components/page-meta";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const EVENT_TYPES = [
  { value: "vessel_arrived",      label: "Vessel Arrived at Port" },
  { value: "nor_tendered",        label: "NOR Tendered" },
  { value: "nor_accepted",        label: "NOR Accepted" },
  { value: "berthing_started",    label: "Berthing Commenced" },
  { value: "all_fast",            label: "All Fast" },
  { value: "hoses_connected",     label: "Hoses Connected" },
  { value: "loading_commenced",   label: "Loading/Discharging Commenced" },
  { value: "loading_completed",   label: "Loading/Discharging Completed" },
  { value: "hoses_disconnected",  label: "Hoses Disconnected" },
  { value: "documents_onboard",   label: "Documents on Board" },
  { value: "unberthing_started",  label: "Unberthing Commenced" },
  { value: "pilot_onboard",       label: "Pilot on Board" },
  { value: "vessel_sailed",       label: "Vessel Sailed" },
  { value: "rain_start",          label: "Rain Start" },
  { value: "rain_stop",           label: "Rain Stop" },
  { value: "breakdown_start",     label: "Breakdown Start" },
  { value: "breakdown_stop",      label: "Breakdown Stop" },
  { value: "shifting_start",      label: "Shifting Start" },
  { value: "shifting_end",        label: "Shifting End" },
  { value: "custom",              label: "Custom Event" },
];

function fmtDateTime(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function toInputDatetime(d: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export default function SofDetail() {
  const { id } = useParams<{ id: string }>();
  const sofId = parseInt(id || "0");
  const { toast } = useToast();

  const [addEventOpen, setAddEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState<{
    eventType: string;
    eventName: string;
    eventDate: string;
    remarks: string;
    laytimeFactor: 100 | 50 | 0;
  }>({
    eventType: "custom",
    eventName: "",
    eventDate: toInputDatetime(new Date().toISOString()),
    remarks: "",
    laytimeFactor: 100,
  });
  const [autoAdjusted, setAutoAdjusted] = useState(false);

  const ZERO_FACTOR_EVENTS = ["rain_start", "rain_stop", "breakdown_start", "breakdown_stop"];
  const HALF_FACTOR_EVENTS = ["shifting_start", "shifting_end"];

  useEffect(() => {
    const et = newEvent.eventType;
    let factor: 100 | 50 | 0 = 100;
    if (ZERO_FACTOR_EVENTS.includes(et)) factor = 0;
    else if (HALF_FACTOR_EVENTS.includes(et)) factor = 50;
    setNewEvent(n => ({ ...n, laytimeFactor: factor }));
    setAutoAdjusted(et !== "custom");
  }, [newEvent.eventType]);

  // Pending edits keyed by event id
  const [editMap, setEditMap] = useState<Record<number, Partial<any>>>({});

  const { data: sof, isLoading } = useQuery<any>({
    queryKey: ["/api/sof", sofId],
    queryFn: async () => {
      const res = await fetch(`/api/sof/${sofId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!sofId,
  });

  const events: any[] = sof?.events || [];
  const isFinalized = sof?.status === "finalized" || sof?.status === "signed";

  const updateSofMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/sof/${sofId}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sof", sofId] }); },
  });

  const finalizeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/sof/${sofId}/finalize`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sof", sofId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sof"] });
      toast({ title: "SOF finalized", description: "The SOF is now locked and read-only." });
    },
  });

  const addEventMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/sof/${sofId}/events`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sof", sofId] });
      setAddEventOpen(false);
      setNewEvent({ eventType: "custom", eventName: "", eventDate: toInputDatetime(new Date().toISOString()), remarks: "", laytimeFactor: 100 });
      setAutoAdjusted(false);
      toast({ title: "Event added" });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ eventId, data }: { eventId: number; data: any }) =>
      apiRequest("PATCH", `/api/sof/events/${eventId}`, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sof", sofId] });
      setEditMap(m => { const n = { ...m }; delete n[vars.eventId]; return n; });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (eventId: number) => apiRequest("DELETE", `/api/sof/events/${eventId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sof", sofId] }); },
  });

  function patchEdit(eventId: number, key: string, value: any) {
    setEditMap(m => ({ ...m, [eventId]: { ...m[eventId], [key]: value } }));
  }

  function saveEvent(event: any) {
    const patch = editMap[event.id];
    if (!patch) return;
    updateEventMutation.mutate({ eventId: event.id, data: patch });
  }

  const handleAddEvent = () => {
    const payload: any = {
      ...newEvent,
      eventDate: new Date(newEvent.eventDate).toISOString(),
      sortOrder: events.length + 1,
    };
    if (newEvent.eventType === "custom" && newEvent.eventName) {
      payload.eventName = newEvent.eventName;
    } else {
      const found = EVENT_TYPES.find(e => e.value === newEvent.eventType);
      if (found) payload.eventName = found.label;
    }
    addEventMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!sof || sof.error) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">SOF not found.</p>
        <Link href="/sof"><Button variant="outline" className="mt-4 gap-2"><ArrowLeft className="h-4 w-4" />Back</Button></Link>
      </div>
    );
  }

  return (
    <>
      <PageMeta title={`SOF — ${sof.vesselName || "Statement of Facts"} | VesselPDA`} description="SOF timeline" />
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* Top bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/sof">
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back-sof">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <ClipboardList className="h-6 w-6 text-maritime-primary" />
            <div>
              <h1 className="text-xl font-bold">Statement of Facts</h1>
              <p className="text-xs text-muted-foreground">SOF #{sof.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isFinalized && (
              <Button
                variant="outline"
                onClick={() => finalizeMutation.mutate()}
                disabled={finalizeMutation.isPending}
                className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400"
                data-testid="button-finalize-sof"
              >
                {finalizeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Finalize SOF
              </Button>
            )}
            <a href={`/api/sof/${sofId}/pdf`} target="_blank" rel="noopener noreferrer">
              <Button className="gap-2" data-testid="button-export-pdf-sof">
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
            </a>
          </div>
        </div>

        {/* Info Card */}
        <div className="border rounded-xl p-5 bg-card space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Ship className="h-4 w-4 text-maritime-primary" />
            <span className="font-semibold text-sm">Vessel & Port Information</span>
            {isFinalized && (
              <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Finalized
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            {[
              { label: "Vessel", value: sof.vesselName },
              { label: "Port", value: sof.portName },
              { label: "Berth", value: sof.berthName },
              { label: "Cargo", value: sof.cargoType ? `${sof.cargoType}${sof.cargoQuantity ? " — " + sof.cargoQuantity : ""}` : null },
              { label: "Operation", value: sof.operation ? sof.operation.charAt(0).toUpperCase() + sof.operation.slice(1) : null },
              { label: "Master", value: sof.masterName },
              { label: "Agent", value: sof.agentName },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                <p className="font-medium">{value || "—"}</p>
              </div>
            ))}
          </div>
          {sof.remarks && (
            <div className="border-t pt-3 mt-1">
              <p className="text-xs text-muted-foreground mb-1">Remarks</p>
              <p className="text-sm">{sof.remarks}</p>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="space-y-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-maritime-primary" />
              Events Timeline
              <span className="text-xs text-muted-foreground font-normal">({events.length} events)</span>
            </h2>
            {!isFinalized && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setAddEventOpen(true)} data-testid="button-add-event">
                <Plus className="h-3.5 w-3.5" />
                Add Event
              </Button>
            )}
          </div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[1.75rem] top-0 bottom-0 w-0.5 bg-maritime-primary/20 dark:bg-maritime-primary/10" />

            <div className="space-y-3">
              {events.map((event: any, idx: number) => {
                const pending = editMap[event.id] || {};
                const isDirty = Object.keys(pending).length > 0;
                const dateVal = pending.eventDate !== undefined ? pending.eventDate : toInputDatetime(event.eventDate);
                const remarksVal = pending.remarks !== undefined ? pending.remarks : (event.remarks || "");
                const laytimeFactorVal: 100 | 50 | 0 =
                  (pending.laytimeFactor !== undefined
                    ? pending.laytimeFactor
                    : (event.laytimeFactor ?? 100)) as 100 | 50 | 0;

                return (
                  <div key={event.id} className="relative flex gap-4" data-testid={`event-card-${event.id}`}>
                    {/* Circle on timeline */}
                    <div className="flex-shrink-0 w-14 flex flex-col items-center">
                      <div className={`w-3.5 h-3.5 rounded-full mt-4 border-2 z-10 ${
                        (event.laytimeFactor ?? 100) === 0
                          ? "bg-muted-foreground/40 border-border"
                          : (event.laytimeFactor ?? 100) === 50
                          ? "bg-amber-400 border-amber-500"
                          : "bg-maritime-primary border-maritime-primary/60"
                      }`} />
                      <span className="text-[10px] text-muted-foreground mt-1 leading-tight text-center">{idx + 1}</span>
                    </div>

                    {/* Card */}
                    <div className={`flex-1 border rounded-xl p-4 bg-card mb-1 transition-colors ${
                      isDirty ? "border-maritime-primary/40 bg-maritime-primary/5" : ""
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm leading-snug">{event.eventName}</p>
                        {!isFinalized && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-500 flex-shrink-0"
                            onClick={() => deleteEventMutation.mutate(event.id)}
                            disabled={deleteEventMutation.isPending}
                            data-testid={`button-delete-event-${event.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Date / Time</Label>
                          {isFinalized ? (
                            <p className="text-sm font-medium mt-0.5">{fmtDateTime(event.eventDate)}</p>
                          ) : (
                            <Input
                              type="datetime-local"
                              className="h-8 text-xs mt-0.5"
                              value={dateVal}
                              onChange={e => patchEdit(event.id, "eventDate", e.target.value)}
                              data-testid={`input-event-date-${event.id}`}
                            />
                          )}
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Remarks</Label>
                          {isFinalized ? (
                            <p className="text-sm mt-0.5 text-muted-foreground">{event.remarks || "—"}</p>
                          ) : (
                            <Input
                              className="h-8 text-xs mt-0.5"
                              placeholder="Optional remarks…"
                              value={remarksVal}
                              onChange={e => patchEdit(event.id, "remarks", e.target.value)}
                              data-testid={`input-event-remarks-${event.id}`}
                            />
                          )}
                        </div>
                      </div>

                      {!isFinalized && (
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Laytime Factor:</span>
                            <div className="flex rounded-md overflow-hidden border border-border/60">
                              {([100, 50, 0] as const).map(pct => (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => patchEdit(event.id, "laytimeFactor", pct)}
                                  className={`px-2.5 py-1 text-[11px] font-bold transition-colors border-r last:border-r-0 border-border/60 ${
                                    laytimeFactorVal === pct
                                      ? pct === 100
                                        ? "bg-blue-500/80 text-white"
                                        : pct === 50
                                        ? "bg-amber-500/80 text-white"
                                        : "bg-slate-600/80 text-white"
                                      : "bg-transparent text-muted-foreground hover:bg-muted/40"
                                  }`}
                                  data-testid={`button-event-factor-${pct}-${event.id}`}
                                >
                                  {pct}%
                                </button>
                              ))}
                            </div>
                          </div>
                          {isDirty && (
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => saveEvent(event)}
                              disabled={updateEventMutation.isPending}
                              data-testid={`button-save-event-${event.id}`}
                            >
                              {updateEventMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                            </Button>
                          )}
                        </div>
                      )}

                      {isFinalized && (event.laytimeFactor ?? 100) < 100 && (
                        <div className="mt-2 pt-2 border-t border-dashed">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                            (event.laytimeFactor ?? 100) === 0
                              ? "text-slate-400 bg-slate-500/10"
                              : "text-amber-400 bg-amber-500/10"
                          }`}>
                            {(event.laytimeFactor ?? 100) === 0 ? "0% — Excluded from laytime" : "50% — Half count"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {events.length === 0 && (
                <div className="pl-14 py-8 text-center text-muted-foreground text-sm">
                  No events yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Event Dialog */}
      <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Event Type</Label>
              <Select
                value={newEvent.eventType}
                onValueChange={v => {
                  const found = EVENT_TYPES.find(e => e.value === v);
                  setNewEvent(n => ({ ...n, eventType: v, eventName: found && v !== "custom" ? found.label : n.eventName }));
                }}
              >
                <SelectTrigger data-testid="select-event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {newEvent.eventType === "custom" && (
              <div>
                <Label>Event Name *</Label>
                <Input
                  data-testid="input-custom-event-name"
                  value={newEvent.eventName}
                  onChange={e => setNewEvent(n => ({ ...n, eventName: e.target.value }))}
                  placeholder="Describe the event…"
                />
              </div>
            )}
            <div>
              <Label>Date / Time *</Label>
              <Input
                type="datetime-local"
                data-testid="input-new-event-date"
                value={newEvent.eventDate}
                onChange={e => setNewEvent(n => ({ ...n, eventDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Remarks</Label>
              <Input
                data-testid="input-new-event-remarks"
                value={newEvent.remarks}
                onChange={e => setNewEvent(n => ({ ...n, remarks: e.target.value }))}
                placeholder="Optional…"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Laytime Factor (To Count)</Label>
                {autoAdjusted && (
                  <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1" data-testid="text-auto-adjusted">
                    ✨ Auto-adjusted based on event type
                  </span>
                )}
              </div>
              <div className="flex rounded-lg overflow-hidden border border-border" data-testid="toggle-laytime-factor">
                {([100, 50, 0] as const).map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setNewEvent(n => ({ ...n, laytimeFactor: pct }));
                      setAutoAdjusted(false);
                    }}
                    className={`flex-1 py-2 text-xs font-bold transition-colors border-r last:border-r-0 border-border ${
                      newEvent.laytimeFactor === pct
                        ? pct === 100
                          ? "bg-blue-500 text-white"
                          : pct === 50
                          ? "bg-amber-500 text-white"
                          : "bg-slate-600 text-white"
                        : "bg-transparent text-muted-foreground hover:bg-muted/40"
                    }`}
                    data-testid={`button-laytime-factor-${pct}`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                100% = Full count &middot; 50% = Half count &middot; 0% = Excluded from laytime
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEventOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddEvent}
              disabled={addEventMutation.isPending || (!newEvent.eventName && newEvent.eventType === "custom")}
              data-testid="button-confirm-add-event"
            >
              {addEventMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
