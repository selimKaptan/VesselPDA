import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Edit2, Clock, FileText, Loader2, CheckCircle2,
  CloudRain, AlertTriangle, Anchor, Ship, LayoutTemplate, Download
} from "lucide-react";
import jsPDF from "jspdf";

interface SofEvent {
  id: number;
  port_call_id: number;
  voyage_id: number;
  event_code: string;
  event_name: string;
  event_time: string;
  remarks: string | null;
  is_official: boolean;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

interface SofTemplate {
  id: number;
  name: string;
  port_call_type: string | null;
  events: { eventCode: string; eventName: string; order: number }[];
  is_default: boolean;
}

const INTERRUPTION_CODES = new Set([
  "RAIN_STARTED","RAIN_STOPPED","BREAKDOWN","BREAKDOWN_REPAIRED",
  "SHIFT_START","SHIFT_END","HOLIDAY","BUNKER_START","BUNKER_END"
]);

const RAIN_CODES = new Set(["RAIN_STARTED","RAIN_STOPPED"]);
const BREAKDOWN_CODES = new Set(["BREAKDOWN","BREAKDOWN_REPAIRED"]);

const ALL_EVENT_CODES = [
  { code: "VESSEL_ARRIVED",     name: "Vessel arrived at port / anchorage", group: "arrival" },
  { code: "NOR_TENDERED",       name: "Notice of Readiness tendered",         group: "arrival" },
  { code: "NOR_ACCEPTED",       name: "Notice of Readiness accepted",          group: "arrival" },
  { code: "FREE_PRATIQUE",      name: "Free pratique granted",                 group: "arrival" },
  { code: "BERTH_ORDERED",      name: "Berth ordered",                         group: "arrival" },
  { code: "BERTHED",            name: "All fast / Vessel berthed",             group: "arrival" },
  { code: "HATCH_OPEN",         name: "Hatches opened",                        group: "operations" },
  { code: "LOADING_COMMENCED",  name: "Loading commenced",                     group: "operations" },
  { code: "LOADING_COMPLETED",  name: "Loading completed",                     group: "operations" },
  { code: "DISCHARGE_COMMENCED",name: "Discharge commenced",                   group: "operations" },
  { code: "DISCHARGE_COMPLETED",name: "Discharge completed",                   group: "operations" },
  { code: "HATCH_CLOSED",       name: "Hatches closed / sealed",               group: "operations" },
  { code: "DOCS_ON_BOARD",      name: "Documents on board",                    group: "departure" },
  { code: "PILOT_ON_BOARD",     name: "Pilot on board",                        group: "departure" },
  { code: "UNBERTHED",          name: "Vessel unberthed",                      group: "departure" },
  { code: "VESSEL_SAILED",      name: "Vessel sailed",                         group: "departure" },
  { code: "RAIN_STARTED",       name: "Rain started (operations stopped)",     group: "interruption" },
  { code: "RAIN_STOPPED",       name: "Rain stopped (operations resumed)",     group: "interruption" },
  { code: "BREAKDOWN",          name: "Crane/equipment breakdown",             group: "interruption" },
  { code: "BREAKDOWN_REPAIRED", name: "Crane/equipment repaired",              group: "interruption" },
  { code: "SHIFT_START",        name: "Shift started",                         group: "interruption" },
  { code: "SHIFT_END",          name: "Shift ended",                           group: "interruption" },
  { code: "HOLIDAY",            name: "Holiday / Sunday (no work)",            group: "interruption" },
  { code: "BUNKER_START",       name: "Bunkering commenced",                   group: "interruption" },
  { code: "BUNKER_END",         name: "Bunkering completed",                   group: "interruption" },
];

function fmtDt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

function diffHours(a: string, b: string): string {
  const diff = (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
  if (diff < 0) return "-";
  const h = Math.floor(diff);
  const m = Math.round((diff - h) * 60);
  return `${h}h ${m}m`;
}

function toLocalDatetimeInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowLocalInput() {
  return toLocalDatetimeInput(new Date().toISOString());
}

interface Props {
  voyageId: number;
  portCallId: number;
  portCallType: string;
  vesselName?: string;
  portName?: string;
}

export function SofEditor({ voyageId, portCallId, portCallType, vesselName, portName }: Props) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [editEvent, setEditEvent] = useState<SofEvent | null>(null);
  const [form, setForm] = useState({ eventCode: "", eventName: "", eventTime: nowLocalInput(), remarks: "", isOfficial: false });
  const [editForm, setEditForm] = useState({ eventCode: "", eventName: "", eventTime: "", remarks: "", isOfficial: false });
  const [templateBaseDate, setTemplateBaseDate] = useState(nowLocalInput());

  const qKey = [`/api/voyages/${voyageId}/port-calls/${portCallId}/sof`];

  const { data: events = [], isLoading } = useQuery<SofEvent[]>({ queryKey: qKey });
  const { data: templates = [] } = useQuery<SofTemplate[]>({ queryKey: ["/api/sof-templates"] });

  const addMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/voyages/${voyageId}/port-calls/${portCallId}/sof`, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qKey }); setShowAdd(false); setForm({ eventCode: "", eventName: "", eventTime: nowLocalInput(), remarks: "", isOfficial: false }); toast({ title: "Event added" }); },
    onError: () => toast({ title: "Error", description: "Failed to add event", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => apiRequest("PATCH", `/api/sof-events/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qKey }); setEditEvent(null); toast({ title: "Event updated" }); },
    onError: () => toast({ title: "Error", description: "Failed to update event", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/sof-events/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qKey }); toast({ title: "Event removed" }); },
    onError: () => toast({ title: "Error", description: "Failed to delete event", variant: "destructive" }),
  });

  const templateMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/voyages/${voyageId}/port-calls/${portCallId}/sof/from-template`, body),
    onSuccess: (data: any) => { queryClient.invalidateQueries({ queryKey: qKey }); setShowTemplate(false); toast({ title: `${data?.inserted || 0} events added from template` }); },
    onError: () => toast({ title: "Error", description: "Failed to apply template", variant: "destructive" }),
  });

  const durations = useMemo(() => {
    const find = (code: string) => events.find(e => e.event_code === code)?.event_time;
    const norAt = find("NOR_TENDERED");
    const berthAt = find("BERTHED");
    const loadStart = find("LOADING_COMMENCED") || find("DISCHARGE_COMMENCED");
    const loadEnd = find("LOADING_COMPLETED") || find("DISCHARGE_COMPLETED");
    const arrived = find("VESSEL_ARRIVED");
    const sailed = find("VESSEL_SAILED");
    return {
      waitNorToBerth: norAt && berthAt ? diffHours(norAt, berthAt) : null,
      waitBerthToOps: berthAt && loadStart ? diffHours(berthAt, loadStart) : null,
      opsTime: loadStart && loadEnd ? diffHours(loadStart, loadEnd) : null,
      totalPort: arrived && sailed ? diffHours(arrived, sailed) : null,
    };
  }, [events]);

  function handleCodeChange(code: string, isEdit = false) {
    const ev = ALL_EVENT_CODES.find(e => e.code === code);
    if (isEdit) setEditForm(f => ({ ...f, eventCode: code, eventName: ev?.name || code }));
    else setForm(f => ({ ...f, eventCode: code, eventName: ev?.name || code }));
  }

  function openEdit(ev: SofEvent) {
    setEditEvent(ev);
    setEditForm({
      eventCode: ev.event_code,
      eventName: ev.event_name,
      eventTime: toLocalDatetimeInput(ev.event_time),
      remarks: ev.remarks || "",
      isOfficial: ev.is_official,
    });
  }

  function exportPdf() {
    const doc = new jsPDF();
    const margin = 14;
    let y = 20;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("STATEMENT OF FACTS", 105, y, { align: "center" });
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (vesselName) { doc.text(`Vessel: ${vesselName}`, margin, y); y += 6; }
    if (portName) { doc.text(`Port: ${portName}`, margin, y); y += 6; }
    doc.text(`Port Call Type: ${portCallType}`, margin, y); y += 6;
    doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, margin, y); y += 10;

    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(margin, y, 200, y); y += 6;

    doc.setFont("helvetica", "bold");
    doc.text("No.", margin, y);
    doc.text("Date / Time", margin + 12, y);
    doc.text("Event", margin + 55, y);
    doc.text("Remarks", margin + 130, y);
    y += 4;
    doc.line(margin, y, 200, y); y += 5;

    doc.setFont("helvetica", "normal");
    events.forEach((ev, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const dt = fmtDt(ev.event_time);
      doc.text(`${idx + 1}.`, margin, y);
      doc.text(dt, margin + 12, y);
      const nameLines = doc.splitTextToSize(ev.event_name, 70);
      doc.text(nameLines, margin + 55, y);
      if (ev.remarks) {
        const remLines = doc.splitTextToSize(ev.remarks, 60);
        doc.text(remLines, margin + 130, y);
      }
      y += Math.max(nameLines.length, 1) * 5 + 2;
    });

    y += 8;
    if (durations.totalPort) { doc.text(`Total port time: ${durations.totalPort}`, margin, y); y += 5; }
    if (durations.opsTime) { doc.text(`Operations time: ${durations.opsTime}`, margin, y); y += 5; }

    y += 15;
    doc.line(margin, y, 85, y); doc.line(120, y, 195, y);
    y += 5;
    doc.text("Master / Captain", margin, y); doc.text("Port Agent", 120, y);

    doc.save(`SOF_${portName || "port"}_${portCallId}.pdf`);
    toast({ title: "SOF PDF exported" });
  }

  function getEventStyle(code: string) {
    if (RAIN_CODES.has(code)) return "border-l-2 border-blue-400 bg-blue-50/50 dark:bg-blue-900/10";
    if (BREAKDOWN_CODES.has(code)) return "border-l-2 border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/10";
    if (INTERRUPTION_CODES.has(code)) return "border-l-2 border-orange-300 bg-orange-50/50 dark:bg-orange-900/10";
    return "";
  }

  function getEventBadge(code: string) {
    if (RAIN_CODES.has(code)) return <Badge className="text-[9px] px-1 py-0 bg-blue-100 text-blue-700 border-0"><CloudRain className="w-2.5 h-2.5 mr-0.5" />Rain</Badge>;
    if (BREAKDOWN_CODES.has(code)) return <Badge className="text-[9px] px-1 py-0 bg-yellow-100 text-yellow-700 border-0"><AlertTriangle className="w-2.5 h-2.5 mr-0.5" />Breakdown</Badge>;
    if (INTERRUPTION_CODES.has(code)) return <Badge className="text-[9px] px-1 py-0 bg-orange-100 text-orange-700 border-0">Interruption</Badge>;
    return null;
  }

  const relevantTemplates = templates.filter(t => !t.port_call_type || t.port_call_type === portCallType);

  return (
    <div className="space-y-4">
      {/* Duration summary */}
      {(durations.totalPort || durations.opsTime || durations.waitNorToBerth) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "NOR → Berth", value: durations.waitNorToBerth, icon: Anchor },
            { label: "Berth → Start ops", value: durations.waitBerthToOps, icon: Clock },
            { label: "Operations", value: durations.opsTime, icon: Ship },
            { label: "Total in port", value: durations.totalPort, icon: CheckCircle2 },
          ].map(({ label, value, icon: Icon }) => value ? (
            <div key={label} className="bg-muted/40 rounded-md px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Icon className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
              <span className="text-sm font-semibold">{value}</span>
            </div>
          ) : null)}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
          <span className="text-sm font-semibold">Statement of Facts</span>
          <Badge variant="secondary" className="text-[10px]">{events.length} events</Badge>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {events.length > 0 && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportPdf} data-testid="button-sof-pdf">
              <Download className="w-3 h-3" /> PDF
            </Button>
          )}
          {relevantTemplates.length > 0 && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowTemplate(true)} data-testid="button-sof-template">
              <LayoutTemplate className="w-3 h-3" /> From Template
            </Button>
          )}
          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setShowAdd(true)} data-testid="button-add-sof-event">
            <Plus className="w-3 h-3" /> Add Event
          </Button>
        </div>
      </div>

      {/* Event timeline */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : events.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No events recorded yet.</p>
          <p className="text-xs mt-1">Start with a template or add events manually.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[5px] top-3 bottom-3 w-px bg-border" />
          <div className="space-y-1">
            {events.map((ev, idx) => (
              <div key={ev.id} className={`relative flex items-start gap-3 pl-6 py-2 pr-2 rounded-md group ${getEventStyle(ev.event_code)}`} data-testid={`sof-event-${ev.id}`}>
                <div className="absolute left-0 top-3 w-2.5 h-2.5 rounded-full bg-border border-2 border-background" style={{ borderColor: RAIN_CODES.has(ev.event_code) ? "#60a5fa" : BREAKDOWN_CODES.has(ev.event_code) ? "#facc15" : INTERRUPTION_CODES.has(ev.event_code) ? "#fb923c" : "hsl(var(--maritime-primary))", background: "white" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold">{ev.event_name}</span>
                        {ev.is_official && <Badge className="text-[9px] px-1 py-0 bg-green-100 text-green-700 border-0"><CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />Official</Badge>}
                        {getEventBadge(ev.event_code)}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{fmtDt(ev.event_time)}</span>
                        {ev.first_name && <span>· {ev.first_name} {ev.last_name}</span>}
                        {idx > 0 && events[idx-1] && (
                          <span className="text-[9px] bg-muted px-1 rounded">+{diffHours(events[idx-1].event_time, ev.event_time)}</span>
                        )}
                      </div>
                      {ev.remarks && <p className="text-[10px] text-muted-foreground italic mt-0.5">"{ev.remarks}"</p>}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEdit(ev)} data-testid={`button-edit-sof-${ev.id}`}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(ev.id)} data-testid={`button-delete-sof-${ev.id}`}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Event Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md" data-testid="dialog-add-sof-event">
          <DialogHeader><DialogTitle>Add SOF Event</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Event</Label>
              <Select value={form.eventCode} onValueChange={c => handleCodeChange(c)}>
                <SelectTrigger data-testid="select-sof-event-code">
                  <SelectValue placeholder="Select event..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {["arrival","operations","departure","interruption"].map(group => (
                    <div key={group}>
                      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">{group}</div>
                      {ALL_EVENT_CODES.filter(e => e.group === group).map(e => (
                        <SelectItem key={e.code} value={e.code} className="text-xs">{e.name}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date & Time</Label>
              <Input type="datetime-local" value={form.eventTime} onChange={e => setForm(f => ({ ...f, eventTime: e.target.value }))} data-testid="input-sof-event-time" />
            </div>
            <div className="space-y-1.5">
              <Label>Remarks (optional)</Label>
              <Textarea placeholder="Additional notes..." value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className="min-h-[70px] text-sm" data-testid="textarea-sof-remarks" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isOfficial" checked={form.isOfficial} onChange={e => setForm(f => ({ ...f, isOfficial: e.target.checked }))} className="rounded" data-testid="checkbox-sof-official" />
              <Label htmlFor="isOfficial" className="text-sm cursor-pointer">Mark as official record</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" disabled={!form.eventCode || !form.eventTime || addMutation.isPending}
              onClick={() => addMutation.mutate({ eventCode: form.eventCode, eventName: form.eventName, eventTime: new Date(form.eventTime).toISOString(), remarks: form.remarks || undefined, isOfficial: form.isOfficial })}
              data-testid="button-save-sof-event"
            >
              {addMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={!!editEvent} onOpenChange={v => !v && setEditEvent(null)}>
        <DialogContent className="max-w-md" data-testid="dialog-edit-sof-event">
          <DialogHeader><DialogTitle>Edit SOF Event</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Event</Label>
              <Select value={editForm.eventCode} onValueChange={c => handleCodeChange(c, true)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {["arrival","operations","departure","interruption"].map(group => (
                    <div key={group}>
                      <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">{group}</div>
                      {ALL_EVENT_CODES.filter(e => e.group === group).map(e => (
                        <SelectItem key={e.code} value={e.code} className="text-xs">{e.name}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date & Time</Label>
              <Input type="datetime-local" value={editForm.eventTime} onChange={e => setEditForm(f => ({ ...f, eventTime: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Textarea value={editForm.remarks} onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))} className="min-h-[70px] text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isOfficialEdit" checked={editForm.isOfficial} onChange={e => setEditForm(f => ({ ...f, isOfficial: e.target.checked }))} className="rounded" />
              <Label htmlFor="isOfficialEdit" className="text-sm cursor-pointer">Mark as official record</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditEvent(null)}>Cancel</Button>
            <Button size="sm" disabled={editMutation.isPending}
              onClick={() => editEvent && editMutation.mutate({ id: editEvent.id, eventCode: editForm.eventCode, eventName: editForm.eventName, eventTime: new Date(editForm.eventTime).toISOString(), remarks: editForm.remarks, isOfficial: editForm.isOfficial })}
            >
              {editMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={showTemplate} onOpenChange={setShowTemplate}>
        <DialogContent className="max-w-sm" data-testid="dialog-sof-template">
          <DialogHeader><DialogTitle>Apply SOF Template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Select a template and base date/time. Events will be spaced 1 hour apart starting from the base time.</p>
            <div className="space-y-1.5">
              <Label>Base Date & Time</Label>
              <Input type="datetime-local" value={templateBaseDate} onChange={e => setTemplateBaseDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              {relevantTemplates.map(t => (
                <Card key={t.id} className="p-3 cursor-pointer hover:border-primary transition-colors" onClick={() => templateMutation.mutate({ templateId: t.id, baseDate: new Date(templateBaseDate).toISOString() })}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.events.length} events</p>
                    </div>
                    {templateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </Card>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowTemplate(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
