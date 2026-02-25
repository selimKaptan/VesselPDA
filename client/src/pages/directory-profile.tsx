import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { Building2, Phone, Mail, Globe, MapPin, Star, Ship, Anchor, ArrowLeft, MessageSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Port, CompanyProfile } from "@shared/schema";

function StarRating({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={`p-0.5 transition-colors ${readonly ? "cursor-default" : "cursor-pointer"}`}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          data-testid={readonly ? undefined : `star-${star}`}
        >
          <Star
            className={`w-5 h-5 ${(hovered || value) >= star ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: any }) {
  const displayName = review.reviewerFirstName
    ? `${review.reviewerFirstName}${review.reviewerLastName ? ` ${review.reviewerLastName}` : ""}`
    : "Armatör";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5">
          <Avatar className="w-8 h-8">
            <AvatarImage src={review.reviewerProfileImage} />
            <AvatarFallback className="text-xs bg-[hsl(var(--maritime-primary)/0.1)] text-[hsl(var(--maritime-primary))]">
              {displayName[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{displayName}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(review.createdAt).toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
        <StarRating value={review.rating} readonly />
      </div>

      {(review.vesselName || review.portName) && (
        <div className="flex flex-wrap gap-3 mb-2 text-xs text-muted-foreground">
          {review.vesselName && (
            <span className="flex items-center gap-1">
              <Ship className="w-3 h-3" /> {review.vesselName}
            </span>
          )}
          {review.portName && (
            <span className="flex items-center gap-1">
              <Anchor className="w-3 h-3" /> {review.portName}
            </span>
          )}
        </div>
      )}

      {review.comment && (
        <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
      )}
    </Card>
  );
}

export default function DirectoryProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const profileId = parseInt(id!);

  const { data: profile, isLoading: profileLoading } = useQuery<CompanyProfile>({
    queryKey: ["/api/directory", profileId],
    queryFn: async () => {
      const res = await fetch(`/api/directory/${profileId}`);
      if (!res.ok) throw new Error("Profile not found");
      return res.json();
    },
  });

  const { data: reviews = [], isLoading: reviewsLoading, refetch: refetchReviews } = useQuery<any[]>({
    queryKey: ["/api/reviews", profileId],
    queryFn: async () => {
      const res = await fetch(`/api/reviews/${profileId}`);
      if (!res.ok) throw new Error("Failed to load reviews");
      return res.json();
    },
  });

  const { data: ports } = useQuery<Port[]>({ queryKey: ["/api/ports"] });

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const effectiveRole = (user as any)?.userRole === "admin"
    ? ((user as any)?.activeRole || "shipowner")
    : (user as any)?.userRole;
  const canReview = user && effectiveRole === "shipowner" && profile?.companyType === "agent";

  const reviewMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/reviews", {
      companyProfileId: profileId,
      rating,
      comment: comment || undefined,
    }),
    onSuccess: () => {
      toast({ title: "Değerlendirmeniz alındı", description: "Teşekkürler!" });
      setRating(0);
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/reviews", profileId] });
    },
    onError: async (err: any) => {
      const data = await err?.response?.json?.().catch(() => ({}));
      toast({ title: "Hata", description: data?.message || "Değerlendirme gönderilemedi", variant: "destructive" });
    },
  });

  const handleSubmitReview = () => {
    if (rating === 0) {
      toast({ title: "Puan giriniz", description: "Lütfen 1-5 arası puan seçiniz", variant: "destructive" });
      return;
    }
    reviewMutation.mutate();
  };

  const getPortName = (portId: number) => ports?.find(p => p.id === portId)?.name || `Port #${portId}`;

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  const servedPorts = (profile?.servedPorts as number[]) || [];
  const serviceTypes = (profile?.serviceTypes as string[]) || [];

  if (profileLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center">
        <p className="text-muted-foreground">Şirket profili bulunamadı.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/directory")}>
          Dizine Dön
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate("/directory")} data-testid="button-back-directory">
        <ArrowLeft className="w-4 h-4" /> Dizine Dön
      </Button>

      {/* Company Header */}
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center flex-shrink-0 overflow-hidden border">
            {profile.logoUrl ? (
              <img src={profile.logoUrl} alt={profile.companyName} className="w-full h-full object-contain" data-testid="img-company-logo" />
            ) : profile.companyType === "agent" ? (
              <Anchor className="w-7 h-7 text-[hsl(var(--maritime-primary))]" />
            ) : (
              <Building2 className="w-7 h-7 text-[hsl(var(--maritime-primary))]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="font-bold text-xl" data-testid="text-company-name">{profile.companyName}</h1>
              <Badge variant="secondary" className="text-xs capitalize">{profile.companyType === "agent" ? "Acente" : "Servis Sağlayıcı"}</Badge>
              {profile.isFeatured && <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">Öne Çıkan</Badge>}
            </div>

            {avgRating && (
              <div className="flex items-center gap-2 mb-2" data-testid="text-avg-rating">
                <div className="flex">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} className={`w-4 h-4 ${parseFloat(avgRating) >= s ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />
                  ))}
                </div>
                <span className="text-sm font-semibold">{avgRating}</span>
                <span className="text-xs text-muted-foreground">({reviews.length} değerlendirme)</span>
              </div>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {profile.city && (
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{profile.city}{profile.country ? `, ${profile.country}` : ""}</span>
              )}
              {profile.phone && (
                <a href={`tel:${profile.phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors" data-testid="link-phone">
                  <Phone className="w-3.5 h-3.5" /> {profile.phone}
                </a>
              )}
              {profile.email && (
                <a href={`mailto:${profile.email}`} className="flex items-center gap-1 hover:text-foreground transition-colors" data-testid="link-email">
                  <Mail className="w-3.5 h-3.5" /> {profile.email}
                </a>
              )}
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors" data-testid="link-website">
                  <Globe className="w-3.5 h-3.5" /> Website
                </a>
              )}
            </div>
          </div>
        </div>

        {profile.description && (
          <>
            <Separator className="my-4" />
            <p className="text-sm text-muted-foreground leading-relaxed">{profile.description}</p>
          </>
        )}
      </Card>

      {/* Ports & Services */}
      {(servedPorts.length > 0 || serviceTypes.length > 0) && (
        <Card className="p-5 space-y-4">
          {servedPorts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Anchor className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" /> Hizmet Verilen Limanlar
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {servedPorts.map((portId: number) => (
                  <Badge key={portId} variant="outline" className="text-xs">{getPortName(portId)}</Badge>
                ))}
              </div>
            </div>
          )}
          {servedPorts.length > 0 && serviceTypes.length > 0 && <Separator />}
          {serviceTypes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" /> Hizmet Türleri
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {serviceTypes.map((s: string) => (
                  <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Reviews section */}
      <div>
        <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          Değerlendirmeler
          {reviews.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">({reviews.length})</span>
          )}
        </h2>

        {/* Submit review form — shipowners only, agent profiles only */}
        {canReview && (
          <Card className="p-5 mb-4 border-[hsl(var(--maritime-primary)/0.2)] bg-[hsl(var(--maritime-primary)/0.02)]">
            <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              Bu acenteyi değerlendirin
            </h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Puanınız <span className="text-red-500">*</span></Label>
                <StarRating value={rating} onChange={setRating} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Yorum (opsiyonel)</Label>
                <Textarea
                  placeholder="Bu acenteyle çalışma deneyiminizi paylaşın..."
                  rows={3}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  data-testid="input-review-comment"
                />
              </div>
              <Button
                onClick={handleSubmitReview}
                disabled={reviewMutation.isPending}
                size="sm"
                className="gap-1.5"
                data-testid="button-submit-review"
              >
                <Star className="w-3.5 h-3.5" />
                {reviewMutation.isPending ? "Gönderiliyor..." : "Değerlendirmeyi Gönder"}
              </Button>
            </div>
          </Card>
        )}

        {reviewsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : reviews.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <Star className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Henüz değerlendirme bulunmuyor</p>
            {canReview && <p className="text-xs text-muted-foreground mt-1">İlk değerlendirmeyi siz yapın</p>}
          </Card>
        ) : (
          <div className="space-y-3">
            {reviews.map((review: any) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
