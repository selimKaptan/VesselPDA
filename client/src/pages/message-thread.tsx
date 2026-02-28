import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Send, Loader2, MessageCircle, Ship, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageMeta } from "@/components/page-meta";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export default function MessageThread() {
  const { id } = useParams<{ id: string }>();
  const convId = parseInt(id || "0");
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const userId = (user as any)?.id || (user as any)?.claims?.sub;

  const { data: conv, isLoading } = useQuery<any>({
    queryKey: ["/api/messages", convId],
    queryFn: async () => {
      const res = await fetch(`/api/messages/${convId}`);
      return res.json();
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (convId) {
      apiRequest("PATCH", `/api/messages/${convId}/read`, {}).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
        queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
      });
    }
  }, [convId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages?.length]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/messages/${convId}/send`, { content });
      return res.json();
    },
    onSuccess: () => {
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages", convId] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
    onError: () => toast({ title: "Mesaj gönderilemedi", variant: "destructive" }),
  });

  function handleSend() {
    if (!content.trim() || sendMutation.isPending) return;
    sendMutation.mutate();
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex-1 space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-3/4" />)}
        </div>
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!conv || conv.message === "Conversation not found") {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Konuşma bulunamadı.</p>
        <Link href="/messages"><Button variant="outline" className="mt-4">Geri Dön</Button></Link>
      </div>
    );
  }

  const msgs: any[] = conv.messages || [];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto">
      <PageMeta title={`${conv.otherUser?.name || "Mesaj"} | VesselPDA`} description="Mesaj konuşması" />

      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <Link href="/messages">
          <button className="text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back-messages">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div className="w-9 h-9 rounded-full bg-[hsl(var(--maritime-primary)/0.12)] flex items-center justify-center font-bold text-sm text-[hsl(var(--maritime-primary))] flex-shrink-0">
          {(conv.otherUser?.name || "?")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{conv.otherUser?.name || conv.otherUser?.email || "Kullanıcı"}</p>
          {conv.voyageId && (
            <Link href={`/voyages/${conv.voyageId}`}>
              <span className="text-xs text-[hsl(var(--maritime-primary))] hover:underline flex items-center gap-1">
                <Ship className="w-3 h-3" /> Sefer bağlantısı
              </span>
            </Link>
          )}
          {conv.serviceRequestId && (
            <Link href={`/service-requests/${conv.serviceRequestId}`}>
              <span className="text-xs text-[hsl(var(--maritime-primary))] hover:underline flex items-center gap-1">
                <Wrench className="w-3 h-3" /> Hizmet talebi
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {msgs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Konuşmayı başlatın</p>
          </div>
        )}
        {msgs.map((msg: any, idx: number) => {
          const isMine = msg.senderId === userId;
          const showDate = idx === 0 || !sameDay(msg.createdAt, msgs[idx - 1].createdAt);
          return (
            <div key={msg.id}>
              {showDate && (
                <div className="text-center my-4">
                  <span className="text-xs text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">
                    {formatDate(msg.createdAt)}
                  </span>
                </div>
              )}
              <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1`} data-testid={`message-${msg.id}`}>
                <div
                  className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMine
                      ? "bg-[hsl(var(--maritime-primary))] text-white rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  <p>{msg.content}</p>
                  <p className={`text-[10px] mt-1 text-right ${isMine ? "text-white/60" : "text-muted-foreground"}`}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-card/80 backdrop-blur-sm">
        <div className="flex gap-2">
          <Input
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Mesaj yazın..."
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            className="flex-1"
            data-testid="input-message"
          />
          <Button
            onClick={handleSend}
            disabled={sendMutation.isPending || !content.trim()}
            size="icon"
            className="bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-secondary))]"
            data-testid="button-send-message"
          >
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
