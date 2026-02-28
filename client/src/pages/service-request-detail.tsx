import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Wrench, Fuel, ShoppingCart, Users as UsersIcon, Sparkles, HelpCircle, MapPin, Calendar, Ship, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { useAuth } from "@/hooks/use-auth";

const SERVICE_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  fuel:         { label: "Yakıt / Bunker", icon: Fuel,         color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900/20" },
  repair:       { label: "Teknik Tamir",   icon: Wrench,       color: "text-red-500",    bg: "bg-red-100 dark:bg-red-900/20" },
  provisioning: { label: "Provizyonlama",  icon: ShoppingCart, color: "text-green-500",  bg: "bg-green-100 dark:bg-green-900/20" },
  crew_change:  { label: "Mürettebat",     icon: UsersIcon,    color: "text-blue-500",   bg: "bg-blue-100 dark:bg-blue-900/20" },
  cleaning:     { label: "Temizlik",       icon: Sparkles,     color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/20" },
  other:        { label: "Diğer",          icon: HelpCircle,   color: "text-gray-500",   bg: "bg-gray-100 dark:bg-gray-800" },
};

const REQ_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:            { label: "Açık",           color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  offers_received: { label: "Teklif Geldi",   color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  selected:        { label: "Teklif Seçildi", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  completed:       { label: "Tamamlandı",     color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
  cancelled:       { label: "İptal",          color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
};

export default function ServiceRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const reqId = parseInt(id || "0");
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: request, isLoading } = useQuery<any>({
    queryKey: ["/api/service-requests", reqId],
    queryFn: async () => {
      const res = await fetch(`/api/service-requests/${reqId}`);
      return res.json();
    },
  });

  const userId = (user as any)?.id || (user as any)?.claims?.sub;
  const isRequester = request?.requesterId === userId;

  const selectMutation = useMutation({
    mutationFn: async (offerId: number) => {
      const res = await apiRequest("POST", `/api/service-requests/${reqId}/offers/${offerId}/select`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests", reqId] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({ title: "Teklif seçildi" });
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/service-requests/${reqId}/status`, { status: "completed" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests", reqId] });
      toast({ title: "Talep tamamlandı olarak işaretlendi" });
    },
  });

  if (isLoading) {
    return (
      <div className="px-3 py-5 space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Talep bulunamadı.</p>
        <Link href="/service-requests"><Button variant="outline" className="mt-4">Geri Dön</Button></Link>
      </div>
    );
  }

  const cfg = SERVICE_TYPE_CONFIG[request.serviceType] || SERVICE_TYPE_CONFIG.other;
  const TypeIcon = cfg.icon;
  const statusCfg = REQ_STATUS_CONFIG[request.status] || REQ_STATUS_CONFIG.open;
  const offers: any[] = request.offers || [];

  return (
    <div className="px-3 py-5 space-y-6 max-w-2xl mx-auto">
      <PageMeta title="Hizmet Talebi Detayı | VesselPDA" description="Hizmet talebi detayı ve teklifler" />

      <Link href="/service-requests">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Hizmet Talepleri
        </button>
      </Link>

      {/* Request Header */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
              <TypeIcon className={`w-6 h-6 ${cfg.color}`} />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold">{cfg.label}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1"><Ship className="w-3.5 h-3.5" />{request.vesselName}</p>
            </div>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusCfg.color}`}>{statusCfg.label}</span>
        </div>

        <div className="mt-4 space-y-3">
          <p className="text-sm">{request.description}</p>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {request.portName && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{request.portName}</span>}
            {request.preferredDate && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(request.preferredDate).toLocaleDateString("tr-TR")}</span>}
            {request.quantity && <span>{request.quantity} {request.unit}</span>}
          </div>
        </div>

        {isRequester && request.status === "selected" && (
          <Button size="sm" variant="outline" className="mt-4 gap-2" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
            <CheckCircle2 className="w-4 h-4" /> Tamamlandı Olarak İşaretle
          </Button>
        )}
      </Card>

      {/* Offers */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          Teklifler ({offers.length})
        </h2>

        {offers.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <p className="text-sm">Henüz teklif gelmedi.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {offers.map((offer: any) => {
              const isSelected = offer.status === "selected";
              const isRejected = offer.status === "rejected";
              return (
                <Card key={offer.id} className={`p-4 ${isSelected ? "ring-2 ring-green-500/30 bg-green-50/50 dark:bg-green-950/20" : ""}`} data-testid={`offer-detail-${offer.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm">{offer.providerName}</p>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Seçildi
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Reddedildi</span>
                        )}
                      </div>
                      {offer.estimatedDuration && <p className="text-xs text-muted-foreground mb-1">Süre: {offer.estimatedDuration}</p>}
                      {offer.notes && <p className="text-xs text-muted-foreground">{offer.notes}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-lg">{offer.price.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{offer.currency}</span></p>
                      {isRequester && !isSelected && !isRejected && (request.status === "open" || request.status === "offers_received") && (
                        <Button
                          size="sm"
                          className="mt-2 h-7 text-xs"
                          onClick={() => selectMutation.mutate(offer.id)}
                          disabled={selectMutation.isPending}
                          data-testid={`button-select-offer-${offer.id}`}
                        >
                          Bu Teklifi Seç
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
