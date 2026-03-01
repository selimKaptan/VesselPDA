import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Package, Plus, Trash2, X, Loader2, ArrowRight, Mail, User } from "lucide-react";
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
import { useAuth } from "@/hooks/use-auth";

const UNIT_OPTIONS = ["MT", "CBM", "TEU", "Units", "BBL", "Lot"];

function formatDate(dt: string | null) {
  if (!dt) return null;
  return new Date(dt).toLocaleDateString("tr-TR");
}

const defaultForm = {
  positionType: "cargo" as "cargo" | "vessel",
  title: "",
  description: "",
  vesselType: "",
  cargoType: "",
  quantity: "",
  quantityUnit: "MT",
  loadingPort: "",
  dischargePort: "",
  laycanFrom: "",
  laycanTo: "",
  contactName: "",
  contactEmail: "",
  expiresAt: "",
};

type FilterType = "all" | "cargo" | "vessel";

export default function CargoPositions() {
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = (user as any)?.id || (user as any)?.claims?.sub;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [form, setForm] = useState({ ...defaultForm });

  const { data: positions = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/cargo-positions"],
  });

  const { data: myPositions = [] } = useQuery<any[]>({
    queryKey: ["/api/cargo-positions/mine"],
    queryFn: async () => {
      const res = await fetch("/api/cargo-positions/mine");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/cargo-positions", {
        ...form,
        quantity: form.quantity ? parseFloat(form.quantity) : null,
        vesselType: form.vesselType || null,
        cargoType: form.cargoType || null,
        quantityUnit: form.quantityUnit || null,
        description: form.description || null,
        laycanFrom: form.laycanFrom || null,
        laycanTo: form.laycanTo || null,
        contactName: form.contactName || null,
        contactEmail: form.contactEmail || null,
        expiresAt: form.expiresAt || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargo-positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cargo-positions/mine"] });
      toast({ title: "İlan yayınlandı" });
      setDialogOpen(false);
      setForm({ ...defaultForm });
    },
    onError: () => toast({ title: "Hata", description: "İlan yayınlanamadı", variant: "destructive" }),
  });

  const closeMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("PATCH", `/api/cargo-positions/${id}`, { status: "closed" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargo-positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cargo-positions/mine"] });
      toast({ title: "İlan kapatıldı" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/cargo-positions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargo-positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cargo-positions/mine"] });
      toast({ title: "İlan silindi" });
      setDeleteTarget(null);
    },
  });

  const myPositionIds = new Set(myPositions.map((p: any) => p.id));

  const filtered = positions.filter((p: any) => {
    if (filter === "cargo") return p.positionType === "cargo";
    if (filter === "vessel") return p.positionType === "vessel";
    return true;
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <PageMeta title="Kargo & Pozisyon İlanları | VesselPDA" description="Kargo ve gemi pozisyon ilan panosu" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground font-serif">Kargo & Pozisyon Panosu</h1>
            <p className="text-sm text-muted-foreground">Kargo veya gemi arayın, pozisyon ilanı verin</p>
          </div>
        </div>
        <Button onClick={() => { setForm({ ...defaultForm }); setDialogOpen(true); }} data-testid="button-new-position">
          <Plus className="w-4 h-4 mr-1" />İlan Ver
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {(["all", "cargo", "vessel"] as FilterType[]).map(f => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            data-testid={`filter-${f}`}
          >
            {f === "all" ? "Tümü" : f === "cargo" ? "Kargo İlanı" : "Gemi İlanı"}
          </Button>
        ))}
        <span className="text-sm text-muted-foreground ml-2">{filtered.length} ilan</span>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Bu kategoride aktif ilan bulunamadı</p>
          <Button className="mt-4" onClick={() => setDialogOpen(true)}>İlk İlanı Ver</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((pos: any) => {
            const isMine = myPositionIds.has(pos.id);
            return (
              <Card key={pos.id} className="p-4 flex flex-col gap-3" data-testid={`position-card-${pos.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={pos.positionType === "cargo"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}>
                        {pos.positionType === "cargo" ? "Kargo İlanı" : "Gemi İlanı"}
                      </Badge>
                      {isMine && <Badge variant="outline" className="text-xs">Benim</Badge>}
                    </div>
                    <h3 className="font-semibold text-sm leading-snug">{pos.title}</h3>
                  </div>
                  {isMine && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => closeMutation.mutate(pos.id)} title="İlanı Kapat" data-testid={`button-close-pos-${pos.id}`}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(pos.id)} data-testid={`button-delete-pos-${pos.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span>{pos.loadingPort}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{pos.dischargePort}</span>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  {pos.cargoType && <div>Kargo: <span className="text-foreground">{pos.cargoType}{pos.quantity ? ` — ${pos.quantity} ${pos.quantityUnit || ""}` : ""}</span></div>}
                  {pos.vesselType && <div>Gemi Tipi: <span className="text-foreground">{pos.vesselType}</span></div>}
                  {(pos.laycanFrom || pos.laycanTo) && (
                    <div>Laycan: <span className="text-foreground">{formatDate(pos.laycanFrom)}{pos.laycanTo ? ` – ${formatDate(pos.laycanTo)}` : ""}</span></div>
                  )}
                  {pos.expiresAt && <div>Geçerlilik: <span className="text-foreground">{formatDate(pos.expiresAt)}</span></div>}
                </div>

                {pos.description && <p className="text-xs text-muted-foreground line-clamp-2">{pos.description}</p>}

                {(pos.contactName || pos.contactEmail) && (
                  <div className="pt-2 mt-auto border-t border-border/50 space-y-1">
                    {pos.contactName && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span>{pos.contactName}</span>
                      </div>
                    )}
                    {pos.contactEmail && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <a href={`mailto:${pos.contactEmail}`} className="text-primary hover:underline">{pos.contactEmail}</a>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Pozisyon İlanı</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>İlan Tipi</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  size="sm"
                  variant={form.positionType === "cargo" ? "default" : "outline"}
                  onClick={() => setForm(f => ({ ...f, positionType: "cargo" }))}
                  data-testid="toggle-cargo"
                >
                  Kargo İlanı
                </Button>
                <Button
                  size="sm"
                  variant={form.positionType === "vessel" ? "default" : "outline"}
                  onClick={() => setForm(f => ({ ...f, positionType: "vessel" }))}
                  data-testid="toggle-vessel"
                >
                  Gemi İlanı
                </Button>
              </div>
            </div>
            <div>
              <Label>Başlık *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="örn. 3000 MT Buğday arıyor, İzmir - Hamburg" data-testid="input-position-title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Yükleme Limanı *</Label>
                <Input value={form.loadingPort} onChange={e => setForm(f => ({ ...f, loadingPort: e.target.value }))} placeholder="örn. İzmir" data-testid="input-pos-loading-port" />
              </div>
              <div>
                <Label>Tahliye Limanı *</Label>
                <Input value={form.dischargePort} onChange={e => setForm(f => ({ ...f, dischargePort: e.target.value }))} placeholder="örn. Hamburg" data-testid="input-pos-discharge-port" />
              </div>
              {form.positionType === "cargo" && (
                <>
                  <div>
                    <Label>Kargo Tipi</Label>
                    <Input value={form.cargoType} onChange={e => setForm(f => ({ ...f, cargoType: e.target.value }))} placeholder="örn. Buğday, Mısır..." data-testid="input-pos-cargo-type" />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label>Miktar</Label>
                      <Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" data-testid="input-pos-qty" />
                    </div>
                    <div className="w-24">
                      <Label>Birim</Label>
                      <Select value={form.quantityUnit} onValueChange={v => setForm(f => ({ ...f, quantityUnit: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
              {form.positionType === "vessel" && (
                <div>
                  <Label>Gemi Tipi</Label>
                  <Input value={form.vesselType} onChange={e => setForm(f => ({ ...f, vesselType: e.target.value }))} placeholder="örn. Bulk Carrier, Tanker..." data-testid="input-vessel-type" />
                </div>
              )}
              <div>
                <Label>Laycan Başlangıç</Label>
                <Input type="date" value={form.laycanFrom} onChange={e => setForm(f => ({ ...f, laycanFrom: e.target.value }))} data-testid="input-pos-laycan-from" />
              </div>
              <div>
                <Label>Laycan Bitiş</Label>
                <Input type="date" value={form.laycanTo} onChange={e => setForm(f => ({ ...f, laycanTo: e.target.value }))} data-testid="input-pos-laycan-to" />
              </div>
              <div>
                <Label>İletişim Adı</Label>
                <Input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="opsiyonel" data-testid="input-contact-name" />
              </div>
              <div>
                <Label>İletişim E-posta</Label>
                <Input type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} placeholder="opsiyonel" data-testid="input-contact-email" />
              </div>
              <div>
                <Label>İlan Geçerlilik Tarihi</Label>
                <Input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} data-testid="input-pos-expires" />
              </div>
            </div>
            <div>
              <Label>Açıklama</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Ek bilgiler, özel koşullar vb. (opsiyonel)" data-testid="textarea-pos-description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.title || !form.loadingPort || !form.dischargePort || createMutation.isPending} data-testid="button-save-position">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yayınla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İlanı Sil</AlertDialogTitle>
            <AlertDialogDescription>Bu ilan kalıcı olarak silinecek.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteTarget !== null && deleteMutation.mutate(deleteTarget)} data-testid="button-confirm-delete-pos">
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
