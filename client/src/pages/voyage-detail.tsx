import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  Ship, MapPin, Calendar, ArrowLeft, CheckCircle2, Circle, Trash2,
  Plus, Loader2, ChevronDown, Wrench, Fuel, ShoppingCart, Users as UsersIcon,
  Sparkles, HelpCircle, Clock, PlayCircle, XCircle, ClipboardList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { useAuth } from "@/hooks/use-auth";
import type { Port } from "@shared/schema";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  planned:   { label: "Planlandı",    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",    icon: Clock },
  active:    { label: "Aktif",        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: PlayCircle },
  completed: { label: "Tamamlandı",   color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",        icon: CheckCircle2 },
  cancelled: { label: "İptal Edildi", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",         icon: XCircle },
};

const SERVICE_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  fuel:         { label: "Yakıt / Bunker", icon: Fuel,          color: "text-orange-500" },
  repair:       { label: "Teknik Tamir",   icon: Wrench,        color: "text-red-500" },
  provisioning: { label: "Provizyonlama",  icon: ShoppingCart,  color: "text-green-500" },
  crew_change:  { label: "Mürettebat",     icon: UsersIcon,     color: "text-blue-500" },
  cleaning:     { label: "Temizlik",       icon: Sparkles,      color: "text-purple-500" },
  other:        { label: "Diğer",          icon: HelpCircle,    color: "text-gray-500" },
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  planned: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

function PortSearch({ value, onChange }: { value: string; onChange: (portId: number, portName: string) => void }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const { data: ports } = useQuery<Port[]>({
    queryKey: ["/api/ports/search", query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const res = await fetch(`/api/ports/search?q=${encodeURIComponent(query)}`);
      return res.json();
    },
    enabled: query.length >= 2,
  });
  return (
    <div className="relative">
      <Input value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }} placeholder="Liman ara..." onFocus={() => setOpen(true)} />
      {open && ports && ports.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {ports.map(p => (
            <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors" onMouseDown={() => { onChange(p.id, p.name); setQuery(p.name); setOpen(false); }}>
              <span className="font-medium">{p.name}</span>{p.code && <span className="ml-2 text-xs text-muted-foreground">{p.code}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VoyageDetail() {
  const { id } = useParams<{ id: string }>();
  const voyageId = parseInt(id || "0");
  const { user } = useAuth();
  const { toast } = useToast();
  const [newTask, setNewTask] = useState("");
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    portId: 0, portName: "", vesselName: "", serviceType: "other",
    description: "", quantity: "", unit: "", preferredDate: "",
  });

  const { data: voyage, isLoading } = useQuery<any>({
    queryKey: ["/api/voyages", voyageId],
    queryFn: async () => {
      const res = await fetch(`/api/voyages/${voyageId}`);
      return res.json();
    },
  });

  const userId = (user as any)?.id || (user as any)?.claims?.sub;
  const isOwner = voyage?.userId === userId;

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/voyages/${voyageId}/status`, { status });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] }); toast({ title: "Durum güncellendi" }); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const addTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/checklist`, { title: newTask, assignedTo: "both" });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] }); setNewTask(""); },
    onError: () => toast({ title: "Görev eklenemedi", variant: "destructive" }),
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const res = await apiRequest("PATCH", `/api/voyages/${voyageId}/checklist/${itemId}`, {});
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest("DELETE", `/api/voyages/${voyageId}/checklist/${itemId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] }),
  });

  const createServiceMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        portId: serviceForm.portId || voyage?.portId,
        vesselName: serviceForm.vesselName || voyage?.vesselName || "Belirtilmedi",
        serviceType: serviceForm.serviceType,
        description: serviceForm.description,
        voyageId: voyageId,
      };
      if (serviceForm.quantity) payload.quantity = parseFloat(serviceForm.quantity);
      if (serviceForm.unit) payload.unit = serviceForm.unit;
      if (serviceForm.preferredDate) payload.preferredDate = serviceForm.preferredDate;
      const res = await apiRequest("POST", "/api/service-requests", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({ title: "Hizmet talebi oluşturuldu" });
      setShowServiceDialog(false);
      setServiceForm({ portId: 0, portName: "", vesselName: "", serviceType: "other", description: "", quantity: "", unit: "", preferredDate: "" });
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!voyage) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Sefer bulunamadı.</p>
        <Link href="/voyages"><Button variant="outline" className="mt-4">Geri Dön</Button></Link>
      </div>
    );
  }

  const s = STATUS_CONFIG[voyage.status] || STATUS_CONFIG.planned;
  const StatusIcon = s.icon;
  const checklist: any[] = voyage.checklists || [];
  const completed = checklist.filter(c => c.isCompleted).length;
  const serviceReqs: any[] = voyage.serviceRequests || [];
  const transitions = STATUS_TRANSITIONS[voyage.status] || [];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <PageMeta title={`Sefer — ${voyage.vesselName || "Detay"} | VesselPDA`} description="Sefer detayı ve operasyon dosyası" />

      {/* Back */}
      <Link href="/voyages">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Seferler
        </button>
      </Link>

      {/* Header Card */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0">
              <Ship className="w-6 h-6 text-[hsl(var(--maritime-primary))]" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold">{voyage.vesselName || "Gemi Belirtilmedi"}</h1>
              <p className="text-sm text-muted-foreground">{voyage.purposeOfCall}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${s.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />{s.label}
            </span>
            {isOwner && transitions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    Durumu Değiştir <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {transitions.map(t => {
                    const cfg = STATUS_CONFIG[t];
                    const TIcon = cfg?.icon;
                    return (
                      <DropdownMenuItem key={t} onClick={() => statusMutation.mutate(t)} className="gap-2">
                        {TIcon && <TIcon className="w-4 h-4" />}{cfg?.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Liman</p>
            <p className="font-medium flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-muted-foreground" />{voyage.portName || `Port #${voyage.portId}`}</p>
          </div>
          {voyage.eta && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">ETA</p>
              <p className="font-medium flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-muted-foreground" />{new Date(voyage.eta).toLocaleDateString("tr-TR")}</p>
            </div>
          )}
          {voyage.etd && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">ETD</p>
              <p className="font-medium flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-muted-foreground" />{new Date(voyage.etd).toLocaleDateString("tr-TR")}</p>
            </div>
          )}
          {voyage.notes && (
            <div className="col-span-full">
              <p className="text-xs text-muted-foreground mb-0.5">Notlar</p>
              <p className="text-sm">{voyage.notes}</p>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Checklist */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              <h2 className="font-semibold text-sm">Görev Listesi</h2>
            </div>
            {checklist.length > 0 && (
              <span className="text-xs text-muted-foreground">{completed}/{checklist.length} tamamlandı</span>
            )}
          </div>

          {checklist.length > 0 && (
            <div className="w-full bg-muted/40 rounded-full h-1.5">
              <div
                className="bg-[hsl(var(--maritime-primary))] h-1.5 rounded-full transition-all"
                style={{ width: `${checklist.length > 0 ? (completed / checklist.length) * 100 : 0}%` }}
              />
            </div>
          )}

          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {checklist.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Henüz görev yok. Aşağıdan ekleyin.</p>
            )}
            {checklist.map((item: any) => (
              <div key={item.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${item.isCompleted ? "bg-green-50 dark:bg-green-950/20" : "bg-muted/30"}`} data-testid={`checklist-item-${item.id}`}>
                <button
                  onClick={() => toggleTaskMutation.mutate(item.id)}
                  className="flex-shrink-0"
                  data-testid={`button-toggle-task-${item.id}`}
                >
                  {item.isCompleted
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : <Circle className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                  }
                </button>
                <span className={`flex-1 text-sm ${item.isCompleted ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                <button
                  onClick={() => deleteTaskMutation.mutate(item.id)}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 hover:text-destructive text-muted-foreground transition-colors"
                  data-testid={`button-delete-task-${item.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              placeholder="Yeni görev..."
              onKeyDown={e => { if (e.key === "Enter" && newTask.trim()) addTaskMutation.mutate(); }}
              className="text-sm h-8"
              data-testid="input-new-task"
            />
            <Button
              size="sm"
              className="h-8 px-3"
              onClick={() => { if (newTask.trim()) addTaskMutation.mutate(); }}
              disabled={addTaskMutation.isPending || !newTask.trim()}
              data-testid="button-add-task"
            >
              {addTaskMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </Card>

        {/* Service Requests */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              <h2 className="font-semibold text-sm">Hizmet Talepleri</h2>
            </div>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setShowServiceDialog(true)} data-testid="button-add-service-request">
              <Plus className="w-3 h-3" /> Talep Oluştur
            </Button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {serviceReqs.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Bu sefere ait hizmet talebi yok.</p>
            )}
            {serviceReqs.map((req: any) => {
              const cfg = SERVICE_TYPE_CONFIG[req.serviceType] || SERVICE_TYPE_CONFIG.other;
              const TypeIcon = cfg.icon;
              return (
                <Link key={req.id} href={`/service-requests/${req.id}`}>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer" data-testid={`service-req-${req.id}`}>
                    <TypeIcon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cfg.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{req.description}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] flex-shrink-0 capitalize">{req.status}</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Service Request Dialog */}
      <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Hizmet Talebi Oluştur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Hizmet Türü *</Label>
              <Select value={serviceForm.serviceType} onValueChange={v => setServiceForm(f => ({ ...f, serviceType: v }))}>
                <SelectTrigger data-testid="select-service-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SERVICE_TYPE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Gemi Adı *</Label>
              <Input
                value={serviceForm.vesselName || voyage?.vesselName || ""}
                onChange={e => setServiceForm(f => ({ ...f, vesselName: e.target.value }))}
                placeholder="Gemi adı"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Açıklama *</Label>
              <Textarea
                value={serviceForm.description}
                onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Hizmet detaylarını girin..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Miktar</Label>
                <Input type="number" value={serviceForm.quantity} onChange={e => setServiceForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Birim</Label>
                <Input value={serviceForm.unit} onChange={e => setServiceForm(f => ({ ...f, unit: e.target.value }))} placeholder="MT, LT, adet..." />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tercih Edilen Tarih</Label>
              <Input type="datetime-local" value={serviceForm.preferredDate} onChange={e => setServiceForm(f => ({ ...f, preferredDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowServiceDialog(false)}>İptal</Button>
            <Button
              onClick={() => createServiceMutation.mutate()}
              disabled={createServiceMutation.isPending || !serviceForm.description.trim()}
              data-testid="button-save-service-request"
            >
              {createServiceMutation.isPending ? "Oluşturuluyor..." : "Talep Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
