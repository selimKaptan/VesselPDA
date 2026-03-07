import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Bell, Trash2, CheckCheck, Filter, MessageSquare, AlertTriangle, Info, Trophy, Ship, FileText, DollarSign, Anchor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { PageMeta } from "@/components/page-meta";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fmtDateTime } from "@/lib/formatDate";
import type { Notification } from "@shared/schema";

type FilterType = "all" | "unread" | "message" | "alert" | "system";

const NOTIF_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  forum_reply: MessageSquare,
  forum_like: MessageSquare,
  nomination: Trophy,
  bid_received: DollarSign,
  bid_selected: Trophy,
  invoice_paid: DollarSign,
  invoice_due: AlertTriangle,
  certificate_expiry: AlertTriangle,
  voyage_update: Ship,
  pda_approved: FileText,
  fda_ready: FileText,
  da_advance: DollarSign,
  nor_accepted: Anchor,
  sof_finalized: FileText,
  announcement: Info,
};

function getIcon(type: string) {
  const Icon = NOTIF_TYPE_ICONS[type] || Bell;
  return Icon;
}

function timeAgo(dt: string | Date | null) {
  if (!dt) return "";
  const diff = Date.now() - new Date(dt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDateTime(dt);
}

function getCategoryColor(type: string): string {
  if (["forum_reply", "forum_like", "nomination"].includes(type)) return "text-blue-400";
  if (["invoice_paid", "bid_selected"].includes(type)) return "text-emerald-400";
  if (["invoice_due", "certificate_expiry"].includes(type)) return "text-amber-400";
  if (["announcement"].includes(type)) return "text-purple-400";
  return "text-[hsl(var(--maritime-primary))]";
}

function filterNotification(n: Notification, filter: FilterType): boolean {
  if (filter === "unread") return !n.isRead;
  if (filter === "message") return ["forum_reply", "forum_like", "nomination"].includes(n.type || "");
  if (filter === "alert") return ["invoice_due", "certificate_expiry", "da_advance"].includes(n.type || "");
  if (filter === "system") return ["announcement", "pda_approved", "fda_ready"].includes(n.type || "");
  return true;
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<FilterType>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery<{ notifications: Notification[]; unreadCount: number }>({
    queryKey: ["/api/notifications"],
  });

  const allNotifs = data?.notifications || [];
  const filtered = allNotifs.filter(n => filterNotification(n, filter));

  const markReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "All marked as read" });
    },
  });

  const clearReadMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/notifications"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "Read notifications cleared" });
    },
  });

  const deleteOneMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/notifications/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const FILTERS: { value: FilterType; label: string; count?: number }[] = [
    { value: "all", label: "All", count: allNotifs.length },
    { value: "unread", label: "Unread", count: allNotifs.filter(n => !n.isRead).length },
    { value: "message", label: "Messages" },
    { value: "alert", label: "Alerts" },
    { value: "system", label: "System" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <PageMeta title="Notification Center | VesselPDA" description="Manage all your notifications" />

      <div className="max-w-4xl mx-auto px-4 py-6 pb-20 md:pb-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[hsl(var(--maritime-primary)/0.1)]">
              <Bell className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-serif">Notification Center</h1>
              <p className="text-xs text-muted-foreground">
                {data?.unreadCount ?? 0} unread · {allNotifs.length} total
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => markReadMutation.mutate()}
              disabled={markReadMutation.isPending}
              data-testid="button-mark-all-read"
              className="text-xs"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
              Mark all read
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => clearReadMutation.mutate()}
              disabled={clearReadMutation.isPending}
              data-testid="button-clear-read"
              className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Clear read
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              data-testid={`filter-notif-${f.value}`}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === f.value
                  ? "bg-[hsl(var(--maritime-primary))] text-white border-transparent"
                  : "border-border text-muted-foreground hover:border-[hsl(var(--maritime-primary)/0.4)] hover:text-foreground"
              }`}
            >
              {f.label}
              {f.count !== undefined && (
                <span className="ml-1.5 opacity-70">({f.count})</span>
              )}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl border border-border/50 flex gap-3">
                <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto">
                <Bell className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">No notifications in this category</p>
            </div>
          ) : (
            filtered.map(n => {
              const Icon = getIcon(n.type || "");
              const iconColor = getCategoryColor(n.type || "");
              return (
                <div
                  key={n.id}
                  data-testid={`notif-item-${n.id}`}
                  className={`group relative flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer hover:border-[hsl(var(--maritime-primary)/0.3)] ${
                    !n.isRead
                      ? "border-[hsl(var(--maritime-primary)/0.3)] bg-[hsl(var(--maritime-primary)/0.04)]"
                      : "border-border/50 bg-card/40"
                  }`}
                  onClick={() => {
                    if (!n.isRead) {
                      apiRequest("POST", `/api/notifications/${n.id}/read`).then(() =>
                        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] })
                      );
                    }
                    if (n.link) window.location.href = n.link;
                  }}
                >
                  {!n.isRead && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-[hsl(var(--maritime-primary))]" />
                  )}
                  <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-current/5`} style={{ backgroundColor: "hsl(var(--maritime-primary) / 0.08)" }}>
                    <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${!n.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      deleteOneMutation.mutate(n.id);
                    }}
                    data-testid={`button-delete-notif-${n.id}`}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
