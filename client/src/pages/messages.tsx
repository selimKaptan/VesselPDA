import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MessageCircle, Search, Ship, Wrench, Paperclip, Mail } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageMeta } from "@/components/page-meta";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Az önce";
  if (mins < 60) return `${mins}dk`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}sa`;
  return new Date(dateStr).toLocaleDateString("tr-TR");
}

export default function Messages() {
  const [search, setSearch] = useState("");

  const { data: conversations = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/messages"],
  });

  const filtered = conversations.filter(c =>
    c.otherUserName?.toLowerCase().includes(search.toLowerCase()) ||
    c.lastMessage?.toLowerCase().includes(search.toLowerCase())
  );

  function getLastMessagePreview(conv: any) {
    if (conv.lastMessageType === "image") return "🖼 Resim paylaşıldı";
    if (conv.lastMessageType === "file") return `📎 ${conv.lastMessageFileName || "Dosya paylaşıldı"}`;
    return conv.lastMessage || "Henüz mesaj yok";
  }

  return (
    <div className="px-3 py-5 max-w-2xl mx-auto space-y-5">
      <PageMeta title="Mesajlar | VesselPDA" description="Doğrudan mesajlaşma gelen kutusu" />

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
        </div>
        <div>
          <h1 className="font-serif text-xl font-bold">Mesajlar</h1>
          <p className="text-xs text-muted-foreground">Doğrudan konuşmalarınız</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Kişi veya mesaj ara..."
          className="pl-9"
          data-testid="input-message-search"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-sm">
            {search ? "Aramayla eşleşen konuşma bulunamadı" : "Henüz mesaj yok"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {search ? "" : "Kullanıcı profilleri veya sefer sayfalarından mesaj gönderebilirsiniz."}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((conv: any) => (
            <Link key={conv.id} href={`/messages/${conv.id}`}>
              <div
                className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-card border hover:border-[hsl(var(--maritime-primary)/0.4)] hover:shadow-sm transition-all cursor-pointer"
                data-testid={`conversation-${conv.id}`}
              >
                <div className="w-10 h-10 rounded-full bg-[hsl(var(--maritime-primary)/0.12)] flex items-center justify-center flex-shrink-0 font-bold text-sm text-[hsl(var(--maritime-primary))] mt-0.5">
                  {(conv.otherUserName || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm font-semibold truncate ${conv.unreadCount > 0 ? "text-foreground" : "text-foreground/80"}`}>
                      {conv.otherUserName}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {conv.externalEmailForward && (
                        <Mail className="w-3 h-3 text-amber-500" aria-label="Email bridge active" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {conv.lastMessageTime ? timeAgo(conv.lastMessageTime) : ""}
                      </span>
                    </div>
                  </div>

                  {/* Context badges */}
                  {(conv.voyageId || conv.serviceRequestId) && (
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {conv.voyageId && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[hsl(var(--maritime-primary)/0.08)] text-[hsl(var(--maritime-primary))]"
                          data-testid={`badge-voyage-context-${conv.id}`}
                        >
                          <Ship className="w-2.5 h-2.5" /> Sefer #{conv.voyageId}
                        </span>
                      )}
                      {conv.serviceRequestId && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[hsl(var(--maritime-primary)/0.08)] text-[hsl(var(--maritime-primary))]"
                          data-testid={`badge-service-context-${conv.id}`}
                        >
                          <Wrench className="w-2.5 h-2.5" /> Hizmet #{conv.serviceRequestId}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={`text-xs truncate flex items-center gap-1 ${conv.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {(conv.lastMessageType === "file" || conv.lastMessageType === "image") && (
                        <Paperclip className="w-3 h-3 flex-shrink-0" />
                      )}
                      {getLastMessagePreview(conv)}
                    </p>
                    {conv.unreadCount > 0 && (
                      <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-[hsl(var(--maritime-primary))] flex-shrink-0" data-testid={`unread-badge-${conv.id}`}>
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
