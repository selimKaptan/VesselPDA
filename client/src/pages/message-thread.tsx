import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  ArrowLeft, Send, Loader2, MessageCircle, Ship, Wrench,
  Paperclip, X, FileIcon, ImageIcon, Mail, Check, CheckCheck,
  Download, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderContentWithMentions(content: string, isMine: boolean) {
  const parts = content.split(/(@\S+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className={`font-semibold ${isMine ? "text-white/90 underline" : "text-[hsl(var(--maritime-primary))]"}`}>
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function MessageThread() {
  const { id } = useParams<{ id: string }>();
  const convId = parseInt(id || "0");
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ url: string; name: string; size: number; type: string } | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [externalEmail, setExternalEmail] = useState("");
  const [externalEmailName, setExternalEmailName] = useState("");
  const [externalEmailForward, setExternalEmailForward] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (conv) {
      setExternalEmail(conv.externalEmail || "");
      setExternalEmailName(conv.externalEmailName || "");
      setExternalEmailForward(conv.externalEmailForward || false);
    }
  }, [conv?.externalEmail, conv?.externalEmailForward]);

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
      const body: any = {
        content: content.trim() || (pendingFile ? `[Dosya: ${pendingFile.name}]` : ""),
        mentions: mentions.length > 0 ? mentions : undefined,
      };
      if (pendingFile) {
        body.messageType = pendingFile.type.startsWith("image/") ? "image" : "file";
        body.fileUrl = pendingFile.url;
        body.fileName = pendingFile.name;
        body.fileSize = pendingFile.size;
      }
      const res = await apiRequest("POST", `/api/messages/${convId}/send`, body);
      return res.json();
    },
    onSuccess: () => {
      setContent("");
      setMentions([]);
      setPendingFile(null);
      setShowMentionPicker(false);
      queryClient.invalidateQueries({ queryKey: ["/api/messages", convId] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    },
    onError: () => toast({ title: "Mesaj gönderilemedi", variant: "destructive" }),
  });

  const saveEmailBridge = async () => {
    setSavingEmail(true);
    try {
      await apiRequest("PATCH", `/api/conversations/${convId}/external-email`, {
        email: externalEmail || null,
        name: externalEmailName || null,
        forward: externalEmailForward,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/messages", convId] });
      toast({ title: "E-posta köprüsü güncellendi" });
      setEmailDialogOpen(false);
    } catch {
      toast({ title: "Kaydedilemedi", variant: "destructive" });
    } finally {
      setSavingEmail(false);
    }
  };

  function handleSend() {
    if ((!content.trim() && !pendingFile) || sendMutation.isPending) return;
    sendMutation.mutate();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Dosya çok büyük", description: "Maksimum dosya boyutu 8MB'dır.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setPendingFile({ url, name: file.name, size: file.size, type: file.type });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setContent(val);
    const lastAt = val.lastIndexOf("@");
    if (lastAt !== -1 && lastAt === val.length - 1) {
      setShowMentionPicker(true);
    } else {
      setShowMentionPicker(false);
    }
  }

  function insertMention() {
    if (!conv?.otherUser) return;
    const otherName = conv.otherUser.name || conv.otherUser.email || "Kullanıcı";
    const withoutAt = content.endsWith("@") ? content.slice(0, -1) : content;
    setContent(`${withoutAt}@${otherName.replace(/\s+/g, "")} `);
    if (!mentions.includes(conv.otherUser.id)) {
      setMentions(prev => [...prev, conv.otherUser.id]);
    }
    setShowMentionPicker(false);
    inputRef.current?.focus();
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto px-3 py-5 space-y-4">
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
  const otherUser = conv.otherUser;
  const bridgeActive = conv.externalEmailForward && conv.externalEmail;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto">
      <PageMeta title={`${otherUser?.name || "Mesaj"} | VesselPDA`} description="Mesaj konuşması" />

      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <Link href="/messages">
          <button className="text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back-messages">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div className="w-9 h-9 rounded-full bg-[hsl(var(--maritime-primary)/0.12)] flex items-center justify-center font-bold text-sm text-[hsl(var(--maritime-primary))] flex-shrink-0">
          {(otherUser?.name || "?")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{otherUser?.name || otherUser?.email || "Kullanıcı"}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {conv.voyageId && (
              <Link href={`/voyages/${conv.voyageId}`}>
                <span className="text-xs text-[hsl(var(--maritime-primary))] hover:underline flex items-center gap-1">
                  <Ship className="w-3 h-3" /> Sefer #{conv.voyageId}
                </span>
              </Link>
            )}
            {conv.serviceRequestId && (
              <Link href={`/service-requests/${conv.serviceRequestId}`}>
                <span className="text-xs text-[hsl(var(--maritime-primary))] hover:underline flex items-center gap-1">
                  <Wrench className="w-3 h-3" /> Hizmet Talebi #{conv.serviceRequestId}
                </span>
              </Link>
            )}
            {bridgeActive && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/20">
                ✉ Bridge Aktif
              </Badge>
            )}
          </div>
        </div>
        <button
          onClick={() => setEmailDialogOpen(true)}
          className="text-muted-foreground hover:text-[hsl(var(--maritime-primary))] transition-colors p-1.5 rounded-lg hover:bg-[hsl(var(--maritime-primary)/0.08)]"
          title="E-posta Köprüsü"
          data-testid="button-email-bridge"
        >
          <Mail className="w-4 h-4" />
        </button>
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
          const isFile = msg.messageType === "file";
          const isImage = msg.messageType === "image";
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
                <div className={`max-w-[78%] ${isImage ? "" : "px-3.5 py-2.5"} rounded-2xl text-sm leading-relaxed ${
                  isMine
                    ? `bg-[hsl(var(--maritime-primary))] text-white ${isImage ? "" : "rounded-br-sm"}`
                    : `bg-muted text-foreground ${isImage ? "" : "rounded-bl-sm"}`
                }`}>
                  {isImage && msg.fileUrl ? (
                    <div className={`rounded-2xl overflow-hidden ${isMine ? "rounded-br-sm" : "rounded-bl-sm"}`}>
                      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                        <img src={msg.fileUrl} alt={msg.fileName || "Resim"} className="max-h-48 w-auto object-cover cursor-pointer hover:opacity-90 transition-opacity" />
                      </a>
                      <div className={`px-3 pb-2 pt-1 ${isMine ? "bg-[hsl(var(--maritime-primary))]" : "bg-muted"}`}>
                        <p className={`text-[10px] text-right ${isMine ? "text-white/60" : "text-muted-foreground"}`}>
                          {formatTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  ) : isFile && msg.fileUrl ? (
                    <>
                      <div className={`flex items-center gap-2 p-2 rounded-xl mb-1 ${isMine ? "bg-white/10" : "bg-background/50"}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isMine ? "bg-white/20" : "bg-[hsl(var(--maritime-primary)/0.1)]"}`}>
                          <FileIcon className={`w-4 h-4 ${isMine ? "text-white" : "text-[hsl(var(--maritime-primary))]"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium truncate ${isMine ? "text-white" : "text-foreground"}`}>{msg.fileName}</p>
                          {msg.fileSize && (
                            <p className={`text-[10px] ${isMine ? "text-white/60" : "text-muted-foreground"}`}>{formatBytes(msg.fileSize)}</p>
                          )}
                        </div>
                        <a href={msg.fileUrl} download={msg.fileName} className={`flex-shrink-0 p-1 rounded hover:opacity-80 transition-opacity ${isMine ? "text-white" : "text-[hsl(var(--maritime-primary))]"}`}>
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      {msg.content && !msg.content.startsWith("[Dosya:") && (
                        <p className="text-sm">{renderContentWithMentions(msg.content, isMine)}</p>
                      )}
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <p className={`text-[10px] ${isMine ? "text-white/60" : "text-muted-foreground"}`}>{formatTime(msg.createdAt)}</p>
                        {isMine && (
                          <span className={`text-[10px] ${msg.readAt ? "text-white/80" : "text-white/40"}`} data-testid={`message-read-receipt-${msg.id}`}>
                            {msg.readAt ? "✓✓" : "✓"}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap">{renderContentWithMentions(msg.content, isMine)}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <p className={`text-[10px] ${isMine ? "text-white/60" : "text-muted-foreground"}`}>{formatTime(msg.createdAt)}</p>
                        {isMine && (
                          <span
                            className={`text-[10px] flex items-center gap-0.5 ${msg.readAt ? "text-white/80" : "text-white/40"}`}
                            title={msg.readAt ? `Okundu · ${formatTime(msg.readAt)}` : "Gönderildi"}
                            data-testid={`message-read-receipt-${msg.id}`}
                          >
                            {msg.readAt ? (
                              <><CheckCheck className="w-3 h-3" /> <span className="text-[9px]">Okundu · {formatTime(msg.readAt)}</span></>
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t bg-card/80 backdrop-blur-sm">
        {/* Pending file preview */}
        {pendingFile && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl bg-[hsl(var(--maritime-primary)/0.08)] border border-[hsl(var(--maritime-primary)/0.2)]" data-testid="file-preview-chip">
            {pendingFile.type.startsWith("image/") ? (
              <ImageIcon className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
            ) : (
              <FileIcon className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
            )}
            <span className="text-xs text-[hsl(var(--maritime-primary))] font-medium flex-1 truncate">{pendingFile.name}</span>
            <span className="text-[10px] text-muted-foreground">{formatBytes(pendingFile.size)}</span>
            {pendingFile.size > 5 * 1024 * 1024 && (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-label="Large file" />
            )}
            <button onClick={() => setPendingFile(null)} className="text-muted-foreground hover:text-destructive transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* @Mention picker */}
        {showMentionPicker && otherUser && (
          <div className="mb-2">
            <button
              onClick={insertMention}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-xl bg-[hsl(var(--maritime-primary)/0.08)] border border-[hsl(var(--maritime-primary)/0.2)] hover:bg-[hsl(var(--maritime-primary)/0.15)] transition-colors text-left"
            >
              <div className="w-6 h-6 rounded-full bg-[hsl(var(--maritime-primary)/0.2)] flex items-center justify-center text-xs font-bold text-[hsl(var(--maritime-primary))]">
                {(otherUser.name || "?")[0].toUpperCase()}
              </div>
              <span className="text-sm font-medium text-[hsl(var(--maritime-primary))]">@{(otherUser.name || otherUser.email || "Kullanıcı").replace(/\s+/g, "")}</span>
              <span className="text-xs text-muted-foreground ml-auto">Etiketle</span>
            </button>
          </div>
        )}

        <div className="flex gap-2">
          {/* File attachment button */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-muted-foreground hover:text-[hsl(var(--maritime-primary))] transition-colors p-2 rounded-xl hover:bg-[hsl(var(--maritime-primary)/0.08)] flex-shrink-0"
            title="Dosya ekle"
            data-testid="button-attach-file"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <Input
            ref={inputRef}
            value={content}
            onChange={handleInputChange}
            placeholder={pendingFile ? "Dosyaya not ekleyin (isteğe bağlı)..." : "Mesaj yazın... (@mention için @ yazın)"}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              if (e.key === "Escape") setShowMentionPicker(false);
            }}
            className="flex-1"
            data-testid="input-message"
          />
          <Button
            onClick={handleSend}
            disabled={sendMutation.isPending || (!content.trim() && !pendingFile)}
            size="icon"
            className="bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-secondary))] flex-shrink-0"
            data-testid="button-send-message"
          >
            {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Email Bridge Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-sm" data-testid="dialog-email-bridge">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              Harici E-posta Yönlendirme
            </DialogTitle>
            <DialogDescription>
              Platformda olmayan kişiye mesajları otomatik e-posta olarak ilet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ext-email" className="text-sm">E-posta Adresi</Label>
              <Input
                id="ext-email"
                type="email"
                placeholder="ornek@sirket.com"
                value={externalEmail}
                onChange={e => setExternalEmail(e.target.value)}
                data-testid="input-external-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ext-name" className="text-sm">Ad / Şirket Adı</Label>
              <Input
                id="ext-name"
                placeholder="Kaptan Ahmet / Barbaros Shipping"
                value={externalEmailName}
                onChange={e => setExternalEmailName(e.target.value)}
                data-testid="input-external-name"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">Otomatik Yönlendirme</p>
                <p className="text-xs text-muted-foreground">Yeni mesajları bu adrese ilet</p>
              </div>
              <Switch
                checked={externalEmailForward}
                onCheckedChange={setExternalEmailForward}
                data-testid="switch-auto-forward"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>İptal</Button>
            <Button
              onClick={saveEmailBridge}
              disabled={savingEmail}
              className="bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-secondary))]"
            >
              {savingEmail ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
