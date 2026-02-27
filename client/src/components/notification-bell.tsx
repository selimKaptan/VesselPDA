import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, MessageSquare, Anchor, Trophy, CheckCheck, X } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";

type Notification = {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

function NotificationIcon({ type }: { type: string }) {
  if (type === "forum_reply") return <MessageSquare className="w-4 h-4 text-blue-500" />;
  if (type === "bid_received") return <Anchor className="w-4 h-4 text-maritime-gold" />;
  if (type === "bid_selected") return <Trophy className="w-4 h-4 text-green-500" />;
  if (type === "nomination") return <Trophy className="w-4 h-4 text-emerald-500" />;
  return <Bell className="w-4 h-4 text-muted-foreground" />;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const { data } = useQuery<{ notifications: Notification[]; unreadCount: number }>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const markAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleOpen() {
    setOpen(prev => !prev);
  }

  function handleNotificationClick(n: Notification) {
    if (!n.isRead) markOneMutation.mutate(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        data-testid="button-notification-bell"
        className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span
            data-testid="badge-unread-count"
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="panel-notifications"
          className="absolute right-0 top-11 z-50 w-80 max-h-[480px] flex flex-col bg-background border border-border rounded-xl shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllMutation.mutate()}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-mark-all-read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-close-notifications"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="w-8 h-8 mb-3 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  data-testid={`notification-item-${n.id}`}
                  onClick={() => handleNotificationClick(n)}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0 ${
                    !n.isRead ? "bg-blue-50/60 dark:bg-blue-950/20" : ""
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <NotificationIcon type={n.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-snug ${!n.isRead ? "font-semibold text-foreground" : "text-foreground"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.isRead && (
                    <div className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
