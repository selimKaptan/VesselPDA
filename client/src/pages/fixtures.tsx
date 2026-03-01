import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Handshake, Plus, Trash2, FileText, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  negotiating: { label: "Müzakere", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  fixed:       { label: "Sabitlendi", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  failed:      { label: "Başarısız", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  cancelled:   { label: "İptal", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
};

const UNIT_OPTIONS = ["MT", "CBM", "TEU", "Units"];
const CURRENCY_OPTIONS = ["USD", "EUR", "TRY"];

function formatDate(dt: string | null) {
  if (!dt) return null;
  return new Date(dt).toLocaleDateString("tr-TR");
}

const defaultForm = {
  vesselName: "",
  imoNumber: "",
  cargoType: "",
  cargoQuantity: "",
  quantityUnit: "MT",
  loadingPort: "",
  dischargePort: "",
  laycanFrom: "",
  laycanTo: "",
  freightRate: "",
  freightCurrency: "USD",
  charterer: "",
  shipowner: "",
  brokerCommission: "",
  notes: "",
};

export default function Fixtures() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [recapDialogOpen, setRecapDialogOpen] = useState(false);
  const [recapFixture, setRecapFixture] = useState<any>(null);
  const [recapText, setRecapText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [form, setForm] = useState({ ...defaultForm });

  const { data: fixtures = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/fixtures"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/fixtures", {
        ...form,
        cargoQuantity: form.cargoQuantity ? parseFloat(form.cargoQuantity) : null,
        freightRate: form.freightRate ? parseFloat(form.freightRate) : null,
        brokerCommission: form.brokerCommission ? parseFloat(form.brokerCommission) : null,
        imoNumber: form.imoNumber || null,
        charterer: form.charterer || null,
        shipowner: form.shipowner || null,
        notes: form.notes || null,
        laycanFrom: form.laycanFrom || null,
        laycanTo: form.laycanTo || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixtures"] });
      toast({ title: "Fixture oluşturuldu" });
      setDialogOpen(false);
      setForm({ ...defaultForm });
    },
    onError: () => toast({ title: "Hata", description: "İşlem başarısız", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PATCH", `/api/fixtures/${id}`, { status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/fixtures"] }),
  });

  const recapMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/fixtures/${recapFixture.id}`, { recapText });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixtures"] });
      toast({ title: "Recap kaydedildi" });
      setRecapDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/fixtures/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fixtures"] });
      toast({ title: "Fixture silindi" });
      setDeleteTarget(null);
    },
  });

  const openRecap = (fx: any) => {
    setRecapFixture(fx);
    setRecapText(fx.recapText || "");
    setRecapDialogOpen(true);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <PageMeta title="Fixture Yönetimi | VesselPDA" description="Charter fixture ve recap takibi" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Handshake className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground font-serif">Fixture Yönetimi</h1>
            <p className="text-sm text-muted-foreground">Charter müzakerelerinizi ve fixturelerinizi takip edin</p>
          </div>
        </div>
        <Button onClick={() => { setForm({ ...defaultForm }); setDialogOpen(true); }} data-testid="button-new-fixture">
          <Plus className="w-4 h-4 mr-1" />Yeni Fixture
        </Button>
      </div>

      {fixtures.length === 0 ? (
        <Card className="p-12 text-center">
          <Handshake className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Henüz fixture eklenmemiş</p>
          <Button className="mt-4" onClick={() => setDialogOpen(true)}>İlk Fixture'ı Ekle</Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {fixtures.map((fx: any) => (
            <Card key={fx.id} className="p-5" data-testid={`fixture-card-${fx.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{fx.vesselName}</span>
                    {fx.imoNumber && <span className="text-xs text-muted-foreground">IMO: {fx.imoNumber}</span>}
                    <Badge className={STATUS_CONFIG[fx.status]?.color || ""}>
                      {STATUS_CONFIG[fx.status]?.label || fx.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{fx.loadingPort}</span>
                    <span className="mx-2">→</span>
                    <span className="font-medium text-foreground">{fx.dischargePort}</span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>Kargo: {fx.cargoType}{fx.cargoQuantity ? ` — ${fx.cargoQuantity} ${fx.quantityUnit}` : ""}</span>
                    {fx.freightRate && <span>Navlun: {fx.freightRate} {fx.freightCurrency}</span>}
                    {fx.brokerCommission && <span>Komisyon: %{fx.brokerCommission}</span>}
                    {fx.laycanFrom && <span>Laycan: {formatDate(fx.laycanFrom)}{fx.laycanTo ? ` – ${formatDate(fx.laycanTo)}` : ""}</span>}
                    {fx.charterer && <span>Charterer: {fx.charterer}</span>}
                    {fx.shipowner && <span>Armatör: {fx.shipowner}</span>}
                  </div>
                  {fx.notes && <p className="text-xs text-muted-foreground italic">{fx.notes}</p>}
                  {fx.recapText && (
                    <div className="mt-2 p-2.5 bg-muted/40 rounded text-xs text-muted-foreground border-l-2 border-primary/40">
                      <span className="font-medium text-foreground block mb-0.5">Recap:</span>
                      <span className="whitespace-pre-wrap">{fx.recapText.length > 200 ? fx.recapText.substring(0, 200) + "..." : fx.recapText}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openRecap(fx)} data-testid={`button-recap-${fx.id}`}>
                    <FileText className="w-3.5 h-3.5 mr-1" />Recap
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" data-testid={`button-status-${fx.id}`}>
                        Durum <ChevronDown className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <DropdownMenuItem key={k} onClick={() => statusMutation.mutate({ id: fx.id, status: k })}>
                          {v.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(fx.id)} data-testid={`button-delete-fixture-${fx.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Fixture</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div>
              <Label>Gemi Adı *</Label>
              <Input value={form.vesselName} onChange={e => setForm(f => ({ ...f, vesselName: e.target.value }))} placeholder="M/V ..." data-testid="input-vessel-name" />
            </div>
            <div>
              <Label>IMO No</Label>
              <Input value={form.imoNumber} onChange={e => setForm(f => ({ ...f, imoNumber: e.target.value }))} placeholder="opsiyonel" data-testid="input-imo-number" />
            </div>
            <div>
              <Label>Kargo Tipi *</Label>
              <Input value={form.cargoType} onChange={e => setForm(f => ({ ...f, cargoType: e.target.value }))} placeholder="örn. Buğday, Konteyner..." data-testid="input-cargo-type" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Miktar</Label>
                <Input type="number" value={form.cargoQuantity} onChange={e => setForm(f => ({ ...f, cargoQuantity: e.target.value }))} placeholder="0" data-testid="input-cargo-qty" />
              </div>
              <div className="w-24">
                <Label>Birim</Label>
                <Select value={form.quantityUnit} onValueChange={v => setForm(f => ({ ...f, quantityUnit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Yükleme Limanı *</Label>
              <Input value={form.loadingPort} onChange={e => setForm(f => ({ ...f, loadingPort: e.target.value }))} placeholder="örn. İzmir" data-testid="input-loading-port" />
            </div>
            <div>
              <Label>Tahliye Limanı *</Label>
              <Input value={form.dischargePort} onChange={e => setForm(f => ({ ...f, dischargePort: e.target.value }))} placeholder="örn. Hamburg" data-testid="input-discharge-port" />
            </div>
            <div>
              <Label>Laycan Başlangıç</Label>
              <Input type="date" value={form.laycanFrom} onChange={e => setForm(f => ({ ...f, laycanFrom: e.target.value }))} data-testid="input-laycan-from" />
            </div>
            <div>
              <Label>Laycan Bitiş</Label>
              <Input type="date" value={form.laycanTo} onChange={e => setForm(f => ({ ...f, laycanTo: e.target.value }))} data-testid="input-laycan-to" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Navlun</Label>
                <Input type="number" value={form.freightRate} onChange={e => setForm(f => ({ ...f, freightRate: e.target.value }))} placeholder="0" data-testid="input-freight-rate" />
              </div>
              <div className="w-24">
                <Label>Para Birimi</Label>
                <Select value={form.freightCurrency} onValueChange={v => setForm(f => ({ ...f, freightCurrency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Charterer</Label>
              <Input value={form.charterer} onChange={e => setForm(f => ({ ...f, charterer: e.target.value }))} placeholder="opsiyonel" data-testid="input-charterer" />
            </div>
            <div>
              <Label>Armatör</Label>
              <Input value={form.shipowner} onChange={e => setForm(f => ({ ...f, shipowner: e.target.value }))} placeholder="opsiyonel" data-testid="input-shipowner" />
            </div>
            <div>
              <Label>Broker Komisyonu (%)</Label>
              <Input type="number" value={form.brokerCommission} onChange={e => setForm(f => ({ ...f, brokerCommission: e.target.value }))} placeholder="örn. 1.25" data-testid="input-broker-commission" />
            </div>
            <div className="col-span-2">
              <Label>Notlar</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="opsiyonel" data-testid="textarea-fixture-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.vesselName || !form.cargoType || !form.loadingPort || !form.dischargePort || createMutation.isPending} data-testid="button-save-fixture">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recapDialogOpen} onOpenChange={setRecapDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Recap — {recapFixture?.vesselName}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>Recap Metni</Label>
            <Textarea
              value={recapText}
              onChange={e => setRecapText(e.target.value)}
              rows={12}
              placeholder="Müzakere edilen tüm şartları buraya yazın (CP tarihi, navlun, demurraj, dispatch, liman, brokerlar vb.)"
              className="font-mono text-sm"
              data-testid="textarea-recap-text"
            />
            <p className="text-xs text-muted-foreground mt-1">Bu alan serbest metin — charter party şartlarını istediğiniz formatta yazabilirsiniz.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecapDialogOpen(false)}>İptal</Button>
            <Button onClick={() => recapMutation.mutate()} disabled={recapMutation.isPending} data-testid="button-save-recap">
              {recapMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fixture Sil</AlertDialogTitle>
            <AlertDialogDescription>Bu fixture kalıcı olarak silinecek. Devam edilsin mi?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteTarget !== null && deleteMutation.mutate(deleteTarget)} data-testid="button-confirm-delete-fixture">
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
