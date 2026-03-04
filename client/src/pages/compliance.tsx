import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ShieldCheck, Plus, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle, Clock, Calendar, Ship, FileText, ClipboardList, Activity, Trash2, X, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import type { Vessel } from "@shared/schema";

const STANDARDS = [
  { code: "ISM", name: "ISM Code", color: "blue", desc: "International Safety Management" },
  { code: "ISPS", name: "ISPS Code", color: "purple", desc: "Ship & Port Facility Security" },
  { code: "MLC", name: "MLC 2006", color: "emerald", desc: "Maritime Labour Convention" },
  { code: "MARPOL", name: "MARPOL", color: "orange", desc: "Pollution Prevention" },
  { code: "SOLAS", name: "SOLAS", color: "red", desc: "Safety of Life at Sea" },
];

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  compliant: "bg-emerald-100 text-emerald-700",
  non_compliant: "bg-red-100 text-red-700",
  expired: "bg-orange-100 text-orange-700",
};

const FINDING_COLORS: Record<string, string> = {
  none: "text-muted-foreground",
  observation: "text-amber-600",
  non_conformity: "text-orange-600",
  major_non_conformity: "text-red-600",
};

const AUDIT_TYPE_LABELS: Record<string, string> = {
  internal: "Internal", external: "External", flag_state: "Flag State",
  port_state: "Port State Control", class: "Class Society",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

// ── Overview Card ─────────────────────────────────────────────────────────────
function OverviewCard({ cl, onClick }: { cl: any; onClick: () => void }) {
  const pct = Math.round(cl.compliance_percentage ?? 0);
  const std = STANDARDS.find(s => s.code === cl.standard_code);
  return (
    <Card
      className="p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      onClick={onClick}
      data-testid={`card-checklist-${cl.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-sm">{cl.standard_code}</div>
          <div className="text-xs text-muted-foreground truncate max-w-[160px]">{cl.vessel_name || "Organization-wide"}</div>
        </div>
        <Badge className={`text-xs ${STATUS_COLORS[cl.status] || ""}`} variant="outline">
          {cl.status?.replace(/_/g, " ")}
        </Badge>
      </div>
      <div className="mb-2">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{cl.completed_items}/{cl.total_items} items</span>
          <span className="font-bold text-foreground">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>
      {cl.next_audit_date && (
        <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Next audit: {formatDate(cl.next_audit_date)}
          {(daysUntil(cl.next_audit_date) ?? 999) <= 30 && (
            <Badge className="ml-1 text-[10px] bg-orange-100 text-orange-700 border-0">
              {daysUntil(cl.next_audit_date)} days
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Checklist Detail ──────────────────────────────────────────────────────────
function ChecklistDetail({ checklistId, onBack }: { checklistId: number; onBack: () => void }) {
  const { toast } = useToast();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showAuditForm, setShowAuditForm] = useState(false);
  const [auditForm, setAuditForm] = useState({
    auditType: "internal", auditorName: "", auditorOrganization: "",
    auditDate: "", overallResult: "satisfactory", notes: "", nextAuditDate: "",
  });

  const { data: cl, isLoading } = useQuery<any>({
    queryKey: ["/api/compliance/checklists", checklistId],
    queryFn: () => fetch(`/api/compliance/checklists/${checklistId}`, { credentials: "include" }).then(r => r.json()),
  });
  const { data: rawAudits } = useQuery<any>({
    queryKey: ["/api/compliance/audits", checklistId],
    queryFn: () => fetch(`/api/compliance/checklists/${checklistId}/audits`, { credentials: "include" }).then(r => r.json()),
  });
  const audits: any[] = Array.isArray(rawAudits) ? rawAudits : [];

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/compliance/items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/checklists", checklistId] });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/checklists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/dashboard"] });
    },
  });

  const addAuditMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/compliance/checklists/${checklistId}/audits`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/audits", checklistId] });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/checklists", checklistId] });
      setShowAuditForm(false);
      toast({ title: "Audit recorded" });
    },
  });

  const items: any[] = Array.isArray(cl?.items) ? cl.items : [];
  const sections = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const item of items) {
      const key = item.section_title || "General";
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [items]);

  if (isLoading || !cl) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  const openFindings = items.filter(i => i.finding_type && i.finding_type !== "none" && i.corrective_action_status !== "closed" && i.corrective_action_status !== "verified");
  const pct = Math.round(cl.compliance_percentage ?? 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-compliance">← Back</Button>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setShowAuditForm(true)} data-testid="button-add-audit">
          <ClipboardList className="w-4 h-4 mr-1" /> Record Audit
        </Button>
      </div>

      {/* Header card */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="font-semibold text-lg">{cl.standard_name}</h2>
            <div className="text-sm text-muted-foreground">{cl.vessel_name || "Organization-wide"} {cl.version && `· v${cl.version}`}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[hsl(var(--maritime-primary))]">{pct}%</div>
            <div className="text-xs text-muted-foreground">Compliance</div>
          </div>
          <div className="sm:text-right space-y-1">
            <Badge className={`${STATUS_COLORS[cl.status] || ""}`} variant="outline">{cl.status?.replace(/_/g, " ")}</Badge>
            {cl.next_audit_date && <div className="text-xs text-muted-foreground">Next audit: {formatDate(cl.next_audit_date)}</div>}
          </div>
        </div>
        <Progress value={pct} className="h-2 mt-4" />
        {openFindings.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-orange-600">
            <AlertTriangle className="w-4 h-4" />
            {openFindings.length} open finding{openFindings.length > 1 ? "s" : ""} requiring corrective action
          </div>
        )}
      </Card>

      <Tabs defaultValue="checklist">
        <TabsList>
          <TabsTrigger value="checklist" data-testid="tab-checklist-items">Checklist ({items.length})</TabsTrigger>
          <TabsTrigger value="findings" data-testid="tab-findings">Findings ({openFindings.length})</TabsTrigger>
          <TabsTrigger value="audits" data-testid="tab-audits">Audit History ({audits.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="checklist" className="space-y-2 mt-4">
          {Object.entries(sections).map(([sectionTitle, sectionItems]) => {
            const expanded = expandedSections.has(sectionTitle);
            const sectionPct = Math.round((sectionItems.filter(i => i.is_compliant).length / sectionItems.length) * 100);
            return (
              <Card key={sectionTitle} className="overflow-hidden">
                <button
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors text-left"
                  onClick={() => {
                    const next = new Set(expandedSections);
                    expanded ? next.delete(sectionTitle) : next.add(sectionTitle);
                    setExpandedSections(next);
                  }}
                  data-testid={`section-toggle-${sectionTitle.replace(/\s+/g, "-")}`}
                >
                  {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  <span className="flex-1 font-medium text-sm">{sectionTitle}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{sectionItems.filter(i => i.is_compliant).length}/{sectionItems.length}</span>
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${sectionPct}%` }} />
                    </div>
                  </div>
                </button>
                {expanded && (
                  <div className="border-t divide-y">
                    {sectionItems.map(item => (
                      <div key={item.id} className="px-4 py-3 space-y-2" data-testid={`item-row-${item.id}`}>
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={item.is_compliant}
                            onCheckedChange={(v) => updateItemMutation.mutate({ id: item.id, data: { isCompliant: !!v } })}
                            className="mt-0.5 flex-shrink-0"
                            data-testid={`checkbox-item-${item.id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {item.section_number && <span className="text-xs font-mono text-muted-foreground">{item.section_number}</span>}
                              <span className="text-sm font-medium">{item.section_title}</span>
                              {item.finding_type && item.finding_type !== "none" && (
                                <span className={`text-xs font-medium ${FINDING_COLORS[item.finding_type]}`}>
                                  {item.finding_type.replace(/_/g, " ")}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{item.requirement}</p>
                            {item.evidence && <p className="text-xs text-emerald-700 mt-1">Evidence: {item.evidence}</p>}
                            {item.corrective_action && (
                              <p className="text-xs text-orange-700 mt-1">
                                CA: {item.corrective_action} · Due {formatDate(item.corrective_action_due_date)}
                                <Badge className="ml-1 text-[10px]" variant="outline">{item.corrective_action_status}</Badge>
                              </p>
                            )}
                          </div>
                          <Button variant="ghost" size="sm" className="flex-shrink-0 h-7 px-2 text-xs" onClick={() => setEditingItem(item)} data-testid={`button-edit-item-${item.id}`}>
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="findings" className="mt-4">
          {openFindings.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">No open findings — great job!</Card>
          ) : (
            <div className="space-y-2">
              {openFindings.map(item => (
                <Card key={item.id} className="p-4" data-testid={`finding-row-${item.id}`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${FINDING_COLORS[item.finding_type] || ""}`} />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.section_title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{item.requirement}</div>
                      {item.corrective_action && (
                        <div className="text-xs text-orange-700 mt-1">Action: {item.corrective_action}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={`text-xs ${item.finding_type === "major_non_conformity" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`} variant="outline">
                        {item.finding_type?.replace(/_/g, " ")}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{item.corrective_action_status}</Badge>
                      {item.corrective_action_due_date && (
                        <span className={`text-xs ${(daysUntil(item.corrective_action_due_date) ?? 999) < 0 ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                          Due {formatDate(item.corrective_action_due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="audits" className="mt-4 space-y-3">
          {audits.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">No audit records yet.</Card>
          ) : audits.map(audit => (
            <Card key={audit.id} className="p-4" data-testid={`audit-row-${audit.id}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-sm">{AUDIT_TYPE_LABELS[audit.audit_type] || audit.audit_type} Audit</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {audit.auditor_name} {audit.auditor_organization && `· ${audit.auditor_organization}`}
                  </div>
                  {audit.notes && <div className="text-xs text-muted-foreground mt-1">{audit.notes}</div>}
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-xs">{audit.overall_result?.replace(/_/g, " ")}</Badge>
                  <div className="text-xs text-muted-foreground mt-1">{formatDate(audit.audit_date)}</div>
                  {audit.next_audit_date && <div className="text-xs text-muted-foreground">Next: {formatDate(audit.next_audit_date)}</div>}
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Edit Item Dialog */}
      {editingItem && (
        <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
          <DialogContent className="max-w-lg" data-testid="dialog-edit-item">
            <DialogHeader>
              <DialogTitle className="text-base">Update Compliance Item</DialogTitle>
            </DialogHeader>
            <EditItemForm item={editingItem} onSave={(data) => {
              updateItemMutation.mutate({ id: editingItem.id, data }, {
                onSuccess: () => setEditingItem(null),
              });
            }} />
          </DialogContent>
        </Dialog>
      )}

      {/* Add Audit Dialog */}
      <Dialog open={showAuditForm} onOpenChange={setShowAuditForm}>
        <DialogContent className="max-w-lg" data-testid="dialog-add-audit">
          <DialogHeader>
            <DialogTitle>Record Audit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Audit Type</Label>
                <Select value={auditForm.auditType} onValueChange={v => setAuditForm(p => ({ ...p, auditType: v }))}>
                  <SelectTrigger data-testid="select-audit-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(AUDIT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Overall Result</Label>
                <Select value={auditForm.overallResult} onValueChange={v => setAuditForm(p => ({ ...p, overallResult: v }))}>
                  <SelectTrigger data-testid="select-audit-result"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="satisfactory">Satisfactory</SelectItem>
                    <SelectItem value="observations">Observations</SelectItem>
                    <SelectItem value="non_conformities">Non-conformities</SelectItem>
                    <SelectItem value="detained">Detained</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Auditor Name *</Label>
              <Input value={auditForm.auditorName} onChange={e => setAuditForm(p => ({ ...p, auditorName: e.target.value }))} placeholder="Inspector / Auditor name" data-testid="input-auditor-name" />
            </div>
            <div>
              <Label className="text-xs">Auditor Organization</Label>
              <Input value={auditForm.auditorOrganization} onChange={e => setAuditForm(p => ({ ...p, auditorOrganization: e.target.value }))} placeholder="IMO, Flag State, Class society..." data-testid="input-auditor-org" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Audit Date *</Label>
                <Input type="date" value={auditForm.auditDate} onChange={e => setAuditForm(p => ({ ...p, auditDate: e.target.value }))} data-testid="input-audit-date" />
              </div>
              <div>
                <Label className="text-xs">Next Audit Date</Label>
                <Input type="date" value={auditForm.nextAuditDate} onChange={e => setAuditForm(p => ({ ...p, nextAuditDate: e.target.value }))} data-testid="input-next-audit-date" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={auditForm.notes} onChange={e => setAuditForm(p => ({ ...p, notes: e.target.value }))} rows={2} data-testid="textarea-audit-notes" />
            </div>
            <Button
              className="w-full"
              disabled={!auditForm.auditorName || !auditForm.auditDate || addAuditMutation.isPending}
              onClick={() => addAuditMutation.mutate({ ...auditForm })}
              data-testid="button-submit-audit"
            >
              Record Audit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Edit Item Form ────────────────────────────────────────────────────────────
function EditItemForm({ item, onSave }: { item: any; onSave: (data: any) => void }) {
  const [form, setForm] = useState({
    isCompliant: item.is_compliant ?? false,
    evidence: item.evidence ?? "",
    responsiblePerson: item.responsible_person ?? "",
    findingType: item.finding_type ?? "none",
    correctiveAction: item.corrective_action ?? "",
    correctiveActionDueDate: item.corrective_action_due_date ? item.corrective_action_due_date.split("T")[0] : "",
    correctiveActionStatus: item.corrective_action_status ?? "open",
    notes: item.notes ?? "",
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox checked={form.isCompliant} onCheckedChange={v => setForm(p => ({ ...p, isCompliant: !!v }))} data-testid="checkbox-compliant" />
        <Label className="text-sm">Mark as Compliant</Label>
      </div>
      <div>
        <Label className="text-xs">Evidence / Notes</Label>
        <Textarea value={form.evidence} onChange={e => setForm(p => ({ ...p, evidence: e.target.value }))} rows={2} placeholder="Describe evidence of compliance..." data-testid="textarea-evidence" />
      </div>
      <div>
        <Label className="text-xs">Responsible Person</Label>
        <Input value={form.responsiblePerson} onChange={e => setForm(p => ({ ...p, responsiblePerson: e.target.value }))} placeholder="Name / Role" data-testid="input-responsible" />
      </div>
      <div>
        <Label className="text-xs">Finding Type</Label>
        <Select value={form.findingType} onValueChange={v => setForm(p => ({ ...p, findingType: v }))}>
          <SelectTrigger data-testid="select-finding-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="observation">Observation</SelectItem>
            <SelectItem value="non_conformity">Non-conformity</SelectItem>
            <SelectItem value="major_non_conformity">Major Non-conformity</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {form.findingType !== "none" && (
        <>
          <div>
            <Label className="text-xs">Corrective Action</Label>
            <Textarea value={form.correctiveAction} onChange={e => setForm(p => ({ ...p, correctiveAction: e.target.value }))} rows={2} data-testid="textarea-corrective-action" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">CA Due Date</Label>
              <Input type="date" value={form.correctiveActionDueDate} onChange={e => setForm(p => ({ ...p, correctiveActionDueDate: e.target.value }))} data-testid="input-ca-due-date" />
            </div>
            <div>
              <Label className="text-xs">CA Status</Label>
              <Select value={form.correctiveActionStatus} onValueChange={v => setForm(p => ({ ...p, correctiveActionStatus: v }))}>
                <SelectTrigger data-testid="select-ca-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}
      <Button className="w-full" onClick={() => onSave(form)} data-testid="button-save-item">Save Changes</Button>
    </div>
  );
}

// ── Create Checklist Dialog ───────────────────────────────────────────────────
function CreateChecklistDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ standardCode: "ISM", vesselId: "", version: "2024", nextAuditDate: "", notes: "" });
  const { data: rawVessels } = useQuery<any>({ queryKey: ["/api/vessels"] });
  const vessels: Vessel[] = Array.isArray(rawVessels) ? rawVessels : [];

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/compliance/checklists", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/checklists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/dashboard"] });
      toast({ title: "Checklist created", description: `${form.standardCode} checklist with template items created.` });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="dialog-create-checklist">
        <DialogHeader>
          <DialogTitle>Create Compliance Checklist</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Standard *</Label>
            <Select value={form.standardCode} onValueChange={v => setForm(p => ({ ...p, standardCode: v }))}>
              <SelectTrigger data-testid="select-standard"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STANDARDS.map(s => <SelectItem key={s.code} value={s.code}>{s.code} — {s.desc}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Vessel (optional)</Label>
            <Select value={form.vesselId} onValueChange={v => setForm(p => ({ ...p, vesselId: v }))}>
              <SelectTrigger data-testid="select-vessel"><SelectValue placeholder="Organization-wide" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Organization-wide</SelectItem>
                {vessels.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Version</Label>
              <Input value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))} placeholder="2024" data-testid="input-version" />
            </div>
            <div>
              <Label className="text-xs">Next Audit Date</Label>
              <Input type="date" value={form.nextAuditDate} onChange={e => setForm(p => ({ ...p, nextAuditDate: e.target.value }))} data-testid="input-next-audit" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} data-testid="textarea-notes" />
          </div>
          <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
            {form.standardCode === "ISM" && "Creates 40 ISM Code checklist items across 13 sections."}
            {form.standardCode === "ISPS" && "Creates 13 ISPS Code Part A checklist items."}
            {form.standardCode === "MLC" && "Creates 18 MLC 2006 checklist items across 5 Titles."}
            {!["ISM","ISPS","MLC"].includes(form.standardCode) && "Custom checklist — you can add items manually."}
          </div>
          <Button
            className="w-full"
            onClick={() => createMutation.mutate({ ...form, vesselId: form.vesselId && form.vesselId !== "none" ? Number(form.vesselId) : null, nextAuditDate: form.nextAuditDate || null })}
            disabled={createMutation.isPending}
            data-testid="button-submit-create-checklist"
          >
            {createMutation.isPending ? "Creating…" : "Create Checklist"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Compliance() {
  const { checklistId } = useParams<{ checklistId?: string }>();
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [filterStandard, setFilterStandard] = useState("all");

  const { data: rawChecklists, isLoading } = useQuery<any>({
    queryKey: ["/api/compliance/checklists"],
    queryFn: () => fetch("/api/compliance/checklists", { credentials: "include" }).then(r => r.json()),
  });
  const checklists: any[] = Array.isArray(rawChecklists) ? rawChecklists : [];

  const { data: dashData } = useQuery<any>({
    queryKey: ["/api/compliance/dashboard"],
    queryFn: () => fetch("/api/compliance/dashboard", { credentials: "include" }).then(r => r.json()),
  });

  const openFindings: any[] = Array.isArray(dashData?.openFindings) ? dashData.openFindings : [];
  const upcomingAudits: any[] = Array.isArray(dashData?.upcomingAudits) ? dashData.upcomingAudits : [];

  const filtered = filterStandard === "all" ? checklists : checklists.filter(c => c.standard_code === filterStandard);

  const byStd = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const cl of checklists) {
      if (!m[cl.standard_code]) m[cl.standard_code] = [];
      m[cl.standard_code].push(cl);
    }
    return m;
  }, [checklists]);

  if (checklistId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <PageMeta title="Compliance Checklist | VesselPDA" />
        <ChecklistDetail checklistId={Number(checklistId)} onBack={() => navigate("/compliance")} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageMeta title="Compliance Management | VesselPDA" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-[hsl(var(--maritime-primary))]" />
          <div>
            <h1 className="text-xl font-bold font-serif">Compliance Management</h1>
            <p className="text-sm text-muted-foreground">ISM · ISPS · MLC · MARPOL · SOLAS</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-checklist">
          <Plus className="w-4 h-4 mr-1" /> New Checklist
        </Button>
      </div>

      {/* Summary bar */}
      {checklists.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold">{checklists.length}</div>
            <div className="text-xs text-muted-foreground">Checklists</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">
              {checklists.filter(c => c.status === "compliant").length}
            </div>
            <div className="text-xs text-muted-foreground">Compliant</div>
          </Card>
          <Card className="p-4 text-center" data-testid="card-open-findings">
            <div className="text-2xl font-bold text-orange-600">{openFindings.length}</div>
            <div className="text-xs text-muted-foreground">Open Findings</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{upcomingAudits.length}</div>
            <div className="text-xs text-muted-foreground">Audits Due (90d)</div>
          </Card>
        </div>
      )}

      {/* Upcoming audits */}
      {upcomingAudits.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
            <span className="font-medium text-sm">Upcoming Audits</span>
          </div>
          <div className="divide-y">
            {upcomingAudits.slice(0, 5).map(cl => {
              const days = daysUntil(cl.next_audit_date);
              return (
                <div key={cl.id} className="py-2 flex items-center justify-between cursor-pointer hover:bg-muted/30 rounded px-2 transition-colors" onClick={() => navigate(`/compliance/${cl.id}`)} data-testid={`upcoming-audit-${cl.id}`}>
                  <div>
                    <span className="text-sm font-medium">{cl.standard_code}</span>
                    <span className="text-xs text-muted-foreground ml-2">{cl.vessel_name || "Org-wide"}</span>
                  </div>
                  <Badge className={`text-xs ${(days ?? 999) <= 14 ? "bg-red-100 text-red-700" : (days ?? 999) <= 30 ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`} variant="outline">
                    {days != null ? (days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`) : "—"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Filter & Checklist grid */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Select value={filterStandard} onValueChange={setFilterStandard}>
            <SelectTrigger className="w-40 h-8 text-sm" data-testid="select-filter-standard">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Standards</SelectItem>
              {STANDARDS.map(s => <SelectItem key={s.code} value={s.code}>{s.code}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">Loading…</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No compliance checklists yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Create one from an ISM, ISPS or MLC template to get started.</p>
            <Button className="mt-4" onClick={() => setShowCreate(true)} data-testid="button-create-first-checklist">
              <Plus className="w-4 h-4 mr-1" /> Create Checklist
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(cl => (
              <OverviewCard key={cl.id} cl={cl} onClick={() => navigate(`/compliance/${cl.id}`)} />
            ))}
          </div>
        )}
      </div>

      <CreateChecklistDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
