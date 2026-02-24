import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { MessageSquare, Eye, Clock, Plus, Search, Pin, Lock, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  authorFirstName: string | null;
  authorLastName: string | null;
  authorImage: string | null;
  participants: TopicParticipant[];
}

function timeAgo(timestamp: string | null): string {
  if (!timestamp) return "";
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function formatDate(timestamp: string | null): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export default function Forum() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("latest");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showNewTopic, setShowNewTopic] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");

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
    enabled: activeTab !== "categories",
  });

  const createTopicMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; categoryId: number }) => {
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
      toast({ title: "Topic created", description: "Your discussion topic has been posted." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create topic", variant: "destructive" });
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
    });
  };

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
              <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-home">Home</a>
              <a href="/directory" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-directory">Directory</a>
              <a href="/service-ports" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-service-ports">Service Ports</a>
              <a href="/forum" className="text-sm font-medium text-foreground transition-colors" data-testid="link-nav-forum">Forum</a>
            </div>
            <div className="flex items-center gap-3">
              <a href="/api/login">
                <Button variant="outline" data-testid="button-forum-login">Log in</Button>
              </a>
              <a href="/api/login">
                <Button data-testid="button-forum-signup">Sign up</Button>
              </a>
            </div>
          </div>
        </nav>
      )}

      <div className={`border-b bg-gradient-to-r from-[hsl(var(--maritime-primary)/0.03)] to-transparent ${!user ? "mt-16" : ""}`}>
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
              </div>
              <div>
                <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-forum-title">Forum</h1>
                <p className="text-sm text-muted-foreground">Discuss maritime topics with the community</p>
              </div>
            </div>
            {user && (
              <Button onClick={() => setShowNewTopic(true)} className="gap-2" data-testid="button-new-topic">
                <Plus className="w-4 h-4" /> New Topic
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList>
              <TabsTrigger value="latest" data-testid="tab-latest">Latest</TabsTrigger>
              <TabsTrigger value="popular" data-testid="tab-popular">Popular</TabsTrigger>
              <TabsTrigger value="categories" data-testid="tab-categories">Categories</TabsTrigger>
            </TabsList>
          </Tabs>

          {activeTab !== "categories" && (
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-forum"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48" data-testid="select-category-filter">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map(cat => (
                    <SelectItem key={cat.id} value={cat.slug}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {activeTab === "categories" ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories?.map(cat => (
              <Card
                key={cat.id}
                className="p-5 cursor-pointer hover:shadow-md transition-all hover:border-[hsl(var(--maritime-primary)/0.3)]"
                onClick={() => { setCategoryFilter(cat.slug); setActiveTab("latest"); }}
                data-testid={`card-category-${cat.slug}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm mb-1">{cat.name}</h3>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed mb-2">{cat.description}</p>
                    )}
                    <Badge variant="secondary" className="text-[10px]">
                      {cat.topicCount} topic{cat.topicCount !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : !filteredTopics?.length ? (
          <Card className="p-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium mb-2">No Topics Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery ? "No topics match your search." : "Be the first to start a discussion!"}
            </p>
            {user && (
              <Button onClick={() => setShowNewTopic(true)} variant="outline" className="gap-2" data-testid="button-new-topic-empty">
                <Plus className="w-4 h-4" /> Create Topic
              </Button>
            )}
          </Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="hidden sm:grid grid-cols-[1fr_80px_80px_100px] gap-4 px-4 py-2.5 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
              <span>Topic</span>
              <span className="text-center">Replies</span>
              <span className="text-center">Views</span>
              <span className="text-right">Activity</span>
            </div>
            {filteredTopics.map(topic => (
              <Link key={topic.id} href={`/forum/${topic.id}`} data-testid={`link-topic-${topic.id}`}>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px_80px_100px] gap-2 sm:gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {topic.isPinned && <Pin className="w-3 h-3 text-[hsl(var(--maritime-primary))] flex-shrink-0" />}
                      {topic.isLocked && <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                      <span className="font-medium text-sm truncate" data-testid={`text-topic-title-${topic.id}`}>{topic.title}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 gap-1"
                        style={{ borderColor: topic.categoryColor + "40", color: topic.categoryColor }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: topic.categoryColor }} />
                        {topic.categoryName}
                      </Badge>
                      <div className="flex items-center -space-x-1.5">
                        <Avatar className="w-5 h-5 border-2 border-background">
                          <AvatarImage src={topic.authorImage || undefined} />
                          <AvatarFallback className="text-[8px] bg-[hsl(var(--maritime-primary))] text-white">
                            {(topic.authorFirstName?.[0] || "") + (topic.authorLastName?.[0] || "")}
                          </AvatarFallback>
                        </Avatar>
                        {topic.participants?.slice(0, 4).map((p, i) => (
                          <Avatar key={i} className="w-5 h-5 border-2 border-background">
                            <AvatarImage src={p.profileImageUrl || undefined} />
                            <AvatarFallback className="text-[8px] bg-muted">
                              {(p.firstName?.[0] || "") + (p.lastName?.[0] || "")}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center justify-center">
                    <span className="text-sm font-medium" data-testid={`text-reply-count-${topic.id}`}>{topic.replyCount}</span>
                  </div>
                  <div className="hidden sm:flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">{topic.viewCount}</span>
                  </div>
                  <div className="hidden sm:flex items-center justify-end">
                    <span className="text-xs text-muted-foreground">{timeAgo(topic.lastActivityAt)}</span>
                  </div>
                  <div className="flex sm:hidden items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {topic.replyCount}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {topic.viewCount}</span>
                    <span>{timeAgo(topic.lastActivityAt)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showNewTopic} onOpenChange={setShowNewTopic}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">New Discussion Topic</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="topic-title">Title</Label>
              <Input
                id="topic-title"
                placeholder="What would you like to discuss?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                data-testid="input-topic-title"
              />
            </div>
            <div>
              <Label htmlFor="topic-category">Category</Label>
              <Select value={newCategoryId} onValueChange={setNewCategoryId}>
                <SelectTrigger data-testid="select-topic-category">
                  <SelectValue placeholder="Select a category" />
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
              <Label htmlFor="topic-content">Content</Label>
              <Textarea
                id="topic-content"
                placeholder="Share your thoughts, questions, or insights..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={6}
                data-testid="input-topic-content"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTopic(false)} data-testid="button-cancel-topic">Cancel</Button>
            <Button
              onClick={handleCreateTopic}
              disabled={!newTitle.trim() || !newContent.trim() || !newCategoryId || createTopicMutation.isPending}
              data-testid="button-submit-topic"
            >
              {createTopicMutation.isPending ? "Posting..." : "Post Topic"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
