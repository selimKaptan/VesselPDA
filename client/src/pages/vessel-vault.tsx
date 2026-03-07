import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Shield, Archive, Plus, Upload, Eye, Pencil, Trash2, ChevronLeft,
  CheckCircle2, AlertTriangle, Clock, XCircle, FileText, Download,
  FolderLock, Loader2, X, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";

const STATUTORY_DOCS = [
  { key: "p_and_i",      name: "P&I Certificate" },
  { key: "class_cert",   name: "Class Certificate" },
  { key: "ism",          name: "ISM Certificate" },
  { key: "isps",         name: "ISPS Certificate" },
  { key: "load_line",    name: "Load Line Certificate" },
  { key: "marpol_iopp",  name: "MARPOL IOPP Certificate" },
  { key: "solas_equip",  name: "SOLAS Safety Equipment Certificate" },
  { key: "solas_radio",  name: "SOLAS Safety Radio Certificate" },
  { key: "solas_const",  name: "SOLAS Safety Construction Certificate" },
  { key: "clc",          name: "CLC Oil Pollution Certificate" },
  { key: "tonnage",      name: "Tonnage Certificate" },
  { key: "deratting",    name: "Deratting Certificate" },
  { key: "mlc",          name: "MLC 2006 Certificate" },
  { key: "bwm",          name: "Ballast Water Management Certificate" },
  { key: "anti_fouling", name: "Anti-Fouling System Declaration" },
  { key: "manning",      name: "Minimum Safe Manning Certificate" },
  { key: "registry",     name: "Certificate of Registry" },
  { key: "csr",          name: "Continuous Synopsis Record" },
];

const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  commercial: ["Hull & Machinery Insurance", "War Risk Insurance", "Charter Party Agreement", "Cargo Insurance Policy", "P&I Cover Letter"],
  operational: ["MARPOL Garbage Management Plan", "Radio Station License", "Ship Sanitation Certificate", "Voyage Orders", "Port State Control Report"],
  crew: ["Crew List", "Medical Fitness Certificates", "STCW Certificates", "Seafarer Employment Agreement", "Watch Schedule"],
};

interface CertRecord {
  id: number;
  name: string;
  certType: string;
  category: string;
  vaultDocType: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  issuingAuthority: string | null;
  certificateNumber: string | null;
  notes: string | null;
  status: string;
  fileBase64: string | null;
  fileName: string | null;
  fileSize: number | null;
  reminderSentDays: string | null;
}

function certStatus(cert: CertRecord | undefined, today = new Date()): "valid" | "expiring" | "expired" | "missing" {
  if (!cert) return "missing";
  if (!cert.expiresAt) return "valid";
  const exp = new Date(cert.expiresAt);
  if (exp < today) return "expired";
  const diff = (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 30) return "expiring";
  return "valid";
}

function StatusBadge({ status }: { status: "valid" | "expiring" | "expired" | "missing" }) {
  if (status === "valid") return <Badge className="text-[10px] h-5 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0">Valid</Badge>;
  if (status === "expiring") return <Badge className="text-[10px] h-5 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-0">Expiring Soon</Badge>;
  if (status === "expired") return <Badge className="text-[10px] h-5 px-1.5 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-0">Expired</Badge>;
  return <Badge className="text-[10px] h-5 px-1.5 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-0">Not Uploaded</Badge>;
}

function StatusIcon({ status }: { status: "valid" | "expiring" | "expired" | "missing" }) {
  if (status === "valid") return <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />;
  if (status === "expiring") return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
  if (status === "expired") return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
  return <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  vesselId: number;
  category: string;
  vaultDocType?: string;
  docName?: string;
  existingCert?: CertRecord;
}

function UploadDialog({ open, onClose, vesselId, category, vaultDocType, docName, existingCert }: UploadDialogProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: existingCert?.name || docName || "",
    issuingAuthority: existingCert?.issuingAuthority || "",
    certificateNumber: existingCert?.certificateNumber || "",
    issuedAt: existingCert?.issuedAt ? existingCert.issuedAt.split("T")[0] : "",
    expiresAt: existingCert?.expiresAt ? existingCert.expiresAt.split("T")[0] : "",
    notes: existingCert?.notes || "",
  });
  const [fileData, setFileData] = useState<{ base64: string; name: string; size: number } | null>(null);

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setFileData({ base64, name: file.name, size: file.size });
    };
    reader.readAsDataURL(file);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name || docName || "Document",
        certType: vaultDocType || category,
        category,
        vaultDocType: vaultDocType || null,
        issuingAuthority: form.issuingAuthority || null,
        certificateNumber: form.certificateNumber || null,
        issuedAt: form.issuedAt || null,
        expiresAt: form.expiresAt || null,
        notes: form.notes || null,
        status: "valid",
      };
      if (fileData) {
        payload.fileBase64 = fileData.base64;
        payload.fileName = fileData.name;
        payload.fileSize = fileData.size;
      }
      if (existingCert) {
        return apiRequest("PATCH", `/api/vessels/${vesselId}/certificates/${existingCert.id}`, payload);
      }
      return apiRequest("POST", `/api/vessels/${vesselId}/certificates`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vessels/${vesselId}/certificates`] });
      queryClient.invalidateQueries({ queryKey: [`/api/vessels/${vesselId}/vault-stats`] });
      toast({ title: existingCert ? "Document updated" : "Document uploaded successfully" });
      onClose();
    },
    onError: () => toast({ title: "Upload failed", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existingCert ? "Update Document" : "Upload Document"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {!vaultDocType && (
            <div className="space-y-1">
              <Label>Document Name</Label>
              <Input value={form.name} onChange={e => f("name", e.target.value)} placeholder="e.g. Charter Party Agreement" data-testid="input-cert-name" />
            </div>
          )}
          {vaultDocType && (
            <div className="p-3 rounded-lg bg-muted/40 text-sm font-medium">{docName}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Issuing Authority</Label>
              <Input value={form.issuingAuthority} onChange={e => f("issuingAuthority", e.target.value)} placeholder="e.g. Flag State" data-testid="input-cert-authority" />
            </div>
            <div className="space-y-1">
              <Label>Certificate Number</Label>
              <Input value={form.certificateNumber} onChange={e => f("certificateNumber", e.target.value)} placeholder="e.g. ISM-2024-001" data-testid="input-cert-number" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Issue Date</Label>
              <Input type="date" value={form.issuedAt} onChange={e => f("issuedAt", e.target.value)} data-testid="input-cert-issued" />
            </div>
            <div className="space-y-1">
              <Label>Expiry Date</Label>
              <Input type="date" value={form.expiresAt} onChange={e => f("expiresAt", e.target.value)} data-testid="input-cert-expiry" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => f("notes", e.target.value)} placeholder="Optional notes…" className="h-20 resize-none" data-testid="input-cert-notes" />
          </div>
          <div className="space-y-1">
            <Label>File (PDF / Image)</Label>
            <div
              className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => fileRef.current?.click()}
              data-testid="dropzone-cert-file"
            >
              {fileData ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">{fileData.name}</span>
                  <span className="text-muted-foreground text-xs">({Math.round(fileData.size / 1024)} KB)</span>
                </div>
              ) : existingCert?.fileName ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">{existingCert.fileName}</span>
                  <span className="text-muted-foreground text-xs ml-1">(replace?)</span>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <Upload className="w-6 h-6 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">Click to browse or drag & drop</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFile} data-testid="input-cert-file" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-cert-save">
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {existingCert ? "Update" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatutorySlot({
  doc, cert, vesselId, onUpload
}: {
  doc: { key: string; name: string };
  cert: CertRecord | undefined;
  vesselId: number;
  onUpload: (docKey: string, docName: string, existingCert?: CertRecord) => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const [showView, setShowView] = useState(false);
  const { toast } = useToast();
  const status = certStatus(cert);

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/vessels/${vesselId}/certificates/${cert!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vessels/${vesselId}/certificates`] });
      queryClient.invalidateQueries({ queryKey: [`/api/vessels/${vesselId}/vault-stats`] });
      toast({ title: "Document removed" });
      setShowDelete(false);
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
        status === "missing" ? "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800" :
        status === "expired" ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900" :
        status === "expiring" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900" :
        "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900"
      }`}
      data-testid={`slot-${doc.key}`}
    >
      <StatusIcon status={status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.name}</p>
        {cert && (
          <p className="text-[11px] text-muted-foreground">
            {cert.certificateNumber && <span className="mr-2">{cert.certificateNumber}</span>}
            {cert.expiresAt && <span>Expires: {fmtDate(cert.expiresAt)}</span>}
            {cert.issuingAuthority && <span className="ml-2 opacity-70">· {cert.issuingAuthority}</span>}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <StatusBadge status={status} />
        {cert?.fileName && (
          <button
            className="p-1.5 hover:bg-muted rounded transition-colors text-blue-600"
            onClick={() => setShowView(true)}
            data-testid={`button-view-cert-${doc.key}`}
            title="View file"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          className="p-1.5 hover:bg-muted rounded transition-colors text-[hsl(var(--maritime-primary))]"
          onClick={() => onUpload(doc.key, doc.name, cert)}
          data-testid={`button-upload-cert-${doc.key}`}
          title={cert ? "Update document" : "Upload document"}
        >
          {cert ? <Pencil className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
        </button>
        {cert && (
          <button
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors text-muted-foreground hover:text-destructive"
            onClick={() => setShowDelete(true)}
            data-testid={`button-delete-cert-${doc.key}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* View file dialog */}
      {cert?.fileBase64 && (
        <Dialog open={showView} onOpenChange={setShowView}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>{cert.fileName}</DialogTitle>
            </DialogHeader>
            {cert.fileName?.match(/\.(jpg|jpeg|png)$/i) ? (
              <img src={`data:image/*;base64,${cert.fileBase64}`} alt={cert.name} className="w-full rounded" />
            ) : cert.fileName?.endsWith(".pdf") ? (
              <iframe
                src={`data:application/pdf;base64,${cert.fileBase64}`}
                className="w-full h-[60vh] rounded"
                title={cert.fileName}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Preview not available</p>
                <Button
                  className="mt-3"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = `data:application/octet-stream;base64,${cert.fileBase64}`;
                    a.download = cert.fileName || "document";
                    a.click();
                  }}
                  data-testid={`button-download-cert-${doc.key}`}
                >
                  <Download className="w-4 h-4 mr-1" /> Download
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Document?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the uploaded document for "{doc.name}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground">
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FreeCategoryTab({
  category, vesselId, certs
}: {
  category: string;
  vesselId: number;
  certs: CertRecord[];
}) {
  const [showUpload, setShowUpload] = useState(false);
  const [editCert, setEditCert] = useState<CertRecord | undefined>();
  const [showDelete, setShowDelete] = useState<CertRecord | null>(null);
  const { toast } = useToast();

  const filtered = certs.filter(c => c.category === category);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/vessels/${vesselId}/certificates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vessels/${vesselId}/certificates`] });
      toast({ title: "Document removed" });
      setShowDelete(null);
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const suggestions = CATEGORY_SUGGESTIONS[category] || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} document{filtered.length !== 1 ? "s" : ""}</p>
        <Button size="sm" variant="outline" className="gap-1 h-8 text-xs" onClick={() => { setEditCert(undefined); setShowUpload(true); }} data-testid={`button-add-${category}-doc`}>
          <Plus className="w-3.5 h-3.5" /> Add Document
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
          <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium text-muted-foreground">No documents yet</p>
          {suggestions.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2">Common documents in this category:</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {suggestions.map(s => (
                  <span key={s} className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(cert => {
            const status = certStatus(cert);
            return (
              <div key={cert.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                status === "expired" ? "bg-red-50 dark:bg-red-950/20 border-red-200" :
                status === "expiring" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200" :
                "bg-muted/30 border-border/50"
              }`} data-testid={`doc-free-${cert.id}`}>
                <StatusIcon status={status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{cert.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {cert.certificateNumber && <span className="mr-2">{cert.certificateNumber}</span>}
                    {cert.expiresAt ? <span>Expires: {fmtDate(cert.expiresAt)}</span> : <span>No expiry set</span>}
                    {cert.fileName && <span className="ml-2 opacity-70">· {cert.fileName}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <StatusBadge status={status} />
                  <button className="p-1.5 hover:bg-muted rounded transition-colors" onClick={() => { setEditCert(cert); setShowUpload(true); }} data-testid={`button-edit-free-${cert.id}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors text-muted-foreground hover:text-destructive" onClick={() => setShowDelete(cert)} data-testid={`button-delete-free-${cert.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showUpload && (
        <UploadDialog
          open={showUpload}
          onClose={() => { setShowUpload(false); setEditCert(undefined); }}
          vesselId={vesselId}
          category={category}
          existingCert={editCert}
        />
      )}

      <AlertDialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Document?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove "{showDelete?.name}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => showDelete && deleteMutation.mutate(showDelete.id)} className="bg-destructive text-destructive-foreground">
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function VesselVault() {
  const params = useParams<{ vesselId: string }>();
  const [, navigate] = useLocation();
  const vesselId = parseInt(params.vesselId || "0");

  const [uploadDialog, setUploadDialog] = useState<{
    open: boolean;
    vaultDocType?: string;
    docName?: string;
    existingCert?: CertRecord;
  }>({ open: false });

  const { data: vessels, isLoading: vesselsLoading } = useQuery<any[]>({ queryKey: ["/api/vessels"] });
  const vessel = vessels?.find(v => v.id === vesselId);

  const { data: certs = [], isLoading: certsLoading } = useQuery<CertRecord[]>({
    queryKey: [`/api/vessels/${vesselId}/certificates`],
    enabled: vesselId > 0,
  });

  const { data: stats } = useQuery<{ total: number; uploaded: number; expired: number; expiring: number; missing: number }>({
    queryKey: [`/api/vessels/${vesselId}/vault-stats`],
    enabled: vesselId > 0,
  });

  const today = new Date();

  const statutoryMap = new Map<string, CertRecord>();
  certs.filter(c => c.category === "statutory" && c.vaultDocType).forEach(c => {
    if (c.vaultDocType) statutoryMap.set(c.vaultDocType, c);
  });

  const uploaded = stats?.uploaded ?? 0;
  const total = stats?.total ?? 18;
  const completePct = total > 0 ? Math.round((uploaded / total) * 100) : 0;

  const expiredCount = STATUTORY_DOCS.filter(d => certStatus(statutoryMap.get(d.key), today) === "expired").length;
  const expiringCount = STATUTORY_DOCS.filter(d => certStatus(statutoryMap.get(d.key), today) === "expiring").length;

  if (vesselsLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!vessel) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <FolderLock className="w-10 h-10 opacity-30" />
      <p className="text-sm text-muted-foreground">Vessel not found</p>
      <Button variant="outline" size="sm" onClick={() => navigate("/vessels")}>Back to Vessels</Button>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      <PageMeta title={`Vessel Vault — ${vessel.name} | VesselPDA`} description="Digital document safe for vessel statutory and operational certificates" />

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/vessels")} className="p-1.5 hover:bg-muted rounded-lg transition-colors" data-testid="button-back-vault">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="p-2 rounded-xl bg-[hsl(var(--maritime-primary)/0.1)]">
          <FolderLock className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">{vessel.name} — Vessel Vault</h1>
          <p className="text-xs text-muted-foreground">
            {vessel.imoNumber && <span className="mr-3">IMO: {vessel.imoNumber}</span>}
            {vessel.flag && <span className="mr-3">Flag: {vessel.flag}</span>}
            {vessel.vesselType && <span>Type: {vessel.vesselType}</span>}
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
            <span className="text-sm font-semibold">Statutory Document Completeness</span>
          </div>
          <span className="text-sm font-bold text-[hsl(var(--maritime-primary))]" data-testid="text-vault-completeness">{uploaded}/{total}</span>
        </div>
        <Progress value={completePct} className="h-2.5" data-testid="progress-vault" />
        <div className="flex items-center gap-4 mt-2.5">
          <span className="text-xs text-muted-foreground">{completePct}% complete</span>
          <div className="flex items-center gap-3 ml-auto">
            {expiredCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                <XCircle className="w-3.5 h-3.5" /> {expiredCount} Expired
              </span>
            )}
            {expiringCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> {expiringCount} Expiring
              </span>
            )}
            {uploaded === total && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> All documents uploaded
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="statutory">
        <TabsList className="h-9">
          <TabsTrigger value="statutory" className="text-xs gap-1.5 data-testid-tab" data-testid="tab-statutory">
            <Shield className="w-3.5 h-3.5" /> Statutory
            <span className="ml-1 text-[10px] opacity-70">{uploaded}/{total}</span>
          </TabsTrigger>
          <TabsTrigger value="commercial" className="text-xs gap-1.5" data-testid="tab-commercial">
            <Archive className="w-3.5 h-3.5" /> Commercial
          </TabsTrigger>
          <TabsTrigger value="operational" className="text-xs gap-1.5" data-testid="tab-operational">
            <FileText className="w-3.5 h-3.5" /> Operational
          </TabsTrigger>
          <TabsTrigger value="crew" className="text-xs gap-1.5" data-testid="tab-crew">
            <Shield className="w-3.5 h-3.5" /> Crew
          </TabsTrigger>
        </TabsList>

        {/* ── Statutory Tab ── */}
        <TabsContent value="statutory" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Required Statutory Documents (18)</CardTitle>
              <p className="text-xs text-muted-foreground">All vessels are required to maintain these statutory certificates on board.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {certsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                ))
              ) : (
                STATUTORY_DOCS.map(doc => (
                  <StatutorySlot
                    key={doc.key}
                    doc={doc}
                    cert={statutoryMap.get(doc.key)}
                    vesselId={vesselId}
                    onUpload={(vaultDocType, docName, existingCert) =>
                      setUploadDialog({ open: true, vaultDocType, docName, existingCert })
                    }
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Commercial Tab ── */}
        <TabsContent value="commercial" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Commercial Documents</CardTitle>
              <p className="text-xs text-muted-foreground">Insurance policies, charter party agreements, and other commercial documents.</p>
            </CardHeader>
            <CardContent>
              <FreeCategoryTab category="commercial" vesselId={vesselId} certs={certs} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Operational Tab ── */}
        <TabsContent value="operational" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Operational Documents</CardTitle>
              <p className="text-xs text-muted-foreground">Operational plans, licenses, and operational compliance documents.</p>
            </CardHeader>
            <CardContent>
              <FreeCategoryTab category="operational" vesselId={vesselId} certs={certs} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Crew Tab ── */}
        <TabsContent value="crew" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Crew Documents</CardTitle>
              <p className="text-xs text-muted-foreground">Crew certification, employment agreements, and STCW documents.</p>
            </CardHeader>
            <CardContent>
              <FreeCategoryTab category="crew" vesselId={vesselId} certs={certs} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload dialog (triggered by statutory slots) */}
      {uploadDialog.open && (
        <UploadDialog
          open={uploadDialog.open}
          onClose={() => setUploadDialog({ open: false })}
          vesselId={vesselId}
          category="statutory"
          vaultDocType={uploadDialog.vaultDocType}
          docName={uploadDialog.docName}
          existingCert={uploadDialog.existingCert}
        />
      )}
    </div>
  );
}
