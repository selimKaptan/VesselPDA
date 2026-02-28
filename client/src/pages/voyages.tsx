import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ship, Plus, MapPin, Calendar, ChevronRight, Anchor, CheckCircle2, Clock, XCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import type { Vessel, Port } from "@shared/schema";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  planned:   { label: "Planlandı",    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",   icon: Clock },
  active:    { label: "Aktif",        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: PlayCircle },
  completed: { label: "Tamamlandı",   color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",       icon: CheckCircle2 },
  cancelled: { label: "İptal Edildi", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",        icon: XCircle },
};

const PURPOSE_OPTIONS = ["Loading", "Discharging", "Transit", "Bunkering", "Repair", "Crew Change", "Inspection"];

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
      <Input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        placeholder="Liman adı veya LOCODE ara..."
        onFocus={() => setOpen(true)}
      />
      {open && ports && ports.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {ports.map(p => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
              onMouseDown={() => {
                onChange(p.id, p.name);
                setQuery(p.name);
                setOpen(false);
              }}
            >
              <span className="font-medium">{p.name}</span>
              {p.code && <span className="ml-2 text-xs text-muted-foreground">{p.code}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Voyages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    portId: 0,
    portName: "",
    vesselId: null as number | null,
    vesselName: "",
    agentUserId: "",
    status: "planned",
    eta: "",
    etd: "",
    purposeOfCall: "Loading",
    notes: "",
  });

  const role = (user as any)?.activeRole || (user as any)?.userRole || "shipowner";

  const { data: voyageList, isLoading } = useQuery<any[]>({
    queryKey: ["/api/voyages"],
  });

  const { data: vessels } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
    enabled: role !== "agent",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        portId: form.portId,
        purposeOfCall: form.purposeOfCall,
        notes: form.notes || null,
        status: "planned",
      };
      if (form.vesselId) payload.vesselId = form.vesselId;
      if (form.vesselName) payload.vesselName = form.vesselName;
      if (form.agentUserId) payload.agentUserId = form.agentUserId;
      if (form.eta) payload.eta = form.eta;
      if (form.etd) payload.etd = form.etd;
      const res = await apiRequest("POST", "/api/voyages", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages"] });
      toast({ title: "Sefer oluşturuldu" });
      setShowCreate(false);
      setForm({ portId: 0, portName: "", vesselId: null, vesselName: "", agentUserId: "", status: "planned", eta: "", etd: "", purposeOfCall: "Loading", notes: "" });
    },
    onError: () => toast({ title: "Hata", description: "Sefer oluşturulamadı", variant: "destructive" }),
  });

  const handleVesselSelect = (id: string) => {
    const v = vessels?.find(v => String(v.id) === id);
    setForm(f => ({ ...f, vesselId: v?.id || null, vesselName: v?.name || "" }));
  };

  return (
    <div className="px-3 py-5 space-y-6 max-w-7xl mx-auto">
      <PageMeta title="Seferler | VesselPDA" description="Sefer ve operasyon dosyaları" />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-voyages-title">Seferler</h1>
          <p className="text-muted-foreground text-sm">Operasyon dosyaları ve sefer yönetimi</p>
        </div>
        {role !== "provider" && (
          <Button onClick={() => setShowCreate(true)} className="gap-2" data-testid="button-create-voyage">
            <Plus className="w-4 h-4" /> Yeni Sefer
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : voyageList && voyageList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {voyageList.map((v: any) => {
            const s = STATUS_CONFIG[v.status] || STATUS_CONFIG.planned;
            const Icon = s.icon;
            return (
              <Link key={v.id} href={`/voyages/${v.id}`}>
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer border hover:border-primary/30 group" data-testid={`card-voyage-${v.id}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0">
                        <Ship className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm leading-tight">{v.vesselName || "Gemi Belirtilmedi"}</p>
                        <p className="text-xs text-muted-foreground">{v.purposeOfCall}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${s.color}`}>
                      <Icon className="w-3 h-3" />{s.label}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{v.portName || `Port #${v.portId}`}</span>
                    </div>
                    {v.eta && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>ETA: {new Date(v.eta).toLocaleDateString("tr-TR")}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end mt-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-medium">Detaylar</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center" data-testid="text-no-voyages">
          <div className="w-20 h-20 rounded-2xl bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center mb-5">
            <Anchor className="w-10 h-10 text-[hsl(var(--maritime-primary)/0.4)]" />
          </div>
          <h3 className="font-serif text-lg font-semibold text-muted-foreground mb-1">Henüz sefer yok</h3>
          <p className="text-sm text-muted-foreground/70 max-w-xs mb-6">
            Yeni bir sefer oluşturarak operasyon dosyanızı başlatın. Checklist, belgeler ve hizmet talepleri ekleyin.
          </p>
          {role !== "provider" && (
            <Button size="lg" className="gap-2 px-8" onClick={() => setShowCreate(true)} data-testid="button-create-first-voyage">
              <Plus className="w-5 h-5" /> Yeni Sefer Oluştur
            </Button>
          )}
        </div>
      )}

      {/* Create Voyage Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Yeni Sefer Oluştur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Liman *</Label>
              <PortSearch
                value={form.portName}
                onChange={(id, name) => setForm(f => ({ ...f, portId: id, portName: name }))}
              />
            </div>

            {vessels && vessels.length > 0 && (
              <div className="space-y-1.5">
                <Label>Gemi (Filomdan Seç)</Label>
                <Select onValueChange={handleVesselSelect}>
                  <SelectTrigger data-testid="select-vessel">
                    <SelectValue placeholder="Gemi seçin (opsiyonel)" />
                  </SelectTrigger>
                  <SelectContent>
                    {vessels.map(v => (
                      <SelectItem key={v.id} value={String(v.id)}>{v.name} — {v.vesselType}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Gemi Adı</Label>
              <Input
                value={form.vesselName}
                onChange={e => setForm(f => ({ ...f, vesselName: e.target.value }))}
                placeholder="Gemi adı girin"
                data-testid="input-vessel-name"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Amaç *</Label>
              <Select value={form.purposeOfCall} onValueChange={v => setForm(f => ({ ...f, purposeOfCall: v }))}>
                <SelectTrigger data-testid="select-purpose">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURPOSE_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ETA</Label>
                <Input type="datetime-local" value={form.eta} onChange={e => setForm(f => ({ ...f, eta: e.target.value }))} data-testid="input-eta" />
              </div>
              <div className="space-y-1.5">
                <Label>ETD</Label>
                <Input type="datetime-local" value={form.etd} onChange={e => setForm(f => ({ ...f, etd: e.target.value }))} data-testid="input-etd" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notlar</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Ek notlar..."
                rows={3}
                data-testid="textarea-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>İptal</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.portId}
              data-testid="button-save-voyage"
            >
              {createMutation.isPending ? "Oluşturuluyor..." : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
