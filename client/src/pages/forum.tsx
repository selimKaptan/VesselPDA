import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { MessageSquare, Eye, Clock, Plus, Search, Pin, Lock, Trash2, TrendingUp, Flame, Menu, X, ThumbsUp } from "lucide-react";
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
import { PageMeta } from "@/components/page-meta";

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
  likeCount: number;
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

interface MyLikes {
  topicIds: number[];
  replyIds: number[];
}

const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function timeAgo(timestamp: string | null): string {
  if (!timestamp) return "";
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} g`;
  const d = new Date(timestamp);
  return `${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTabState] = useState(() => getUrlParams().get("tab") || "latest");
  const [categoryFilter, setCategoryFilterState] = useState(() => getUrlParams().get("cat") || "all");
  const [searchQuery, setSearchQueryState] = useState(() => getUrlParams().get("q") || "");
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newIsAnonymous, setNewIsAnonymous] = useState(false);
  const [deleteTopicId, setDeleteTopicId] = useState<number | null>(null);
  // Optimistic like state: topicId → { liked, count }
  const [localLikes, setLocalLikes] = useState<Record<number, { liked: boolean; count: number }>>({});

  const setActiveTab = useCallback((v: string) => {
    setActiveTabState(v);
    setOffset(0);
    setAllTopics([]);
    setUrlParam("tab", v, "latest");
  }, []);

  const setCategoryFilter = useCallback((v: string) => {
    setCategoryFilterState(v);
    setOffset(0);
    setAllTopics([]);
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

  const [offset, setOffset] = useState(0);
  const [allTopics, setAllTopics] = useState<ForumTopicListItem[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  const { data: topics, isLoading, isFetching } = useQuery<ForumTopicListItem[]>({
    queryKey: ["/api/forum/topics", activeTab, categoryFilter, offset],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("sort", activeTab === "popular" ? "popular" : "latest");
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      if (categoryFilter && categoryFilter !== "all") {
        const cat = categories?.find(c => c.slug === categoryFilter);
        if (cat) params.set("categoryId", String(cat.id));
      }
      const res = await fetch(`/api/forum/topics?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch topics");
      return res.json();
    },
    enabled: !!categories || categoryFilter === "all",
  });

  useEffect(() => {
    if (!topics) return;
    if (offset === 0) {
      setAllTopics(topics);
    } else {
      setAllTopics(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const newItems = topics.filter(t => !existingIds.has(t.id));
        return [...prev, ...newItems];
      });
    }
    setHasMore(topics.length === PAGE_SIZE);
  }, [topics, offset]);

  const { data: myLikes } = useQuery<MyLikes>({
    queryKey: ["/api/forum/my-likes"],
    enabled: !!user,
    queryFn: async () => {
      const res = await fetch("/api/forum/my-likes", { credentials: "include" });
      if (!res.ok) return { topicIds: [], replyIds: [] };
      return res.json();
    },
  });

  // Sync server likes into local state
  useEffect(() => {
    if (!myLikes || !allTopics.length) return;
    const likedSet = new Set(myLikes.topicIds);
    setLocalLikes(prev => {
      const newLocal: Record<number, { liked: boolean; count: number }> = { ...prev };
      for (const t of allTopics) {
        if (!newLocal[t.id]) {
          newLocal[t.id] = {
            liked: likedSet.has(t.id),
            count: t.likeCount ?? 0,
          };
        }
      }
      return newLocal;
    });
  }, [myLikes, allTopics]);

  const likeMutation = useMutation({
    mutationFn: async (topicId: number) => {
      const res = await apiRequest("POST", `/api/forum/topics/${topicId}/like`);
      return res.json();
    },
    onSuccess: (data: { liked: boolean; likeCount: number }, topicId: number) => {
      setLocalLikes(prev => ({ ...prev, [topicId]: { liked: data.liked, count: data.likeCount } }));
      queryClient.invalidateQueries({ queryKey: ["/api/forum/my-likes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forum/topics"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update like.", variant: "destructive" });
    },
  });

  const handleLike = (e: React.MouseEvent, topicId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast({ title: "Sign in required", description: "Log in to like topics." });
      return;
    }
    // Optimistic update
    const current = localLikes[topicId] ?? { liked: false, count: 0 };
    setLocalLikes(prev => ({
      ...prev,
      [topicId]: { liked: !current.liked, count: current.liked ? current.count - 1 : current.count + 1 },
    }));
    likeMutation.mutate(topicId);
  };

  const createTopicMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; categoryId: number; isAnonymous: boolean }) => {
      const res = await apiRequest("POST", "/api/forum/topics", data);
      return res.json();
    },
    onSuccess: () => {
      setOffset(0);
      setAllTopics([]);
      queryClient.invalidateQueries({ queryKey: ["/api/forum/topics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forum/categories"] });
      setShowNewTopic(false);
      setNewTitle("");
      setNewContent("");
      setNewCategoryId("");
      setNewIsAnonymous(false);
      toast({ title: "Topic created", description: "Your discussion has been published." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Could not create topic", variant: "destructive" });
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
      toast({ title: "Topic deleted", description: "The discussion has been removed." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Could not delete topic", variant: "destructive" });
    },
  });

  const filteredTopics = allTopics.filter(t => {
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
      <PageMeta title="Maritime Forum | VesselPDA" description="Discuss maritime topics with ship agents, shipowners, and service providers worldwide." />
      {!user && (
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
            <a href="/" className="flex items-center gap-2" data-testid="link-home">
              <img src="/logo-v2.png" alt="VesselPDA" className="w-9 h-9 rounded-md object-contain" />
              <span className="font-serif font-bold text-lg tracking-tight">VesselPDA</span>
            </a>
            <div className="hidden md:flex items-center gap-8">
              <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-home">Home</a>
              <a href="/directory" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-directory">Directory</a>
              <a href="/service-ports" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-service-ports">Ports</a>
              <a href="/forum" className="text-sm font-medium text-foreground transition-colors" data-testid="link-nav-forum">Forum</a>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <a href="/login">
                <Button variant="outline" data-testid="button-forum-login">Log in</Button>
              </a>
              <a href="/register">
                <Button data-testid="button-forum-signup">Sign up</Button>
              </a>
            </div>
            <div className="flex md:hidden items-center gap-2">
              <a href="/register">
                <Button size="sm" data-testid="button-forum-signup-mobile">Sign up</Button>
              </a>
              <button
                onClick={() => setMobileMenuOpen(o => !o)}
                className="p-2 rounded-md hover:bg-muted transition-colors"
                data-testid="button-forum-mobile-menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-border/60 bg-background/95 backdrop-blur-md" data-testid="forum-mobile-menu">
              <div className="px-6 py-4 flex flex-col gap-1">
                {[
                  { href: "/", label: "Home" },
                  { href: "/directory", label: "Directory" },
                  { href: "/service-ports", label: "Service Ports" },
                  { href: "/forum", label: "Forum" },
                ].map(item => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2.5 rounded-md text-sm font-medium hover:bg-muted transition-colors"
                  >{item.label}</a>
                ))}
                <div className="pt-2 border-t border-border mt-1">
                  <a href="/login" className="block">
                    <Button variant="outline" className="w-full mb-2" size="sm">Log in</Button>
                  </a>
                </div>
              </div>
            </div>
          )}
        </nav>
      )}

      {/* Header */}
      <div className={`border-b bg-gradient-to-br from-[hsl(var(--maritime-primary)/0.06)] via-[hsl(var(--maritime-primary)/0.03)] to-transparent ${!user ? "mt-16" : ""}`}>
        <div className="max-w-7xl mx-auto px-3 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--maritime-primary)/0.15)] to-[hsl(var(--maritime-primary)/0.05)] border border-[hsl(var(--maritime-primary)/0.2)] flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
              </div>
              <div>
                <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-forum-title">Forum</h1>
                <p className="text-sm text-muted-foreground">Discuss with the maritime community</p>
              </div>
            </div>
            {user ? (
              <Button onClick={openNewTopicWithCategory} className="gap-2 flex-shrink-0" data-testid="button-new-topic">
                <Plus className="w-4 h-4" /> New Topic
              </Button>
            ) : (
              <a href="/login">
                <Button variant="outline" className="gap-2 flex-shrink-0" data-testid="button-login-to-post">
                  <Plus className="w-4 h-4" /> Start Topic
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 py-5">

        {/* Discourse-style tab bar */}
        <div className="flex items-center gap-0 border-b mb-0 -mx-3 px-3">
          <button
            onClick={() => setActiveTab("latest")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              activeTab === "latest"
                ? "border-[hsl(var(--maritime-primary))] text-[hsl(var(--maritime-primary))]"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
            data-testid="tab-latest"
          >
            <Clock className="w-3.5 h-3.5" /> En son
          </button>
          <button
            onClick={() => setActiveTab("popular")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              activeTab === "popular"
                ? "border-[hsl(var(--maritime-primary))] text-[hsl(var(--maritime-primary))]"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
            data-testid="tab-popular"
          >
            <Flame className="w-3.5 h-3.5" /> Popüler
          </button>
          <div className="flex-1" />
          <div className="relative w-44 sm:w-56 flex-shrink-0 pb-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Konu ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-sm"
              data-testid="input-search-forum"
            />
          </div>
        </div>

        {/* Category pills */}
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
            {allTopics.length > 0 && <span className="ml-1 opacity-70">({allTopics.length}{hasMore ? "+" : ""})</span>}
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

        {/* Compose prompt */}
        {user ? (
          <button
            onClick={openNewTopicWithCategory}
            className="w-full flex items-center gap-3 px-4 py-3.5 mb-4 rounded-lg border-2 border-dashed border-[hsl(var(--maritime-primary)/0.25)] bg-[hsl(var(--maritime-primary)/0.03)] hover:border-[hsl(var(--maritime-primary)/0.5)] hover:bg-[hsl(var(--maritime-primary)/0.06)] hover:shadow-sm transition-all text-left group"
            data-testid="button-compose-prompt"
          >
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarImage src={(user as any)?.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs bg-[hsl(var(--maritime-primary))] text-white">
                {((user as any)?.firstName?.[0] || "") + ((user as any)?.lastName?.[0] || "")}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              {activeCategoryObj ? `Start a topic in ${activeCategoryObj.name}...` : "Start a new discussion..."}
            </span>
            <span className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--maritime-primary))]">
              <Plus className="w-3.5 h-3.5" /> New Topic
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3.5 mb-4 rounded-lg border-2 border-dashed border-border bg-muted/10">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="flex-1 text-sm text-muted-foreground">Sign in to post or reply</span>
            <a href="/login">
              <Button size="sm" variant="outline" className="flex-shrink-0" data-testid="button-login-compose">Sign in</Button>
            </a>
          </div>
        )}

        {/* Topic list */}
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-6 w-20 hidden sm:block" />
                <Skeleton className="h-4 w-8 hidden sm:block" />
                <Skeleton className="h-4 w-8 hidden sm:block" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        ) : !filteredTopics?.length ? (
          <Card className="p-10 text-center border-dashed mt-4">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-semibold mb-1">
              {searchQuery ? "Konu bulunamadı" : activeCategoryObj ? `${activeCategoryObj.name} kategorisinde henüz konu yok` : "Henüz konu yok"}
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              {searchQuery ? "Farklı bir arama terimi deneyin." : "İlk konuyu başlatan siz olun!"}
            </p>
            {user ? (
              <Button onClick={openNewTopicWithCategory} className="gap-2 mx-auto" data-testid="button-new-topic-empty">
                <Plus className="w-4 h-4" />
                {activeCategoryObj ? `${activeCategoryObj.name} — Konu Başlat` : "Konu Başlat"}
              </Button>
            ) : (
              <a href="/login">
                <Button variant="outline" className="gap-2 mx-auto" data-testid="button-login-empty">
                  <Plus className="w-4 h-4" /> Tartışmaya katılmak için giriş yapın
                </Button>
              </a>
            )}
          </Card>
        ) : (
          <>
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b bg-muted/30">
            <span>Konu</span>
            <span className="w-24 text-center">Katılımcılar</span>
            <span className="w-12 text-center">Yanıtlar</span>
            <span className="w-14 text-center">Görüntü</span>
            <span className="w-16 text-right">Aktivite</span>
          </div>

          <div className="divide-y" data-testid="forum-topic-list">
            {filteredTopics.map(topic => {
              const likeState = localLikes[topic.id] ?? { liked: false, count: topic.likeCount ?? 0 };

              // Build participant list: OP first, then reply authors (deduped)
              const opParticipant: TopicParticipant = {
                userId: topic.userId,
                firstName: topic.authorFirstName,
                lastName: topic.authorLastName,
                profileImageUrl: topic.authorImage,
              };
              const allParticipants: TopicParticipant[] = topic.isAnonymous
                ? []
                : [opParticipant, ...(topic.participants || []).filter(p => p.userId !== topic.userId)];
              const visibleParticipants = allParticipants.slice(0, 4);
              const extraCount = allParticipants.length - visibleParticipants.length;

              return (
                <Link key={topic.id} href={`/forum/${topic.id}`} data-testid={`link-topic-${topic.id}`}>
                  <div className="group grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 gap-y-0 items-center px-3 py-3 hover:bg-muted/40 transition-colors cursor-pointer">

                    {/* Topic title + meta (left col) */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        {topic.isPinned && <Pin className="w-3 h-3 text-[hsl(var(--maritime-primary))] flex-shrink-0" />}
                        {topic.isLocked && <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                        <span
                          className="font-semibold text-sm leading-snug line-clamp-1 group-hover:text-[hsl(var(--maritime-primary))] transition-colors"
                          data-testid={`text-topic-title-${topic.id}`}
                        >
                          {topic.title}
                        </span>
                        {/* Delete on hover */}
                        {user && (user.id === topic.userId || (user as any).userRole === "admin") && (
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTopicId(topic.id); }}
                            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground ml-1"
                            data-testid={`button-delete-topic-${topic.id}`}
                            title="Sil"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-4 gap-1 flex-shrink-0"
                          style={{ borderColor: topic.categoryColor + "50", color: topic.categoryColor }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: topic.categoryColor }} />
                          {topic.categoryName}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {topic.isAnonymous ? "Anonim Kullanıcı" : `${topic.authorFirstName || ""} ${topic.authorLastName || ""}`.trim()}
                        </span>
                        {/* Like pill (inline with meta) */}
                        {likeState.count > 0 && (
                          <button
                            onClick={(e) => handleLike(e, topic.id)}
                            className={`flex items-center gap-1 text-[10px] transition-all rounded px-1.5 py-0.5 font-medium ${
                              likeState.liked
                                ? "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
                                : "text-muted-foreground hover:text-blue-600"
                            }`}
                            data-testid={`button-like-topic-${topic.id}`}
                          >
                            <ThumbsUp className="w-3 h-3" />
                            {likeState.count}
                          </button>
                        )}
                        {likeState.count === 0 && (
                          <button
                            onClick={(e) => handleLike(e, topic.id)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-blue-600 transition-colors px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100"
                            data-testid={`button-like-topic-${topic.id}`}
                          >
                            <ThumbsUp className="w-3 h-3" /> Beğen
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Participants avatar stack (hidden on mobile) */}
                    <div className="hidden sm:flex items-center justify-center w-24">
                      <div className="flex -space-x-2">
                        {topic.isAnonymous ? (
                          <Avatar className="w-7 h-7 border-2 border-background ring-1 ring-border">
                            <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">?</AvatarFallback>
                          </Avatar>
                        ) : (
                          <>
                            {visibleParticipants.map((p, idx) => (
                              <Avatar key={p.userId + idx} className="w-7 h-7 border-2 border-background ring-1 ring-border">
                                <AvatarImage src={p.profileImageUrl || undefined} />
                                <AvatarFallback className="text-[9px] bg-[hsl(var(--maritime-primary))] text-white">
                                  {(p.firstName?.[0] || "") + (p.lastName?.[0] || "")}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {extraCount > 0 && (
                              <div className="w-7 h-7 rounded-full border-2 border-background ring-1 ring-border bg-muted flex items-center justify-center text-[9px] font-semibold text-muted-foreground">
                                +{extraCount}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Reply count (hidden on mobile) */}
                    <div className="hidden sm:flex items-center justify-center w-12">
                      <span className="text-sm text-muted-foreground font-medium">{topic.replyCount}</span>
                    </div>

                    {/* View count (hidden on mobile) */}
                    <div className="hidden sm:flex items-center justify-center w-14">
                      <span className="text-sm text-muted-foreground">{topic.viewCount}</span>
                    </div>

                    {/* Activity (shown on all) */}
                    <div className="flex items-center justify-end w-16 sm:w-16">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(topic.lastActivityAt)}</span>
                    </div>

                  </div>
                </Link>
              );
            })}
          </div>
          {!searchQuery && hasMore && (
            <div className="flex justify-center mt-4 pb-2">
              <Button
                variant="outline"
                onClick={() => setOffset(prev => prev + PAGE_SIZE)}
                disabled={isFetching}
                data-testid="button-load-more-topics"
              >
                {isFetching ? "Yükleniyor..." : "Daha Fazla Konu Yükle"}
              </Button>
            </div>
          )}
          </>
        )}
      </div>

      {/* New Topic Dialog */}
      <Dialog open={showNewTopic} onOpenChange={setShowNewTopic}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Start a New Discussion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="topic-category">Category</Label>
              <Select value={newCategoryId} onValueChange={setNewCategoryId}>
                <SelectTrigger id="topic-category" data-testid="select-topic-category">
                  <SelectValue placeholder="Select a category..." />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map(cat => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topic-title">Title</Label>
              <Input
                id="topic-title"
                placeholder="What would you like to discuss?"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                data-testid="input-new-topic-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topic-content">Content</Label>
              <Textarea
                id="topic-content"
                placeholder="Share your thoughts, questions, or insights..."
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                rows={5}
                data-testid="input-new-topic-content"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="anonymous"
                checked={newIsAnonymous}
                onCheckedChange={(v) => setNewIsAnonymous(!!v)}
                data-testid="checkbox-anonymous"
              />
              <Label htmlFor="anonymous" className="text-sm font-normal cursor-pointer">Post anonymously</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTopic(false)} data-testid="button-cancel-new-topic">Cancel</Button>
            <Button
              onClick={handleCreateTopic}
              disabled={!newTitle.trim() || !newContent.trim() || !newCategoryId || createTopicMutation.isPending}
              data-testid="button-submit-new-topic"
            >
              {createTopicMutation.isPending ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTopicId} onOpenChange={() => setDeleteTopicId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this topic?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The topic and all its replies will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTopicId && deleteTopicMutation.mutate(deleteTopicId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
              disabled={deleteTopicMutation.isPending}
            >
              {deleteTopicMutation.isPending ? "Deleting..." : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
