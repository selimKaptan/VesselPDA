import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "wouter";
import { MessageSquare, Eye, ArrowLeft, Clock, Pin, Lock, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Reply {
  id: number;
  content: string;
  createdAt: string | null;
  topicId: number;
  userId: string;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorImage: string | null;
}

interface TopicDetail {
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
  replies: Reply[];
}

function formatDateTime(timestamp: string | null): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
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

export default function ForumTopic() {
  const { user } = useAuth();
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const topicId = parseInt(params.id || "0");
  const [replyContent, setReplyContent] = useState("");

  const { data: topic, isLoading } = useQuery<TopicDetail>({
    queryKey: [`/api/forum/topics/${topicId}`],
    enabled: topicId > 0,
  });

  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/forum/topics/${topicId}/replies`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forum/topics/${topicId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/forum/topics"] });
      setReplyContent("");
      toast({ title: "Reply posted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to post reply", variant: "destructive" });
    },
  });

  const handleReply = () => {
    if (!replyContent.trim()) return;
    replyMutation.mutate(replyContent.trim());
  };

  const authorInitials = topic
    ? `${topic.authorFirstName?.[0] || ""}${topic.authorLastName?.[0] || ""}`.toUpperCase() || "U"
    : "U";

  return (
    <div className="min-h-screen bg-background">
      {!user && (
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
            <a href="/" className="flex items-center gap-2" data-testid="link-home">
              <img src="/logo.png" alt="VesselPDA" className="w-9 h-9 rounded-md object-contain" />
              <span className="font-serif font-bold text-lg tracking-tight">VesselPDA</span>
            </a>
            <div className="hidden md:flex items-center gap-8">
              <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Home</a>
              <a href="/directory" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Directory</a>
              <a href="/service-ports" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Service Ports</a>
              <a href="/forum" className="text-sm font-medium text-foreground transition-colors">Forum</a>
            </div>
            <div className="flex items-center gap-3">
              <a href="/api/login"><Button variant="outline">Log in</Button></a>
              <a href="/api/login"><Button>Sign up</Button></a>
            </div>
          </div>
        </nav>
      )}

      <div className={`max-w-4xl mx-auto px-6 ${!user ? "pt-24" : "pt-6"} pb-8`}>
        <Link href="/forum" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6" data-testid="link-back-forum">
          <ArrowLeft className="w-4 h-4" /> Back to Forum
        </Link>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !topic ? (
          <Card className="p-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium">Topic Not Found</h3>
          </Card>
        ) : (
          <>
            <Card className="p-6 mb-6">
              <div className="flex items-start gap-4">
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarImage src={topic.authorImage || undefined} />
                  <AvatarFallback className="bg-[hsl(var(--maritime-primary))] text-white text-sm">{authorInitials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {topic.isPinned && <Pin className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />}
                    {topic.isLocked && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                    <h1 className="font-serif text-xl font-bold" data-testid="text-topic-detail-title">{topic.title}</h1>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap mb-4">
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 gap-1"
                      style={{ borderColor: topic.categoryColor + "40", color: topic.categoryColor }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: topic.categoryColor }} />
                      {topic.categoryName}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {topic.authorFirstName} {topic.authorLastName}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDateTime(topic.createdAt)}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {topic.viewCount} views
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> {topic.replyCount} replies
                    </span>
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-topic-content">
                    {topic.content}
                  </div>
                </div>
              </div>
            </Card>

            {topic.replies && topic.replies.length > 0 && (
              <div className="space-y-1 mb-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> {topic.replies.length} {topic.replies.length === 1 ? "Reply" : "Replies"}
                </h3>
                {topic.replies.map((reply, idx) => {
                  const initials = `${reply.authorFirstName?.[0] || ""}${reply.authorLastName?.[0] || ""}`.toUpperCase() || "U";
                  return (
                    <Card key={reply.id} className="p-4" data-testid={`card-reply-${reply.id}`}>
                      <div className="flex items-start gap-3">
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarImage src={reply.authorImage || undefined} />
                          <AvatarFallback className="text-[10px] bg-muted">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm font-medium">
                              {reply.authorFirstName} {reply.authorLastName}
                            </span>
                            <span className="text-xs text-muted-foreground">{timeAgo(reply.createdAt)}</span>
                          </div>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap" data-testid={`text-reply-content-${reply.id}`}>
                            {reply.content}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {topic.isLocked ? (
              <Card className="p-4 text-center text-sm text-muted-foreground">
                <Lock className="w-4 h-4 inline mr-2" /> This topic is locked. No more replies are accepted.
              </Card>
            ) : user ? (
              <Card className="p-4">
                <h3 className="text-sm font-medium mb-3">Post a Reply</h3>
                <Textarea
                  placeholder="Share your thoughts..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={4}
                  data-testid="input-reply-content"
                />
                <div className="flex justify-end mt-3">
                  <Button
                    onClick={handleReply}
                    disabled={!replyContent.trim() || replyMutation.isPending}
                    className="gap-2"
                    data-testid="button-submit-reply"
                  >
                    <Send className="w-4 h-4" />
                    {replyMutation.isPending ? "Posting..." : "Reply"}
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-3">Log in to join the discussion</p>
                <a href="/api/login">
                  <Button variant="outline" data-testid="button-login-to-reply">Log in to Reply</Button>
                </a>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
