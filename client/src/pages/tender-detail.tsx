import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Gavel, ArrowLeft, Clock, Ship, FileText, Upload, CheckCircle2,
  XCircle, Building2, Trophy, Mail, AlertCircle, Eye, Send, Star
} from "lucide-react";

function useCountdown(createdAt: string, expiryHours: number) {
  const [remaining, setRemaining] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const expiresAt = new Date(createdAt).getTime() + expiryHours * 3600000;
    const update = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) { setRemaining("Süresi Doldu"); setExpired(true); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(`${h}s ${m}dk kaldı`); setExpired(false);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [createdAt, expiryHours]);

  return { remaining, expired };
}

function BidCard({
  bid, isOwner, onSelect, onViewPdf
}: {
  bid: any; isOwner: boolean; onSelect: (bidId: number) => void; onViewPdf: (bidId: number) => void;
}) {
  const statusConfig = {
    selected: { label: "Seçildi", cls: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" /> },
    rejected: { label: "Reddedildi", cls: "bg-red-100 text-red-700", icon: <XCircle className="w-4 h-4 text-red-500" /> },
    pending: { label: "Beklemede", cls: "bg-amber-100 text-amber-700", icon: null },
  }[bid.status as string] || { label: bid.status, cls: "bg-gray-100 text-gray-600", icon: null };

  return (
    <Card className={`p-5 transition-all ${bid.status === "selected" ? "ring-2 ring-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10" : ""}`}
      data-testid={`card-bid-${bid.id}`}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[hsl(var(--maritime-primary)/0.12)]">
          {bid.companyLogoUrl
            ? <img src={bid.companyLogoUrl} alt={bid.companyName} className="w-full h-full object-contain" />
            : <Building2 className="w-6 h-6 text-[hsl(var(--maritime-primary))]" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-sm">
                {bid.companyName || `${bid.agentFirstName} ${bid.agentLastName}`}
              </p>
              {bid.totalAmount && (
                <p className="text-lg font-bold text-[hsl(var(--maritime-primary))] mt-0.5">
                  {bid.totalAmount} <span className="text-sm font-normal text-muted-foreground">{bid.currency}</span>
                </p>
              )}
              {bid.notes && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{bid.notes}</p>
              )}
            </div>
            <Badge className={`text-[10px] border-0 flex items-center gap-1 ${statusConfig.cls}`}>
              {statusConfig.icon}{statusConfig.label}
            </Badge>
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {(bid.hasPdf || bid.proformaPdfBase64) && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
                onClick={() => onViewPdf(bid.id)} data-testid={`button-view-pdf-${bid.id}`}>
                <Eye className="w-3.5 h-3.5" /> Proforma Görüntüle
              </Button>
            )}
            {isOwner && bid.status === "pending" && (
              <Button size="sm" className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => onSelect(bid.id)} data-testid={`button-select-bid-${bid.id}`}>
                <Trophy className="w-3.5 h-3.5" /> Bu Teklifi Seç
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function SubmitBidForm({ tenderId, onSuccess }: { tenderId: number; onSuccess: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ notes: "", totalAmount: "", currency: "USD" });
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Dosya çok büyük", description: "Maksimum 5MB PDF yükleyebilirsiniz.", variant: "destructive" });
      return;
    }
    const allowed = ["application/pdf", "image/jpg", "image/jpeg", "image/png"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|jpg|jpeg|png)$/i)) {
      toast({ title: "Hatalı format", description: "PDF, JPG veya PNG dosyası yükleyiniz.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => { setPdfBase64(ev.target?.result as string); setPdfName(file.name); };
    reader.readAsDataURL(file);
  };

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/tenders/${tenderId}/bids`, data),
    onSuccess: () => {
      toast({ title: "Teklifiniz gönderildi!", description: "Armatör teklifinizi inceleyecek." });
      onSuccess();
    },
    onError: async (err: any) => {
      const data = await err.response?.json().catch(() => ({}));
      toast({ title: "Hata", description: data.message || "Teklif gönderilemedi", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!form.totalAmount) {
      toast({ title: "Eksik Alan", description: "Fiyat giriniz", variant: "destructive" });
      return;
    }
    if (!form.notes) {
      toast({ title: "Eksik Alan", description: "Açıklama giriniz", variant: "destructive" });
      return;
    }
    if (!pdfBase64) {
      toast({ title: "Eksik Alan", description: "PDA dosyası yükleyiniz", variant: "destructive" });
      return;
    }
    mutation.mutate({ ...form, proformaPdfBase64: pdfBase64 });
  };

  return (
    <Card className="p-5 border-[hsl(var(--maritime-primary)/0.2)] bg-[hsl(var(--maritime-primary)/0.02)]">
      <h3 className="font-semibold mb-4 flex items-center gap-2 text-sm">
        <Gavel className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
        Teklif Ver
      </h3>
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <Label>Fiyat <span className="text-red-500">*</span></Label>
            <Input
              placeholder="ör. 8,500"
              value={form.totalAmount}
              onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
              data-testid="input-total-amount"
            />
          </div>
          <div className="w-28 space-y-1.5">
            <Label>Para Birimi</Label>
            <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
              <SelectTrigger data-testid="select-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="TRY">TRY</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Açıklama <span className="text-red-500">*</span></Label>
          <Textarea
            placeholder="Teklif hakkında açıklama ekleyiniz..."
            rows={3}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            data-testid="input-bid-notes"
          />
        </div>

        <div className="space-y-1.5">
          <Label>PDA Dosyası <span className="text-red-500">*</span> <span className="text-muted-foreground text-xs font-normal">(PDF / JPG, maks. 5MB)</span></Label>
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${pdfName ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/10" : "hover:bg-muted/30 border-border"}`}
            onClick={() => fileRef.current?.click()}
            data-testid="dropzone-pdf"
          >
            {pdfName ? (
              <div className="flex items-center justify-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">{pdfName}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="w-6 h-6" />
                <span className="text-sm">PDA dosyasını yüklemek için tıklayın</span>
                <span className="text-xs">PDF, JPG, PNG desteklenir</span>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFile} data-testid="input-pdf-file" />
          {pdfBase64 && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="gap-1.5 text-xs"
              onClick={() => {
                const win = window.open();
                if (win) {
                  win.document.write(
                    `<iframe src="${pdfBase64}" width="100%" height="100%" style="border:none;margin:0;padding:0;height:100vh;"></iframe>`
                  );
                }
              }}
              data-testid="button-preview-pdf"
            >
              <Eye className="w-3.5 h-3.5" /> Önizle
            </Button>
          )}
        </div>

        <Button onClick={handleSubmit} disabled={mutation.isPending} className="w-full gap-2" data-testid="button-submit-bid">
          {mutation.isPending ? "Gönderiliyor..." : (<><Send className="w-4 h-4" /> Teklif Gönder</>)}
        </Button>
      </div>
    </Card>
  );
}

export default function TenderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectBidId, setSelectBidId] = useState<number | null>(null);
  const [showNomination, setShowNomination] = useState(false);
  const [nominationData, setNominationData] = useState<any>(null);

  const tenderId = parseInt(id!);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/tenders", tenderId],
    queryFn: async () => {
      const res = await fetch(`/api/tenders/${tenderId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  const selectMutation = useMutation({
    mutationFn: (bidId: number) => apiRequest("POST", `/api/tenders/${tenderId}/bids/${bidId}/select`, {}),
    onSuccess: () => {
      toast({ title: "Teklif seçildi!", description: "Nominasyon onaylamak için devam edin." });
      setSelectBidId(null);
      refetch();
    },
    onError: async (err: any) => {
      const data = await err.response?.json().catch(() => ({}));
      toast({ title: "Hata", description: data.message || "İşlem başarısız", variant: "destructive" });
    },
  });

  const nominateMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tenders/${tenderId}/nominate`, {}),
    onSuccess: async (res: any) => {
      const d = await res.json();
      setNominationData(d.nominatedAgent);
      setShowNomination(false);
      toast({
        title: "Nominasyon tamamlandı!",
        description: `${d.nominatedAgent.companyName} başarıyla nomiye edildi.`,
      });
      refetch();
    },
    onError: async (err: any) => {
      const d = await err.response?.json().catch(() => ({}));
      toast({ title: "Hata", description: d.message || "Nominasyon başarısız", variant: "destructive" });
    },
  });

  const handleViewPdf = async (bidId: number) => {
    const res = await fetch(`/api/tenders/${tenderId}/bids/${bidId}/pdf`, { credentials: "include" });
    const data = await res.json();
    if (data.proformaPdfBase64) {
      const win = window.open();
      if (win) {
        win.document.write(`<iframe src="${data.proformaPdfBase64}" width="100%" height="100%" style="border:none;margin:0;padding:0;overflow:hidden;height:100vh;"></iframe>`);
      }
    } else {
      toast({ title: "PDF bulunamadı", description: "Acente PDF yüklememiş.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-24 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 py-20">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">İhale bulunamadı</p>
        <Button variant="outline" onClick={() => navigate("/tenders")}>Geri Dön</Button>
      </div>
    );
  }

  const { tender, bids, myBid, isOwner } = data;
  const { remaining, expired } = (() => {
    const expiresAt = new Date(tender.createdAt).getTime() + tender.expiryHours * 3600000;
    const diff = expiresAt - Date.now();
    if (diff <= 0) return { remaining: "Süresi Doldu", expired: true };
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return { remaining: `${h}s ${m}dk kaldı`, expired: false };
  })();

  const selectedBid = bids?.find((b: any) => b.status === "selected");
  const pendingBids = bids?.filter((b: any) => b.status === "pending") || [];
  const allBids = bids || [];

  const statusColor = {
    open: "bg-emerald-100 text-emerald-700",
    closed: "bg-blue-100 text-blue-700",
    cancelled: "bg-red-100 text-red-700",
    nominated: "bg-purple-100 text-purple-700",
  }[tender.status as string] || "bg-gray-100 text-gray-600";

  const statusLabel = {
    open: "Açık",
    closed: "Kapandı",
    cancelled: "İptal Edildi",
    nominated: "Nominasyon Yapıldı",
  }[tender.status as string] || tender.status;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tenders")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-1" /> Geri
        </Button>
      </div>

      {/* Tender Info */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center flex-shrink-0">
              <Gavel className="w-6 h-6 text-[hsl(var(--maritime-primary))]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-bold">{tender.portName}</h1>
                <Badge className={`text-[10px] border-0 ${statusColor}`}>{statusLabel}</Badge>
              </div>
              {tender.vesselName && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Ship className="w-4 h-4" /> {tender.vesselName}
                </div>
              )}
            </div>
          </div>
          <div className={`flex items-center gap-1.5 text-sm font-medium ${expired || tender.status !== "open" ? "text-muted-foreground" : "text-amber-600"}`}>
            <Clock className="w-4 h-4" />
            {tender.status === "open" ? remaining : statusLabel}
          </div>
        </div>

        <Separator className="my-4" />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {/* Vessel info */}
          {tender.flag && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Bayrak</p>
              <p>{tender.flag}</p>
            </div>
          )}
          {tender.grt && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">GRT</p>
              <p>{Number(tender.grt).toLocaleString("tr-TR")}</p>
            </div>
          )}
          {tender.nrt && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">NRT</p>
              <p>{Number(tender.nrt).toLocaleString("tr-TR")}</p>
            </div>
          )}
          {/* Cargo info */}
          {tender.cargoType && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Yük Türü</p>
              <p>{tender.cargoType}</p>
            </div>
          )}
          {tender.cargoQuantity && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Yük Miktarı</p>
              <p>{tender.cargoQuantity}</p>
            </div>
          )}
          {tender.previousPort && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Önceki Liman</p>
              <p>{tender.previousPort}</p>
            </div>
          )}
          {/* Legacy cargoInfo */}
          {tender.cargoInfo && !tender.cargoType && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Kargo</p>
              <p>{tender.cargoInfo}</p>
            </div>
          )}
          {tender.description && (
            <div className="col-span-2 md:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Açıklama</p>
              <p>{tender.description}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">İhale Süresi</p>
            <p>{tender.expiryHours} Saat</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Oluşturulma</p>
            <p>{new Date(tender.createdAt).toLocaleString("tr-TR")}</p>
          </div>
        </div>

        {/* Q88 Download */}
        {tender.q88Base64 && (
          <>
            <Separator className="my-4" />
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              <span className="text-sm font-medium">Q88 Formu</span>
              <a
                href={tender.q88Base64}
                download="Q88_Form"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs text-[hsl(var(--maritime-primary))] hover:underline font-medium flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" /> Görüntüle / İndir
              </a>
            </div>
          </>
        )}
      </Card>

      {/* Nomination success banner */}
      {nominationData && (
        <Card className="p-5 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">Nominasyon Tamamlandı</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                <strong>{nominationData.companyName}</strong> nomiye edildi.
                {nominationData.email && ` (${nominationData.email})`}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Tender closed/nominated status */}
      {tender.status === "nominated" && !nominationData && (
        <Card className="p-5 bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-purple-600" />
              <p className="font-medium text-purple-800 dark:text-purple-300">Bu ihale için nominasyon tamamlandı.</p>
            </div>
            {isOwner && (() => {
              const nominatedBid = allBids?.find((b: any) => b.status === "selected");
              return nominatedBid?.agentCompanyId ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-100"
                  onClick={() => navigate(`/directory/${nominatedBid.agentCompanyId}`)}
                  data-testid="button-review-agent"
                >
                  <Star className="w-3.5 h-3.5" /> Bu Acenteyi Değerlendir
                </Button>
              ) : null;
            })()}
          </div>
        </Card>
      )}

      {/* Owner: bid list */}
      {isOwner && allBids.length > 0 && (
        <div>
          <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
            Gelen Teklifler ({allBids.length})
          </h2>
          <div className="space-y-3">
            {allBids.map((bid: any) => (
              <BidCard
                key={bid.id}
                bid={bid}
                isOwner={isOwner && tender.status === "open"}
                onSelect={(bidId) => setSelectBidId(bidId)}
                onViewPdf={handleViewPdf}
              />
            ))}
          </div>

          {selectedBid && tender.status === "closed" && (
            <div className="mt-4">
              <Button
                className="gap-2 bg-purple-600 hover:bg-purple-700"
                onClick={() => setShowNomination(true)}
                data-testid="button-nominate"
              >
                <Mail className="w-4 h-4" /> Nominasyon Onayla
              </Button>
            </div>
          )}
        </div>
      )}

      {isOwner && allBids.length === 0 && tender.status === "open" && (
        <Card className="p-8 flex flex-col items-center gap-3 text-center border-dashed">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <FileText className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-muted-foreground">Henüz teklif gelmedi</p>
          <p className="text-sm text-muted-foreground">Acenteler tekliflerini değerlendiriyor...</p>
        </Card>
      )}

      {/* Agent: submit bid or show my bid */}
      {!isOwner && (
        <div>
          {myBid ? (
            <Card className="p-5">
              <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Teklifiniz Gönderildi
              </h2>
              <div className="space-y-2 text-sm">
                {myBid.totalAmount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tutar</span>
                    <span className="font-semibold text-[hsl(var(--maritime-primary))]">
                      {myBid.totalAmount} {myBid.currency}
                    </span>
                  </div>
                )}
                {myBid.notes && (
                  <div>
                    <span className="text-muted-foreground">Not: </span>
                    <span>{myBid.notes}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-muted-foreground">Durum</span>
                  <Badge className={`text-[10px] border-0 ${
                    myBid.status === "selected" ? "bg-emerald-100 text-emerald-700" :
                    myBid.status === "rejected" ? "bg-red-100 text-red-700" :
                    "bg-amber-100 text-amber-700"
                  }`}>
                    {myBid.status === "selected" ? "Seçildi! 🎉" : myBid.status === "rejected" ? "Reddedildi" : "Değerlendiriliyor"}
                  </Badge>
                </div>
                {myBid.proformaPdfBase64 && (
                  <Button size="sm" variant="outline" className="w-full gap-2 mt-2"
                    onClick={() => handleViewPdf(myBid.id)} data-testid="button-my-pdf">
                    <Eye className="w-3.5 h-3.5" /> Yüklediğim Proformayı Gör
                  </Button>
                )}
              </div>

              {myBid.status === "selected" && (
                <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Teklifiniz seçildi! Armatör nominasyon onayı yapacak.
                  </p>
                </div>
              )}
            </Card>
          ) : tender.status === "open" && !expired ? (
            <SubmitBidForm tenderId={tenderId} onSuccess={() => refetch()} />
          ) : (
            <Card className="p-5 text-center text-muted-foreground">
              <p className="text-sm">Bu ihale artık teklif kabul etmiyor.</p>
            </Card>
          )}
        </div>
      )}

      {/* Select bid confirmation dialog */}
      <AlertDialog open={selectBidId !== null} onOpenChange={(o) => !o && setSelectBidId(null)}>
        <AlertDialogContent data-testid="dialog-select-bid">
          <AlertDialogHeader>
            <AlertDialogTitle>Teklifi Seç</AlertDialogTitle>
            <AlertDialogDescription>
              Bu teklifi seçtiğinizde diğer teklifler reddedilecek ve ihale kapanacak.
              Ardından nominasyon onayı yapabileceksiniz. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-select">İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectBidId && selectMutation.mutate(selectBidId)}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-confirm-select"
            >
              {selectMutation.isPending ? "İşleniyor..." : "Evet, Bu Teklifi Seç"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Nomination confirmation dialog */}
      <AlertDialog open={showNomination} onOpenChange={setShowNomination}>
        <AlertDialogContent data-testid="dialog-nominate">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-purple-600" />
              Nominasyon Onayla
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedBid && (
                <span>
                  <strong>{selectedBid.companyName || `${selectedBid.agentFirstName} ${selectedBid.agentLastName}`}</strong> firmасına nominasyon bildirimi gönderilecek.
                  {selectedBid.agentEmail && <> ({selectedBid.agentEmail})</>}
                  {" "}Onaylıyor musunuz?
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-nominate">İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => nominateMutation.mutate()}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="button-confirm-nominate"
            >
              {nominateMutation.isPending ? "İşleniyor..." : "Evet, Nomiye Et"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
