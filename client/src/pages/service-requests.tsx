import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Wrench, Fuel, ShoppingCart, Users as UsersIcon, Sparkles, HelpCircle,
  Plus, MapPin, Calendar, Ship, CheckCircle2, Clock, ChevronRight,
  Send, Loader2, ChevronsUpDown, Check, PenLine
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { useAuth } from "@/hooks/use-auth";
import type { Port, Vessel } from "@shared/schema";

const SERVICE_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  fuel:         { label: "Yakıt / Bunker", icon: Fuel,         color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900/20" },
  repair:       { label: "Teknik Tamir",   icon: Wrench,       color: "text-red-500",    bg: "bg-red-100 dark:bg-red-900/20" },
  provisioning: { label: "Provizyonlama",  icon: ShoppingCart, color: "text-green-500",  bg: "bg-green-100 dark:bg-green-900/20" },
  crew_change:  { label: "Mürettebat",     icon: UsersIcon,    color: "text-blue-500",   bg: "bg-blue-100 dark:bg-blue-900/20" },
  cleaning:     { label: "Temizlik",       icon: Sparkles,     color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/20" },
  other:        { label: "Diğer",          icon: HelpCircle,   color: "text-gray-500",   bg: "bg-gray-100 dark:bg-gray-800" },
};

const REQ_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:            { label: "Açık",             color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  offers_received: { label: "Teklif Geldi",     color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  selected:        { label: "Teklif Seçildi",   color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  completed:       { label: "Tamamlandı",        color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  cancelled:       { label: "İptal",             color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
};

function PortSearch({ value, onChange }: { value: string; onChange: (portId: number, portName: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data: ports = [], isFetching } = useQuery<Port[]>({
    queryKey: ["/api/ports", query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const res = await fetch(`/api/ports?q=${encodeURIComponent(query)}`);
      return res.json();
    },
    enabled: query.length >= 2,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-10"
          data-testid="port-search-trigger"
        >
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value || "Liman ara..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Liman adı veya kod girin..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {query.length < 2 && (
              <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                Aramak için en az 2 karakter girin
              </CommandEmpty>
            )}
            {query.length >= 2 && isFetching && (
              <CommandEmpty className="py-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Aranıyor...
              </CommandEmpty>
            )}
            {query.length >= 2 && !isFetching && ports.length === 0 && (
              <CommandEmpty>Liman bulunamadı</CommandEmpty>
            )}
            {ports.length > 0 && (
              <CommandGroup>
                {ports.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.name}
                    onSelect={() => {
                      onChange(p.id, p.name);
                      setOpen(false);
                      setQuery("");
                    }}
                    data-testid={`port-option-${p.id}`}
                  >
                    <Check className={`mr-2 h-4 w-4 ${value === p.name ? "opacity-100" : "opacity-0"}`} />
                    <span className="font-medium">{p.name}</span>
                    {p.code && <span className="ml-2 text-xs text-muted-foreground">{p.code}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Vessel Select ────────────────────────────────────────────────────────────

const FLAG_EMOJI: Record<string, string> = {
  "Turkey": "🇹🇷", "Malta": "🇲🇹", "Panama": "🇵🇦", "Liberia": "🇱🇷",
  "Marshall Islands": "🇲🇭", "Bahamas": "🇧🇸", "Greece": "🇬🇷",
  "Cyprus": "🇨🇾", "Singapore": "🇸🇬", "Hong Kong": "🇭🇰",
  "Norway": "🇳🇴", "United Kingdom": "🇬🇧",
};

function VesselSelect({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [mode, setMode] = useState<"fleet" | "manual">("fleet");
  const { data: vessels = [] } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });

  if (mode === "manual") {
    return (
      <div className="space-y-1.5">
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Gemi adını girin..."
          data-testid="input-vessel-manual"
          autoFocus
        />
        {vessels.length > 0 && (
          <button
            type="button"
            className="text-xs text-[hsl(var(--maritime-primary))] hover:underline flex items-center gap-1"
            onClick={() => { setMode("fleet"); onChange(""); }}
          >
            <Ship className="w-3 h-3" /> Filomdan seç
          </button>
        )}
      </div>
    );
  }

  if (vessels.length === 0) {
    return (
      <div className="space-y-1.5">
        <div className="border border-dashed rounded-lg px-3 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
          <Ship className="w-4 h-4 flex-shrink-0" />
          <span>Filonuzda gemi yok</span>
        </div>
        <button
          type="button"
          className="text-xs text-[hsl(var(--maritime-primary))] hover:underline flex items-center gap-1"
          onClick={() => setMode("manual")}
        >
          <PenLine className="w-3 h-3" /> Manuel giriş
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger data-testid="select-vessel-fleet">
          <SelectValue placeholder="Filo gemisi seç..." />
        </SelectTrigger>
        <SelectContent>
          {vessels.map((v) => (
            <SelectItem key={v.id} value={v.name} data-testid={`vessel-option-${v.id}`}>
              <span className="flex items-center gap-2">
                <span>{FLAG_EMOJI[v.flag || ""] || "🏳️"}</span>
                <span className="font-medium">{v.name}</span>
                <span className="text-xs text-muted-foreground">{v.vesselType}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1"
        onClick={() => { setMode("manual"); onChange(""); }}
      >
        <PenLine className="w-3 h-3" /> Filo dışı gemi (manuel giriş)
      </button>
    </div>
  );
}

function ServiceRequestCard({ req, showOffer, onOfferClick }: { req: any; showOffer?: boolean; onOfferClick?: (id: number) => void }) {
  const cfg = SERVICE_TYPE_CONFIG[req.serviceType] || SERVICE_TYPE_CONFIG.other;
  const TypeIcon = cfg.icon;
  const status = REQ_STATUS_CONFIG[req.status] || REQ_STATUS_CONFIG.open;

  return (
    <Card className="p-4 space-y-3" data-testid={`card-service-req-${req.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
            <TypeIcon className={`w-4 h-4 ${cfg.color}`} />
          </div>
          <div>
            <p className="font-semibold text-sm">{cfg.label}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Ship className="w-3 h-3" />{req.vesselName}</p>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2">{req.description}</p>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {req.portName && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{req.portName}</span>}
        {req.preferredDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(req.preferredDate).toLocaleDateString("tr-TR")}</span>}
        {req.quantity && <span>{req.quantity} {req.unit}</span>}
      </div>

      {showOffer && (req.status === "open" || req.status === "offers_received") && (
        <Button size="sm" className="w-full gap-2 h-8" onClick={() => onOfferClick?.(req.id)} data-testid={`button-make-offer-${req.id}`}>
          <Send className="w-3.5 h-3.5" /> Teklif Ver
        </Button>
      )}

      {!showOffer && (
        <Link href={`/service-requests/${req.id}`}>
          <Button size="sm" variant="outline" className="w-full gap-2 h-8">
            Detaylar <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      )}
    </Card>
  );
}

function OfferCard({ offer }: { offer: any }) {
  const s = offer.status === "selected" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : offer.status === "rejected" ? "bg-red-100 text-red-600" : "bg-muted text-muted-foreground";
  const label = offer.status === "selected" ? "Seçildi" : offer.status === "rejected" ? "Reddedildi" : "Bekliyor";
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 text-sm" data-testid={`offer-card-${offer.id}`}>
      <div>
        <p className="font-medium">{offer.request?.vesselName} — {SERVICE_TYPE_CONFIG[offer.request?.serviceType]?.label}</p>
        <p className="text-xs text-muted-foreground">{offer.request?.portName}</p>
      </div>
      <div className="text-right">
        <p className="font-semibold">{offer.price} {offer.currency}</p>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s}`}>{label}</span>
      </div>
    </div>
  );
}

export default function ServiceRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [offerDialogId, setOfferDialogId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({
    portId: 0, portName: "", vesselName: "", grt: "",
    serviceType: "other", description: "", quantity: "", unit: "", preferredDate: "",
  });
  const [offerForm, setOfferForm] = useState({ price: "", currency: "USD", notes: "", estimatedDuration: "" });

  const role = (user as any)?.activeRole || (user as any)?.userRole || "shipowner";
  const isProvider = role === "provider";

  const { data, isLoading } = useQuery<{ requests: any[]; myOffers: any[] }>({
    queryKey: ["/api/service-requests"],
  });

  const requests: any[] = data?.requests || [];
  const myOffers: any[] = data?.myOffers || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        portId: createForm.portId,
        vesselName: createForm.vesselName,
        serviceType: createForm.serviceType,
        description: createForm.description,
      };
      if (createForm.grt) payload.grt = parseFloat(createForm.grt);
      if (createForm.quantity) payload.quantity = parseFloat(createForm.quantity);
      if (createForm.unit) payload.unit = createForm.unit;
      if (createForm.preferredDate) payload.preferredDate = createForm.preferredDate;
      const res = await apiRequest("POST", "/api/service-requests", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({ title: "Hizmet talebi oluşturuldu" });
      setShowCreate(false);
      setCreateForm({ portId: 0, portName: "", vesselName: "", grt: "", serviceType: "other", description: "", quantity: "", unit: "", preferredDate: "" });
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const offerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/service-requests/${offerDialogId}/offers`, {
        price: parseFloat(offerForm.price),
        currency: offerForm.currency,
        notes: offerForm.notes,
        estimatedDuration: offerForm.estimatedDuration,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({ title: "Teklifiniz gönderildi" });
      setOfferDialogId(null);
      setOfferForm({ price: "", currency: "USD", notes: "", estimatedDuration: "" });
    },
    onError: () => toast({ title: "Teklif gönderilemedi", variant: "destructive" }),
  });

  const selectOfferMutation = useMutation({
    mutationFn: async ({ requestId, offerId }: { requestId: number; offerId: number }) => {
      const res = await apiRequest("POST", `/api/service-requests/${requestId}/offers/${offerId}/select`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({ title: "Teklif seçildi" });
    },
  });

  return (
    <div className="px-3 py-5 space-y-6 max-w-7xl mx-auto">
      <PageMeta title="Hizmet Talepleri | VesselPDA" description="Denizcilik hizmet talepleri ve teklifler" />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">Hizmet Talepleri</h1>
          <p className="text-muted-foreground text-sm">
            {isProvider ? "Servis bölgenizdeki açık talepler ve teklifleriniz" : "Hizmet taleplerini yönetin"}
          </p>
        </div>
        {!isProvider && (
          <Button onClick={() => setShowCreate(true)} className="gap-2" data-testid="button-create-service-req">
            <Plus className="w-4 h-4" /> Yeni Talep
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : isProvider ? (
        <Tabs defaultValue="open">
          <TabsList>
            <TabsTrigger value="open">Açık Talepler ({requests.length})</TabsTrigger>
            <TabsTrigger value="myoffers">Tekliflerim ({myOffers.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="open" className="mt-4">
            {requests.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Wrench className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">Servis bölgenizde açık talep yok</p>
                <p className="text-sm mt-1">Servis portlarınızı profil sayfanızdan güncelleyebilirsiniz.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {requests.map(req => (
                  <ServiceRequestCard key={req.id} req={req} showOffer onOfferClick={id => { setOfferDialogId(id); setOfferForm({ price: "", currency: "USD", notes: "", estimatedDuration: "" }); }} />
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="myoffers" className="mt-4 space-y-3">
            {myOffers.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Send className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="font-medium">Henüz teklif vermediniz</p>
              </div>
            ) : (
              myOffers.map(o => <OfferCard key={o.id} offer={o} />)
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <>
          {requests.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Wrench className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">Henüz hizmet talebi yok</p>
              <p className="text-sm mt-1">Yakıt, tamir, provizyonlama gibi hizmetler için talep oluşturun.</p>
              <Button className="mt-4 gap-2" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4" /> Talep Oluştur
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {requests.map((req: any) => {
                const cfg = SERVICE_TYPE_CONFIG[req.serviceType] || SERVICE_TYPE_CONFIG.other;
                const TypeIcon = cfg.icon;
                const status = REQ_STATUS_CONFIG[req.status] || REQ_STATUS_CONFIG.open;
                return (
                  <Card key={req.id} className="p-4 space-y-3" data-testid={`card-req-${req.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                          <TypeIcon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{cfg.label}</p>
                          <p className="text-xs text-muted-foreground">{req.vesselName}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{req.description}</p>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{req.portName}
                    </div>
                    <Link href={`/service-requests/${req.id}`}>
                      <Button size="sm" variant="outline" className="w-full h-8 gap-1 text-xs">
                        Teklifleri Gör <ChevronRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create Request Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Yeni Hizmet Talebi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Hizmet Türü *</Label>
              <Select value={createForm.serviceType} onValueChange={v => setCreateForm(f => ({ ...f, serviceType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SERVICE_TYPE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Liman *</Label>
              <PortSearch value={createForm.portName} onChange={(id, name) => setCreateForm(f => ({ ...f, portId: id, portName: name }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Gemi *</Label>
              <VesselSelect
                value={createForm.vesselName}
                onChange={(name) => setCreateForm(f => ({ ...f, vesselName: name }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Açıklama *</Label>
              <Textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Hizmet detaylarını açıklayın..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Miktar</Label>
                <Input type="number" value={createForm.quantity} onChange={e => setCreateForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Birim</Label>
                <Input value={createForm.unit} onChange={e => setCreateForm(f => ({ ...f, unit: e.target.value }))} placeholder="MT, LT, adet..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tercih Edilen Tarih</Label>
              <Input type="datetime-local" value={createForm.preferredDate} onChange={e => setCreateForm(f => ({ ...f, preferredDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>İptal</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !createForm.portId || !createForm.vesselName || !createForm.description}>
              {createMutation.isPending ? "Oluşturuluyor..." : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offer Dialog */}
      <Dialog open={!!offerDialogId} onOpenChange={open => { if (!open) setOfferDialogId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Teklif Ver</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fiyat *</Label>
                <Input type="number" value={offerForm.price} onChange={e => setOfferForm(f => ({ ...f, price: e.target.value }))} placeholder="0" data-testid="input-offer-price" />
              </div>
              <div className="space-y-1.5">
                <Label>Para Birimi</Label>
                <Select value={offerForm.currency} onValueChange={v => setOfferForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="TRY">TRY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tahmini Süre</Label>
              <Input value={offerForm.estimatedDuration} onChange={e => setOfferForm(f => ({ ...f, estimatedDuration: e.target.value }))} placeholder="Örn: 2-3 gün" />
            </div>
            <div className="space-y-1.5">
              <Label>Notlar</Label>
              <Textarea value={offerForm.notes} onChange={e => setOfferForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ek bilgi..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferDialogId(null)}>İptal</Button>
            <Button onClick={() => offerMutation.mutate()} disabled={offerMutation.isPending || !offerForm.price} data-testid="button-submit-offer">
              {offerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Teklif Gönder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
