import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Gavel, Plus, Clock, FileText, Ship, MapPin, ChevronRight,
  AlertCircle, CheckCircle2, XCircle, Inbox, Send, Anchor
} from "lucide-react";

function useCountdown(createdAt: string, expiryHours: number) {
  const [remaining, setRemaining] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const expiresAt = new Date(createdAt).getTime() + expiryHours * 3600000;
    const update = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) {
        setRemaining("Süresi Doldu");
        setExpired(true);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(`${h}s ${m}dk kaldı`);
      setExpired(false);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [createdAt, expiryHours]);

  return { remaining, expired };
}

function TenderCard({ tender, role, myBidStatus }: { tender: any; role: string; myBidStatus?: string }) {
  const [, navigate] = useLocation();
  const { remaining, expired } = useCountdown(tender.createdAt, tender.expiryHours);

  const statusColor = {
    open: "bg-emerald-100 text-emerald-700",
    closed: "bg-blue-100 text-blue-700",
    cancelled: "bg-red-100 text-red-700",
    nominated: "bg-purple-100 text-purple-700",
  }[tender.status as string] || "bg-gray-100 text-gray-700";

  const statusLabel = {
    open: "Açık",
    closed: "Kapandı",
    cancelled: "İptal",
    nominated: "Nominasyon Yapıldı",
  }[tender.status as string] || tender.status;

  const bidStatusIcon = myBidStatus === "selected"
    ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
    : myBidStatus === "rejected"
    ? <XCircle className="w-4 h-4 text-red-500" />
    : myBidStatus === "pending"
    ? <Clock className="w-4 h-4 text-amber-500" />
    : null;

  return (
    <Card
      className="p-5 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer border-border/60"
      onClick={() => navigate(`/tenders/${tender.id}`)}
      data-testid={`card-tender-${tender.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center flex-shrink-0">
            <Gavel className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-sm" data-testid={`text-tender-port-${tender.id}`}>
                {tender.portName}
              </span>
              <Badge className={`text-[10px] border-0 ${statusColor}`}>{statusLabel}</Badge>
              {myBidStatus && (
                <div className="flex items-center gap-1">
                  {bidStatusIcon}
                  <span className="text-xs text-muted-foreground">
                    {myBidStatus === "selected" ? "Teklifiniz seçildi!" : myBidStatus === "rejected" ? "Reddedildi" : "Değerlendiriliyor"}
                  </span>
                </div>
              )}
            </div>
            {tender.vesselName && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Ship className="w-3 h-3" />
                <span>{tender.vesselName}</span>
              </div>
            )}
            {tender.cargoInfo && (
              <p className="text-xs text-muted-foreground line-clamp-1">{tender.cargoInfo}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className={`flex items-center gap-1 text-xs font-medium ${expired || tender.status !== "open" ? "text-muted-foreground" : "text-amber-600"}`}>
            <Clock className="w-3.5 h-3.5" />
            {tender.status === "open" ? remaining : statusLabel}
          </div>
          {role === "shipowner" && tender.bidCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {tender.bidCount} teklif
            </Badge>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}

function CreateTenderDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [portSearch, setPortSearch] = useState("");
  const [form, setForm] = useState({
    portId: "",
    vesselName: "",
    description: "",
    cargoInfo: "",
    expiryHours: "24",
  });

  const { data: ports } = useQuery<any[]>({ queryKey: ["/api/ports"] });

  const filteredPorts = (ports || []).filter((p: any) =>
    p.name.toLowerCase().includes(portSearch.toLowerCase())
  ).slice(0, 50);

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tenders", data),
    onSuccess: async (res: any) => {
      const data = await res.json();
      toast({
        title: "İhale oluşturuldu!",
        description: `${data.agentCount} acenteye gönderildi.`,
      });
      setOpen(false);
      setForm({ portId: "", vesselName: "", description: "", cargoInfo: "", expiryHours: "24" });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
    },
    onError: async (err: any) => {
      const data = await err.response?.json().catch(() => ({}));
      toast({ title: "Hata", description: data.message || "İhale oluşturulamadı", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!form.portId) {
      toast({ title: "Hata", description: "Liman seçiniz", variant: "destructive" });
      return;
    }
    mutation.mutate({ ...form, portId: Number(form.portId), expiryHours: Number(form.expiryHours) });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-create-tender">
          <Plus className="w-4 h-4" /> Yeni İhale Oluştur
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" data-testid="dialog-create-tender">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
            Liman Proforma İhalesi
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Liman <span className="text-red-500">*</span></Label>
            <Input
              placeholder="Liman ara..."
              value={portSearch}
              onChange={e => setPortSearch(e.target.value)}
              data-testid="input-port-search"
            />
            {portSearch && (
              <div className="border rounded-md max-h-40 overflow-y-auto divide-y">
                {filteredPorts.length === 0 && (
                  <p className="p-2 text-sm text-muted-foreground">Sonuç yok</p>
                )}
                {filteredPorts.map((p: any) => (
                  <button
                    key={p.id}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${form.portId === String(p.id) ? "bg-[hsl(var(--maritime-primary)/0.08)] font-medium" : ""}`}
                    onClick={() => { setForm(f => ({ ...f, portId: String(p.id) })); setPortSearch(p.name); }}
                    data-testid={`option-port-${p.id}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            {form.portId && !portSearch.includes("…") && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Liman seçildi
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Gemi Adı</Label>
            <Input
              placeholder="MV EXAMPLE"
              value={form.vesselName}
              onChange={e => setForm(f => ({ ...f, vesselName: e.target.value }))}
              data-testid="input-vessel-name"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Kargo Bilgisi</Label>
            <Input
              placeholder="ör. 15,000 MT Grain, Loading"
              value={form.cargoInfo}
              onChange={e => setForm(f => ({ ...f, cargoInfo: e.target.value }))}
              data-testid="input-cargo-info"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Açıklama / Notlar</Label>
            <Textarea
              placeholder="Ek bilgi ve gereksinimler..."
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              data-testid="input-description"
            />
          </div>

          <div className="space-y-2">
            <Label>İhale Süresi <span className="text-red-500">*</span></Label>
            <RadioGroup
              value={form.expiryHours}
              onValueChange={v => setForm(f => ({ ...f, expiryHours: v }))}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="24" id="exp-24" data-testid="radio-24h" />
                <Label htmlFor="exp-24" className="cursor-pointer font-normal">24 Saat</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="48" id="exp-48" data-testid="radio-48h" />
                <Label htmlFor="exp-48" className="cursor-pointer font-normal">48 Saat</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-400">
              İhale oluşturulduğunda, seçtiğiniz limanda kayıtlı tüm acentelere otomatik olarak iletilecektir.
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending || !form.portId}
            className="w-full"
            data-testid="button-submit-tender"
          >
            {mutation.isPending ? "Oluşturuluyor..." : "İhale Oluştur ve Gönder"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TendersPage() {
  const { data, isLoading } = useQuery<{ role: string; tenders: any[] }>({ queryKey: ["/api/tenders"] });
  const { data: myBids } = useQuery<any[]>({ queryKey: ["/api/tenders/my-bids"] });

  const role = data?.role || "shipowner";
  const tenders = data?.tenders || [];

  const openTenders = tenders.filter(t => t.status === "open");
  const closedTenders = tenders.filter(t => t.status !== "open");

  const getMyBidStatus = (tenderId: number) => {
    if (!myBids) return undefined;
    const bid = myBids.find((b: any) => b.tenderId === tenderId);
    return bid?.status;
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gavel className="w-6 h-6 text-[hsl(var(--maritime-primary))]" />
            {role === "agent" ? "Liman İhaleleri" : "Proforma İhaleleri"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {role === "agent"
              ? "Hizmet verdiğiniz limanlardaki açık ihaleler"
              : "Oluşturduğunuz ihale teklifleri"}
          </p>
        </div>
        {role !== "agent" && <CreateTenderDialog />}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : role === "agent" ? (
        <Tabs defaultValue="available">
          <TabsList>
            <TabsTrigger value="available" data-testid="tab-available">
              Açık İhaleler
              {openTenders.length > 0 && (
                <Badge className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 border-0">{openTenders.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="my-bids" data-testid="tab-my-bids">Tekliflerim</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="space-y-3 mt-4">
            {openTenders.length === 0 ? (
              <EmptyState icon={Inbox} title="Açık ihale yok" desc="Hizmet verdiğiniz limanlar için yeni ihale geldiğinde burada görünecek." />
            ) : (
              openTenders.map(t => (
                <TenderCard key={t.id} tender={t} role="agent" myBidStatus={getMyBidStatus(t.id)} />
              ))
            )}
          </TabsContent>

          <TabsContent value="my-bids" className="space-y-3 mt-4">
            {!myBids || myBids.length === 0 ? (
              <EmptyState icon={Send} title="Henüz teklif vermediniz" desc="Açık ihaleler sekmesinden teklif verebilirsiniz." />
            ) : (
              myBids.map((bid: any) => (
                <MyBidCard key={bid.id} bid={bid} />
              ))
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active" data-testid="tab-active">
              Aktif İhaleler
              {openTenders.length > 0 && (
                <Badge className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 border-0">{openTenders.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-past">Geçmiş</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3 mt-4">
            {openTenders.length === 0 ? (
              <EmptyState icon={Gavel} title="Aktif ihale yok" desc="Yeni ihale oluşturmak için 'Yeni İhale Oluştur' butonuna tıklayın." />
            ) : (
              openTenders.map(t => <TenderCard key={t.id} tender={t} role="shipowner" />)
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-3 mt-4">
            {closedTenders.length === 0 ? (
              <EmptyState icon={FileText} title="Geçmiş ihale yok" />
            ) : (
              closedTenders.map(t => <TenderCard key={t.id} tender={t} role="shipowner" />)
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function MyBidCard({ bid }: { bid: any }) {
  const [, navigate] = useLocation();
  const { remaining, expired } = useCountdown(bid.tenderCreatedAt, bid.expiryHours);

  const statusConfig = {
    selected: { label: "Seçildi! 🎉", cls: "bg-emerald-100 text-emerald-700" },
    rejected: { label: "Reddedildi", cls: "bg-red-100 text-red-700" },
    pending: { label: "Değerlendiriliyor", cls: "bg-amber-100 text-amber-700" },
  }[bid.status as string] || { label: bid.status, cls: "bg-gray-100 text-gray-700" };

  return (
    <Card
      className="p-5 cursor-pointer hover:shadow-md transition-all"
      onClick={() => navigate(`/tenders/${bid.tenderId}`)}
      data-testid={`card-bid-${bid.id}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center">
            <Anchor className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
          </div>
          <div>
            <p className="font-medium text-sm">{bid.portName}</p>
            {bid.vesselName && <p className="text-xs text-muted-foreground">{bid.vesselName}</p>}
            {bid.totalAmount && (
              <p className="text-xs text-[hsl(var(--maritime-primary))] font-semibold mt-0.5">
                {bid.totalAmount} {bid.currency}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge className={`text-[10px] border-0 ${statusConfig.cls}`}>{statusConfig.label}</Badge>
          <span className="text-[11px] text-muted-foreground">
            {bid.tenderStatus === "open" ? remaining : "İhale kapandı"}
          </span>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="font-medium text-muted-foreground">{title}</p>
      {desc && <p className="text-sm text-muted-foreground max-w-xs">{desc}</p>}
    </div>
  );
}
