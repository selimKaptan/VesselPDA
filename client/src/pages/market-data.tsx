import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, Minus, Fuel, ArrowRight, Info,
  Ship, Anchor, Package, RefreshCw, Edit2, Trash2, Plus, Loader2
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { useAuth } from "@/hooks/use-auth";

type FreightIndex = {
  code: string;
  name: string;
  description: string;
  value: number;
  change: number;
  changePct: number;
  previousClose: number;
};

type FreightData = {
  indices: FreightIndex[];
  lastUpdated: string;
  source: string;
  cached: boolean;
};

type BunkerPrice = {
  id: number;
  portName: string;
  portCode: string | null;
  region: string;
  ifo380: number | null;
  vlsfo: number | null;
  mgo: number | null;
  updatedAt: string;
};

const defaultBunkerForm = {
  portName: "",
  portCode: "",
  region: "TR",
  ifo380: "",
  vlsfo: "",
  mgo: "",
};

const REGION_LABELS: Record<string, string> = {
  TR: "Türkiye",
  EU: "Avrupa",
  ASIA: "Asya",
  ME: "Orta Doğu",
  US: "Amerika",
};

function FreightIndexCard({ index, loading }: { index?: FreightIndex; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-4 w-24" />
        </CardContent>
      </Card>
    );
  }
  if (!index) return null;

  const positive = index.change > 0;
  const neutral = index.change === 0;

  return (
    <Card data-testid={`card-freight-${index.code}`} className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{index.code}</p>
            <p className="text-sm font-medium text-foreground">{index.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{index.description}</p>
          </div>
          {neutral ? (
            <Minus className="w-5 h-5 text-muted-foreground mt-1" />
          ) : positive ? (
            <TrendingUp className="w-5 h-5 text-emerald-500 mt-1" />
          ) : (
            <TrendingDown className="w-5 h-5 text-red-500 mt-1" />
          )}
        </div>

        <p className="text-4xl font-bold text-foreground tabular-nums">
          {index.value.toLocaleString("tr-TR")}
        </p>

        <div className="flex items-center gap-2 mt-2">
          <span className={`text-sm font-semibold ${neutral ? "text-muted-foreground" : positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {positive ? "+" : ""}{index.change.toLocaleString("tr-TR")}
          </span>
          <Badge
            variant="outline"
            className={`text-xs px-1.5 py-0 ${neutral ? "text-muted-foreground border-muted" : positive ? "text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950" : "text-red-600 border-red-300 bg-red-50 dark:bg-red-950"}`}
          >
            {positive ? "+" : ""}{index.changePct.toFixed(2)}%
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Önceki kapanış: {index.previousClose.toLocaleString("tr-TR")}
        </p>
      </CardContent>
    </Card>
  );
}

export default function MarketData() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = (user as any)?.userRole === "admin";

  const [bunkerDialog, setBunkerDialog] = useState(false);
  const [editBunker, setEditBunker] = useState<BunkerPrice | null>(null);
  const [bunkerForm, setBunkerForm] = useState({ ...defaultBunkerForm });
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { data: freightData, isLoading: freightLoading } = useQuery<FreightData>({
    queryKey: ["/api/market/freight-indices"],
    staleTime: 15 * 60 * 1000,
  });

  const { data: bunkerPrices = [], isLoading: bunkerLoading } = useQuery<BunkerPrice[]>({
    queryKey: ["/api/market/bunker-prices"],
  });

  const addBunkerMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/bunker-prices", {
      portName: bunkerForm.portName,
      portCode: bunkerForm.portCode || null,
      region: bunkerForm.region,
      ifo380: bunkerForm.ifo380 ? parseFloat(bunkerForm.ifo380) : null,
      vlsfo: bunkerForm.vlsfo ? parseFloat(bunkerForm.vlsfo) : null,
      mgo: bunkerForm.mgo ? parseFloat(bunkerForm.mgo) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/bunker-prices"] });
      toast({ title: "Bunker fiyatı eklendi" });
      setBunkerDialog(false);
      setBunkerForm({ ...defaultBunkerForm });
      setEditBunker(null);
    },
    onError: () => toast({ title: "Hata", description: "Fiyat eklenemedi", variant: "destructive" }),
  });

  const editBunkerMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/bunker-prices/${id}`, {
      portName: bunkerForm.portName,
      portCode: bunkerForm.portCode || null,
      region: bunkerForm.region,
      ifo380: bunkerForm.ifo380 ? parseFloat(bunkerForm.ifo380) : null,
      vlsfo: bunkerForm.vlsfo ? parseFloat(bunkerForm.vlsfo) : null,
      mgo: bunkerForm.mgo ? parseFloat(bunkerForm.mgo) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/bunker-prices"] });
      toast({ title: "Bunker fiyatı güncellendi" });
      setBunkerDialog(false);
      setBunkerForm({ ...defaultBunkerForm });
      setEditBunker(null);
    },
    onError: () => toast({ title: "Hata", description: "Güncellenemedi", variant: "destructive" }),
  });

  const deleteBunkerMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/bunker-prices/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/bunker-prices"] });
      toast({ title: "Silindi" });
      setDeleteTarget(null);
    },
  });

  function openEdit(row: BunkerPrice) {
    setEditBunker(row);
    setBunkerForm({
      portName: row.portName,
      portCode: row.portCode ?? "",
      region: row.region,
      ifo380: row.ifo380?.toString() ?? "",
      vlsfo: row.vlsfo?.toString() ?? "",
      mgo: row.mgo?.toString() ?? "",
    });
    setBunkerDialog(true);
  }

  function openAdd() {
    setEditBunker(null);
    setBunkerForm({ ...defaultBunkerForm });
    setBunkerDialog(true);
  }

  const sortedBunker = [...bunkerPrices].sort((a, b) => {
    const regionOrder: Record<string, number> = { TR: 0, EU: 1, ASIA: 2, ME: 3, US: 4 };
    return (regionOrder[a.region] ?? 5) - (regionOrder[b.region] ?? 5);
  });

  const lastUpdated = freightData?.lastUpdated
    ? new Date(freightData.lastUpdated).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="p-4 md:p-6 space-y-8 max-w-7xl mx-auto">
      <PageMeta title="Piyasa Verileri | VesselPDA" />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Piyasa Verileri
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Güncel navlun endeksleri ve liman bazlı bunker fiyatları
          </p>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
            Son güncelleme: {lastUpdated}
          </div>
        )}
      </div>

      {freightData?.source === "Fallback" && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm">
          <Info className="w-4 h-4 shrink-0" />
          Anlık endeks verisi alınamıyor. Referans değerler gösteriliyor.
        </div>
      )}

      {/* Freight Index Cards */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Navlun Endeksleri</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {freightLoading ? (
            [0, 1, 2].map(i => <FreightIndexCard key={i} loading={true} />)
          ) : (
            freightData?.indices.map(idx => (
              <FreightIndexCard key={idx.code} index={idx} loading={false} />
            ))
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Kaynak: {freightData?.source ?? "—"} · Veriler günlük kapanışa göredir, yatırım tavsiyesi değildir.
        </p>
      </section>

      {/* Bunker Prices */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Bunker Yakıt Fiyatları</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground">
                    <Info className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs space-y-1 p-3">
                  <p><strong>IFO 380</strong> — High Sulfur Fuel Oil (HSFO), geleneksel ağır yakıt</p>
                  <p><strong>VLSFO</strong> — Very Low Sulfur Fuel Oil, IMO 2020 uyumlu &lt;0.5% kükürt</p>
                  <p><strong>MGO</strong> — Marine Gas Oil, distilat yakıt, ECA bölgeleri için</p>
                  <p className="text-muted-foreground pt-1">Fiyatlar USD/MT cinsinden yaklaşık değerlerdir.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={openAdd} data-testid="button-add-bunker" className="gap-1.5">
              <Plus className="w-4 h-4" /> Fiyat Ekle
            </Button>
          )}
        </div>

        <Card data-testid="table-bunker-prices">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-3 font-medium text-muted-foreground">Liman</th>
                  <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Bölge</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">
                    <span className="flex items-center justify-end gap-1">IFO 380</span>
                  </th>
                  <th className="text-right p-3 font-medium text-muted-foreground">VLSFO</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">MGO</th>
                  <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">Güncelleme</th>
                  {isAdmin && <th className="p-3 w-16" />}
                </tr>
              </thead>
              <tbody>
                {bunkerLoading ? (
                  [0, 1, 2, 3, 4].map(i => (
                    <tr key={i} className="border-b">
                      <td className="p-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="p-3 hidden sm:table-cell"><Skeleton className="h-4 w-16" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-14 ml-auto" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-14 ml-auto" /></td>
                      <td className="p-3"><Skeleton className="h-4 w-14 ml-auto" /></td>
                      <td className="p-3 hidden md:table-cell"><Skeleton className="h-4 w-20 ml-auto" /></td>
                    </tr>
                  ))
                ) : sortedBunker.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="p-6 text-center text-muted-foreground">
                      Bunker fiyatı bulunamadı
                    </td>
                  </tr>
                ) : (
                  sortedBunker.map((row) => (
                    <tr key={row.id} data-testid={`row-bunker-${row.id}`} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Fuel className="w-3.5 h-3.5 text-muted-foreground" />
                          {row.portName}
                          {row.portCode && (
                            <span className="text-xs text-muted-foreground">({row.portCode})</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 hidden sm:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {REGION_LABELS[row.region] ?? row.region}
                        </Badge>
                      </td>
                      <td className="p-3 text-right tabular-nums text-foreground">
                        {row.ifo380 != null ? `$${row.ifo380.toLocaleString("tr-TR")}` : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums text-foreground">
                        {row.vlsfo != null ? `$${row.vlsfo.toLocaleString("tr-TR")}` : "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums text-foreground">
                        {row.mgo != null ? `$${row.mgo.toLocaleString("tr-TR")}` : "—"}
                      </td>
                      <td className="p-3 text-right text-xs text-muted-foreground hidden md:table-cell">
                        {new Date(row.updatedAt).toLocaleDateString("tr-TR")}
                      </td>
                      {isAdmin && (
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEdit(row)} data-testid={`button-edit-bunker-${row.id}`}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(row.id)} data-testid={`button-delete-bunker-${row.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground p-3 border-t">
            Fiyatlar USD/MT cinsinden yaklaşık piyasa değerleridir. Son güncelleme tarihleri limanlar arası farklılık gösterebilir.
          </p>
        </Card>
      </section>

      {/* Quick Links */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Hızlı Erişim</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/cargo-positions" data-testid="link-quick-cargo">
            <Card className="hover:shadow-md transition-shadow cursor-pointer hover:border-primary/40 group">
              <CardContent className="pt-5 pb-5 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-foreground">Kargo & Pozisyon Panosu</p>
                  <p className="text-xs text-muted-foreground">Aktif kargo ve gemi ilanları</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/fixtures" data-testid="link-quick-fixtures">
            <Card className="hover:shadow-md transition-shadow cursor-pointer hover:border-primary/40 group">
              <CardContent className="pt-5 pb-5 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <Ship className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-foreground">Fixture Yönetimi</p>
                  <p className="text-xs text-muted-foreground">Charter müzakereleri ve recap</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/port-info" data-testid="link-quick-portinfo">
            <Card className="hover:shadow-md transition-shadow cursor-pointer hover:border-primary/40 group">
              <CardContent className="pt-5 pb-5 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                  <Anchor className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-foreground">Port Bilgisi</p>
                  <p className="text-xs text-muted-foreground">Türk limanları ve tarifeler</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* Bunker Price Dialog (Admin) */}
      <Dialog open={bunkerDialog} onOpenChange={v => { setBunkerDialog(v); if (!v) { setBunkerForm({ ...defaultBunkerForm }); setEditBunker(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editBunker ? "Fiyatı Güncelle" : "Yeni Bunker Fiyatı"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Liman Adı *</Label>
                <Input
                  value={bunkerForm.portName}
                  onChange={e => setBunkerForm(f => ({ ...f, portName: e.target.value }))}
                  placeholder="Örn. İstanbul"
                  data-testid="input-bunker-port-name"
                />
              </div>
              <div>
                <Label>LOCODE</Label>
                <Input
                  value={bunkerForm.portCode}
                  onChange={e => setBunkerForm(f => ({ ...f, portCode: e.target.value }))}
                  placeholder="TRIST"
                  data-testid="input-bunker-port-code"
                />
              </div>
              <div>
                <Label>Bölge</Label>
                <Select value={bunkerForm.region} onValueChange={v => setBunkerForm(f => ({ ...f, region: v }))}>
                  <SelectTrigger data-testid="select-bunker-region">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REGION_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>IFO 380 (USD/MT)</Label>
                <Input
                  type="number"
                  value={bunkerForm.ifo380}
                  onChange={e => setBunkerForm(f => ({ ...f, ifo380: e.target.value }))}
                  placeholder="410"
                  data-testid="input-bunker-ifo380"
                />
              </div>
              <div>
                <Label>VLSFO (USD/MT)</Label>
                <Input
                  type="number"
                  value={bunkerForm.vlsfo}
                  onChange={e => setBunkerForm(f => ({ ...f, vlsfo: e.target.value }))}
                  placeholder="545"
                  data-testid="input-bunker-vlsfo"
                />
              </div>
              <div>
                <Label>MGO (USD/MT)</Label>
                <Input
                  type="number"
                  value={bunkerForm.mgo}
                  onChange={e => setBunkerForm(f => ({ ...f, mgo: e.target.value }))}
                  placeholder="715"
                  data-testid="input-bunker-mgo"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBunkerDialog(false)}>İptal</Button>
            <Button
              onClick={() => editBunker ? editBunkerMutation.mutate(editBunker.id) : addBunkerMutation.mutate()}
              disabled={!bunkerForm.portName || addBunkerMutation.isPending || editBunkerMutation.isPending}
              data-testid="button-save-bunker"
            >
              {(addBunkerMutation.isPending || editBunkerMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editBunker ? "Güncelle" : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fiyatı Sil</AlertDialogTitle>
            <AlertDialogDescription>Bu bunker fiyat kaydı silinecek. Emin misiniz?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteBunkerMutation.mutate(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-bunker"
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
