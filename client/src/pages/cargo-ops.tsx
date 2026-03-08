import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Package, Plus, Search, Ship, Calendar, Edit2, Trash2,
  CheckCircle2, Clock, AlertCircle, PlayCircle, XCircle,
  ArrowDown, ArrowUp, RefreshCw, BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCargoOperationSchema, type CargoOperation, type Voyage, type PortCall } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fmtDate, fmtDateTime } from "@/lib/formatDate";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";

const OPERATION_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  loading:     { label: "Yükleme",      icon: ArrowUp,   color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  discharging: { label: "Boşaltma",     icon: ArrowDown, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  bunkering:   { label: "Yakıt İkmali", icon: RefreshCw, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  restowage:   { label: "Yeniden Stivaj", icon: Package, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
};

const STATUS_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  planned:     { label: "Planlandı",    icon: Clock,         color: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
  in_progress: { label: "Devam Ediyor", icon: PlayCircle,    color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  completed:   { label: "Tamamlandı",   icon: CheckCircle2,  color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  cancelled:   { label: "İptal",        icon: XCircle,       color: "text-red-400 bg-red-500/10 border-red-500/20" },
};

const CARGO_TYPES = ["bulk", "general", "container", "tanker", "liquid", "roro", "breakbulk"];
const CARGO_TYPE_LABELS: Record<string, string> = {
  bulk: "Dökme Yük", general: "Genel Kargo", container: "Konteyner",
  tanker: "Tanker", liquid: "Sıvı", roro: "Ro-Ro", breakbulk: "Break Bulk",
};
const UNITS = ["MT", "CBM", "TEU", "BBL", "CTN", "LT", "LOT"];

const formSchema = insertCargoOperationSchema.extend({
  cargoName: z.string().min(1, "Kargo adı gereklidir"),
});

export default function CargoOps() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [opFilter, setOpFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<CargoOperation | null>(null);

  const { data: ops, isLoading } = useQuery<CargoOperation[]>({
    queryKey: ["/api/cargo-operations"],
  });
  const { data: voyages } = useQuery<Voyage[]>({ queryKey: ["/api/voyages"] });
  const { data: portCalls } = useQuery<PortCall[]>({ queryKey: ["/api/port-calls"] });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cargoName: "", cargoType: "bulk", operation: "loading",
      unit: "MT", status: "planned", quantity: undefined,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/cargo-operations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargo-operations"] });
      toast({ title: "Kargo operasyonu oluşturuldu" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => toast({ title: "Hata", description: "Kayıt oluşturulamadı", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/cargo-operations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargo-operations"] });
      toast({ title: "Güncellendi" });
      setIsDialogOpen(false);
      setEditItem(null);
      form.reset();
    },
    onError: () => toast({ title: "Hata", description: "Güncellenemedi", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/cargo-operations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargo-operations"] });
      toast({ title: "Silindi" });
    },
  });

  const quickStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/cargo-operations/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/cargo-operations"] }),
  });

  const openEdit = (item: CargoOperation) => {
    setEditItem(item);
    form.reset({
      cargoName: item.cargoName,
      cargoType: item.cargoType,
      operation: item.operation,
      quantity: item.quantity ?? undefined,
      unit: item.unit,
      blNumber: item.blNumber ?? "",
      hatchNo: item.hatchNo ?? "",
      status: item.status,
      notes: item.notes ?? "",
      voyageId: item.voyageId ?? undefined,
      portCallId: item.portCallId ?? undefined,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filtered = (ops || []).filter(op => {
    const matchSearch = !search || op.cargoName.toLowerCase().includes(search.toLowerCase()) || (op.blNumber || "").toLowerCase().includes(search.toLowerCase());
    const matchOp = opFilter === "all" || op.operation === opFilter;
    const matchStatus = statusFilter === "all" || op.status === statusFilter;
    return matchSearch && matchOp && matchStatus;
  });

  const totalLoaded = (ops || []).filter(o => o.operation === "loading" && o.status === "completed").reduce((s, o) => s + (o.quantity || 0), 0);
  const totalDischarged = (ops || []).filter(o => o.operation === "discharging" && o.status === "completed").reduce((s, o) => s + (o.quantity || 0), 0);
  const inProgress = (ops || []).filter(o => o.status === "in_progress").length;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Package className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Kargo Operasyonları</h1>
            <p className="text-slate-400 text-sm">Yükleme, boşaltma ve kargo takibi</p>
          </div>
        </div>
        <Button
          data-testid="btn-add-cargo-op"
          onClick={() => { setEditItem(null); form.reset(); setIsDialogOpen(true); }}
          className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          Yeni Operasyon
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-emerald-400">{totalLoaded.toLocaleString()} MT</div>
            <div className="text-sm text-slate-400 flex items-center gap-1"><ArrowUp className="h-3 w-3" />Toplam Yüklenen</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-blue-400">{totalDischarged.toLocaleString()} MT</div>
            <div className="text-sm text-slate-400 flex items-center gap-1"><ArrowDown className="h-3 w-3" />Toplam Boşaltılan</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-amber-400">{inProgress}</div>
            <div className="text-sm text-slate-400 flex items-center gap-1"><PlayCircle className="h-3 w-3" />Devam Eden</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                data-testid="input-search-cargo"
                placeholder="Kargo adı veya B/L No ara..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-slate-900/50 border-slate-600 text-white"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={opFilter} onValueChange={setOpFilter}>
                <SelectTrigger data-testid="filter-operation" className="w-36 bg-slate-900/50 border-slate-600 text-slate-300">
                  <SelectValue placeholder="Operasyon" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Operasyonlar</SelectItem>
                  {Object.entries(OPERATION_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="filter-status-cargo" className="w-36 bg-slate-900/50 border-slate-600 text-slate-300">
                  <SelectValue placeholder="Durum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Durumlar</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full bg-slate-700" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Kargo operasyonu bulunamadı</p>
              <p className="text-sm mt-1">Yeni operasyon eklemek için butona tıklayın</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(op => {
                const opInfo = OPERATION_LABELS[op.operation] || { label: op.operation, icon: Package, color: "" };
                const stInfo = STATUS_LABELS[op.status] || { label: op.status, icon: Clock, color: "" };
                const OpIcon = opInfo.icon;
                const StIcon = stInfo.icon;
                return (
                  <div
                    key={op.id}
                    data-testid={`row-cargo-op-${op.id}`}
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg ${opInfo.color} mt-0.5`}>
                        <OpIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-white truncate">{op.cargoName}</span>
                          <Badge className={`text-xs border ${opInfo.color}`}>{opInfo.label}</Badge>
                          <Badge className={`text-xs border ${stInfo.color}`}>{stInfo.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-400 flex-wrap">
                          {op.quantity && (
                            <span className="font-medium text-white">{op.quantity.toLocaleString()} {op.unit}</span>
                          )}
                          <span>{CARGO_TYPE_LABELS[op.cargoType] || op.cargoType}</span>
                          {op.blNumber && <span>B/L: {op.blNumber}</span>}
                          {op.hatchNo && <span>Ambar: {op.hatchNo}</span>}
                          {op.startTime && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(op.startTime)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      {op.status === "planned" && (
                        <Button
                          data-testid={`btn-start-${op.id}`}
                          size="sm" variant="outline"
                          className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs"
                          onClick={() => quickStatusMutation.mutate({ id: op.id, status: "in_progress" })}
                        >
                          Başlat
                        </Button>
                      )}
                      {op.status === "in_progress" && (
                        <Button
                          data-testid={`btn-complete-${op.id}`}
                          size="sm" variant="outline"
                          className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-xs"
                          onClick={() => quickStatusMutation.mutate({ id: op.id, status: "completed" })}
                        >
                          Tamamla
                        </Button>
                      )}
                      <Button
                        data-testid={`btn-edit-${op.id}`}
                        size="icon" variant="ghost"
                        className="h-8 w-8 text-slate-400 hover:text-white"
                        onClick={() => openEdit(op)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        data-testid={`btn-delete-${op.id}`}
                        size="icon" variant="ghost"
                        className="h-8 w-8 text-slate-400 hover:text-red-400"
                        onClick={() => deleteMutation.mutate(op.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={open => { setIsDialogOpen(open); if (!open) { setEditItem(null); form.reset(); } }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Operasyon Düzenle" : "Yeni Kargo Operasyonu"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="cargoName" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Kargo Adı</FormLabel>
                    <FormControl>
                      <Input data-testid="input-cargo-name" placeholder="Örn: Çelik, Mısır, Petrol Ürünü" {...field} className="bg-slate-800 border-slate-600" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="operation" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operasyon Türü</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-operation" className="bg-slate-800 border-slate-600">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(OPERATION_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="cargoType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kargo Tipi</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-cargo-type" className="bg-slate-800 border-slate-600">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CARGO_TYPES.map(t => (
                          <SelectItem key={t} value={t}>{CARGO_TYPE_LABELS[t] || t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Miktar</FormLabel>
                    <FormControl>
                      <Input data-testid="input-quantity" type="number" placeholder="0" {...field} onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)} value={field.value ?? ""} className="bg-slate-800 border-slate-600" />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="unit" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birim</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-unit" className="bg-slate-800 border-slate-600">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="blNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>B/L No</FormLabel>
                    <FormControl>
                      <Input data-testid="input-bl-number" placeholder="Konşimento numarası" {...field} value={field.value ?? ""} className="bg-slate-800 border-slate-600" />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="hatchNo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ambar No</FormLabel>
                    <FormControl>
                      <Input data-testid="input-hatch-no" placeholder="Ambar/Sintine no" {...field} value={field.value ?? ""} className="bg-slate-800 border-slate-600" />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Durum</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status" className="bg-slate-800 border-slate-600">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="voyageId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sefer (opsiyonel)</FormLabel>
                    <Select onValueChange={v => field.onChange(v === "none" ? undefined : parseInt(v))} value={field.value ? String(field.value) : "none"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-voyage" className="bg-slate-800 border-slate-600">
                          <SelectValue placeholder="Sefer seç" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">— Sefer Yok —</SelectItem>
                        {(voyages || []).map(v => (
                          <SelectItem key={v.id} value={String(v.id)}>{v.vesselName || `Sefer #${v.id}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Notlar</FormLabel>
                    <FormControl>
                      <Textarea data-testid="input-notes" placeholder="Ek notlar..." {...field} value={field.value ?? ""} className="bg-slate-800 border-slate-600 resize-none" rows={2} />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="border-slate-600 text-slate-300" onClick={() => setIsDialogOpen(false)}>İptal</Button>
                <Button
                  data-testid="btn-submit-cargo"
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  {editItem ? "Güncelle" : "Kaydet"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
