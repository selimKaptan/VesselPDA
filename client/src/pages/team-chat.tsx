import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Hash, Lock, Plus, Send, X, CornerDownLeft, Pencil, Trash2,
  Users, ChevronDown, ChevronRight, MessageCircle, Loader2,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { format, isToday, isYesterday } from "date-fns";

interface Channel {
  id: number;
  organization_id: number;
  name: string;
  description: string | null;
  channel_type: string;
  created_by_user_id: string;
  created_at: string;
  message_count: number;
  member_count: number;
}

interface Message {
  id: number;
  channel_id: number;
  sender_id: string;
  content: string;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  is_edited: boolean;
  reply_to_id: number | null;
  created_at: string;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
  reply_content?: string;
  reply_first_name?: string;
  reply_last_name?: string;
}

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `Yesterday ${format(d, "HH:mm")}`;
  return format(d, "dd MMM HH:mm");
}

function groupMessagesByDate(messages: Message[]) {
  const groups: { label: string; messages: Message[] }[] = [];
  let currentLabel = "";
  messages.forEach((msg) => {
    const d = new Date(msg.created_at);
    let label: string;
    if (isToday(d)) label = "Today";
    else if (isYesterday(d)) label = "Yesterday";
    else label = format(d, "dd MMMM yyyy");

    if (label !== currentLabel) {
      groups.push({ label, messages: [msg] });
      currentLabel = label;
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  });
  return groups;
}

let socket: Socket | null = null;
function getSocket(userId: string): Socket {
  if (!socket) {
    socket = io({ path: "/ws/socket.io", auth: { userId }, transports: ["websocket", "polling"] });
  }
  return socket;
}

export default function TeamChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = (user as any)?.id || (user as any)?.claims?.sub;

  const { data: myOrgs = [] } = useQuery<any[]>({
    queryKey: ["/api/organizations/my"],
    queryFn: async () => {
      const res = await fetch("/api/organizations/my");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!userId,
  });

  const orgId: number | null = (user as any)?.activeOrganizationId || myOrgs[0]?.id || null;

  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [newChannelType, setNewChannelType] = useState("public");
  const [publicOpen, setPublicOpen] = useState(true);
  const [privateOpen, setPrivateOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);

  const { data: channels = [], isLoading: channelsLoading } = useQuery<Channel[]>({
    queryKey: ["/api/organizations", orgId, "channels"],
    queryFn: async () => {
      if (!orgId) return [];
      const res = await fetch(`/api/organizations/${orgId}/channels`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!orgId,
    refetchInterval: 30000,
  });

  const { data: fetchedMessages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/organizations", orgId, "channels", activeChannelId, "messages"],
    queryFn: async () => {
      if (!orgId || !activeChannelId) return [];
      const res = await fetch(`/api/organizations/${orgId}/channels/${activeChannelId}/messages?limit=100`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!orgId && !!activeChannelId,
  });

  useEffect(() => {
    setLocalMessages(fetchedMessages);
  }, [fetchedMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  useEffect(() => {
    if (!userId || !orgId) return;
    const s = getSocket(userId);

    s.emit("join_org", orgId);

    s.on("channel_created", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", orgId, "channels"] });
    });

    s.on("team_message", (msg: Message) => {
      if (msg.channel_id === activeChannelId) {
        setLocalMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    });

    s.on("team_typing", (data: { channelId: number; userId: string; userName: string }) => {
      if (data.channelId === activeChannelId && data.userId !== userId) {
        setTypingUsers((prev) => prev.includes(data.userName) ? prev : [...prev, data.userName]);
      }
    });

    s.on("team_typing_stop", (data: { channelId: number; userId: string; userName: string }) => {
      setTypingUsers((prev) => prev.filter((u) => u !== data.userName));
    });

    return () => {
      s.off("channel_created");
      s.off("team_message");
      s.off("team_typing");
      s.off("team_typing_stop");
    };
  }, [userId, orgId, activeChannelId]);

  useEffect(() => {
    if (!userId) return;
    const s = getSocket(userId);
    if (activeChannelId) {
      s.emit("join_channel", activeChannelId);
    }
    return () => {
      if (activeChannelId) s.emit("leave_channel", activeChannelId);
    };
  }, [activeChannelId, userId]);

  const sendMutation = useMutation({
    mutationFn: async (data: { content: string; replyToId?: number }) => {
      return apiRequest("POST", `/api/organizations/${orgId}/channels/${activeChannelId}/messages`, data);
    },
    onSuccess: () => {
      setMessageText("");
      setReplyTo(null);
    },
    onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      return apiRequest("PATCH", `/api/team-messages/${id}`, { content });
    },
    onSuccess: (_, vars) => {
      setLocalMessages((prev) =>
        prev.map((m) => m.id === vars.id ? { ...m, content: vars.content, is_edited: true } : m)
      );
      setEditingMessage(null);
      setEditText("");
    },
    onError: () => toast({ title: "Failed to edit", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/team-messages/${id}`);
    },
    onSuccess: (_, id) => {
      setLocalMessages((prev) => prev.filter((m) => m.id !== id));
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const createChannelMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/organizations/${orgId}/channels`, {
        name: newChannelName.trim(),
        description: newChannelDesc.trim() || undefined,
        channelType: newChannelType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations", orgId, "channels"] });
      setShowNewChannel(false);
      setNewChannelName("");
      setNewChannelDesc("");
      setNewChannelType("public");
      toast({ title: "Channel created" });
    },
    onError: () => toast({ title: "Failed to create channel", variant: "destructive" }),
  });

  const handleTyping = useCallback(() => {
    if (!userId || !activeChannelId) return;
    const s = getSocket(userId);
    const name = `${(user as any)?.firstName || ""} ${(user as any)?.lastName || ""}`.trim() || "Someone";
    s.emit("team_typing", { channelId: activeChannelId, userId, userName: name });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {}, 3000);
  }, [userId, activeChannelId, user]);

  const handleSend = () => {
    const text = messageText.trim();
    if (!text || !activeChannelId) return;
    sendMutation.mutate({ content: text, replyToId: replyTo?.id });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const publicChannels = channels.filter((c) => c.channel_type === "public");
  const privateChannels = channels.filter((c) => c.channel_type === "private");
  const messageGroups = groupMessagesByDate(localMessages);

  if (!orgId) {
    return (
      <div className="h-full flex items-center justify-center text-center p-8">
        <div>
          <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <h2 className="text-lg font-semibold mb-2">No Active Organization</h2>
          <p className="text-muted-foreground text-sm">
            Join or create an organization to access Team Chat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left Panel: Channel List ── */}
      <aside className="w-60 flex-shrink-0 border-r flex flex-col bg-sidebar">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold text-sidebar-foreground">Team Chat</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setShowNewChannel(true)}
            data-testid="button-new-channel"
            title="New channel"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="py-2">
            {/* Public channels */}
            <button
              className="flex items-center gap-1 w-full px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
              onClick={() => setPublicOpen((v) => !v)}
            >
              {publicOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Channels
            </button>
            {publicOpen && (
              <div className="mt-0.5">
                {channelsLoading ? (
                  <div className="px-4 py-2 text-xs text-muted-foreground">Loading...</div>
                ) : publicChannels.length === 0 ? (
                  <div className="px-4 py-2 text-xs text-muted-foreground">No channels</div>
                ) : (
                  publicChannels.map((ch) => (
                    <button
                      key={ch.id}
                      data-testid={`channel-item-${ch.id}`}
                      onClick={() => setActiveChannelId(ch.id)}
                      className={`flex items-center gap-2 w-full px-4 py-1.5 text-sm transition-colors rounded-none hover:bg-sidebar-accent ${activeChannelId === ch.id ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/80"}`}
                    >
                      <Hash className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{ch.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Private channels */}
            {privateChannels.length > 0 && (
              <>
                <button
                  className="flex items-center gap-1 w-full px-4 py-1 mt-2 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
                  onClick={() => setPrivateOpen((v) => !v)}
                >
                  {privateOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Private
                </button>
                {privateOpen && (
                  <div className="mt-0.5">
                    {privateChannels.map((ch) => (
                      <button
                        key={ch.id}
                        data-testid={`channel-item-${ch.id}`}
                        onClick={() => setActiveChannelId(ch.id)}
                        className={`flex items-center gap-2 w-full px-4 py-1.5 text-sm transition-colors rounded-none hover:bg-sidebar-accent ${activeChannelId === ch.id ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/80"}`}
                      >
                        <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{ch.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* ── Right Panel: Messages ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeChannel ? (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <Hash className="w-10 h-10 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">Select a channel to start chatting</p>
            </div>
          </div>
        ) : (
          <>
            {/* Channel Header */}
            <div className="flex-shrink-0 flex items-center gap-3 px-4 h-14 border-b bg-background">
              {activeChannel.channel_type === "private" ? (
                <Lock className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Hash className="w-4 h-4 text-muted-foreground" />
              )}
              <div>
                <span className="font-semibold text-sm">{activeChannel.name}</span>
                {activeChannel.description && (
                  <span className="text-xs text-muted-foreground ml-2">{activeChannel.description}</span>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                <span>{activeChannel.member_count || "All"} members</span>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-2">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : localMessages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No messages yet. Say hello!
                </div>
              ) : (
                messageGroups.map((group) => (
                  <div key={group.label}>
                    <div className="flex items-center gap-3 my-4">
                      <Separator className="flex-1" />
                      <span className="text-[10px] text-muted-foreground font-medium">{group.label}</span>
                      <Separator className="flex-1" />
                    </div>
                    {group.messages.map((msg, idx) => {
                      const prevMsg = idx > 0 ? group.messages[idx - 1] : null;
                      const isContinuation = prevMsg && prevMsg.sender_id === msg.sender_id;
                      const isMine = msg.sender_id === userId;
                      const initials = `${msg.first_name?.[0] || ""}${msg.last_name?.[0] || ""}`.toUpperCase() || "?";
                      const senderName = `${msg.first_name || ""} ${msg.last_name || ""}`.trim() || "Unknown";

                      return (
                        <div
                          key={msg.id}
                          data-testid={`message-item-${msg.id}`}
                          className={`group flex gap-3 ${isContinuation ? "mt-0.5" : "mt-3"} hover:bg-muted/30 rounded-md px-1 py-0.5`}
                        >
                          <div className="w-8 flex-shrink-0">
                            {!isContinuation ? (
                              <Avatar className="w-8 h-8">
                                {msg.profile_image_url && <AvatarImage src={msg.profile_image_url} />}
                                <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                              </Avatar>
                            ) : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            {!isContinuation && (
                              <div className="flex items-baseline gap-2 mb-0.5">
                                <span className={`text-sm font-semibold ${isMine ? "text-primary" : ""}`}>{senderName}</span>
                                <span className="text-[10px] text-muted-foreground">{formatMsgTime(msg.created_at)}</span>
                              </div>
                            )}
                            {msg.reply_to_id && msg.reply_content && (
                              <div className="mb-1 pl-3 border-l-2 border-muted-foreground/30 text-xs text-muted-foreground truncate">
                                <span className="font-medium">{msg.reply_first_name} {msg.reply_last_name}: </span>
                                {msg.reply_content}
                              </div>
                            )}
                            {editingMessage?.id === msg.id ? (
                              <div className="flex gap-2 items-end">
                                <Input
                                  data-testid="input-edit-message"
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      editMutation.mutate({ id: msg.id, content: editText });
                                    }
                                    if (e.key === "Escape") { setEditingMessage(null); setEditText(""); }
                                  }}
                                  className="text-sm h-8"
                                  autoFocus
                                />
                                <Button size="sm" className="h-8 px-2" onClick={() => editMutation.mutate({ id: msg.id, content: editText })}>
                                  Save
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setEditingMessage(null); setEditText(""); }}>
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                                {msg.content}
                                {msg.is_edited && <span className="text-[10px] text-muted-foreground ml-1">(edited)</span>}
                              </p>
                            )}
                          </div>
                          {/* Actions */}
                          <div className="flex-shrink-0 flex items-start gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              title="Reply"
                              data-testid={`button-reply-${msg.id}`}
                              onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                            >
                              <CornerDownLeft className="w-3 h-3" />
                            </Button>
                            {isMine && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  title="Edit"
                                  data-testid={`button-edit-${msg.id}`}
                                  onClick={() => { setEditingMessage(msg); setEditText(msg.content); }}
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  title="Delete"
                                  data-testid={`button-delete-${msg.id}`}
                                  onClick={() => deleteMutation.mutate(msg.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              {typingUsers.length > 0 && (
                <div className="text-xs text-muted-foreground mt-2 italic px-1">
                  {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                </div>
              )}
              <div ref={bottomRef} />
            </ScrollArea>

            {/* Input Area */}
            <div className="flex-shrink-0 border-t bg-background px-4 py-3">
              {replyTo && (
                <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-muted rounded-md text-xs">
                  <CornerDownLeft className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Replying to </span>
                  <span className="font-medium">{replyTo.first_name} {replyTo.last_name}</span>
                  <span className="truncate text-muted-foreground flex-1">{replyTo.content}</span>
                  <button onClick={() => setReplyTo(null)} className="flex-shrink-0 text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  data-testid="input-message"
                  value={messageText}
                  onChange={(e) => { setMessageText(e.target.value); handleTyping(); }}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message #${activeChannel.name}`}
                  className="flex-1"
                  disabled={sendMutation.isPending}
                />
                <Button
                  data-testid="button-send-message"
                  onClick={handleSend}
                  disabled={!messageText.trim() || sendMutation.isPending}
                  size="icon"
                >
                  {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── New Channel Dialog ── */}
      <Dialog open={showNewChannel} onOpenChange={setShowNewChannel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="ch-name">Channel Name</Label>
              <Input
                id="ch-name"
                data-testid="input-channel-name"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="general, operations, accounting..."
                onKeyDown={(e) => e.key === "Enter" && createChannelMutation.mutate()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ch-desc">Description (optional)</Label>
              <Input
                id="ch-desc"
                data-testid="input-channel-description"
                value={newChannelDesc}
                onChange={(e) => setNewChannelDesc(e.target.value)}
                placeholder="What is this channel about?"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={newChannelType} onValueChange={setNewChannelType}>
                <SelectTrigger data-testid="select-channel-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public — all org members</SelectItem>
                  <SelectItem value="private">Private — invite only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowNewChannel(false)}>Cancel</Button>
              <Button
                data-testid="button-create-channel"
                onClick={() => createChannelMutation.mutate()}
                disabled={!newChannelName.trim() || createChannelMutation.isPending}
              >
                {createChannelMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Channel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
