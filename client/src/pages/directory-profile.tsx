import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { Building2, Phone, Mail, Globe, MapPin, Star, Ship, Anchor, ArrowLeft, MessageSquare, FileText, MessageCircle, Loader2, UserCheck, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
            className={`w-5 h-5 transition-all duration-150 ${!readonly && "group-hover:scale-110"} ${(hovered || value) >= star ? "fill-amber-400 text-amber-400 drop-shadow-sm" : "text-muted-foreground/30 hover:text-amber-300"}`}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: any }) {
  const displayName = review.reviewerFirstName
    ? `${review.reviewerFirstName}${review.reviewerLastName ? ` ${review.reviewerLastName}` : ""}`
    : "Shipowner/Broker";

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
              {new Date(review.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
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
  const [showNominateDialog, setShowNominateDialog] = useState(false);
  const [portQuery, setPortQuery] = useState("");
  const [portSearchOpen, setPortSearchOpen] = useState(false);
  const [nomForm, setNomForm] = useState({
    portId: 0, portName: "", vesselName: "",
    purposeOfCall: "other", eta: "", etd: "", notes: "",
  });

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

  const { data: agentStats } = useQuery<any>({
    queryKey: ["/api/agent-stats", profileId],
    queryFn: async () => {
      const res = await fetch(`/api/agent-stats/${profileId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!profileId,
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
      toast({ title: "Review submitted", description: "Thank you!" });
      setRating(0);
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/reviews", profileId] });
    },
    onError: async (err: any) => {
      const data = await err?.response?.json?.().catch(() => ({}));
      toast({ title: "Error", description: data?.message || "Could not submit review", variant: "destructive" });
    },
  });

  const currentUserId = (user as any)?.id || (user as any)?.claims?.sub;
  const canMessage = user && profile?.userId && profile.userId !== currentUserId;

  const messageMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/messages/start", {
        targetUserId: profile!.userId,
        message: `Merhaba, ${profile!.companyName} profilinizi inceledim ve sizinle iletişime geçmek istedim.`,
      });
      return res.json();
    },
    onSuccess: (data) => {
      navigate(`/messages/${data.conversationId}`);
    },
    onError: () => toast({ title: "Mesaj gönderilemedi", variant: "destructive" }),
  });

  const canNominate = user && profile?.companyType === "agent" && profile?.userId !== currentUserId
    && (effectiveRole === "shipowner" || (user as any)?.userRole === "admin");

  const { data: portSearchResults } = useQuery<Port[]>({
    queryKey: ["/api/ports/search", portQuery],
    queryFn: async () => {
      if (portQuery.length < 2) return [];
      const res = await fetch(`/api/ports/search?q=${encodeURIComponent(portQuery)}`);
      return res.json();
    },
    enabled: portQuery.length >= 2,
  });

  const nominateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/nominations", {
        agentUserId: profile!.userId,
        agentCompanyId: profileId,
        portId: nomForm.portId,
        vesselName: nomForm.vesselName,
        purposeOfCall: nomForm.purposeOfCall,
        eta: nomForm.eta || undefined,
        etd: nomForm.etd || undefined,
        notes: nomForm.notes || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Nominasyon gönderildi", description: `${profile!.companyName} acentesi bilgilendirildi.` });
      setShowNominateDialog(false);
      setNomForm({ portId: 0, portName: "", vesselName: "", purposeOfCall: "other", eta: "", etd: "", notes: "" });
      setPortQuery("");
      navigate("/nominations");
    },
    onError: () => toast({ title: "Nominasyon gönderilemedi", variant: "destructive" }),
  });

  const handleSubmitReview = () => {
    if (rating === 0) {
      toast({ title: "Please rate", description: "Please select a rating between 1 and 5", variant: "destructive" });
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
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center">
        <p className="text-muted-foreground">Company profile not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/directory")}>
          Back to Directory
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate("/directory")} data-testid="button-back-directory">
        <ArrowLeft className="w-4 h-4" /> Back to Directory
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
              <Badge variant="secondary" className="text-xs capitalize">{profile.companyType === "agent" ? "Ship Agent" : "Service Provider"}</Badge>
              {profile.isFeatured && <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">Featured</Badge>}
            </div>

            {avgRating && (
              <div className="flex items-center gap-2 mb-2" data-testid="text-avg-rating">
                <div className="flex">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} className={`w-4 h-4 ${parseFloat(avgRating) >= s ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />
                  ))}
                </div>
                <span className="text-sm font-semibold">{avgRating}</span>
                <span className="text-xs text-muted-foreground">({reviews.length} reviews)</span>
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

            {(canMessage || canNominate) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {canMessage && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 h-8 text-xs"
                    onClick={() => messageMutation.mutate()}
                    disabled={messageMutation.isPending}
                    data-testid="button-send-message"
                  >
                    {messageMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                    Mesaj Gönder
                  </Button>
                )}
                {canNominate && (
                  <Button
                    size="sm"
                    className="gap-2 h-8 text-xs bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-secondary))]"
                    onClick={() => setShowNominateDialog(true)}
                    data-testid="button-nominate-agent"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Nomine Et
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

      </Card>

      {/* Company Description */}
      {profile.description && (
        <Card className="overflow-hidden" data-testid="card-company-description">
          <div className="px-5 py-3 flex items-center gap-2" style={{ background: "linear-gradient(90deg, #003D7A, #0077BE)" }}>
            <FileText className="w-4 h-4 text-white/80" />
            <h2 className="text-sm font-bold tracking-wide text-white uppercase">Company Description</h2>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{profile.description}</p>
          </div>
        </Card>
      )}

      {/* Agent Performance Metrics */}
      {profile.companyType === "agent" && agentStats && (agentStats.totalBids > 0 || agentStats.totalReviews > 0) && (
        <Card className="p-5" data-testid="card-agent-metrics">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-500" /> Agent Performance
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted/40 rounded-lg">
              <p className="text-2xl font-bold text-[hsl(var(--maritime-primary))]">{agentStats.winRate}%</p>
              <p className="text-xs text-muted-foreground mt-0.5">Win Rate</p>
            </div>
            <div className="text-center p-3 bg-muted/40 rounded-lg">
              <p className="text-2xl font-bold">{agentStats.totalBids}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total Bids</p>
            </div>
            <div className="text-center p-3 bg-muted/40 rounded-lg">
              <p className="text-2xl font-bold text-amber-500">{agentStats.avgRating > 0 ? agentStats.avgRating : "—"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Avg Rating</p>
            </div>
            <div className="text-center p-3 bg-muted/40 rounded-lg">
              <p className="text-2xl font-bold">{agentStats.totalReviews}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Reviews</p>
            </div>
          </div>
        </Card>
      )}

      {/* Ports & Services */}
      {(servedPorts.length > 0 || serviceTypes.length > 0) && (
        <Card className="p-5 space-y-4">
          {servedPorts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Anchor className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" /> Served Ports
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
                <Building2 className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" /> Service Types
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
          Reviews
          {reviews.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">({reviews.length})</span>
          )}
        </h2>

        {/* Submit review form — shipowners only, agent profiles only */}
        {canReview && (
          <Card className="p-5 mb-4 border-[hsl(var(--maritime-primary)/0.2)] bg-[hsl(var(--maritime-primary)/0.02)]">
            <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              Rate this agent
            </h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Your Rating <span className="text-red-500">*</span></Label>
                <StarRating value={rating} onChange={setRating} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Comment (optional)</Label>
                <Textarea
                  placeholder="Share your experience working with this agent..."
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
                {reviewMutation.isPending ? "Submitting..." : "Submit Review"}
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
            <p className="text-sm text-muted-foreground">No reviews yet</p>
            {canReview && <p className="text-xs text-muted-foreground mt-1">Be the first to leave a review</p>}
          </Card>
        ) : (
          <div className="space-y-3">
            {reviews.map((review: any) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        )}
      </div>

      {/* Nomination Dialog */}
      <Dialog open={showNominateDialog} onOpenChange={setShowNominateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
              {profile?.companyName}'i Nomine Et
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Port Search */}
            <div className="space-y-1.5">
              <Label>Liman *</Label>
              <div className="relative">
                <Input
                  value={portQuery}
                  onChange={e => { setPortQuery(e.target.value); setPortSearchOpen(true); }}
                  onFocus={() => setPortSearchOpen(true)}
                  placeholder="Liman ara... (en az 2 harf)"
                  data-testid="input-nom-port"
                />
                {nomForm.portId > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600 font-medium">✓</span>
                )}
                {portSearchOpen && portSearchResults && portSearchResults.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {portSearchResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onMouseDown={() => {
                          setNomForm(f => ({ ...f, portId: p.id, portName: p.name }));
                          setPortQuery(p.name + (p.code ? ` (${p.code})` : ""));
                          setPortSearchOpen(false);
                        }}
                      >
                        <span className="font-medium">{p.name}</span>
                        {p.code && <span className="ml-2 text-xs text-muted-foreground">{p.code}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Vessel Name */}
            <div className="space-y-1.5">
              <Label>Gemi Adı *</Label>
              <Input
                value={nomForm.vesselName}
                onChange={e => setNomForm(f => ({ ...f, vesselName: e.target.value }))}
                placeholder="Gemi adı girin"
                data-testid="input-nom-vessel"
              />
            </div>

            {/* Purpose */}
            <div className="space-y-1.5">
              <Label>Seferin Amacı *</Label>
              <Select value={nomForm.purposeOfCall} onValueChange={v => setNomForm(f => ({ ...f, purposeOfCall: v }))}>
                <SelectTrigger data-testid="select-nom-purpose">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loading">Yükleme</SelectItem>
                  <SelectItem value="unloading">Boşaltma</SelectItem>
                  <SelectItem value="bunkering">Yakıt İkmali</SelectItem>
                  <SelectItem value="crew_change">Mürettebat Değişimi</SelectItem>
                  <SelectItem value="transit">Transit</SelectItem>
                  <SelectItem value="other">Diğer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ETA / ETD */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> ETA *</Label>
                <Input
                  type="datetime-local"
                  value={nomForm.eta}
                  onChange={e => setNomForm(f => ({ ...f, eta: e.target.value }))}
                  data-testid="input-nom-eta"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> ETD</Label>
                <Input
                  type="datetime-local"
                  value={nomForm.etd}
                  onChange={e => setNomForm(f => ({ ...f, etd: e.target.value }))}
                  data-testid="input-nom-etd"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notlar</Label>
              <Textarea
                value={nomForm.notes}
                onChange={e => setNomForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Acente için ek bilgi veya talepler..."
                rows={2}
                data-testid="textarea-nom-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNominateDialog(false)}>İptal</Button>
            <Button
              onClick={() => nominateMutation.mutate()}
              disabled={nominateMutation.isPending || !nomForm.portId || !nomForm.vesselName.trim() || !nomForm.eta}
              className="bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-secondary))]"
              data-testid="button-confirm-nominate"
            >
              {nominateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserCheck className="w-4 h-4 mr-2" />}
              Nominasyonu Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
