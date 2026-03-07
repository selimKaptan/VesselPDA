import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ShieldCheck, Plus, Trash2, Pencil, AlertTriangle, CheckCircle2, Clock, Loader2, BadgeCheck, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { EmptyState } from "@/components/empty-state";
import { fmtDate } from "@/lib/formatDate";

const CERT_TYPES: Record<string, string> = {
  ism: "ISM",
  isps: "ISPS",
  loadline: "Load Line",
  marpol: "MARPOL",
  solas: "SOLAS",
  other: "Other",
};

const CERT_TYPE_COLORS: Record<string, string> = {
  ism: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  isps: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  loadline: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  marpol: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  solas: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  other: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

function statusBadge(status: string, expiresAt: string | null) {
  if (status === "expired" || (expiresAt && new Date(expiresAt) < new Date())) {
    return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 gap-1"><AlertTriangle className="w-3 h-3" />Expired</Badge>;
  }
  if (status === "expiring_soon") {
    return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 gap-1"><Clock className="w-3 h-3" />Expiring Soon</Badge>;
  }
  return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 gap-1"><CheckCircle2 className="w-3 h-3" />Valid</Badge>;
}

function formatDate(dt: string | null) {
  if (!dt) return "—";
  return fmtDate(dt);
}

const defaultForm = {
  name: "",
  certType: "ism",
  issuedAt: "",
  expiresAt: "",
  issuingAuthority: "",
  certificateNumber: "",
  notes: "",
};

export default function VesselCertificates() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCert, setEditCert] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; vesselId: number } | null>(null);
  const [form, setForm] = useState({ ...defaultForm });

  const { data: vessels = [], isLoading: vesselsLoading } = useQuery<any[]>({
    queryKey: ["/api/vessels"],
  });

  const { data: expiring = [] } = useQuery<any[]>({
    queryKey: ["/api/certificates/expiring"],
    queryFn: async () => {
      const res = await fetch("/api/certificates/expiring?days=30");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const certsByVessel = useQuery<Record<number, any[]>>({
    queryKey: ["/api/certificates/all", vessels.map((v: any) => v.id)],
    queryFn: async () => {
      const results: Record<number, any[]> = {};
      await Promise.all(
        vessels.map(async (v: any) => {
          const res = await fetch(`/api/vessels/${v.id}/certificates`);
          if (res.ok) results[v.id] = await res.json();
          else results[v.id] = [];
        })
      );
      return results;
    },
    enabled: vessels.length > 0,
  });

  const openAdd = (vesselId: number) => {
    setEditCert({ vesselId, id: null });
    setForm({ ...defaultForm });
    setDialogOpen(true);
  };

  const openEdit = (cert: any) => {
    setEditCert(cert);
    setForm({
      name: cert.name || "",
      certType: cert.certType || "ism",
      issuedAt: cert.issuedAt ? cert.issuedAt.substring(0, 10) : "",
      expiresAt: cert.expiresAt ? cert.expiresAt.substring(0, 10) : "",
      issuingAuthority: cert.issuingAuthority || "",
      certificateNumber: cert.certificateNumber || "",
      notes: cert.notes || "",
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        issuedAt: form.issuedAt || null,
        expiresAt: form.expiresAt || null,
        issuingAuthority: form.issuingAuthority || null,
        certificateNumber: form.certificateNumber || null,
        notes: form.notes || null,
      };
      if (editCert?.id) {
        return apiRequest("PATCH", `/api/vessels/${editCert.vesselId}/certificates/${editCert.id}`, payload);
      } else {
        return apiRequest("POST", `/api/vessels/${editCert.vesselId}/certificates`, payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/expiring"] });
      toast({ title: editCert?.id ? "Certificate updated" : "Certificate added" });
      setDialogOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Operation failed", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, vesselId }: { id: number; vesselId: number }) => {
      return apiRequest("DELETE", `/api/vessels/${vesselId}/certificates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/certificates/expiring"] });
      toast({ title: "Certificate deleted" });
      setDeleteTarget(null);
    },
  });

  if (vesselsLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <PageMeta title="Vessel Certificates | VesselPDA" description="Vessel certificate tracking and management" />

      <div className="flex items-center gap-3">
        <BadgeCheck className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground font-serif">Vessel Certificates</h1>
          <p className="text-sm text-muted-foreground">Track all certificates and monitor upcoming expiry dates</p>
        </div>
      </div>

      {expiring.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">Certificates expiring soon!</p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {expiring.length} certificate(s) will expire within 30 days. Please contact the relevant authorities.
            </p>
          </div>
        </div>
      )}

      {vessels.length === 0 ? (
        <EmptyState
          icon="📜"
          title="No Certificates"
          description="Track vessel certificates and get alerts before they expire."
          actionLabel="Add Certificate"
          actionHref="/vessels"
          tips={[
            "Add vessels to your fleet first to manage their certificates",
            "Upload digital copies for easy access during port calls",
            "Set up expiry alerts to never miss a renewal"
          ]}
        />
      ) : (
        <div className="space-y-6">
          {vessels.map((vessel: any) => {
            const certs = certsByVessel.data?.[vessel.id] || [];
            return (
              <Card key={vessel.id} className="overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-muted/40 border-b">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">{vessel.name}</span>
                    <span className="text-xs text-muted-foreground">{vessel.imoNumber ? `IMO: ${vessel.imoNumber}` : ""}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openAdd(vessel.id)} data-testid={`button-add-cert-${vessel.id}`}>
                    <Plus className="w-4 h-4 mr-1" />Add Certificate
                  </Button>
                </div>

                {certs.length === 0 ? (
                  <div className="px-5 py-6 text-center text-sm text-muted-foreground">No certificates added for this vessel yet</div>
                ) : (
                  <div className="divide-y">
                    {certs.map((cert: any) => (
                      <div key={cert.id} className="flex items-start justify-between px-5 py-4 hover:bg-muted/20 transition-colors" data-testid={`cert-row-${cert.id}`}>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{cert.name}</span>
                            <Badge className={CERT_TYPE_COLORS[cert.certType] || CERT_TYPE_COLORS.other}>
                              {CERT_TYPES[cert.certType] || cert.certType}
                            </Badge>
                            {statusBadge(cert.status, cert.expiresAt)}
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            {cert.certificateNumber && <span>No: {cert.certificateNumber}</span>}
                            {cert.issuingAuthority && <span>Authority: {cert.issuingAuthority}</span>}
                            {cert.issuedAt && <span>Issued: {formatDate(cert.issuedAt)}</span>}
                            {cert.expiresAt && <span>Expires: {formatDate(cert.expiresAt)}</span>}
                          </div>
                          {cert.notes && <p className="text-xs text-muted-foreground italic">{cert.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1 ml-4 shrink-0">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(cert)} data-testid={`button-edit-cert-${cert.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ id: cert.id, vesselId: vessel.id })} data-testid={`button-delete-cert-${cert.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editCert?.id ? "Edit Certificate" : "Add New Certificate"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Certificate Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. ISM Safety Management Certificate" data-testid="input-cert-name" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.certType} onValueChange={v => setForm(f => ({ ...f, certType: v }))}>
                  <SelectTrigger data-testid="select-cert-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CERT_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Certificate No.</Label>
                <Input value={form.certificateNumber} onChange={e => setForm(f => ({ ...f, certificateNumber: e.target.value }))} placeholder="optional" data-testid="input-cert-number" />
              </div>
              <div>
                <Label>Issue Date</Label>
                <Input type="date" value={form.issuedAt} onChange={e => setForm(f => ({ ...f, issuedAt: e.target.value }))} data-testid="input-cert-issued" />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} data-testid="input-cert-expires" />
              </div>
              <div className="col-span-2">
                <Label>Issuing Authority</Label>
                <Input value={form.issuingAuthority} onChange={e => setForm(f => ({ ...f, issuingAuthority: e.target.value }))} placeholder="e.g. Turkish Lloyd, DNV, Lloyd's Register..." data-testid="input-cert-authority" />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="optional" data-testid="textarea-cert-notes" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending} data-testid="button-save-cert">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Certificate</AlertDialogTitle>
            <AlertDialogDescription>This certificate will be permanently deleted. Do you want to continue?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)} data-testid="button-confirm-delete-cert">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
