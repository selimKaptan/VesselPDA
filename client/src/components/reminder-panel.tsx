import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Bell, CheckCircle2, Clock, AlarmClock, Trash2, Plus, ChevronRight,
  AlertTriangle, AlertCircle, Info, Flag, BellOff, Filter, X
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type Priority = "low" | "normal" | "high" | "urgent";
type Category = "tender_response" | "document_missing" | "vessel_approaching" | "certificate_expiry" |
  "invoice_overdue" | "da_pending" | "nomination_pending" | "sof_incomplete" | "proforma_followup" | "custom";

interface Reminder {
  id: number;
  type: string;
  category: Category;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: number;
  priority: Priority;
  due_date?: string;
  is_completed: boolean;
  is_snoozed: boolean;
  snoozed_until?: string;
  created_at: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bgColor: string; icon: any }> = {
  urgent: { label: "Urgent",  color: "text-red-600 dark:text-red-400",    bgColor: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",      icon: AlertTriangle },
  high:   { label: "High",    color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800", icon: AlertCircle },
  normal: { label: "Normal",  color: "text-blue-600 dark:text-blue-400",   bgColor: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",   icon: Info },
  low:    { label: "Low",     color: "text-gray-500 dark:text-gray-400",   bgColor: "bg-gray-50 border-gray-200 dark:bg-gray-900/30 dark:border-gray-700",   icon: Flag },
};

const CATEGORY_LABELS: Record<Category, string> = {
  tender_response:    "Tender",
  document_missing:   "Documents",
  vessel_approaching: "Vessel",
  certificate_expiry: "Certificate",
  invoice_overdue:    "Invoice",
  da_pending:         "Final DA",
  nomination_pending: "Nomination",
  sof_incomplete:     "SOF",
  proforma_followup:  "Proforma",
  custom:             "Custom",
};

const ENTITY_LINKS: Record<string, string> = {
  voyage: "/voyages",
  tender: "/tenders",
  invoice: "/invoices",
  nomination: "/nominations",
  certificate: "/vessel-certificates",
};

function getEntityLink(entityType?: string, entityId?: number) {
  if (!entityType) return null;
  const base = ENTITY_LINKS[entityType] || null;
  if (!base || !entityId) return base;
  if (entityType === "voyage") return `${base}/${entityId}`;
  if (entityType === "tender") return `${base}/${entityId}`;
  return base;
}

function formatDue(due?: string) {
  if (!due) return null;
  const d = new Date(due);
  const now = Date.now();
  const diff = d.getTime() - now;
  if (diff < 0) return { label: "Overdue", isOverdue: true };
  const hours = Math.ceil(diff / 3600000);
  if (hours < 24) return { label: `${hours}h left`, isOverdue: false };
  const days = Math.ceil(diff / 86400000);
  return { label: `${days}d left`, isOverdue: false };
}

// ─── Snooze Dialog ────────────────────────────────────────────────────────────
function SnoozeDialog({ reminderId, onClose }: { reminderId: number; onClose: () => void }) {
  const { toast } = useToast();
  const [preset, setPreset] = useState("1h");

  const snoozeMutation = useMutation({
    mutationFn: (until: string) => apiRequest("PATCH", `/api/reminders/${reminderId}/snooze`, { until }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/pending-count"] });
      toast({ title: "Reminder snoozed" });
      onClose();
    },
  });

  const getUntil = (p: string) => {
    const now = new Date();
    if (p === "1h") return new Date(now.getTime() + 3600000).toISOString();
    if (p === "4h") return new Date(now.getTime() + 4 * 3600000).toISOString();
    if (p === "1d") return new Date(now.getTime() + 86400000).toISOString();
    if (p === "3d") return new Date(now.getTime() + 3 * 86400000).toISOString();
    if (p === "1w") return new Date(now.getTime() + 7 * 86400000).toISOString();
    return new Date(now.getTime() + 3600000).toISOString();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Snooze Reminder</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-2 py-2">
          {[
            { value: "1h",  label: "1 Hour" },
            { value: "4h",  label: "4 Hours" },
            { value: "1d",  label: "Tomorrow" },
            { value: "3d",  label: "3 Days" },
            { value: "1w",  label: "1 Week" },
          ].map(p => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                preset === p.value ? "bg-[hsl(var(--maritime-primary))] text-white border-transparent" : "bg-muted border-border hover:bg-muted/80"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => snoozeMutation.mutate(getUntil(preset))} disabled={snoozeMutation.isPending}>
            <AlarmClock className="w-3.5 h-3.5 mr-1" /> Snooze
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Manual Reminder Dialog ───────────────────────────────────────────────
function AddReminderDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ title: "", message: "", category: "custom" as Category, priority: "normal" as Priority, dueDate: "" });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/reminders", {
      title: form.title,
      message: form.message,
      category: form.category,
      priority: form.priority,
      dueDate: form.dueDate || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/pending-count"] });
      toast({ title: "Reminder created" });
      onClose();
    },
    onError: () => toast({ title: "Failed to create reminder", variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Reminder</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Follow up with client" data-testid="input-reminder-title" />
          </div>
          <div className="space-y-1.5">
            <Label>Message *</Label>
            <Textarea value={form.message} onChange={e => set("message", e.target.value)} rows={3} placeholder="Details..." data-testid="input-reminder-message" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => set("category", v)}>
                <SelectTrigger data-testid="select-reminder-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => set("priority", v)}>
                <SelectTrigger data-testid="select-reminder-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Due Date (optional)</Label>
            <Input type="datetime-local" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} data-testid="input-reminder-due-date" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.title || !form.message || mutation.isPending} data-testid="button-save-reminder">
            {mutation.isPending ? "Saving…" : "Add Reminder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reminder Card ────────────────────────────────────────────────────────────
function ReminderCard({ reminder, onComplete, onDelete }: {
  reminder: Reminder;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [showSnooze, setShowSnooze] = useState(false);
  const cfg = PRIORITY_CONFIG[reminder.priority] ?? PRIORITY_CONFIG.normal;
  const PriorityIcon = cfg.icon;
  const due = formatDue(reminder.due_date);
  const entityLink = getEntityLink(reminder.entity_type, reminder.entity_id);

  return (
    <>
      <div
        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors group ${cfg.bgColor}`}
        data-testid={`reminder-${reminder.id}`}
      >
        <PriorityIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold leading-tight truncate" data-testid={`text-reminder-title-${reminder.id}`}>{reminder.title}</p>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">{CATEGORY_LABELS[reminder.category] ?? reminder.category}</Badge>
                {reminder.type === "auto" && <Badge className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 flex-shrink-0">Auto</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{reminder.message}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {due && (
                  <span className={cn("text-[10px] font-medium flex items-center gap-0.5", due.isOverdue ? "text-red-600" : "text-muted-foreground")}>
                    <Clock className="w-3 h-3" />{due.label}
                  </span>
                )}
                {entityLink && (
                  <Link href={entityLink} className="text-[10px] text-[hsl(var(--maritime-primary))] hover:underline flex items-center gap-0.5">
                    View <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => onComplete(reminder.id)}
            className="p-1.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-muted-foreground hover:text-emerald-600 transition-colors"
            title="Mark done"
            data-testid={`button-complete-reminder-${reminder.id}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowSnooze(true)}
            className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-muted-foreground hover:text-amber-600 transition-colors"
            title="Snooze"
            data-testid={`button-snooze-reminder-${reminder.id}`}
          >
            <AlarmClock className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(reminder.id)}
            className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-colors"
            title="Delete"
            data-testid={`button-delete-reminder-${reminder.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {showSnooze && <SnoozeDialog reminderId={reminder.id} onClose={() => setShowSnooze(false)} />}
    </>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export function ReminderPanel({ compact = false }: { compact?: boolean }) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"active" | "snoozed" | "completed">("active");
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading } = useQuery<{ reminders: Reminder[]; pendingCount: number }>({
    queryKey: ["/api/reminders", filter],
    queryFn: () => fetch(`/api/reminders?filter=${filter}`, { credentials: "include" }).then(r => r.json()),
  });

  const reminders = data?.reminders ?? [];
  const pendingCount = data?.pendingCount ?? 0;

  const completeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/reminders/${id}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/pending-count"] });
      toast({ title: "Marked as done" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/reminders/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders/pending-count"] });
    },
  });

  const urgent = reminders.filter(r => r.priority === "urgent").length;
  const high = reminders.filter(r => r.priority === "high").length;

  return (
    <Card data-testid="reminder-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              Reminders & Follow-ups
            </CardTitle>
            {pendingCount > 0 && (
              <Badge className="text-[10px] px-1.5 min-w-5 h-5 flex items-center justify-center bg-[hsl(var(--maritime-primary))]" data-testid="badge-reminder-count">
                {pendingCount}
              </Badge>
            )}
          </div>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setShowAdd(true)} data-testid="button-add-reminder">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>

        {/* Summary row */}
        {filter === "active" && reminders.length > 0 && (
          <div className="flex items-center gap-3 text-xs mt-1">
            {urgent > 0 && <span className="text-red-600 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{urgent} urgent</span>}
            {high > 0 && <span className="text-orange-600 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" />{high} high</span>}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 mt-2">
          {(["active", "snoozed", "completed"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium capitalize transition-colors ${
                filter === f ? "bg-[hsl(var(--maritime-primary))] text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              data-testid={`filter-reminder-${f}`}
            >
              {f}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : reminders.length === 0 ? (
          <div className="text-center py-8">
            {filter === "active" ? (
              <>
                <BellOff className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground font-medium">No active reminders</p>
                <p className="text-xs text-muted-foreground mt-1">The system will auto-create reminders based on your activity</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No {filter} reminders</p>
              </>
            )}
          </div>
        ) : (
          <div className={`space-y-2 ${compact ? "max-h-80 overflow-y-auto pr-1" : ""}`}>
            {(compact ? reminders.slice(0, 5) : reminders).map(r => (
              <ReminderCard
                key={r.id}
                reminder={r}
                onComplete={id => completeMutation.mutate(id)}
                onDelete={id => deleteMutation.mutate(id)}
              />
            ))}
            {compact && reminders.length > 5 && (
              <p className="text-xs text-center text-muted-foreground pt-1">+{reminders.length - 5} more reminders</p>
            )}
          </div>
        )}
      </CardContent>

      {showAdd && <AddReminderDialog onClose={() => setShowAdd(false)} />}
    </Card>
  );
}
