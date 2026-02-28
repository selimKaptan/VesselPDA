import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { UserCheck, Clock, CheckCircle2, XCircle, Ship, MapPin, Calendar, ChevronRight, Loader2, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { PageMeta } from "@/components/page-meta";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending:  { label: "Bekliyor",      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",   icon: Clock },
  accepted: { label: "Kabul Edildi",  color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",  icon: CheckCircle2 },
  declined: { label: "Reddedildi",    color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",          icon: XCircle },
};

const PURPOSE_LABELS: Record<string, string> = {
  loading:       "Yükleme",
  unloading:     "Boşaltma",
  bunkering:     "Yakıt İkmali",
  crew_change:   "Mürettebat Değişimi",
  transit:       "Transit",
  other:         "Diğer",
};

function NominationCard({ nom, role, onRespond }: { nom: any; role: "sent" | "received"; onRespond?: (id: number, status: string) => void }) {
  const sc = STATUS_CONFIG[nom.status] || STATUS_CONFIG.pending;
  const StatusIcon = sc.icon;
  const [, navigate] = useLocation();

  return (
    <div
      className={`border rounded-xl p-4 space-y-3 transition-all hover:shadow-md ${
        nom.status === "accepted" ? "border-green-200 dark:border-green-800/50 bg-green-50/30 dark:bg-green-950/10" :
        nom.status === "declined" ? "border-red-100 dark:border-red-900/30 opacity-70" :
        "bg-card border-border hover:border-[hsl(var(--maritime-primary)/0.4)]"
      }`}
      data-testid={`nomination-card-${nom.id}`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0">
            <Ship className="w-4.5 h-4.5 text-[hsl(var(--maritime-primary))]" />
          </div>
          <div>
            <p className="font-semibold text-sm">{nom.vesselName}</p>
            <p className="text-xs text-muted-foreground">
              {role === "sent"
                ? (nom.agentCompanyName || nom.agentName)
                : nom.nominatorName}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${sc.color}`}>
          <StatusIcon className="w-3 h-3" /> {sc.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {nom.portName}{nom.portCode ? ` (${nom.portCode})` : ""}
        </span>
        <span className="flex items-center gap-1.5">
          <UserCheck className="w-3 h-3 flex-shrink-0" />
          {PURPOSE_LABELS[nom.purposeOfCall] || nom.purposeOfCall}
        </span>
        {nom.eta && (
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            ETA: {new Date(nom.eta).toLocaleDateString("tr-TR")}
          </span>
        )}
        {nom.etd && (
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            ETD: {new Date(nom.etd).toLocaleDateString("tr-TR")}
          </span>
        )}
        <span className="col-span-2 text-[11px]">
          {new Date(nom.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
        </span>
      </div>

      {nom.notes && (
        <p className="text-xs text-muted-foreground bg-muted/40 px-3 py-2 rounded-lg italic">{nom.notes}</p>
      )}

      {role === "received" && nom.status === "pending" && onRespond && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700"
            onClick={() => onRespond(nom.id, "accepted")}
            data-testid={`button-accept-nomination-${nom.id}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Kabul Et
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => onRespond(nom.id, "declined")}
            data-testid={`button-decline-nomination-${nom.id}`}
          >
            <XCircle className="w-3.5 h-3.5 mr-1" /> Reddet
          </Button>
        </div>
      )}

      {nom.status === "accepted" && role === "received" && (
        <div className="pt-1">
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs gap-1.5 border-[hsl(var(--maritime-primary)/0.4)] text-[hsl(var(--maritime-primary))]"
            onClick={() => navigate(`/voyages?nominationId=${nom.id}&portId=${nom.portId}&vesselName=${encodeURIComponent(nom.vesselName)}&purposeOfCall=${encodeURIComponent(nom.purposeOfCall)}&agentUserId=${nom.nominatorUserId}`)}
            data-testid={`button-create-voyage-${nom.id}`}
          >
            <Ship className="w-3.5 h-3.5" /> Bu nominasyondan sefer oluştur
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Nominations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const effectiveRole = (user as any)?.userRole === "admin"
    ? ((user as any)?.activeRole || "shipowner")
    : (user as any)?.userRole;

  const { data, isLoading } = useQuery<{ sent: any[]; received: any[] }>({
    queryKey: ["/api/nominations"],
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/nominations/${id}/respond`, { status });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/nominations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nominations/pending-count"] });
      toast({
        title: vars.status === "accepted" ? "Nominasyon kabul edildi" : "Nominasyon reddedildi",
      });
    },
    onError: () => toast({ title: "İşlem başarısız", variant: "destructive" }),
  });

  const sent: any[] = data?.sent || [];
  const received: any[] = data?.received || [];
  const pendingReceived = received.filter(n => n.status === "pending").length;

  const defaultTab = effectiveRole === "agent" ? "received" : "sent";

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <PageMeta title="Nominasyonlar | VesselPDA" description="Doğrudan acente nominasyon sistemi" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold">Nominasyonlar</h1>
            <p className="text-xs text-muted-foreground">Doğrudan acente nominasyon sistemi</p>
          </div>
        </div>
        {(effectiveRole === "shipowner" || effectiveRole === "admin") && (
          <Link href="/directory">
            <Button size="sm" className="gap-1.5 bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-secondary))]" data-testid="button-find-agent">
              <Plus className="w-4 h-4" /> Acente Bul & Nomine Et
            </Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : (
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="sent" className="flex-1" data-testid="tab-sent">
              Gönderdiklerim
              {sent.length > 0 && <span className="ml-1.5 text-xs opacity-70">({sent.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="received" className="flex-1" data-testid="tab-received">
              Gelenler
              {pendingReceived > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] rounded-full font-bold">
                  {pendingReceived}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sent" className="mt-4 space-y-3">
            {sent.length === 0 ? (
              <Card className="p-10 text-center">
                <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium text-sm">Henüz nominasyon göndermediniz</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Dizin sayfasından bir acente profili görüntüleyerek "Nomine Et" butonunu kullanın.
                </p>
                <Link href="/directory">
                  <Button variant="outline" size="sm" className="mt-4 gap-1.5">
                    <ChevronRight className="w-4 h-4" /> Dizine Git
                  </Button>
                </Link>
              </Card>
            ) : (
              sent.map(nom => (
                <NominationCard key={nom.id} nom={nom} role="sent" />
              ))
            )}
          </TabsContent>

          <TabsContent value="received" className="mt-4 space-y-3">
            {received.length === 0 ? (
              <Card className="p-10 text-center">
                <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium text-sm">Henüz nominasyon almadınız</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Armatörler profil sayfanız üzerinden sizi nomine edebilir.
                </p>
              </Card>
            ) : (
              received.map(nom => (
                <NominationCard
                  key={nom.id}
                  nom={nom}
                  role="received"
                  onRespond={(id, status) => respondMutation.mutate({ id, status })}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
