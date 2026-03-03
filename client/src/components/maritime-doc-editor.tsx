import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FileText, CheckCircle2, Clock, PenLine, AlertCircle, Plus, Trash2,
  Download, ChevronRight, History, Send, ShieldCheck, X
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocStatus = "draft" | "pending_review" | "approved" | "signed" | "void";

interface TemplateField {
  fieldName: string;
  fieldType: "text" | "number" | "date" | "select" | "textarea" | "table";
  label: string;
  required: boolean;
  defaultValue?: string;
  autoFill?: string;
  options?: string[];
  tableColumns?: { key: string; label: string }[];
}

interface MaritimeDoc {
  id: number;
  template_id: number;
  voyage_id: number;
  port_call_id?: number;
  document_number: string;
  data: Record<string, any>;
  status: DocStatus;
  version: number;
  notes?: string;
  signature_text?: string;
  signed_at?: string;
  signer_name?: string;
  reviewer_name?: string;
  reviewed_at?: string;
  creator_name?: string;
  created_at: string;
  template_name: string;
  template_code: string;
  template_category: string;
  template_fields: TemplateField[];
  template_description?: string;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DocStatus, { label: string; color: string; icon: any }> = {
  draft:          { label: "Draft",          color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",      icon: Clock },
  pending_review: { label: "Pending Review", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: AlertCircle },
  approved:       { label: "Approved",       color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",    icon: CheckCircle2 },
  signed:         { label: "Signed",         color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: ShieldCheck },
  void:           { label: "Void",           color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",        icon: X },
};

const WORKFLOW_STEPS: { status: DocStatus; label: string }[] = [
  { status: "draft",          label: "Draft" },
  { status: "pending_review", label: "Review" },
  { status: "approved",       label: "Approved" },
  { status: "signed",         label: "Signed" },
];

// ─── TableField component ─────────────────────────────────────────────────────

function TableFieldEditor({ field, value, onChange, disabled }: {
  field: TemplateField;
  value: Record<string, string>[];
  onChange: (v: Record<string, string>[]) => void;
  disabled: boolean;
}) {
  const cols = field.tableColumns ?? [];
  const rows: Record<string, string>[] = Array.isArray(value) ? value : [];

  const addRow = () => {
    const empty: Record<string, string> = {};
    cols.forEach(c => { empty[c.key] = ""; });
    onChange([...rows, empty]);
  };

  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  const setCell = (rowIdx: number, col: string, val: string) => {
    const updated = rows.map((r, i) => i === rowIdx ? { ...r, [col]: val } : r);
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              {cols.map(c => <th key={c.key} className="px-2 py-2 text-left font-medium text-muted-foreground">{c.label}</th>)}
              {!disabled && <th className="px-2 py-2 w-8" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr><td colSpan={cols.length + 1} className="px-2 py-4 text-center text-muted-foreground">No rows — click Add to start</td></tr>
            )}
            {rows.map((row, ri) => (
              <tr key={ri}>
                {cols.map(c => (
                  <td key={c.key} className="px-1 py-1">
                    <Input
                      value={row[c.key] ?? ""}
                      onChange={e => setCell(ri, c.key, e.target.value)}
                      disabled={disabled}
                      className="h-7 text-xs border-0 bg-transparent focus:bg-background focus:border"
                    />
                  </td>
                ))}
                {!disabled && (
                  <td className="px-1 py-1">
                    <button onClick={() => removeRow(ri)} className="p-1 text-muted-foreground hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!disabled && (
        <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-7 text-xs">
          <Plus className="w-3 h-3 mr-1" /> Add Row
        </Button>
      )}
    </div>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export function MaritimeDocEditor({ docId, onClose }: { docId: number; onClose?: () => void }) {
  const { toast } = useToast();
  const [localData, setLocalData] = useState<Record<string, any> | null>(null);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [sigText, setSigText] = useState("");
  const [showVersions, setShowVersions] = useState(false);

  const docQuery = useQuery<MaritimeDoc>({
    queryKey: ["/api/maritime-docs", docId],
    queryFn: () => fetch(`/api/maritime-docs/${docId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!docId,
  });

  const versionsQuery = useQuery<any[]>({
    queryKey: ["/api/maritime-docs", docId, "versions"],
    queryFn: () => fetch(`/api/maritime-docs/${docId}/versions`, { credentials: "include" }).then(r => r.json()),
    enabled: showVersions,
  });

  const doc = docQuery.data;
  const fields: TemplateField[] = doc?.template_fields ?? [];
  const data = localData ?? doc?.data ?? {};
  const isEditable = doc?.status === "draft" || doc?.status === "pending_review";

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/maritime-docs", docId] });
    queryClient.invalidateQueries({ queryKey: ["/api/voyages"] });
    if (doc?.voyage_id) queryClient.invalidateQueries({ queryKey: ["/api/voyages", doc.voyage_id, "maritime-docs"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/maritime-docs/${docId}`, { data: localData ?? data }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Document saved" }); setLocalData(null); invalidate(); },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/maritime-docs/${docId}/status`, { status }).then(r => r.json()),
    onSuccess: (_, status) => { toast({ title: `Status changed to ${status}` }); invalidate(); },
    onError: () => toast({ title: "Status update failed", variant: "destructive" }),
  });

  const signMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/maritime-docs/${docId}/sign`, { signatureText: sigText }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Document signed" }); setShowSignDialog(false); invalidate(); },
    onError: () => toast({ title: "Sign failed", variant: "destructive" }),
  });

  const newVersionMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/maritime-docs/${docId}/new-version`, {}).then(r => r.json()),
    onSuccess: (newDoc) => {
      toast({ title: `v${newDoc.version} created` });
      queryClient.invalidateQueries({ queryKey: ["/api/voyages"] });
    },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const setField = useCallback((name: string, val: any) => {
    setLocalData(prev => ({ ...(prev ?? doc?.data ?? {}), [name]: val }));
  }, [doc?.data]);

  const exportPdf = async () => {
    if (!doc) return;
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const margin = 20;
      let y = margin;
      const pageW = 210;
      const contentW = pageW - 2 * margin;

      pdf.setFillColor(10, 40, 90);
      pdf.rect(0, 0, pageW, 40, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("VesselPDA", margin, 18);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text("Maritime Document", margin, 27);

      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(doc.template_name.toUpperCase(), pageW - margin, 18, { align: "right" });
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`No: ${doc.document_number}`, pageW - margin, 25, { align: "right" });
      pdf.text(`Date: ${new Date(doc.created_at).toLocaleDateString("en-GB")}`, pageW - margin, 31, { align: "right" });
      pdf.text(`Status: ${STATUS_CONFIG[doc.status].label}`, pageW - margin, 37, { align: "right" });

      y = 50;

      const renderField = (field: TemplateField) => {
        const val = data[field.fieldName];
        if (!val && !field.required) return;
        const displayVal = Array.isArray(val) ? "" : String(val || "—");

        if (y > 260) { pdf.addPage(); y = 20; }

        pdf.setFontSize(8);
        pdf.setTextColor(100, 120, 140);
        pdf.setFont("helvetica", "bold");
        pdf.text(field.label.toUpperCase(), margin, y);
        y += 4;

        if (field.fieldType === "table" && Array.isArray(val) && val.length > 0) {
          const cols = field.tableColumns ?? [];
          const colW = contentW / Math.max(cols.length, 1);
          pdf.setFillColor(230, 235, 245);
          pdf.rect(margin, y, contentW, 6, "F");
          pdf.setFontSize(7);
          pdf.setTextColor(50, 70, 100);
          pdf.setFont("helvetica", "bold");
          cols.forEach((c, i) => pdf.text(c.label, margin + i * colW + 1, y + 4));
          y += 6;
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(30, 30, 30);
          val.forEach((row: any) => {
            if (y > 270) { pdf.addPage(); y = 20; }
            pdf.setFontSize(7);
            cols.forEach((c, i) => {
              const cell = String(row[c.key] || "");
              pdf.text(cell.substring(0, 20), margin + i * colW + 1, y + 4);
            });
            pdf.setDrawColor(220, 225, 235);
            pdf.line(margin, y + 6, margin + contentW, y + 6);
            y += 7;
          });
        } else {
          pdf.setFontSize(9);
          pdf.setTextColor(30, 30, 30);
          pdf.setFont("helvetica", "normal");
          const lines = pdf.splitTextToSize(displayVal, contentW);
          lines.forEach((line: string) => {
            if (y > 270) { pdf.addPage(); y = 20; }
            pdf.text(line, margin, y);
            y += 5;
          });
        }
        pdf.setDrawColor(210, 220, 230);
        pdf.line(margin, y, margin + contentW, y);
        y += 4;
      };

      fields.forEach(renderField);

      if (doc.status === "signed" && doc.signature_text) {
        if (y > 240) { pdf.addPage(); y = 20; }
        y += 8;
        pdf.setDrawColor(10, 40, 90);
        pdf.setLineWidth(0.5);
        pdf.line(margin, y, margin + 70, y);
        y += 4;
        pdf.setFontSize(8);
        pdf.setTextColor(30, 30, 30);
        pdf.text(doc.signature_text, margin, y);
        y += 4;
        pdf.setTextColor(100, 120, 140);
        pdf.text(`Signed: ${doc.signed_at ? new Date(doc.signed_at).toLocaleDateString("en-GB") : ""}`, margin, y);
      }

      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7);
        pdf.setTextColor(150);
        pdf.text(`Page ${i} of ${pageCount} — ${doc.document_number} — VesselPDA`, pageW / 2, 290, { align: "center" });
      }

      pdf.save(`${doc.document_number}.pdf`);
      toast({ title: "PDF downloaded" });
    } catch (err) {
      console.error(err);
      toast({ title: "PDF export failed", variant: "destructive" });
    }
  };

  if (docQuery.isLoading) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Loading document…</div>;
  }
  if (!doc) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Document not found.</div>;
  }

  const statusCfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;
  const hasUnsaved = localData !== null;
  const currentStepIdx = WORKFLOW_STEPS.findIndex(s => s.status === doc.status);

  return (
    <div className="space-y-5" data-testid="maritime-doc-editor">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <FileText className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
            <h2 className="text-base font-semibold">{doc.template_name}</h2>
            <span className="text-xs text-muted-foreground font-mono">{doc.document_number}</span>
            <Badge className={`text-[10px] px-2 py-0.5 flex items-center gap-1 ${statusCfg.color}`} data-testid="badge-doc-status">
              <StatusIcon className="w-3 h-3" /> {statusCfg.label}
            </Badge>
            {doc.version > 1 && (
              <Badge variant="outline" className="text-[10px]">v{doc.version}</Badge>
            )}
            {hasUnsaved && (
              <span className="text-[10px] text-amber-600 font-medium">● Unsaved changes</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{doc.template_description}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportPdf} data-testid="button-export-pdf">
            <Download className="w-3.5 h-3.5 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowVersions(v => !v)}>
            <History className="w-3.5 h-3.5 mr-1" /> Versions
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
          )}
        </div>
      </div>

      {/* Workflow Steps */}
      {doc.status !== "void" && (
        <Card className="p-4">
          <div className="flex items-center gap-0">
            {WORKFLOW_STEPS.map((step, i) => {
              const isActive = step.status === doc.status;
              const isPast = i < currentStepIdx;
              return (
                <div key={step.status} className="flex items-center flex-1">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive ? "bg-[hsl(var(--maritime-primary))] text-white" :
                    isPast ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {isPast ? <CheckCircle2 className="w-3 h-3" /> : <div className={`w-2 h-2 rounded-full ${isActive ? "bg-white" : "bg-muted-foreground/40"}`} />}
                    {step.label}
                  </div>
                  {i < WORKFLOW_STEPS.length - 1 && (
                    <ChevronRight className={`w-3 h-3 flex-shrink-0 mx-1 ${isPast ? "text-emerald-500" : "text-muted-foreground/30"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Version history */}
      {showVersions && (
        <Card className="p-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Version History</h4>
          {versionsQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-1">
              {(versionsQuery.data ?? []).map((v: any) => (
                <div key={v.id} className={`flex items-center gap-3 text-xs px-3 py-2 rounded ${v.id === docId ? "bg-muted" : ""}`} data-testid={`version-row-${v.id}`}>
                  <span className="font-mono font-bold w-8">v{v.version}</span>
                  <Badge className={`text-[10px] ${STATUS_CONFIG[v.status as DocStatus]?.color ?? ""}`}>{STATUS_CONFIG[v.status as DocStatus]?.label ?? v.status}</Badge>
                  <span className="text-muted-foreground flex-1">{v.document_number}</span>
                  <span className="text-muted-foreground">{new Date(v.created_at).toLocaleDateString("en-GB")}</span>
                  {v.id !== docId && (
                    <Link href={`/maritime-docs/${v.id}`} className="text-[hsl(var(--maritime-primary))] hover:underline">Open</Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Form fields */}
      <Card className="p-5">
        <div className="space-y-5">
          {fields.map(field => (
            <div key={field.fieldName} data-testid={`field-${field.fieldName}`}>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
                {field.autoFill && <span className="ml-2 text-[10px] text-blue-500 normal-case font-normal">(auto-filled)</span>}
              </Label>

              {field.fieldType === "textarea" && (
                <Textarea
                  value={data[field.fieldName] ?? ""}
                  onChange={e => setField(field.fieldName, e.target.value)}
                  disabled={!isEditable}
                  rows={3}
                  className="text-sm resize-none"
                  data-testid={`input-field-${field.fieldName}`}
                />
              )}

              {(field.fieldType === "text" || field.fieldType === "number") && (
                <Input
                  type={field.fieldType === "number" ? "number" : "text"}
                  value={data[field.fieldName] ?? ""}
                  onChange={e => setField(field.fieldName, e.target.value)}
                  disabled={!isEditable}
                  className="text-sm"
                  data-testid={`input-field-${field.fieldName}`}
                />
              )}

              {field.fieldType === "date" && (
                <Input
                  type="date"
                  value={data[field.fieldName] ?? ""}
                  onChange={e => setField(field.fieldName, e.target.value)}
                  disabled={!isEditable}
                  className="text-sm"
                  data-testid={`input-field-${field.fieldName}`}
                />
              )}

              {field.fieldType === "select" && (
                <Select
                  value={data[field.fieldName] ?? field.defaultValue ?? ""}
                  onValueChange={v => setField(field.fieldName, v)}
                  disabled={!isEditable}
                >
                  <SelectTrigger className="text-sm" data-testid={`select-field-${field.fieldName}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.options ?? []).map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {field.fieldType === "table" && (
                <TableFieldEditor
                  field={field}
                  value={Array.isArray(data[field.fieldName]) ? data[field.fieldName] : []}
                  onChange={v => setField(field.fieldName, v)}
                  disabled={!isEditable}
                />
              )}
            </div>
          ))}

          {/* Notes */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Internal Notes</Label>
            <Textarea
              value={data.__notes ?? ""}
              onChange={e => setField("__notes", e.target.value)}
              disabled={!isEditable}
              rows={2}
              placeholder="Internal notes (not printed on document)"
              className="text-sm resize-none"
            />
          </div>
        </div>
      </Card>

      {/* Signature display */}
      {doc.status === "signed" && (
        <Card className="p-4 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Signed Document</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Signed by <strong>{doc.signature_text}</strong>
            {doc.signed_at && ` on ${new Date(doc.signed_at).toLocaleDateString("en-GB")}`}
          </p>
        </Card>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {isEditable && (
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!hasUnsaved || saveMutation.isPending}
            data-testid="button-save-doc"
          >
            {saveMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        )}

        {doc.status === "draft" && (
          <Button variant="outline" onClick={() => statusMutation.mutate("pending_review")} disabled={statusMutation.isPending} data-testid="button-send-review">
            <Send className="w-3.5 h-3.5 mr-1" /> Send for Review
          </Button>
        )}

        {doc.status === "pending_review" && (
          <Button variant="outline" onClick={() => statusMutation.mutate("approved")} disabled={statusMutation.isPending} data-testid="button-approve">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
          </Button>
        )}

        {(doc.status === "approved" || doc.status === "pending_review") && (
          <Button variant="outline" onClick={() => setShowSignDialog(true)} data-testid="button-sign">
            <PenLine className="w-3.5 h-3.5 mr-1" /> Sign
          </Button>
        )}

        {doc.status === "signed" && (
          <Button variant="outline" onClick={() => newVersionMutation.mutate()} disabled={newVersionMutation.isPending} data-testid="button-new-version">
            <Plus className="w-3.5 h-3.5 mr-1" /> New Version
          </Button>
        )}

        {doc.status !== "void" && doc.status !== "signed" && (
          <Button variant="ghost" className="text-muted-foreground hover:text-red-600 ml-auto" onClick={() => statusMutation.mutate("void")} data-testid="button-void">
            Void Document
          </Button>
        )}
      </div>

      {/* Sign Dialog */}
      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Enter your full name as digital signature. This action cannot be undone.</p>
            <div className="space-y-1.5">
              <Label>Full Name / Title</Label>
              <Input
                value={sigText}
                onChange={e => setSigText(e.target.value)}
                placeholder="Capt. John Smith — Master"
                data-testid="input-signature"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignDialog(false)}>Cancel</Button>
            <Button onClick={() => signMutation.mutate()} disabled={!sigText || signMutation.isPending} data-testid="button-confirm-sign">
              {signMutation.isPending ? "Signing…" : "Sign Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
