import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { MessageSquare, Eye, Clock, Plus, Search, Pin, Lock, Trash2, TrendingUp, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ForumCategory {
  id: number;
  name: string;
  slug: string;
  color: string;
  description: string | null;
  topicCount: number;
}

interface TopicParticipant {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

interface ForumTopicListItem {
  id: number;
  title: string;
  content: string;
  isAnonymous: boolean;
  viewCount: number;
  replyCount: number;
  isPinned: boolean;
  isLocked: boolean;
  lastActivityAt: string | null;
  createdAt: string | null;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  categoryColor: string;
  userId: string;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorImage: string | null;
  participants: TopicParticipant[];
}

function timeAgo(timestamp: string | null): string {
  if (!timestamp) return "";
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins}dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}s önce`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}g önce`;
  return new Date(timestamp).toLocaleDateString("tr-TR", { month: "short", year: "numeric" });
}

function getUrlParams() {
  return new URLSearchParams(window.location.search);
}

function setUrlParam(key: string, value: string, defaultValue: string) {
  const params = getUrlParams();
  if (value === defaultValue) {
    params.delete(key);
  } else {
    params.set(key, value);
  }
  const query = params.toString();
  window.history.replaceState(null, "", `/forum${query ? "?" + query : ""}`);
}

export default function Forum() {
  const { user } = useAuth();
  const { toast } = useToast();
  const pillsRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTabState] = useState(() => getUrlParams().get("tab") || "latest");
  const [categoryFilter, setCategoryFilterState] = useState(() => getUrlParams().get("cat") || "all");
  const [searchQuery, setSearchQueryState] = useState(() => getUrlParams().get("q") || "");
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newIsAnonymous, setNewIsAnonymous] = useState(false);
  const [deleteTopicId, setDeleteTopicId] = useState<number | null>(null);

  const setActiveTab = useCallback((v: string) => {
    setActiveTabState(v);
    setUrlParam("tab", v, "latest");
  }, []);

  const setCategoryFilter = useCallback((v: string) => {
    setCategoryFilterState(v);
    setUrlParam("cat", v, "all");
  }, []);

  const setSearchQuery = useCallback((v: string) => {
    setSearchQueryState(v);
    setUrlParam("q", v, "");
  }, []);

  useEffect(() => {
    sessionStorage.setItem("forumReturnSearch", window.location.search);
  }, [activeTab, categoryFilter, searchQuery]);

  const { data: categories } = useQuery<ForumCategory[]>({
    queryKey: ["/api/forum/categories"],
  });

  const { data: topics, isLoading } = useQuery<ForumTopicListItem[]>({
    queryKey: ["/api/forum/topics", activeTab, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("sort", activeTab === "popular" ? "popular" : "latest");
      if (categoryFilter && categoryFilter !== "all") {
        const cat = categories?.find(c => c.slug === categoryFilter);
        if (cat) params.set("categoryId", String(cat.id));
      }
      const res = await fetch(`/api/forum/topics?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch topics");
      return res.json();
    },
  });

  const createTopicMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; categoryId: number; isAnonymous: boolean }) => {
      const res = await apiRequest("POST", "/api/forum/topics", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/topics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forum/categories"] });
      setShowNewTopic(false);
      setNewTitle("");
      setNewContent("");
      setNewCategoryId("");
      setNewIsAnonymous(false);
      toast({ title: "Konu oluşturuldu", description: "Tartışma konunuz yayınlandı." });
    },
    onError: (err: any) => {
      toast({ title: "Hata", description: err.message || "Konu oluşturulamadı", variant: "destructive" });
    },
  });

  const deleteTopicMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/forum/topics/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/topics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forum/categories"] });
      setDeleteTopicId(null);
      toast({ title: "Konu silindi", description: "Tartışma konusu kaldırıldı." });
    },
    onError: (err: any) => {
      toast({ title: "Hata", description: err.message || "Konu silinemedi", variant: "destructive" });
    },
  });

  const filteredTopics = topics?.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.categoryName.toLowerCase().includes(q);
  });

  const handleCreateTopic = () => {
    if (!newTitle.trim() || !newContent.trim() || !newCategoryId) return;
    createTopicMutation.mutate({
      title: newTitle.trim(),
      content: newContent.trim(),
      categoryId: Number(newCategoryId),
      isAnonymous: newIsAnonymous,
    });
  };

  const openNewTopicWithCategory = () => {
    if (categoryFilter !== "all") {
      const cat = categories?.find(c => c.slug === categoryFilter);
      if (cat) setNewCategoryId(String(cat.id));
    }
    setShowNewTopic(true);
  };

  const activeCategoryObj = categories?.find(c => c.slug === categoryFilter);

  return (
    <div className="min-h-screen bg-background">
      {!user && (
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
            <a href="/" className="flex items-center gap-2" data-testid="link-home">
              <img src="/logo-v2.png" alt="VesselPDA" className="w-9 h-9 rounded-md object-contain" />
              <span className="font-serif font-bold text-lg tracking-tight">VesselPDA</span>
            </a>
            <div className="hidden md:flex items-center gap-8">
              <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-home">Anasayfa</a>
              <a href="/directory" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-directory">Rehber</a>
              <a href="/service-ports" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-service-ports">Limanlar</a>
              <a href="/forum" className="text-sm font-medium text-foreground transition-colors" data-testid="link-nav-forum">Forum</a>
            </div>
            <div className="flex items-center gap-3">
              <a href="/api/login">
                <Button variant="outline" data-testid="button-forum-login">Giriş Yap</Button>
              </a>
              <a href="/api/login">
                <Button data-testid="button-forum-signup">Üye Ol</Button>
              </a>
            </div>
          </div>
        </nav>
      )}

      {/* Header */}
      <div className={`border-b bg-gradient-to-br from-[hsl(var(--maritime-primary)/0.06)] via-[hsl(var(--maritime-primary)/0.03)] to-transparent ${!user ? "mt-16" : ""}`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--maritime-primary)/0.15)] to-[hsl(var(--maritime-primary)/0.05)] border border-[hsl(var(--maritime-primary)/0.2)] flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
              </div>
              <div>
                <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-forum-title">Forum</h1>
                <p className="text-sm text-muted-foreground">Denizcilik topluluğuyla tartışın</p>
              </div>
            </div>
            {user ? (
              <Button onClick={openNewTopicWithCategory} className="gap-2 flex-shrink-0" data-testid="button-new-topic">
                <Plus className="w-4 h-4" /> Yeni Konu
              </Button>
            ) : (
              <a href="/api/login">
                <Button variant="outline" className="gap-2 flex-shrink-0" data-testid="button-login-to-post">
                  <Plus className="w-4 h-4" /> Konu Aç
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">

        {/* Sort tabs + search bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg flex-shrink-0">
            <button
              onClick={() => setActiveTab("latest")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "latest"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="tab-latest"
            >
              <Clock className="w-3.5 h-3.5" /> Son Eklenen
            </button>
            <button
              onClick={() => setActiveTab("popular")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "popular"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="tab-popular"
            >
              <Flame className="w-3.5 h-3.5" /> Popüler
            </button>
          </div>

          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Konu ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-forum"
            />
          </div>
        </div>

        {/* Category pills — single source of truth */}
        <div
          ref={pillsRef}
          className="flex items-center gap-2 overflow-x-auto pb-3 mb-5 scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <button
            onClick={() => setCategoryFilter("all")}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              categoryFilter === "all"
                ? "bg-[hsl(var(--maritime-primary))] text-white border-[hsl(var(--maritime-primary))]"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 bg-background"
            }`}
            data-testid="pill-category-all"
          >
            Tümü
            {topics && <span className="ml-1 opacity-70">({topics.length})</span>}
          </button>
          {categories?.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.slug)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                categoryFilter === cat.slug
                  ? "text-white border-transparent"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 bg-background"
              }`}
              style={categoryFilter === cat.slug ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
              data-testid={`pill-category-${cat.slug}`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: categoryFilter === cat.slug ? "white" : cat.color, opacity: categoryFilter === cat.slug ? 0.8 : 1 }}
              />
              {cat.name}
              <span className="opacity-60">({cat.topicCount})</span>
            </button>
          ))}
        </div>

        {/* Active category banner when filtered */}
        {activeCategoryObj && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg mb-4 border"
            style={{
              backgroundColor: activeCategoryObj.color + "10",
              borderColor: activeCategoryObj.color + "30",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: activeCategoryObj.color }} />
              <span className="text-sm font-medium">{activeCategoryObj.name}</span>
              {activeCategoryObj.description && (
                <span className="text-xs text-muted-foreground hidden sm:inline">— {activeCategoryObj.description}</span>
              )}
            </div>
            <button
              onClick={() => setCategoryFilter("all")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              data-testid="button-clear-category"
            >
              Temizle ×
            </button>
          </div>
        )}

        {/* Topic list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : !filteredTopics?.length ? (
          <Card className="p-10 text-center border-dashed">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-semibold mb-1">
              {searchQuery ? "Eşleşen konu bulunamadı" : activeCategoryObj ? `${activeCategoryObj.name} kategorisinde henüz konu yok` : "Henüz konu yok"}
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              {searchQuery
                ? "Farklı bir arama terimi deneyin ya da tüm kategorilere bakın."
                : "İlk tartışmayı sen başlat!"}
            </p>
            {user ? (
              <Button onClick={openNewTopicWithCategory} className="gap-2 mx-auto" data-testid="button-new-topic-empty">
                <Plus className="w-4 h-4" />
                {activeCategoryObj ? `${activeCategoryObj.name} — Konu Aç` : "Konu Aç"}
              </Button>
            ) : (
              <a href="/api/login">
                <Button variant="outline" className="gap-2 mx-auto" data-testid="button-login-empty">
                  <Plus className="w-4 h-4" /> Tartışmaya katılmak için giriş yapın
                </Button>
              </a>
            )}
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredTopics.map(topic => (
              <Link key={topic.id} href={`/forum/${topic.id}`} data-testid={`link-topic-${topic.id}`}>
                <div
                  className="group flex gap-3 sm:gap-4 p-4 rounded-lg border bg-card hover:shadow-sm hover:border-[hsl(var(--maritime-primary)/0.25)] transition-all cursor-pointer"
                  style={{ borderLeft: `3px solid ${topic.categoryColor}60` }}
                >
                  {/* Author avatar */}
                  <div className="flex-shrink-0 pt-0.5">
                    {topic.isAnonymous ? (
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs bg-muted text-muted-foreground">?</AvatarFallback>
                      </Avatar>
                    ) : (
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={topic.authorImage || undefined} />
                        <AvatarFallback className="text-xs bg-[hsl(var(--maritime-primary))] text-white">
                          {(topic.authorFirstName?.[0] || "") + (topic.authorLastName?.[0] || "")}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          {topic.isPinned && <Pin className="w-3 h-3 text-[hsl(var(--maritime-primary))] flex-shrink-0" />}
                          {topic.isLocked && <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                          <span className="font-semibold text-sm leading-snug line-clamp-2" data-testid={`text-topic-title-${topic.id}`}>
                            {topic.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 gap-1 flex-shrink-0"
                            style={{ borderColor: topic.categoryColor + "50", color: topic.categoryColor }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: topic.categoryColor }} />
                            {topic.categoryName}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {topic.isAnonymous ? "Anonim" : [topic.authorFirstName, topic.authorLastName].filter(Boolean).join(" ") || "Kullanıcı"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">·</span>
                          <span className="text-[11px] text-muted-foreground">{timeAgo(topic.lastActivityAt)}</span>
                        </div>
                      </div>

                      {/* Delete button (desktop hover) */}
                      {user && (user.id === topic.userId || (user as any).userRole === "admin") && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTopicId(topic.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all flex-shrink-0"
                          data-testid={`button-delete-topic-${topic.id}`}
                          title="Konuyu sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="w-3 h-3" />
                        <span data-testid={`text-reply-count-${topic.id}`}>{topic.replyCount}</span>
                        <span className="hidden sm:inline">yanıt</span>
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="w-3 h-3" />
                        {topic.viewCount}
                        <span className="hidden sm:inline">görüntüleme</span>
                      </span>
                      {topic.participants && topic.participants.length > 0 && (
                        <div className="flex items-center -space-x-1.5 ml-auto">
                          {topic.participants.slice(0, 5).map((p, i) => (
                            <Avatar key={i} className="w-5 h-5 border-2 border-background">
                              <AvatarImage src={p.profileImageUrl || undefined} />
                              <AvatarFallback className="text-[8px] bg-muted">
                                {(p.firstName?.[0] || "") + (p.lastName?.[0] || "")}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Login to participate notice for guests */}
        {!user && filteredTopics && filteredTopics.length > 0 && (
          <div className="mt-6 p-4 rounded-lg border border-dashed bg-muted/20 text-center">
            <p className="text-sm text-muted-foreground mb-2">Tartışmalara katılmak için giriş yapın</p>
            <a href="/api/login">
              <Button size="sm" variant="outline" data-testid="button-login-join">Giriş Yap / Üye Ol</Button>
            </a>
          </div>
        )}
      </div>

      {/* New Topic Dialog */}
      <Dialog open={showNewTopic} onOpenChange={setShowNewTopic}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Yeni Tartışma Konusu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="topic-title">Başlık</Label>
              <Input
                id="topic-title"
                placeholder="Ne hakkında konuşmak istiyorsunuz?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                data-testid="input-topic-title"
              />
            </div>
            <div>
              <Label htmlFor="topic-category">Kategori</Label>
              <Select value={newCategoryId} onValueChange={setNewCategoryId}>
                <SelectTrigger data-testid="select-topic-category">
                  <SelectValue placeholder="Kategori seçin" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map(cat => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="topic-content">İçerik</Label>
              <Textarea
                id="topic-content"
                placeholder="Düşüncelerinizi, sorularınızı veya içgörülerinizi paylaşın..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={6}
                data-testid="input-topic-content"
              />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <Checkbox
                id="anonymous-check"
                checked={newIsAnonymous}
                onCheckedChange={(checked) => setNewIsAnonymous(checked === true)}
                data-testid="checkbox-anonymous"
              />
              <div>
                <Label htmlFor="anonymous-check" className="font-medium cursor-pointer">Anonim olarak paylaş</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">İsminiz gizlenir, sadece içerik görünür. Yanıtlar her zaman isimlidir.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTopic(false)} data-testid="button-cancel-topic">İptal</Button>
            <Button
              onClick={handleCreateTopic}
              disabled={!newTitle.trim() || !newContent.trim() || !newCategoryId || createTopicMutation.isPending}
              data-testid="button-submit-topic"
            >
              {createTopicMutation.isPending ? "Gönderiliyor..." : "Konuyu Yayınla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTopicId !== null} onOpenChange={(open) => { if (!open) setDeleteTopicId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bu konuyu silmek istiyor musunuz?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem geri alınamaz. Konu ve tüm yanıtları kalıcı olarak silinecektir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTopicId !== null && deleteTopicMutation.mutate(deleteTopicId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
              disabled={deleteTopicMutation.isPending}
            >
              {deleteTopicMutation.isPending ? "Siliniyor..." : "Evet, Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
