import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Anchor, Radio, Ship, Upload, Download, CheckCircle2,
  FileText, Flag, Clock, Loader2, AlertCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string | null;
  status: "completed" | "active" | "pending";
  icon: string;
}

const ICON_MAP: Record<string, React.ElementType> = {
  anchor:   Anchor,
  radio:    Radio,
  ship:     Ship,
  upload:   Upload,
  download: Download,
  check:    CheckCircle2,
  file:     FileText,
  flag:     Flag,
  clock:    Clock,
};

function EventIcon({ icon, status }: { icon: string; status: TimelineEvent["status"] }) {
  const Icon = ICON_MAP[icon] ?? Clock;
  const colorClass =
    status === "completed"
      ? "bg-emerald-500 text-white"
      : status === "active"
      ? "bg-blue-500 text-white"
      : "bg-muted text-muted-foreground border border-border";

  return (
    <div className={`relative z-10 flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0 ${colorClass}`}>
      <Icon className="w-4 h-4" />
    </div>
  );
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ConnectorLine({ status }: { status: TimelineEvent["status"] }) {
  return (
    <div className="absolute left-[17px] top-9 bottom-0 w-0.5 -mb-1">
      <div
        className={`h-full w-full ${
          status === "completed"
            ? "bg-emerald-400"
            : status === "active"
            ? "bg-blue-300"
            : "bg-border"
        }`}
        style={{
          backgroundImage:
            status === "pending"
              ? "repeating-linear-gradient(to bottom, transparent, transparent 4px, currentColor 4px, currentColor 8px)"
              : undefined,
        }}
      />
    </div>
  );
}

interface VoyageTimelineProps {
  voyageId: number;
}

export function VoyageTimeline({ voyageId }: VoyageTimelineProps) {
  const { data: events, isLoading, isError } = useQuery<TimelineEvent[]>({
    queryKey: ["/api/voyages", voyageId, "timeline"],
    queryFn: async () => {
      const res = await fetch(`/api/voyages/${voyageId}/timeline`);
      if (!res.ok) throw new Error("Failed to load timeline");
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 py-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError || !events) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <AlertCircle className="w-8 h-8 text-destructive/60" />
        <p className="text-sm">Could not load timeline data.</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <Clock className="w-8 h-8 opacity-30" />
        <p className="text-sm">No timeline events yet.</p>
      </div>
    );
  }

  return (
    <div className="relative py-2" data-testid="voyage-timeline">
      <AnimatePresence>
        {events.map((event, index) => {
          const isLast = index === events.length - 1;

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: index * 0.07, ease: "easeOut" }}
              className="relative flex gap-4 pb-7"
              data-testid={`timeline-event-${event.id}`}
            >
              {/* Connector line (not shown for last item) */}
              {!isLast && <ConnectorLine status={event.status} />}

              {/* Icon dot */}
              <EventIcon icon={event.icon} status={event.status} />

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <span
                    className={`text-sm font-semibold leading-snug ${
                      event.status === "completed"
                        ? "text-foreground"
                        : event.status === "active"
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {event.title}
                  </span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                      event.status === "completed"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : event.status === "active"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {event.status === "completed"
                      ? "Completed"
                      : event.status === "active"
                      ? "In Progress"
                      : "Pending"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {event.description}
                </p>

                {event.timestamp && (
                  <p className="mt-1 text-[11px] text-muted-foreground/70 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimestamp(event.timestamp)}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
