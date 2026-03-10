import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  Ship, MapPin, Calendar, ArrowLeft, CheckCircle2, Circle, Trash2,
  Plus, Loader2, ChevronDown, Wrench, Fuel, ShoppingCart, Users as UsersIcon,
  Sparkles, HelpCircle, Clock, PlayCircle, XCircle, ClipboardList,
  FileText, Upload, Download, Star, MessageCircle, FolderOpen, Anchor, Cloud,
  CalendarClock, Pen, LayoutTemplate, GitBranch, BadgeCheck, DollarSign, Receipt, ExternalLink,
  FileCheck, Users2, UserPlus, MoreVertical, Package, Navigation, CheckCheck, Settings, Archive, X,
  TrendingUp, TrendingDown, AlertTriangle, Mail, Plane, LogIn, LogOut, Maximize2, Calculator, FolderLock,
  Scale, Banknote, CreditCard, Percent, BarChart2, ScrollText, LayoutDashboard,
  MessageSquare, Activity, CheckSquare, Send, Phone, Check,
  FileImage, Eye, Pencil,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import { WeatherPanel, EtaWeatherAlert } from "@/components/port-weather-panel";
import { getVoyageFeatures } from "@/lib/voyage-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { AnimatePresence, motion } from "framer-motion";
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "@/hooks/use-auth";
import { fmtDate, fmtDateTime } from "@/lib/formatDate";
import { useSocket } from "@/hooks/use-socket";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertPortExpenseSchema, type PortExpense, type Voyage, type Port } from "@shared/schema";
import { generateAndPrintCrewDocs, type DocSelection } from "@/components/crew-change-docs";
import { getDeparturePort, getDestinationPort, formatPortName, formatCoord, NAV_STATUS_CONFIG } from "@/lib/format-port";
import { PortCallWorkflow } from "@/components/port-call-workflow";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  planned:         { label: "Planned",         color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",       icon: Clock },
  active:          { label: "Active",          color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",   icon: PlayCircle },
  completed:       { label: "Completed",       color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",          icon: CheckCircle2 },
  cancelled:       { label: "Cancelled",       color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",           icon: XCircle },
  pending_finance: { label: "Pending Finance", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",   icon: DollarSign },
  archived:        { label: "Archived",        color: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",      icon: Archive },
};

const SERVICE_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  fuel:         { label: "Fuel / Bunker", icon: Fuel,          color: "text-orange-500" },
  repair:       { label: "Technical Repair", icon: Wrench,     color: "text-red-500" },
  provisioning: { label: "Provisioning",  icon: ShoppingCart,  color: "text-green-500" },
  crew_change:  { label: "Crew Change",   icon: UsersIcon,     color: "text-blue-500" },
  cleaning:     { label: "Cleaning",      icon: Sparkles,      color: "text-purple-500" },
  other:        { label: "Other",         icon: HelpCircle,    color: "text-gray-500" },
};

const DOC_TYPE_CONFIG: Record<string, string> = {
  manifest:       "Manifest",
  bill_of_lading: "Bill of Lading",
  certificate:    "Certificate",
  port_clearance: "Port Clearance",
  other:          "Other",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  planned:         ["active", "cancelled"],
  active:          ["completed", "cancelled", "pending_finance"],
  completed:       ["pending_finance"],
  cancelled:       [],
  pending_finance: ["archived"],
  archived:        [],
};

// ─── Port Call Stepper ────────────────────────────────────────────────────────

const PORT_CALL_STEPS: { key: string; label: string; icon: any }[] = [
  { key: "pre_arrival", label: "Pre-Arrival", icon: Anchor     },
  { key: "anchorage",   label: "Anchorage",   icon: Anchor     },
  { key: "berthed",     label: "Berthed",     icon: Ship       },
  { key: "cargo_ops",   label: "Cargo Ops",   icon: Package    },
  { key: "departed",    label: "Departed",    icon: Navigation },
];

function getStepperIndex(status: string): number {
  if (status === "planned")   return 0;
  if (status === "active")    return 3;
  if (status === "completed") return 4;
  return -1;
}

function getDateTag(dt: string | null | undefined): {
  label: string; relText: string; color: string; isOverdue: boolean;
} | null {
  if (!dt) return null;
  const now = Date.now();
  const ms = new Date(dt).getTime();
  const days = Math.ceil((ms - now) / 86_400_000);
  const label = fmtDate(dt);
  if (days > 3)  return { label, relText: `in ${days} days`,        color: "text-slate-300 bg-slate-700/50 border-slate-600/30",   isOverdue: false };
  if (days > 0)  return { label, relText: days === 1 ? "Tomorrow" : `in ${days} days`, color: "text-orange-400 bg-orange-500/20 border-orange-500/20", isOverdue: false };
  if (days === 0) return { label, relText: "Today",                  color: "text-red-400 bg-red-500/20 border-red-500/20",          isOverdue: false };
  return            { label, relText: `⚠️ ${Math.abs(days)} days overdue`, color: "text-red-400 bg-red-500/20 border-red-500/20", isOverdue: true };
}

function PortSearch({ value, onChange }: { value: string; onChange: (portId: number, portName: string) => void }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const { data: ports } = useQuery<Port[]>({
    queryKey: ["/api/ports", query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const res = await fetch(`/api/ports?q=${encodeURIComponent(query)}`);
      return res.json();
    },
    enabled: query.length >= 2,
  });
  return (
    <div className="relative">
      <Input value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }} placeholder="Search port..." onFocus={() => setOpen(true)} />
      {open && ports && ports.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {ports.map(p => (
            <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors" onMouseDown={() => { onChange(p.id, p.name); setQuery(p.name); setOpen(false); }}>
              <span className="font-medium">{p.name}</span>{p.code && <span className="ml-2 text-xs text-muted-foreground">{p.code}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110"
          data-testid={`star-${i}`}
        >
          <Star
            className={`w-7 h-7 ${(hovered || value) >= i ? "fill-amber-400 text-amber-400 drop-shadow" : "text-muted-foreground"} transition-colors`}
          />
        </button>
      ))}
    </div>
  );
}

type AiSuggestion = { crewId: number; field: string; label: string; newVal: any; oldVal: any };

function DraggableCrewCard({ id, children }: { id: number; children: import("react").ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: String(id) });
  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 999, position: "relative" as const }
    : undefined;
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-60" : undefined} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function VoyageVaultSection({ vesselId }: { vesselId: number }) {
  const { data: vaultCerts = [] } = useQuery<any[]>({
    queryKey: [`/api/vessels/${vesselId}/certificates`],
    enabled: vesselId > 0,
  });
  const { data: vaultStats } = useQuery<any>({
    queryKey: [`/api/vessels/${vesselId}/vault-stats`],
    enabled: vesselId > 0,
  });
  const today = new Date();
  const alerts = vaultCerts.filter((c: any) => {
    if (!c.expiresAt) return false;
    const exp = new Date(c.expiresAt);
    return exp < today || (exp.getTime() - today.getTime()) / 86400000 <= 30;
  });
  const uploaded = vaultStats?.uploaded ?? 0;
  const total = vaultStats?.total ?? 18;
  return (
    <Card className="p-4 space-y-3" data-testid="card-voyage-vault">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderLock className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
          <h2 className="font-semibold text-sm">Vessel Vault Documents</h2>
          <span className="text-xs text-muted-foreground">({uploaded}/{total} statutory)</span>
        </div>
        <a
          href={`/vessel-vault/${vesselId}`}
          className="flex items-center gap-1 text-xs text-[hsl(var(--maritime-primary))] font-medium hover:underline"
          data-testid="button-open-vessel-vault"
        >
          Open Vault <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-[hsl(var(--maritime-primary))] rounded-full transition-all"
          style={{ width: `${total > 0 ? Math.round((uploaded / total) * 100) : 0}%` }}
        />
      </div>
      {alerts.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-amber-600">Certificates requiring attention:</p>
          {alerts.slice(0, 5).map((c: any) => {
            const exp = c.expiresAt ? new Date(c.expiresAt) : null;
            const isExpired = exp && exp < today;
            return (
              <div key={c.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${isExpired ? "bg-red-50 dark:bg-red-950/20" : "bg-amber-50 dark:bg-amber-950/20"}`} data-testid={`vault-alert-cert-${c.id}`}>
                {isExpired ? <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                <span className="font-medium">{c.name}</span>
                <span className="ml-auto text-muted-foreground">
                  {isExpired ? "Expired" : `Expires ${new Date(c.expiresAt).toLocaleDateString("en-GB")}`}
                </span>
              </div>
            );
          })}
          {alerts.length > 5 && <p className="text-xs text-muted-foreground pl-1">+{alerts.length - 5} more</p>}
        </div>
      ) : uploaded === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          No documents uploaded yet.{" "}
          <a href={`/vessel-vault/${vesselId}`} className="text-[hsl(var(--maritime-primary))] hover:underline">Open Vault →</a>
        </p>
      ) : (
        <p className="text-xs text-emerald-600 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> All uploaded statutory documents are valid.
        </p>
      )}
    </Card>
  );
}

// ─── OriginPortInline ─────────────────────────────────────────────────────────
function OriginPortInline({ value, onChange }: { value: string; onChange: (portId: number, portName: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState(value);
  const { data: ports } = useQuery<Port[]>({
    queryKey: ["/api/ports", query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const res = await fetch(`/api/ports?q=${encodeURIComponent(query)}`);
      return res.json();
    },
    enabled: query.length >= 2,
  });

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setQuery(value); setEditing(true); }}
        className="group flex items-center gap-1 text-sm font-bold text-left hover:text-blue-300 transition-colors"
        data-testid="button-edit-origin-port"
      >
        {value || <span className="text-muted-foreground font-normal italic">Ayarla...</span>}
        <Pen className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
      </button>
    );
  }

  return (
    <div className="relative">
      <Input
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setEditing(false), 200)}
        placeholder="Liman ara..."
        className="h-7 text-xs px-2 py-0 w-36"
        data-testid="input-origin-port"
      />
      {ports && ports.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 w-56 bg-popover border rounded-md shadow-xl max-h-44 overflow-y-auto">
          {ports.map((p: Port) => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors"
              onMouseDown={() => {
                onChange(p.id, p.name);
                setQuery(p.name);
                setEditing(false);
              }}
            >
              <span className="font-medium">{p.name}</span>
              {p.code && <span className="ml-1.5 text-[10px] text-muted-foreground">{p.code}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── VoyageLiveTracker ────────────────────────────────────────────────────────
function VoyageLiveTracker({ voyage, portName, imoNumber, onOriginPortChange }: {
  voyage: any;
  portName: string;
  imoNumber: string | null;
  onOriginPortChange?: (portId: number, portName: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);

  const eta = voyage.eta ? new Date(voyage.eta) : null;
  const etd = voyage.etd ? new Date(voyage.etd) : null;
  const now = new Date();
  let progress = 0;
  if (eta && etd && etd > eta) {
    progress = Math.min(1, Math.max(0, (now.getTime() - eta.getTime()) / (etd.getTime() - eta.getTime())));
  }

  const { data: pos, isLoading } = useQuery<any>({
    queryKey: ["/api/vessels/live-position", imoNumber],
    queryFn: async () => {
      const res = await fetch(`/api/vessels/live-position?imo=${encodeURIComponent(imoNumber!)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!imoNumber,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (!pos || !mapRef.current) return;
    let destroyed = false;
    import("leaflet").then((LM) => {
      if (destroyed || !mapRef.current) return;
      const L = LM.default;
      if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; }
      const map = L.map(mapRef.current, {
        center: [pos.latitude, pos.longitude],
        zoom: 10,
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: false,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 18,
      }).addTo(map);
      const rotation = pos.course || pos.heading || 0;
      const icon = L.divIcon({
        html: `<svg width="26" height="26" viewBox="0 0 24 24" style="transform:rotate(${rotation}deg)" xmlns="http://www.w3.org/2000/svg"><polygon points="12,2 20,20 12,15 4,20" fill="#3b82f6" stroke="white" stroke-width="1.5"/></svg>`,
        className: "",
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      L.marker([pos.latitude, pos.longitude], { icon }).addTo(map);
      leafletMap.current = map;
    });
    return () => {
      destroyed = true;
      if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; }
    };
  }, [pos]);

  const hasLiveData = !!pos;
  const showMap = hasLiveData || (imoNumber && isLoading);

  return (
    <Card className="overflow-hidden border-border bg-card" data-testid="card-voyage-live-tracker">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <Navigation className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <span className="text-sm font-semibold">Yolculuk Durumu</span>
        </div>
        {hasLiveData ? (
          <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            CANLI
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/60 px-2.5 py-1 rounded-full border border-border/40 bg-muted/20">
            Planlı
          </span>
        )}
      </div>

      <div className={showMap ? "grid grid-cols-1 md:grid-cols-2" : "px-4 py-4 space-y-4"}>

        {/* ── Sol: harita (sadece live data varsa) veya boş/loading ── */}
        {showMap && (
          <div
            ref={mapRef}
            style={{ height: "250px", minHeight: "250px" }}
            className="w-full bg-slate-900 flex items-center justify-center"
          >
            {isLoading && !pos && (
              <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
                <div className="w-6 h-6 border-2 border-blue-400/50 border-t-blue-400 rounded-full animate-spin" />
                <span className="text-[10px]">Konum alınıyor...</span>
              </div>
            )}
          </div>
        )}

        {/* ── Sağ: bilgi paneli ── */}
        <div className={`flex flex-col gap-3 justify-between ${showMap ? "px-4 py-4" : ""}`}>

          {/* Kalkış → Varış */}
          {(() => {
            const depPort = getDeparturePort(voyage, pos);
            const destPort = getDestinationPort({ ...voyage, portName }, pos);
            const aisDest = formatPortName(pos?.destination);
            const showAisDiff = aisDest && aisDest !== destPort;
            return (
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Kalkış</p>
                  {onOriginPortChange ? (
                    <OriginPortInline
                      value={voyage.originPortName || ""}
                      onChange={onOriginPortChange}
                    />
                  ) : depPort ? (
                    <p className="text-sm font-bold truncate">{depPort}</p>
                  ) : (
                    <p className="text-sm italic text-slate-500">AIS Bekleniyor...</p>
                  )}
                </div>
                <div className="text-muted-foreground/40 text-base pt-2 shrink-0">→</div>
                <div className="min-w-0 text-right flex-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Varış</p>
                  {destPort ? (
                    <p className="text-sm font-bold truncate">{destPort}</p>
                  ) : (
                    <p className="text-sm italic text-slate-500">AIS Bekleniyor...</p>
                  )}
                  {showAisDiff && (
                    <div className="flex items-center gap-1 mt-0.5 justify-end">
                      <span className="text-[10px] text-slate-500">AIS:</span>
                      <span className="text-[10px] text-slate-400">{aisDest}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* İlerleme çubuğu */}
          {eta && etd ? (
            <div>
              {(() => {
                const navStatus = pos?.navigation_status || "";
                const isMoored = navStatus.toLowerCase().includes("moor") || navStatus.toLowerCase().includes("berth");
                const isAnchor = navStatus.toLowerCase().includes("anchor");
                const isUnderway = (pos?.speed ?? 0) > 0.5;
                if (isMoored) {
                  return (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-emerald-500/20 rounded-full h-2">
                        <div className="bg-emerald-500 h-2 rounded-full w-full" />
                      </div>
                      <span className="text-[10px] text-emerald-400 whitespace-nowrap shrink-0">⚓ In Port</span>
                    </div>
                  );
                }
                if (isAnchor) {
                  return (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-amber-500/20 rounded-full h-2">
                        <div className="bg-amber-500 h-2 rounded-full w-full animate-pulse" />
                      </div>
                      <span className="text-[10px] text-amber-400 whitespace-nowrap shrink-0">⚓ At Anchor</span>
                    </div>
                  );
                }
                return (
                  <div className="relative h-2.5 bg-muted/60 rounded-full overflow-hidden">
                    <div
                      className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${isUnderway ? "bg-blue-500" : "bg-blue-500"}`}
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                );
              })()}
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] text-muted-foreground">ETA {eta.toLocaleDateString("tr-TR")}</span>
                <span className="text-[9px] text-blue-400 font-bold">{Math.round(progress * 100)}% tamamlandı</span>
                <span className="text-[9px] text-muted-foreground">ETD {etd.toLocaleDateString("tr-TR")}</span>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground/60 italic">ETA/ETD tarihi girilmemiş</div>
          )}

          {/* Canlı pozisyon detayları */}
          {hasLiveData && (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                {(() => {
                  const lat = pos.latitude;
                  const lon = pos.longitude;
                  const navSt = pos.navigation_status || "";
                  const statusCfg = NAV_STATUS_CONFIG[navSt] ?? { icon: "📍", color: "text-slate-400", label: navSt || "—" };
                  return (
                    <>
                      <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Enlem</p>
                        <p className="text-xs font-semibold leading-tight">
                          {lat != null ? formatCoord(lat, "lat") : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Boylam</p>
                        <p className="text-xs font-semibold leading-tight">
                          {lon != null ? formatCoord(lon, "lon") : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Hız</p>
                        <p className="text-xs font-semibold leading-tight">{pos.speed ?? "—"} kn</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Rota</p>
                        <p className="text-xs font-semibold leading-tight">{pos.course ?? "—"}°</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Baş İstikameti</p>
                        <p className="text-xs font-semibold leading-tight">{pos.heading ?? "—"}°</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-0.5">Durum</p>
                        <p className={`text-xs font-semibold leading-tight flex items-center gap-1 ${statusCfg.color}`}>
                          <span>{statusCfg.icon}</span>
                          <span>{statusCfg.label}</span>
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/60 border-t border-border/40 pt-2">
                <Clock className="w-2.5 h-2.5 shrink-0" />
                <span>Güncelleme: {pos.timestamp ? fmtDateTime(new Date(pos.timestamp)) : "—"}</span>
                <span className="ml-auto shrink-0">Kaynak: Datalastic</span>
              </div>
            </>
          )}

          {/* Mesajlar: IMO yok veya veri yok */}
          {!hasLiveData && !isLoading && (
            <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-[11px] ${
              !imoNumber
                ? "bg-muted/30 border border-border/40 text-muted-foreground"
                : "bg-amber-500/8 border border-amber-500/20 text-amber-400/80"
            }`}>
              <Navigation className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-60" />
              <span>
                {!imoNumber
                  ? "Canlı konum için IMO numarası gerekli. Gemiler sayfasından IMO ekleyebilirsiniz."
                  : "Bu gemi için şu anda canlı konum verisi mevcut değil."}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function VoyageDetail() {
  const { id } = useParams<{ id: string }>();
  const voyageId = parseInt(id || "0");
  const { user } = useAuth();
  const isShipowner = user?.userRole === "shipowner";
  const { toast } = useToast();
  const { joinVoyage, leaveVoyage } = useSocket();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!voyageId) return;
    joinVoyage(voyageId);
    return () => { leaveVoyage(voyageId); };
  }, [voyageId]);

  const [newTask, setNewTask] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Adjusted activeTab initial value if needed, but 'operation' (Overview) is usually first
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState<"comment" | "observation" | "alert" | "milestone">("comment");
  const [isPrivateNote, setIsPrivateNote] = useState(false);
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskAssignedTo, setTaskAssignedTo] = useState("both");

  const { data: voyageNotes = [] } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "notes"],
    enabled: !!voyageId,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/notes`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "notes"] });
      setNoteContent("");
      setShowNoteForm(false);
      toast({ title: "Note added" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      await apiRequest("DELETE", `/api/voyages/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "notes"] });
      toast({ title: "Note deleted" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/voyages/${voyageId}/checklist/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] });
      toast({ title: "Task updated" });
    },
  });
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editCargoOpen, setEditCargoOpen] = useState(false);
  const [editCargoType, setEditCargoType] = useState("");
  const [editCargoQty, setEditCargoQty] = useState("");
  const [inviteTab, setInviteTab] = useState<"email" | "directory" | "bulk">("email");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("observer");
  const [inviteServiceType, setInviteServiceType] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkRole, setBulkRole] = useState("observer");
  const [directorySearch, setDirectorySearch] = useState("");
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDesc, setNoteDesc] = useState("");
  const [showAddLogDialog, setShowAddLogDialog] = useState(false);
  const [logForm, setLogForm] = useState<{
    fromTime: string; toTime: string; logType: string; remarks: string; delayReason: string; delayNotes: string;
    receiverEntries: Record<number, { amount: string; trucks: string }>;
  }>({ fromTime: "", toTime: "", logType: "operation", remarks: "", delayReason: "", delayNotes: "", receiverEntries: {} });
  const [showCargoReportDialog, setShowCargoReportDialog] = useState(false);
  const [reportEmail, setReportEmail] = useState("");
  const [reportSelectedEmails, setReportSelectedEmails] = useState<string[]>([]);
  const [reportManualEmail, setReportManualEmail] = useState("");
  const [contactBulkText, setContactBulkText] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactRole, setNewContactRole] = useState("other");
  const [showAddReceiverDialog, setShowAddReceiverDialog] = useState(false);
  const [receiverForm, setReceiverForm] = useState({ name: "", allocatedMt: 0 });
  const [showAddParcelDialog, setShowAddParcelDialog] = useState(false);
  const [editingParcel, setEditingParcel] = useState<any | null>(null);
  const [parcelForm, setParcelForm] = useState({ receiverName: "", cargoType: "", cargoDescription: "", targetQuantity: 0, handledQuantity: 0, unit: "MT", holdNumbers: "", blNumber: "", notes: "" });
  const [stowageNotes, setStowageNotes] = useState("");
  const [stowageNotesEditing, setStowageNotesEditing] = useState(false);
  const [inlineHandled, setInlineHandled] = useState<Record<number, string>>({});
  const [docFilter, setDocFilter] = useState<string>("all");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [showDocDialog, setShowDocDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [docForm, setDocForm] = useState({ name: "", docType: "other", notes: "", fileBase64: "", fileUrl: "", fileName: "", fileSize: 0 });
  const [docUploading, setDocUploading] = useState(false);
  const [isDragOverDropzone, setIsDragOverDropzone] = useState(false);
  const [isPanelDragOver, setIsPanelDragOver] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generatingCount, setGeneratingCount] = useState(0);
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: "" });
  const [isAddExpenseDialogOpen, setIsAddExpenseDialogOpen] = useState(false);
  const [showCloseOutDialog, setShowCloseOutDialog] = useState(false);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [closeOutSummary, setCloseOutSummary] = useState<any>(null);

  const { data: closeOutStatus, isLoading: isLoadingCloseOutStatus } = useQuery({
    queryKey: ["/api/voyages", voyageId, "closeout-status"],
    enabled: showCloseOutDialog,
  });

  const completeVoyageMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/complete`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] });
      setCloseOutSummary(data.summary);
      setShowCloseOutDialog(false);
      setShowSummaryDialog(true);
      toast({ title: "Voyage Completed", description: "The voyage has been closed out successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertPortExpenseSchema),
    defaultValues: {
      category: "other",
      description: "",
      amount: 0,
      currency: "USD",
      vendor: "",
      receiptNumber: "",
      expenseDate: new Date().toISOString().split('T')[0],
      notes: "",
      voyageId: voyageId,
      isPaid: false,
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/port-expenses", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/port-expenses", "voyage", voyageId] });
      setIsAddExpenseDialogOpen(false);
      toast({ title: "Success", description: "Port expense added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // ── Husbandry: Crew Logistics Board ────────────────────────────────────────
  type CrewTimelineStep = { id: number; icon: string; label: string; time: string };
  type CrewDoc = { name: string; dataUrl: string };
  type CrewDocs = { passport: CrewDoc | null; seamansBook: CrewDoc | null; medicalCert: CrewDoc | null };
  type CrewSigner = {
    id: number; name: string; rank: string; side: "on" | "off";
    nationality: string;
    passportNo: string;
    dob: string;
    seamanBookNo: string;
    birthPlace: string;
    flight: string; flightEta: string; flightDelayed: boolean;
    visaRequired: boolean;
    eVisaStatus: "pending" | "approved" | "n/a";
    okToBoard: "pending" | "sent" | "confirmed";
    arrivalStatus: "pending" | "arrived" | "departed";
    timeline: CrewTimelineStep[];
    docs: CrewDocs;
    requiresHotel: boolean;
    hotelName: string;
    hotelCheckIn: string;
    hotelCheckOut: string;
    hotelStatus: "none" | "reserved" | "checked-in" | "checked-out";
    hotelPickupTime: string;
  };
  type CrewSlideFormType = Omit<CrewSigner, "id" | "timeline" | "arrivalStatus" | "docs">;
  const ON_TIMELINE_DEFAULT: CrewTimelineStep[] = [
    { id: 1, icon: "✈️", label: "Arrival Flight", time: "" },
    { id: 2, icon: "🚐", label: "Airport → Port", time: "" },
    { id: 3, icon: "🚤", label: "Embark",          time: "" },
  ];
  const OFF_TIMELINE_DEFAULT: CrewTimelineStep[] = [
    { id: 1, icon: "🚤", label: "Disembark",       time: "" },
    { id: 2, icon: "🛂", label: "Customs / Police", time: "" },
    { id: 3, icon: "🚐", label: "Port → Airport",  time: "" },
    { id: 4, icon: "✈️", label: "Flight",           time: "" },
  ];
  const EMPTY_CREW_DOCS: CrewDocs = { passport: null, seamansBook: null, medicalCert: null };
  const HOTEL_DEFAULTS = { requiresHotel: false, hotelName: "", hotelCheckIn: "", hotelCheckOut: "", hotelStatus: "none" as const, hotelPickupTime: "" };
  const EMPTY_CREW_SLIDE_FORM: CrewSlideFormType = { name: "", rank: "", side: "on", nationality: "", passportNo: "", dob: "", seamanBookNo: "", birthPlace: "", flight: "", flightEta: "", flightDelayed: false, visaRequired: false, eVisaStatus: "n/a", okToBoard: "pending" as const, ...HOTEL_DEFAULTS };
  const [crewSigners, setCrewSigners] = useState<CrewSigner[]>([]);
  const [crewSaveStatus, setCrewSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const crewHydrated = useRef(false);
  const crewSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hubTimeline, setHubTimeline] = useState([
    { id: 1, time: "10:00", emoji: "📦", title: "Spare Parts Customs Clearance",       status: "in_progress" },
    { id: 2, time: "14:00", emoji: "🚐", title: "Crew Transfer from Airport to Port",  status: "upcoming"    },
    { id: 3, time: "15:30", emoji: "🚤", title: "Launch Boat (Servis Motoru) to Vessel", status: "upcoming"  },
    { id: 4, time: "16:00", emoji: "🥩", title: "Provisions Delivery Alongside",        status: "upcoming"   },
  ]);
  const [editingTimelineId, setEditingTimelineId] = useState<number | null>(null);
  const [timelineEditVal, setTimelineEditVal]     = useState("");
  const [editingCrewTimeline, setEditingCrewTimeline] = useState<{ crewId: number; stepId: number } | null>(null);
  const [crewTimelineEditVal, setCrewTimelineEditVal] = useState("");
  const [showCrewPanel, setShowCrewPanel] = useState(false);
  const [showCrewDocDialog, setShowCrewDocDialog] = useState(false);
  const [docSel, setDocSel] = useState<DocSelection>({ gumruk: true, polisYurttan: true, polisYurda: true, vize: false, acente: false, ekimTur: false });
  const [crewPanelMode, setCrewPanelMode] = useState<"add_on" | "add_off" | "edit">("add_on");
  const [editingCrewId, setEditingCrewId] = useState<number | null>(null);
  const [crewSlideForm, setCrewSlideForm] = useState<CrewSlideFormType>(EMPTY_CREW_SLIDE_FORM);
  const [slideFormTimeline, setSlideFormTimeline] = useState<CrewTimelineStep[]>([]);
  const [crewFilterMode, setCrewFilterMode] = useState<"all" | "action" | "ready">("all");
  const [crewCompactMode, setCrewCompactMode] = useState(false);
  const [isHotelPanelOpen, setIsHotelPanelOpen] = useState(false);
  const [inlineEdit, setInlineEdit] = useState<{ crewId: number; field: "flight" | "flightEta"; val: string } | null>(null);

  // ── Close Operation / Finance Handover ───────────────────────────────────
  const [showCloseOpModal, setShowCloseOpModal] = useState(false);
  const [closeOpAcknowledge, setCloseOpAcknowledge] = useState(false);

  // ── Drag & Drop ─────────────────────────────────────────────────────────
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [dragQuickBook, setDragQuickBook] = useState<{ crewId: number; crewName: string; crewRank: string } | null>(null);
  const [dragQuickHotelForm, setDragQuickHotelForm] = useState({ hotelName: "", checkIn: "", checkOut: "" });
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const { setNodeRef: setHotelDropRef, isOver: isHotelDragOver } = useDroppable({ id: "hotel-drop-zone" });
  const dragAutoOpenedPanel = useRef(false);

  // ── AI Human-in-the-Loop ─────────────────────────────────────────────────
  const [aiPendingSuggestions, setAiPendingSuggestions] = useState<AiSuggestion[]>([]);

  // ── Smart Rule Engine helpers ─────────────────────────────────────────────
  const timeToMins = (t: string): number => {
    if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return -1;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const addMins = (t: string, delta: number): string => {
    const base = timeToMins(t);
    if (base < 0) return "";
    const total = ((base + delta) % 1440 + 1440) % 1440;
    const hh = String(Math.floor(total / 60)).padStart(2, "0");
    const mm = String(total % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  };
  // Compute per-crew card warnings (Rule 1–4) for display on cards
  // Rule 1: on-signer flight after vessel ETD (critical)
  // Rule 2: off-signer <5h disembark gap (operational)
  // Rule 3: on-signer flight arrives >6h before vessel ETA → hotel required
  // Rule 4: off-signer flight departs >12h after vessel ETD → hotel required
  const getCrewWarnings = (crew: CrewSigner, vesselEtdStr?: string, vesselEtaStr?: string): string[] => {
    const warns: string[] = [];
    const flightMins = timeToMins(crew.flightEta);

    if (crew.side === "on") {
      // Rule 1: flight arrives after vessel departure
      if (vesselEtdStr) {
        const etdMins = timeToMins(vesselEtdStr);
        if (flightMins >= 0 && etdMins >= 0 && flightMins > etdMins)
          warns.push("⚠️ Critical: Flight arrives after Vessel ETD!");
      }
      // Rule 3: flight arrives >6h before vessel ETA → hotel required
      if (vesselEtaStr) {
        const etaMins = timeToMins(vesselEtaStr);
        if (flightMins >= 0 && etaMins >= 0 && etaMins - flightMins > 360)
          warns.push("🏨 Hotel Required: >6h wait before Vessel ETA.");
      }
    }

    if (crew.side === "off") {
      // Rule 2: <5h between disembark and departure flight
      const disembarkStep = crew.timeline.find(s => /disembark/i.test(s.label));
      const disembarkMins = timeToMins(disembarkStep?.time ?? "");
      if (flightMins >= 0 && disembarkMins >= 0) {
        const gap = flightMins >= disembarkMins
          ? flightMins - disembarkMins
          : (1440 - disembarkMins) + flightMins;
        if (gap < 300) warns.push("⚠️ Warning: Minimum 5 hours required for disembarkation & transfer.");
      }
      // Rule 4: flight departs >12h after vessel ETD → hotel required
      if (vesselEtdStr) {
        const etdMins = timeToMins(vesselEtdStr);
        if (flightMins >= 0 && etdMins >= 0) {
          const waitMins = flightMins >= etdMins
            ? flightMins - etdMins
            : (1440 - etdMins) + flightMins;
          if (waitMins > 720)
            warns.push("🏨 Hotel Required: >12h wait after Vessel ETD.");
        }
      }
    }

    return warns;
  };

  // Helper: does a warning string indicate a hotel requirement rule?
  const isHotelWarning = (w: string) => w.startsWith("🏨 Hotel Required");

  // ── AI Drop Zone / Command Palette ────────────────────────────────────────
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const [crewAiParsing, setCrewAiParsing] = useState(false);
  const [crewAiText, setCrewAiText] = useState("");
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // ── Ops Summary Report ────────────────────────────────────────────────────
  const [opsSummaryOpen, setOpsSummaryOpen] = useState(false);
  const [opsSummaryLang, setOpsSummaryLang] = useState<"TR" | "EN">("EN");
  const [opsSummaryText, setOpsSummaryText] = useState("");

  // ── Activity & Audit Log ───────────────────────────────────────────────────
  type ActivityLogEntry = { id: number; time: string; actor: "AI" | "Agent" | "System"; message: string; highlight?: string };
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([
    { id: 3, time: "11:25 AM", actor: "System",  message: "Auto-generated 'Shore Pass Forms' for 7 crew members." },
    { id: 2, time: "11:20 AM", actor: "Agent",   message: "Updated Capt. Ahmet Yılmaz's flight from TK10 to TK2320.", highlight: "TK10 → TK2320" },
    { id: 1, time: "10:45 AM", actor: "AI",      message: "AI extracted 2 On-signers and 2 Off-signers from 'CrewList_March.pdf'." },
  ]);
  const addActivityLog = (message: string, actor: ActivityLogEntry["actor"], highlight?: string) => {
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    // Use random suffix to guarantee unique ID even when called multiple times per millisecond
    const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    setActivityLog(prev => [{ id, time, actor, message, highlight }, ...prev]);
  };

  // ── Ops Summary Content Engine ─────────────────────────────────────────────
  const generateOpsSummary = (lang: "TR" | "EN"): string => {
    const isEN = lang === "EN";
    const now = new Date();
    const nowStr = now.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }) + " / " + now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

    // ── BLOCK 1: Warnings ────────────────────────────────────────────────────
    const warnings: string[] = [];
    crewSigners.forEach(c => {
      if (c.requiresHotel && !c.hotelName) {
        warnings.push(isEN
          ? `• Hotel reservation missing for ${c.name} (${c.rank}).`
          : `• ${c.name} (${c.rank}) için otel rezervasyonu eksik.`);
      }
      if (c.flightDelayed) {
        warnings.push(isEN
          ? `• ${c.name}'s flight (${c.flight || "—"}) is delayed.`
          : `• ${c.name}'in uçuşunda (${c.flight || "—"}) rötar var.`);
      }
      if (c.visaRequired && c.eVisaStatus === "pending") {
        warnings.push(isEN
          ? `• Visa pending for ${c.name} (${c.rank}).`
          : `• ${c.name} (${c.rank}) için vize onayı bekleniyor.`);
      }
    });
    const block1Header = isEN ? "⚠️  ACTION REQUIRED / WARNINGS" : "⚠️  AKSİYON BEKLEYENLER / UYARILAR";
    const block1Body = warnings.length > 0 ? warnings.join("\n") : (isEN ? "✅ No action items." : "✅ Bekleyen aksiyon yok.");

    // ── BLOCK 2: Logistics Timeline ──────────────────────────────────────────
    const onSigners = crewSigners.filter(c => c.side === "on");
    const offSigners = crewSigners.filter(c => c.side === "off");

    const formatOnSigner = (c: (typeof crewSigners)[0]) => {
      const transfer = c.timeline.find(s => /airport.*port|transfer/i.test(s.label));
      const transferTime = transfer?.time ? ` at ${transfer.time}` : "";
      const hotelInfo = c.hotelName
        ? (isEN
            ? `, checked into ${c.hotelName}${c.hotelCheckIn ? " (check-in: " + c.hotelCheckIn + ")" : ""}${c.hotelCheckOut ? ", check-out: " + c.hotelCheckOut : ""}`
            : `, ${c.hotelName} otel'e yerleştirildi${c.hotelCheckIn ? " (giriş: " + c.hotelCheckIn + ")" : ""}${c.hotelCheckOut ? ", çıkış: " + c.hotelCheckOut : ""}`)
        : "";
      if (isEN) return `  • ${c.name} (${c.rank}) — Flight: ${c.flight || "—"}, Arrival ETA: ${c.flightEta || "—"}${transferTime ? ", transferred" + transferTime : ""}${hotelInfo}.`;
      return `  • ${c.name} (${c.rank}) — Uçuş: ${c.flight || "—"}, Geliş: ${c.flightEta || "—"}${transferTime ? ", transfer" + transferTime : ""}${hotelInfo}.`;
    };
    const formatOffSigner = (c: (typeof crewSigners)[0]) => {
      const transfer = c.timeline.find(s => /port.*airport|transfer/i.test(s.label));
      const transferTime = transfer?.time ? ` at ${transfer.time}` : "";
      if (isEN) return `  • ${c.name} (${c.rank}) — Flight: ${c.flight || "—"}, Departure ETA: ${c.flightEta || "—"}${transferTime ? ", transfer to airport" + transferTime : ""}.`;
      return `  • ${c.name} (${c.rank}) — Uçuş: ${c.flight || "—"}, Gidiş: ${c.flightEta || "—"}${transferTime ? ", havalimanı transferi" + transferTime : ""}.`;
    };

    const onLabel = isEN ? "ON-SIGNERS (Joining Crew)" : "KATILANLAR (Gemiye Binenler)";
    const offLabel = isEN ? "OFF-SIGNERS (Departing Crew)" : "AYRILANLAR (Gemiden İnenler)";
    const noneStr = isEN ? "  None." : "  Yok.";
    const block2Header = isEN ? "📋  OPERATIONS SUMMARY — LOGISTICS TIMELINE" : "📋  OPERASYON ÖZETİ — LOJİSTİK ZAMAN ÇİZELGESİ";
    const block2Body = [
      `${onLabel}:`,
      onSigners.length > 0 ? onSigners.map(formatOnSigner).join("\n") : noneStr,
      "",
      `${offLabel}:`,
      offSigners.length > 0 ? offSigners.map(formatOffSigner).join("\n") : noneStr,
    ].join("\n");

    // ── BLOCK 3: Services (NO pricing) ──────────────────────────────────────
    const uniqueFlights = [...new Set(crewSigners.map(c => c.flight).filter(Boolean))];
    const hotelsWithNights = crewSigners
      .filter(c => c.requiresHotel && c.hotelName)
      .map(c => {
        const nights = (() => {
          if (!c.hotelCheckIn || !c.hotelCheckOut) return null;
          const parseHM = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
          const inM = parseHM(c.hotelCheckIn);
          const outM = parseHM(c.hotelCheckOut);
          const diff = outM < inM ? (1440 - inM + outM) : (outM - inM);
          return diff >= 600 ? 1 : null;
        })();
        return `${c.hotelName}${nights ? (isEN ? " (1 Night)" : " (1 Gece)") : ""}`;
      });
    const uniqueHotels = [...new Set(hotelsWithNights)];
    const transferCount = crewSigners.reduce((acc, c) => {
      return acc + c.timeline.filter(s => /transfer|airport/i.test(s.label)).length;
    }, 0);
    const visaCount = crewSigners.filter(c => c.visaRequired).length;

    const block3Header = isEN ? "🛎️  SERVICES ARRANGED (No Pricing)" : "🛎️  SAĞLANAN HİZMET KALEMLERİ (Fiyatsız)";
    const flightsLine = isEN
      ? `  • Flights: ${uniqueFlights.length > 0 ? uniqueFlights.join(", ") : "None"}`
      : `  • Uçuşlar: ${uniqueFlights.length > 0 ? uniqueFlights.join(", ") : "Yok"}`;
    const hotelsLine = isEN
      ? `  • Accommodation: ${uniqueHotels.length > 0 ? uniqueHotels.join("; ") : "None"}`
      : `  • Konaklama: ${uniqueHotels.length > 0 ? uniqueHotels.join("; ") : "Yok"}`;
    const transferLine = isEN
      ? `  • Ground Transfers: ${transferCount} vehicle run(s)`
      : `  • Kara Transferleri: ${transferCount} araç seferi`;
    const visaLine = visaCount > 0
      ? (isEN ? `  • Visa Services: ${visaCount} crew member(s)` : `  • Vize Hizmetleri: ${visaCount} personel`)
      : null;
    const block3Body = [flightsLine, hotelsLine, transferLine, ...(visaLine ? [visaLine] : [])].join("\n");

    // ── Compose full report ──────────────────────────────────────────────────
    const sep = "─".repeat(52);
    const vesselLine = isEN
      ? `Vessel: ${voyage?.vesselName || "—"}  |  Port: ${voyage?.portName || "—"}  |  Generated: ${nowStr}`
      : `Gemi: ${voyage?.vesselName || "—"}  |  Liman: ${voyage?.portName || "—"}  |  Oluşturuldu: ${nowStr}`;

    return [
      isEN ? "OPERATIONS SUMMARY REPORT" : "OPERASYON ÖZETİ RAPORU",
      vesselLine,
      sep,
      block1Header,
      block1Body,
      sep,
      block2Header,
      block2Body,
      sep,
      block3Header,
      block3Body,
      sep,
      isEN
        ? "This report contains no pricing information."
        : "Bu rapor herhangi bir fiyat bilgisi içermemektedir.",
    ].join("\n");
  };

  // ── Auto-fill Disembark time when Off-signer ETD changes ─────────────────
  useEffect(() => {
    if (crewSlideForm.side !== "off") return;
    const etd = crewSlideForm.flightEta;
    if (!etd) return;
    const disembarkTime = addMins(etd, -300);
    if (!disembarkTime) return;
    setSlideFormTimeline(prev =>
      prev.map(s => /disembark/i.test(s.label) ? { ...s, time: disembarkTime } : s)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewSlideForm.flightEta, crewSlideForm.side]);

  // ── Auto-fill hotel pickup time = flightEta - 4h ──────────────────────────
  useEffect(() => {
    if (!crewSlideForm.requiresHotel || !crewSlideForm.flightEta) return;
    const pickup = addMins(crewSlideForm.flightEta, -240);
    if (!pickup) return;
    setCrewSlideForm(f => ({ ...f, hotelPickupTime: pickup }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewSlideForm.requiresHotel, crewSlideForm.flightEta]);


  // ── AI Text Parser — real state updater ────────────────────────────────────
  const parseAndApplyAIText = (text: string) => {
    const lower = text.toLowerCase();
    const logLines: string[] = [];

    // ── MODE 1: Structured crew list (SIGN ON / SIGN OFF table) ─────────────
    if (/SIGN[\s_-]*ON/i.test(text) || /SIGN[\s_-]*OFF/i.test(text)) {
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      let currentSide: "on" | "off" | null = null;
      let headerCols: string[] = [];
      const updateList = [...crewSigners];
      const toAdd: (typeof crewSigners)[0][] = [];

      const titleCase = (s: string) =>
        s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

      for (const line of lines) {
        if (/SIGN[\s_-]*ON/i.test(line) && !/SIGN[\s_-]*OFF/i.test(line)) {
          currentSide = "on"; headerCols = []; continue;
        }
        if (/SIGN[\s_-]*OFF/i.test(line)) {
          currentSide = "off"; headerCols = []; continue;
        }
        if (!currentSide) continue;

        // Split by tab, pipe, or 2+ spaces
        const cols = line.split(/\t|\s{2,}|\|/).map(c => c.trim()).filter(c => c.length > 0);
        if (cols.length < 2) continue;

        // Detect header row (contains CREW NAME, NAME, RANK)
        if (!headerCols.length && cols.some(c => /^(crew[\s_]?name|name)$/i.test(c))) {
          headerCols = cols.map(c => c.toLowerCase().replace(/[\s_']+/g, "_"));
          continue;
        }
        if (!headerCols.length) continue;

        // Map columns to keys
        const row: Record<string, string> = {};
        headerCols.forEach((h, i) => { if (cols[i]) row[h] = cols[i]; });

        const rawName  = row["crew_name"] || row["name"] || "";
        const rank     = titleCase(row["rank"] || "");
        const nat      = titleCase(row["nationality"] || "");
        const passport = row["passport"] || "";

        if (!rawName || rawName.length < 3) continue;
        const name = titleCase(rawName);

        // Match existing crew by normalized full name or first token
        const token0 = rawName.toLowerCase().split(/\s+/)[0];
        const existsIdx = updateList.findIndex(c =>
          c.name.toLowerCase().replace(/\s+/g, "") === rawName.toLowerCase().replace(/\s+/g, "") ||
          c.name.toLowerCase().split(/\s+/)[0] === token0
        );

        if (existsIdx >= 0) {
          const old = updateList[existsIdx];
          const fieldChanges: string[] = [];
          if (passport && passport !== old.passportNo) fieldChanges.push(`passport: ${old.passportNo || "—"} → ${passport}`);
          if (nat && nat !== old.nationality)           fieldChanges.push(`nationality: ${old.nationality || "—"} → ${nat}`);
          if (rank && rank !== old.rank)                fieldChanges.push(`rank: ${old.rank || "—"} → ${rank}`);
          if (fieldChanges.length) {
            updateList[existsIdx] = { ...old, passportNo: passport || old.passportNo, nationality: nat || old.nationality, rank: rank || old.rank };
            logLines.push(`Updated ${name}: ${fieldChanges.join(", ")}`);
          }
        } else {
          toAdd.push({
            id: Date.now() + toAdd.length + 1,
            name,
            rank,
            side: currentSide,
            nationality: nat,
            passportNo: passport,
            flight: "",
            flightEta: "",
            flightDelayed: false,
            visaRequired: false,
            eVisaStatus: "n/a",
            okToBoard: "pending",
            arrivalStatus: "expected",
            timeline: [],
            docs: { passport: null, seamansBook: null, medicalCert: null },
          });
          logLines.push(`AI added ${currentSide === "on" ? "ON-SIGNER" : "OFF-SIGNER"}: ${name}${rank ? ` (${rank})` : ""}${nat ? `, ${nat}` : ""}`);
        }
      }

      const updatedCount = logLines.length;
      if (updatedCount > 0) setCrewSigners([...updateList, ...toAdd]);
      return { updatedCount, logLines };
    }

    // ── MODE 2: Natural language — stage suggestions for human approval ──────
    const matchName = (crew: (typeof crewSigners)[0]) =>
      crew.name.toLowerCase().split(/\s+/).some(p => p.length > 2 && lower.includes(p));

    const flightRx = /\b([A-Z]{2}\d{3,4})\b/gi;
    const timeRx   = /(?:arrives?|etd?|departs?|at|time)[:\s]+(\d{1,2}:\d{2})/i;
    const timeRx2  = /\b(\d{1,2}:\d{2})\b/;

    const pendingSuggestions: AiSuggestion[] = [];

    crewSigners.forEach(crew => {
      if (!matchName(crew)) return;

      // flight number
      const flights = [...text.matchAll(new RegExp(flightRx.source, "gi"))].map(m => m[1].toUpperCase());
      if (flights.length > 0 && flights[0] !== crew.flight) {
        pendingSuggestions.push({ crewId: crew.id, field: "flight", label: `Flight → ${flights[0]}`, newVal: flights[0], oldVal: crew.flight || "" });
      }

      // ETA / time
      const timeMatch = timeRx.exec(text) ?? timeRx2.exec(text);
      if (timeMatch) {
        const newTime = timeMatch[timeMatch.length - 1];
        if (newTime !== crew.flightEta) {
          pendingSuggestions.push({ crewId: crew.id, field: "flightEta", label: `ETA → ${newTime}`, newVal: newTime, oldVal: crew.flightEta || "" });
        }
      }

      // delayed
      if (/\bdelay(ed)?\b/i.test(text) && !crew.flightDelayed) {
        pendingSuggestions.push({ crewId: crew.id, field: "flightDelayed", label: "Mark as Delayed", newVal: true, oldVal: false });
      } else if (/\b(not delayed|on.?time|recovered|rescheduled)\b/i.test(text) && crew.flightDelayed) {
        pendingSuggestions.push({ crewId: crew.id, field: "flightDelayed", label: "Remove Delay", newVal: false, oldVal: true });
      }

      // e-visa
      if (/e.?visa.*(approved|confirmed|ok)\b/i.test(text) && crew.eVisaStatus !== "approved") {
        pendingSuggestions.push({ crewId: crew.id, field: "eVisaStatus", label: "e-Visa → Approved", newVal: "approved", oldVal: crew.eVisaStatus });
      } else if (/e.?visa.*(pending|applied|submitted)\b/i.test(text) && crew.eVisaStatus !== "pending") {
        pendingSuggestions.push({ crewId: crew.id, field: "eVisaStatus", label: "e-Visa → Pending", newVal: "pending", oldVal: crew.eVisaStatus });
      }

      // visa required
      if (/(no visa|visa not required|visa free)\b/i.test(text) && crew.visaRequired) {
        pendingSuggestions.push({ crewId: crew.id, field: "visaRequired", label: "Visa: Not Required", newVal: false, oldVal: true });
      } else if (/(visa required|needs visa|requires visa)\b/i.test(text) && !crew.visaRequired) {
        pendingSuggestions.push({ crewId: crew.id, field: "visaRequired", label: "Visa: Required", newVal: true, oldVal: false });
      }

      const crewSuggestions = pendingSuggestions.filter(s => s.crewId === crew.id);
      if (crewSuggestions.length > 0) {
        logLines.push(`${crew.name}: ${crewSuggestions.map(s => s.label).join(", ")}`);
      }
    });

    const updatedCount = pendingSuggestions.length;
    if (updatedCount > 0) setAiPendingSuggestions(prev => [...prev, ...pendingSuggestions]);
    return { updatedCount, logLines };
  };

  // ── processAiText: shared AI text processor (used by command palette & paste) ─
  const processAiText = (txt: string) => {
    if (!txt.trim()) return;
    setCrewAiParsing(true);
    setCrewAiText(txt);
    setTimeout(() => {
      const { updatedCount, logLines } = parseAndApplyAIText(txt);
      setCrewAiParsing(false);
      setCrewAiText("");
      setIsCommandPaletteOpen(false);
      if (updatedCount > 0) {
        logLines.forEach(line => {
          const arrowMatch = line.match(/(\S+ → \S+)/);
          addActivityLog(`AI updated: ${line}`, "AI", arrowMatch?.[1]);
        });
        toast({
          title: `✨ AI Suggested ${updatedCount} Change${updatedCount > 1 ? "s" : ""} — Review & Approve`,
          description: logLines.join(" · ").slice(0, 120),
        });
      } else {
        toast({
          title: "No matching crew found",
          description: "AI could not match any crew member name from the text. Try including the crew member's name.",
          variant: "destructive",
        });
      }
    }, 900);
  };

  // ── DnD onDragEnd handler ─────────────────────────────────────────────────
  const handleCrewDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    if (event.over?.id === "hotel-drop-zone") {
      const crew = crewSigners.find(c => c.id === Number(event.active.id));
      if (crew) {
        setDragQuickBook({ crewId: crew.id, crewName: crew.name, crewRank: crew.rank });
        setDragQuickHotelForm({ hotelName: crew.hotelName || "", checkIn: crew.hotelCheckIn || "", checkOut: crew.hotelCheckOut || "" });
      }
    } else {
      // If hotel panel was auto-opened during drag but crew was not dropped on it, close it again
      if (dragAutoOpenedPanel.current) {
        setIsHotelPanelOpen(false);
      }
    }
    dragAutoOpenedPanel.current = false;
  };

  // ── handleAiFileDrop: shared file drop handler ─────────────────────────────
  const handleAiFileDrop = (file: File) => {
    if (file.type.startsWith("image/")) {
      setCrewAiParsing(true);
      const reader2 = new FileReader();
      reader2.onload = async ev => {
        try {
          const dataUrl = ev.target?.result as string;
          const base64 = dataUrl.split(",")[1];
          const mimeType = file.type as "image/png" | "image/jpeg" | "image/gif" | "image/webp";
          const resp = await fetch("/api/ai/extract-crew-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageData: base64, mimeType }),
          });
          if (!resp.ok) throw new Error(await resp.text());
          const { text: extracted } = await resp.json();
          if (!extracted) throw new Error("No text extracted");
          setCrewAiParsing(false);
          toast({ title: `🔍 Extracted from ${file.name}`, description: "Opening AI command palette to review…" });
          setCrewAiText(extracted);
          setIsCommandPaletteOpen(true);
        } catch (err: any) {
          setCrewAiParsing(false);
          toast({ title: "Image extraction failed", description: err.message || "Could not read crew data from image.", variant: "destructive" });
        }
      };
      reader2.readAsDataURL(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ((ev.target?.result as string) || "").trim().slice(0, 5000);
      setCrewAiText(content);
      setIsCommandPaletteOpen(true);
      toast({ title: `📎 ${file.name} loaded`, description: "Review the content in the AI panel, then click Process." });
    };
    reader.onerror = () => {
      toast({ title: "Could not read file", description: "Try copying the text and pasting it directly.", variant: "destructive" });
    };
    reader.readAsText(file);
  };

  // ── Global drag-enter overlay ──────────────────────────────────────────────
  useEffect(() => {
    let dragCounter = 0;
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (dragCounter === 1) setIsGlobalDragging(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) { dragCounter = 0; setIsGlobalDragging(false); }
    };
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsGlobalDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) handleAiFileDrop(file);
    };
    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);
    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("drop", handleDrop);
    };
  }, []);

  // ── Global paste listener (Ctrl+V / Cmd+V outside inputs) ─────────────────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      const text = e.clipboardData?.getData("text/plain") || "";
      if (!text.trim()) return;
      e.preventDefault();
      setCrewAiText(text.trim());
      setIsCommandPaletteOpen(true);
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // ── Cmd+K / Ctrl+K → open Command Palette; ESC → close ───────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        setIsCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [showApptForm, setShowApptForm] = useState(false);
  const [apptForm, setApptForm] = useState({ appointmentType: "pilot", scheduledAt: "", notes: "" });
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [signDocId, setSignDocId] = useState<number | null>(null);
  const [signatureText, setSignatureText] = useState("");
  const [serviceForm, setServiceForm] = useState({
    portId: 0, portName: "", vesselName: "", serviceType: "other",
    description: "", quantity: "", unit: "", preferredDate: "",
  });

  const { data: voyage, isLoading } = useQuery<any>({
    queryKey: ["/api/voyages", voyageId],
    queryFn: async () => {
      const res = await fetch(`/api/voyages/${voyageId}`);
      return res.json();
    },
  });

  const features = getVoyageFeatures(voyage?.purposeOfCall);

  // ── Crew Logistics: Load from DB ─────────────────────────────────────────
  const { data: crewFromDb } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "crew-logistics"],
    queryFn: async () => {
      const res = await fetch(`/api/voyages/${voyageId}/crew-logistics`);
      return res.json();
    },
    enabled: !!voyageId,
  });

  const { data: crewDocConfig } = useQuery<any>({
    queryKey: ["/api/crew-doc-config"],
  });

  const { data: vesselData } = useQuery<any>({
    queryKey: ["/api/vessels", "detail", voyage?.vesselId],
    queryFn: async () => {
      const res = await fetch(`/api/vessels/${voyage?.vesselId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!voyage?.vesselId,
  });

  useEffect(() => {
    if (!crewFromDb || crewHydrated.current) return;
    crewHydrated.current = true;
    setCrewSigners(crewFromDb.map((row: any) => ({
      id: row.id,
      name: row.name,
      rank: row.rank,
      side: row.side as "on" | "off",
      nationality: row.nationality ?? "",
      passportNo: row.passportNo ?? "",
      dob: row.dob ?? "",
      seamanBookNo: row.seamanBookNo ?? "",
      birthPlace: row.birthPlace ?? "",
      flight: row.flight ?? "",
      flightEta: row.flightEta ?? "",
      flightDelayed: row.flightDelayed ?? false,
      visaRequired: row.visaRequired ?? false,
      eVisaStatus: (row.eVisaStatus ?? "n/a") as "pending" | "approved" | "n/a",
      okToBoard: (row.okToBoard ?? "pending") as "pending" | "sent" | "confirmed",
      arrivalStatus: (row.arrivalStatus ?? "pending") as "pending" | "arrived" | "departed",
      timeline: (row.timeline as any[]) ?? [],
      docs: row.docs ?? { passport: null, seamansBook: null, medicalCert: null },
      requiresHotel: row.requiresHotel ?? false,
      hotelName: row.hotelName ?? "",
      hotelCheckIn: row.hotelCheckIn ?? "",
      hotelCheckOut: row.hotelCheckOut ?? "",
      hotelStatus: (row.hotelStatus ?? "none") as "none" | "reserved" | "checked-in" | "checked-out",
      hotelPickupTime: row.hotelPickupTime ?? "",
    })));
  }, [crewFromDb]);

  // ── Crew Logistics: Debounced Auto-Save ──────────────────────────────────
  const saveCrewMutation = useMutation({
    mutationFn: async (crew: CrewSigner[]) => {
      return apiRequest("PUT", `/api/voyages/${voyageId}/crew-logistics`, crew.map((c, i) => ({ ...c, sortOrder: i })));
    },
    onMutate: () => setCrewSaveStatus("saving"),
    onSuccess: () => {
      setCrewSaveStatus("saved");
      setTimeout(() => setCrewSaveStatus("idle"), 2500);
    },
    onError: () => setCrewSaveStatus("error"),
  });

  useEffect(() => {
    if (!crewHydrated.current) return;
    if (crewSaveTimer.current) clearTimeout(crewSaveTimer.current);
    crewSaveTimer.current = setTimeout(() => {
      saveCrewMutation.mutate(crewSigners);
    }, 1000);
    return () => { if (crewSaveTimer.current) clearTimeout(crewSaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewSigners]);

  // ── Cargo Update Mutation ─────────────────────────────────────────────────
  const updateCargoMutation = useMutation({
    mutationFn: (data: { cargoType: string; cargoQuantity: string }) =>
      apiRequest("PATCH", `/api/voyages/${voyageId}`, {
        cargoType: data.cargoType.trim() || null,
        cargoQuantity: data.cargoQuantity ? parseFloat(data.cargoQuantity) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] });
      queryClient.invalidateQueries({ queryKey: ["/api/voyages"] });
      setEditCargoOpen(false);
      toast({ title: "Cargo info updated" });
    },
    onError: () => toast({ title: "Failed to update cargo info", variant: "destructive" }),
  });

  const updateOriginPortMutation = useMutation({
    mutationFn: (data: { originPortId: number; originPortName: string }) =>
      apiRequest("PATCH", `/api/voyages/${voyageId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] });
      queryClient.invalidateQueries({ queryKey: ["/api/voyages"] });
      toast({ title: "Kalkış limanı güncellendi" });
    },
    onError: () => toast({ title: "Kalkış limanı güncellenemedi", variant: "destructive" }),
  });

  // ── Auto-set requiresHotel on crewSigners when voyage ETA/ETD loaded ───────
  useEffect(() => {
    if (!voyage) return;
    const vesselEtaTime = voyage.eta ? new Date(voyage.eta).toTimeString().substring(0, 5) : "";
    const vesselEtdTime = voyage.etd ? new Date(voyage.etd).toTimeString().substring(0, 5) : "";
    setCrewSigners(prev => prev.map(crew => {
      if (crew.requiresHotel) return crew;
      const fMins = timeToMins(crew.flightEta);
      let shouldHaveHotel = false;
      if (crew.side === "on" && vesselEtaTime) {
        const etaMins = timeToMins(vesselEtaTime);
        if (fMins >= 0 && etaMins >= 0 && etaMins - fMins > 360) shouldHaveHotel = true;
      }
      if (crew.side === "off" && vesselEtdTime) {
        const etdMins = timeToMins(vesselEtdTime);
        if (fMins >= 0 && etdMins >= 0) {
          const waitMins = fMins >= etdMins ? fMins - etdMins : (1440 - etdMins) + fMins;
          if (waitMins > 720) shouldHaveHotel = true;
        }
      }
      return shouldHaveHotel ? { ...crew, requiresHotel: true } : crew;
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voyage?.eta, voyage?.etd]);

  // ── Auto-set requiresHotel in slide-over form when hotel rule triggers ─────
  useEffect(() => {
    if (crewSlideForm.requiresHotel || !crewSlideForm.flightEta || !voyage) return;
    const vesselEtaTime = voyage.eta ? new Date(voyage.eta).toTimeString().substring(0, 5) : "";
    const vesselEtdTime = voyage.etd ? new Date(voyage.etd).toTimeString().substring(0, 5) : "";
    const fMins = timeToMins(crewSlideForm.flightEta);
    if (crewSlideForm.side === "on" && vesselEtaTime) {
      const etaMins = timeToMins(vesselEtaTime);
      if (fMins >= 0 && etaMins >= 0 && etaMins - fMins > 360)
        setCrewSlideForm(f => ({ ...f, requiresHotel: true }));
    }
    if (crewSlideForm.side === "off" && vesselEtdTime) {
      const etdMins = timeToMins(vesselEtdTime);
      if (fMins >= 0 && etdMins >= 0) {
        const waitMins = fMins >= etdMins ? fMins - etdMins : (1440 - etdMins) + fMins;
        if (waitMins > 720) setCrewSlideForm(f => ({ ...f, requiresHotel: true }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewSlideForm.flightEta, crewSlideForm.side, crewSlideForm.requiresHotel]);

  const { data: docs = [], isLoading: docsLoading } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/voyages/${voyageId}/documents`);
      return res.json();
    },
    enabled: !!voyageId,
  });

  const { data: reviewData } = useQuery<{ reviews: any[]; myReview: any }>({
    queryKey: ["/api/voyages", voyageId, "reviews"],
    queryFn: async () => {
      const res = await fetch(`/api/voyages/${voyageId}/reviews`);
      return res.json();
    },
    enabled: !!voyageId,
  });

  const { data: portData } = useQuery<any>({
    queryKey: ["/api/ports", voyage?.portId],
    queryFn: async () => {
      const res = await fetch(`/api/ports/${voyage.portId}`);
      return res.json();
    },
    enabled: !!voyage?.portId,
  });

  const { data: chatMessages = [], refetch: refetchChat } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "chat"],
    queryFn: async () => {
      const res = await fetch(`/api/voyages/${voyageId}/chat`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!voyageId,
    refetchInterval: 10000,
  });

  const { data: appointments = [] } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "appointments"],
    queryFn: async () => {
      const res = await fetch(`/api/voyages/${voyageId}/appointments`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!voyageId,
  });

  const { data: voyageNors = [] } = useQuery<any[]>({
    queryKey: ["/api/nor", "voyage", voyageId],
    queryFn: async () => {
      const res = await fetch(`/api/nor?voyageId=${voyageId}`);
      return res.ok ? res.json() : [];
    },
    enabled: !!voyageId,
  });
  const activeNor = (voyageNors as any[])[0];

  const { data: voyagePortCalls = [] } = useQuery<any[]>({
    queryKey: ["/api/port-calls", "voyage", voyageId],
    queryFn: async () => {
      const res = await fetch(`/api/port-calls?voyageId=${voyageId}`);
      return res.ok ? res.json() : [];
    },
    enabled: !!voyageId,
  });
  const activePortCall = (voyagePortCalls as any[])[0] ?? null;

  const advanceStepMutation = useMutation({
    mutationFn: async (portCallId: number) => {
      const res = await apiRequest("POST", `/api/port-calls/${portCallId}/advance-step`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/port-calls", "voyage", voyageId] });
    },
    onError: () => toast({ title: "Hata", description: "Adım onaylanamadı.", variant: "destructive" }),
  });

  const { data: workflowData, refetch: refetchWorkflow } = useQuery<any>({
    queryKey: ["/api/v1/voyages", voyageId, "workflow"],
    queryFn: async () => {
      const res = await fetch(`/api/v1/voyages/${voyageId}/workflow`, { credentials: "include" });
      if (!res.ok) return { steps: {} };
      return res.json();
    },
    enabled: !!voyageId,
    staleTime: 30_000,
  });

  const { data: voyageSofs = [] } = useQuery<any[]>({
    queryKey: ["/api/sof", "voyage", voyageId],
    queryFn: async () => {
      const res = await fetch(`/api/sof?voyageId=${voyageId}`);
      return res.ok ? res.json() : [];
    },
    enabled: !!voyageId,
  });
  const activeSof = (voyageSofs as any[])[0];

  const { data: docTemplates = [] } = useQuery<any[]>({
    queryKey: ["/api/document-templates"],
  });

  const { data: voyageInvoices = [] } = useQuery<any[]>({
    queryKey: ["/api/invoices", "voyage", voyageId],
    queryFn: async () => {
      const res = await fetch(`/api/invoices?voyageId=${voyageId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.invoices ?? []);
    },
    enabled: !!voyageId,
  });

  const { data: voyageProformas = [] } = useQuery<any[]>({
    queryKey: ["/api/proformas", "voyage", voyageId],
    queryFn: async () => {
      const res = await fetch(`/api/proformas?voyageId=${voyageId}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!voyageId,
  });

  const { data: voyageFdas = [] } = useQuery<any[]>({
    queryKey: ["/api/fda", "voyage", voyageId],
    queryFn: async () => {
      const res = await fetch(`/api/fda?voyageId=${voyageId}`, { credentials: "include" });
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    enabled: !!voyageId,
  });

  const { data: voyageLaytimeSheets = [] } = useQuery<any[]>({
    queryKey: ["/api/laytime-sheets", "voyage", voyageId],
    queryFn: async () => {
      const res = await fetch(`/api/laytime-sheets?voyageId=${voyageId}`, { credentials: "include" });
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    enabled: !!voyageId,
  });

  const { data: voyageDaAdvances = [] } = useQuery<any[]>({
    queryKey: ["/api/da-advances", "voyage", voyageId],
    queryFn: async () => {
      const res = await fetch(`/api/da-advances?voyageId=${voyageId}`, { credentials: "include" });
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    enabled: !!voyageId,
  });

  const { data: voyagePortExpenses = [] } = useQuery<any[]>({
    queryKey: ["/api/port-expenses", "voyage", voyageId],
    queryFn: async () => {
      const res = await fetch(`/api/port-expenses?voyageId=${voyageId}`, { credentials: "include" });
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    enabled: !!voyageId,
  });

  const { data: voyageCommissions = [], refetch: refetchCommissions } = useQuery<any[]>({
    queryKey: ["/api/commissions", "voyage", voyageId],
    queryFn: async () => {
      const res = await fetch(`/api/commissions?voyageId=${voyageId}`, { credentials: "include" });
      if (!res.ok) return [];
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    enabled: !!voyageId && activeTab === "financials",
  });

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const userId = (user as any)?.id || (user as any)?.claims?.sub;
  const isOwner = voyage?.userId === userId;
  const isAgent = voyage?.agentUserId === userId;

  const revieweeUserId = isOwner ? voyage?.agentUserId : (isAgent ? voyage?.userId : null);
  const canReview = voyage?.status === "completed" && (isOwner || isAgent) && revieweeUserId && !reviewData?.myReview;

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/voyages/${voyageId}/status`, { status });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] }); toast({ title: "Status updated" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const addTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/checklist`, { 
        title: newTask, 
        assignedTo: taskAssignedTo,
        dueDate: taskDueDate || null
      });
      return res.json();
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] }); 
      setNewTask(""); 
      setTaskDueDate("");
      setTaskAssignedTo("both");
    },
    onError: () => toast({ title: "Could not add task", variant: "destructive" }),
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const res = await apiRequest("PATCH", `/api/voyages/${voyageId}/checklist/${itemId}`, {});
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest("DELETE", `/api/voyages/${voyageId}/checklist/${itemId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] }),
  });

  const createApptMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/voyages/${voyageId}/appointments`, {
        ...apptForm,
        scheduledAt: apptForm.scheduledAt || null,
        notes: apptForm.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "appointments"] });
      setApptForm({ appointmentType: "pilot", scheduledAt: "", notes: "" });
      setShowApptForm(false);
      toast({ title: "Appointment added" });
    },
  });

  const updateApptMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PATCH", `/api/voyages/${voyageId}/appointments/${id}`, { status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "appointments"] }),
  });

  const deleteApptMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/voyages/${voyageId}/appointments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "appointments"] });
      toast({ title: "Appointment deleted" });
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        portId: serviceForm.portId || voyage?.portId,
        vesselName: serviceForm.vesselName || voyage?.vesselName || "Unspecified",
        serviceType: serviceForm.serviceType,
        description: serviceForm.description,
        voyageId: voyageId,
      };
      if (serviceForm.quantity) payload.quantity = parseFloat(serviceForm.quantity);
      if (serviceForm.unit) payload.unit = serviceForm.unit;
      if (serviceForm.preferredDate) payload.preferredDate = serviceForm.preferredDate;
      const res = await apiRequest("POST", "/api/service-requests", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({ title: "Service request created" });
      setShowServiceDialog(false);
      setServiceForm({ portId: 0, portName: "", vesselName: "", serviceType: "other", description: "", quantity: "", unit: "", preferredDate: "" });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const uploadDocMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: docForm.name,
        docType: docForm.docType,
        notes: docForm.notes,
      };
      if (docForm.fileUrl) {
        payload.fileUrl = docForm.fileUrl;
        payload.fileName = docForm.fileName;
        payload.fileSize = docForm.fileSize;
      } else {
        payload.fileBase64 = docForm.fileBase64;
      }
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/documents`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "documents"] });
      toast({ title: "Document uploaded" });
      setShowDocDialog(false);
      setDocForm({ name: "", docType: "other", notes: "", fileBase64: "", fileUrl: "", fileName: "", fileSize: 0 });
    },
    onError: () => toast({ title: "Upload error", variant: "destructive" }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/voyages/${voyageId}/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "documents"] });
      toast({ title: "Document deleted" });
    },
    onError: () => toast({ title: "Delete error", variant: "destructive" }),
  });

  const fromTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/documents/from-template`, { templateId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "documents"] });
      setShowTemplateDialog(false);
      toast({ title: "Created from template", description: "Document was auto-filled" });
    },
    onError: () => toast({ title: "Error", description: "Template could not be applied", variant: "destructive" }),
  });

  const signDocMutation = useMutation({
    mutationFn: async ({ docId, sigText }: { docId: number; sigText: string }) => {
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/documents/${docId}/sign`, { signatureText: sigText });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "documents"] });
      setShowSignDialog(false);
      setSignatureText("");
      setSignDocId(null);
      toast({ title: "Document signed" });
    },
    onError: () => toast({ title: "Signing error", variant: "destructive" }),
  });

  const createReviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/reviews`, {
        revieweeUserId,
        rating: reviewForm.rating,
        comment: reviewForm.comment,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "reviews"] });
      toast({ title: "Review saved" });
      setShowReviewDialog(false);
      setReviewForm({ rating: 0, comment: "" });
    },
    onError: () => toast({ title: "Review error", variant: "destructive" }),
  });

  const sendChatMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/chat`, { content: chatMessage });
      return res.json();
    },
    onSuccess: () => {
      setChatMessage("");
      refetchChat();
    },
    onError: () => toast({ title: "Message could not be sent", variant: "destructive" }),
  });

  function handleChatKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey && chatMessage.trim()) {
      e.preventDefault();
      sendChatMutation.mutate();
    }
  }

  async function processDroppedFile(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 20 MB", variant: "destructive" });
      return;
    }
    setDocUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/files/upload?folder=documents", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url, fileName: uploadedName, fileSize } = await res.json();
      setDocForm(f => ({
        ...f,
        fileUrl: url,
        fileBase64: "",
        fileName: uploadedName,
        fileSize,
        name: f.name || file.name.replace(/\.[^/.]+$/, ""),
      }));
    } catch {
      toast({ title: "Upload error", description: "Failed to upload file", variant: "destructive" });
    } finally {
      setDocUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processDroppedFile(file);
  }

  function handlePanelDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsPanelDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processDroppedFile(file);
    setShowDocDialog(true);
  }

  function downloadDoc(doc: any) {
    if (doc.fileBase64) {
      const b64 = doc.fileBase64.includes(",") ? doc.fileBase64.split(",")[1] : doc.fileBase64;
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName || doc.name;
      a.click();
      URL.revokeObjectURL(url);
    } else if (doc.fileUrl) {
      const a = document.createElement("a");
      a.href = doc.fileUrl;
      a.download = doc.fileName || doc.name;
      a.click();
    }
  }

  async function handleDownloadAllZip() {
    if (!Array.isArray(docs) || docs.length === 0) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    await Promise.all(docs.map(async (doc: any) => {
      const fileName = doc.fileName || doc.name || `document-${doc.id}`;
      if (doc.fileBase64) {
        const b64 = doc.fileBase64.includes(",") ? doc.fileBase64.split(",")[1] : doc.fileBase64;
        zip.file(fileName, b64, { base64: true });
      } else if (doc.fileUrl) {
        try {
          const res = await fetch(doc.fileUrl, { credentials: "include" });
          const blob = await res.blob();
          zip.file(fileName, blob);
        } catch {
          // skip files that fail to fetch
        }
      }
    }));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voyage-${voyageId}-documents.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function previewDoc(doc: any) {
    if (doc.fileBase64) {
      const b64 = doc.fileBase64.includes(",") ? doc.fileBase64.split(",")[1] : doc.fileBase64;
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } else if (doc.fileUrl) {
      window.open(doc.fileUrl, "_blank");
    }
  }

  const { data: activitiesData } = useQuery<{ activities: any[], total: number }>({
    queryKey: ["/api/voyages", voyageId, "activities"],
    enabled: activeTab === "documents" || activeTab === "team",
  });
  const activities = activitiesData?.activities || [];

  const { data: cargoLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "cargo-logs"],
    queryFn: () => fetch(`/api/voyages/${voyageId}/cargo-logs`, { credentials: "include" }).then(r => r.json()),
    enabled: ["overview","sof","appointments","cargo","crew-ops"].includes(activeTab),
  });

  const { data: receivers = [] } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "cargo-receivers"],
    queryFn: () => fetch(`/api/voyages/${voyageId}/cargo-receivers`, { credentials: "include" }).then(r => r.json()),
    enabled: ["overview","sof","appointments","cargo","crew-ops"].includes(activeTab),
  });

  const { data: cargoParcelsData = [] } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "cargo-parcels"],
    queryFn: () => fetch(`/api/voyages/${voyageId}/cargo-parcels`, { credentials: "include" }).then(r => r.json()),
    enabled: activeTab === "cargo",
  });

  const { data: stowagePlanData } = useQuery<any>({
    queryKey: ["/api/voyages", voyageId, "stowage-plan"],
    queryFn: () => fetch(`/api/voyages/${voyageId}/stowage-plan`, { credentials: "include" }).then(r => r.json()),
    enabled: activeTab === "cargo",
  });

  const addParcelMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/voyages/${voyageId}/cargo-parcels`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "cargo-parcels"] });
      setShowAddParcelDialog(false);
      setParcelForm({ receiverName: "", cargoType: "", cargoDescription: "", targetQuantity: 0, handledQuantity: 0, unit: "MT", holdNumbers: "", blNumber: "", notes: "" });
    },
  });

  const updateParcelMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/voyages/cargo-parcels/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "cargo-parcels"] });
      setEditingParcel(null);
    },
  });

  const deleteParcelMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/voyages/cargo-parcels/${id}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "cargo-parcels"] }),
  });

  const updateStowagePlanMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/voyages/${voyageId}/stowage-plan`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "stowage-plan"] }),
  });

  const { data: voyageContactsList = [] } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "contacts"],
    queryFn: () => fetch(`/api/voyages/${voyageId}/contacts`, { credentials: "include" }).then(r => r.json()),
    enabled: activeTab === "team" || showCargoReportDialog,
  });

  const addCargoLogMutation = useMutation({
    mutationFn: () => {
      const fromIso = logForm.fromTime ? new Date(logForm.fromTime).toISOString() : undefined;
      const toIso = logForm.toTime ? new Date(logForm.toTime).toISOString() : undefined;
      if (logForm.logType === "operation") {
        const entries = Object.entries(logForm.receiverEntries)
          .filter(([, v]) => v.amount && parseFloat(v.amount) > 0)
          .map(([rId, v]) => ({
            receiverId: Number(rId),
            amountHandled: parseFloat(v.amount),
            truckCount: v.trucks ? parseInt(v.trucks) : undefined,
          }));
        return apiRequest("POST", `/api/voyages/${voyageId}/cargo-logs`, {
          fromTime: fromIso, toTime: toIso, logType: "operation", entries,
        });
      } else {
        const fullReason = logForm.delayReason + (logForm.delayNotes ? `: ${logForm.delayNotes}` : "");
        return apiRequest("POST", `/api/voyages/${voyageId}/cargo-logs`, {
          fromTime: fromIso, toTime: toIso, logType: "delay",
          amountHandled: 0, remarks: fullReason,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "cargo-logs"] });
      setShowAddLogDialog(false);
      setLogForm({ fromTime: "", toTime: "", logType: "operation", remarks: "", delayReason: "", delayNotes: "", receiverEntries: {} });
      toast({ title: "Log added" });
    },
  });

  const deleteCargoLogMutation = useMutation({
    mutationFn: (logId: number) => apiRequest("DELETE", `/api/voyages/${voyageId}/cargo-logs/${logId}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "cargo-logs"] }),
  });

  const deleteBatchMutation = useMutation({
    mutationFn: (batchId: string) => apiRequest("DELETE", `/api/voyages/${voyageId}/cargo-logs/batch/${batchId}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "cargo-logs"] }),
  });

  const sendCargoReportMutation = useMutation({
    mutationFn: (toEmails: string[]) => apiRequest("POST", `/api/voyages/${voyageId}/send-cargo-report`, { toEmails }),
    onSuccess: (_data, toEmails) => {
      setShowCargoReportDialog(false);
      setReportSelectedEmails([]);
      setReportManualEmail("");
      toast({ title: "Report sent", description: `Cargo report sent to ${toEmails.length} recipient(s)` });
    },
    onError: () => toast({ title: "Failed to send report", variant: "destructive" }),
  });

  const addContactMutation = useMutation({
    mutationFn: (data: { email: string; name?: string; role?: string }) =>
      apiRequest("POST", `/api/voyages/${voyageId}/contacts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "contacts"] });
      setNewContactEmail(""); setNewContactName(""); setNewContactRole("other");
      toast({ title: "Contact added" });
    },
    onError: () => toast({ title: "Failed to add contact", variant: "destructive" }),
  });

  const bulkImportContactsMutation = useMutation({
    mutationFn: (emails: string) => apiRequest("POST", `/api/voyages/${voyageId}/contacts/bulk`, { emails }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "contacts"] });
      setContactBulkText("");
      toast({ title: `${data.inserted} contact(s) added`, description: data.skipped > 0 ? `${data.skipped} duplicate(s) skipped` : undefined });
    },
    onError: () => toast({ title: "Bulk import failed", variant: "destructive" }),
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ contactId, updates }: { contactId: number; updates: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/voyages/${voyageId}/contacts/${contactId}`, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "contacts"] }),
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: number) => apiRequest("DELETE", `/api/voyages/${voyageId}/contacts/${contactId}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "contacts"] }),
  });

  const addReceiverMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/voyages/${voyageId}/cargo-receivers`, {
      name: receiverForm.name,
      allocatedMt: Number(receiverForm.allocatedMt),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "cargo-receivers"] });
      setShowAddReceiverDialog(false);
      setReceiverForm({ name: "", allocatedMt: 0 });
      toast({ title: "Receiver added" });
    },
  });

  const deleteReceiverMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/voyages/${voyageId}/cargo-receivers/${id}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "cargo-receivers"] }),
  });

  const { data: collaboratorsData, refetch: refetchCollaborators } = useQuery<{ invitations: any[], participants: any[] }>({
    queryKey: ["/api/voyages", voyageId, "invitations"],
    queryFn: () => fetch(`/api/voyages/${voyageId}/invitations`, { credentials: "include" }).then(r => r.json()),
    enabled: !!voyageId,
  });
  const participants = collaboratorsData?.participants ?? [];
  const pendingInvites = collaboratorsData?.invitations?.filter((i: any) => i.status === "pending") ?? [];

  const sendInviteMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/voyages/${voyageId}/invite`, data),
    onSuccess: () => {
      toast({ title: "Invitation sent" });
      refetchCollaborators();
      setShowInviteDialog(false);
      setInviteEmail(""); setInviteRole("observer"); setInviteServiceType(""); setInviteMessage("");
    },
    onError: () => toast({ title: "Failed to send invitation", variant: "destructive" }),
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (inviteId: number) => apiRequest("DELETE", `/api/voyages/${voyageId}/invitations/${inviteId}`, {}),
    onSuccess: () => { toast({ title: "Invitation cancelled" }); refetchCollaborators(); },
  });

  const resendInviteMutation = useMutation({
    mutationFn: (inviteId: number) => apiRequest("POST", `/api/voyages/${voyageId}/invitations/${inviteId}/resend`, {}),
    onSuccess: () => { toast({ title: "Invitation resent" }); refetchCollaborators(); },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: (participantId: number) => apiRequest("DELETE", `/api/voyages/${voyageId}/participants/${participantId}`, {}),
    onSuccess: () => { toast({ title: "Participant removed" }); refetchCollaborators(); },
  });

  const sendBulkInviteMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/voyages/${voyageId}/invite-bulk`, data),
    onSuccess: (res: any) => {
      res.json().then((d: any) => toast({ title: `${d.sent} invitation${d.sent !== 1 ? "s" : ""} sent` }));
      refetchCollaborators();
      setShowInviteDialog(false);
      setBulkEmails("");
    },
    onError: () => toast({ title: "Bulk invite failed", variant: "destructive" }),
  });

  const { data: directoryResults = [] } = useQuery<any[]>({
    queryKey: ["/api/directory", directorySearch],
    queryFn: () => fetch(`/api/directory?search=${encodeURIComponent(directorySearch)}&limit=8`, { credentials: "include" }).then(r => r.json()),
    enabled: directorySearch.length >= 2,
  });

  const addActivityMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/voyages/${voyageId}/activities`, { title: noteTitle, description: noteDesc }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "activities"] });
      setShowNoteDialog(false);
      setNoteTitle(""); setNoteDesc("");
    }
  });

  function formatTimeAgo(dt: string | Date) {
    const d = new Date(dt);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    if (hrs < 48) return "Yesterday";
    const dd2 = String(d.getDate()).padStart(2, "0");
    const mm2 = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd2}.${mm2}`;
  }

  function formatActivityTime(dt: string | Date): string {
    const d = new Date(dt);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const HH = String(d.getHours()).padStart(2, "0");
    const MM = String(d.getMinutes()).padStart(2, "0");
    const time = `${HH}:${MM}`;
    if (isToday)     return `Today, ${time}`;
    if (isYesterday) return `Yesterday, ${time}`;
    const dd2 = String(d.getDate()).padStart(2, "0");
    const mm2 = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd2}.${mm2}., ${time}`;
  }

  function getActivityStyle(type: string): { bg: string; text: string; emoji: string; isSystem: boolean } {
    const map: Record<string, { bg: string; text: string; emoji: string }> = {
      voyage_created:         { bg: "bg-sky-500/20",     text: "text-sky-400",     emoji: "🗺️" },
      status_changed:         { bg: "bg-amber-500/20",   text: "text-amber-400",   emoji: "🔄" },
      eta_updated:            { bg: "bg-blue-500/20",    text: "text-blue-400",    emoji: "🕐" },
      document_uploaded:      { bg: "bg-purple-500/20",  text: "text-purple-400",  emoji: "📄" },
      document_signed:        { bg: "bg-green-500/20",   text: "text-green-400",   emoji: "✍️" },
      checklist_added:        { bg: "bg-slate-500/20",   text: "text-slate-400",   emoji: "☐" },
      checklist_completed:    { bg: "bg-green-500/20",   text: "text-green-400",   emoji: "✅" },
      chat_message:           { bg: "bg-slate-500/20",   text: "text-slate-400",   emoji: "💬" },
      sof_created:            { bg: "bg-cyan-500/20",    text: "text-cyan-400",    emoji: "📝" },
      sof_finalized:          { bg: "bg-cyan-500/20",    text: "text-cyan-400",    emoji: "📝" },
      pda_created:            { bg: "bg-sky-500/20",     text: "text-sky-400",     emoji: "📋" },
      pda_approved:           { bg: "bg-green-500/20",   text: "text-green-400",   emoji: "📋" },
      fda_created:            { bg: "bg-amber-500/20",   text: "text-amber-400",   emoji: "🧾" },
      fda_approved:           { bg: "bg-green-500/20",   text: "text-green-400",   emoji: "🧾" },
      invoice_created:        { bg: "bg-emerald-500/20", text: "text-emerald-400", emoji: "💳" },
      invoice_paid:           { bg: "bg-green-500/20",   text: "text-green-400",   emoji: "💰" },
      nomination_sent:        { bg: "bg-sky-500/20",     text: "text-sky-400",     emoji: "🤝" },
      review_submitted:       { bg: "bg-yellow-500/20",  text: "text-yellow-400",  emoji: "⭐" },
      custom_note:            { bg: "bg-violet-500/20",  text: "text-violet-400",  emoji: "📌" },
      nor_tendered:           { bg: "bg-amber-500/20",   text: "text-amber-400",   emoji: "📋" },
      nor_accepted:           { bg: "bg-green-500/20",   text: "text-green-400",   emoji: "✅" },
    };
    const base = map[type] || { bg: "bg-slate-500/20", text: "text-slate-400", emoji: "📌" };
    return { ...base, isSystem: type !== "custom_note" };
  }

  if (isLoading) {
    return (
      <div className="px-3 py-5 space-y-4 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!voyage) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Voyage not found.</p>
        <Link href="/voyages"><Button variant="outline" className="mt-4">Go Back</Button></Link>
      </div>
    );
  }

  const s = STATUS_CONFIG[voyage.status] || STATUS_CONFIG.planned;
  const StatusIcon = s.icon;
  const checklist: any[] = voyage.checklists || [];
  const completed = checklist.filter(c => c.isCompleted).length;
  const serviceReqs: any[] = voyage.serviceRequests || [];
  const transitions = STATUS_TRANSITIONS[voyage.status] || [];
  const reviews: any[] = reviewData?.reviews || [];

  return (
    <div className="px-3 sm:px-4 py-5 space-y-6 max-w-6xl mx-auto">
      <PageMeta title={`Voyage — ${voyage.vesselName || "Detail"} | VesselPDA`} description="Voyage detail and operation file" />

      {/* ── Global AI Drag Overlay ─────────────────────────────────────────── */}
      <AnimatePresence>
        {isGlobalDragging && (
          <motion.div
            key="global-drag-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[100] backdrop-blur-md bg-slate-900/80 flex flex-col items-center justify-center pointer-events-none"
            data-testid="global-drag-overlay"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="relative">
                <div className="w-28 h-28 rounded-3xl bg-blue-600/20 border-2 border-blue-500/60 flex items-center justify-center shadow-[0_0_60px_rgba(59,130,246,0.45)]">
                  <Sparkles className="w-14 h-14 text-blue-400" />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.18, 1] }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-3xl border-2 border-blue-400/40 pointer-events-none"
                />
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white mb-2">Drop files anywhere to process with AI</p>
                <p className="text-sm text-slate-400">PDF, .eml, Images supported · Claude AI powered</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Command Palette ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {isCommandPaletteOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="command-palette-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
              onClick={() => setIsCommandPaletteOpen(false)}
            />
            {/* Panel */}
            <motion.div
              key="command-palette-panel"
              initial={{ opacity: 0, y: -24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 340, damping: 26 }}
              className="fixed top-[18%] left-1/2 -translate-x-1/2 z-[91] w-full max-w-2xl px-4"
              data-testid="command-palette-modal"
            >
              <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center flex-shrink-0">
                    {crewAiParsing
                      ? <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                      : <Sparkles className="w-4 h-4 text-indigo-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-100">✨ AI Crew Update</p>
                    <p className="text-[10px] text-slate-500">Paste WhatsApp messages, flight updates, or drop a file</p>
                  </div>
                  <button
                    onClick={() => setIsCommandPaletteOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
                    data-testid="button-close-command-palette"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Textarea */}
                <div className="px-5 pt-4 pb-3">
                  <textarea
                    autoFocus
                    className="w-full bg-slate-800/60 border border-slate-700 rounded-xl outline-none resize-none text-sm text-slate-200 placeholder:text-slate-600 px-4 py-3 leading-relaxed focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                    style={{ minHeight: "120px" }}
                    placeholder={"Paste WhatsApp message, type a crew update, or describe what changed...\n\nExample: \"Ahmet's flight changed to TK2321, arrives 17:00\"\nExample: \"Captain confirmed hotel check-in at Hilton\""}
                    value={crewAiText}
                    onChange={e => setCrewAiText(e.target.value)}
                    disabled={crewAiParsing}
                    data-testid="textarea-command-palette-input"
                  />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 pb-5 pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[".eml", "PDF", "Text", "WhatsApp", "Image"].map(fmt => (
                      <span key={fmt} className="text-[10px] text-slate-600 bg-slate-800/70 border border-slate-700/60 rounded px-1.5 py-0.5">{fmt}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-600 bg-slate-800 border border-slate-700/40 rounded px-1.5 py-0.5 font-mono">ESC to close</span>
                    <button
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        crewAiText.trim() && !crewAiParsing
                          ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_18px_rgba(99,102,241,0.45)] hover:shadow-[0_0_24px_rgba(99,102,241,0.6)]"
                          : "bg-slate-700/50 text-slate-600 cursor-not-allowed border border-slate-600/40"
                      }`}
                      disabled={!crewAiText.trim() || crewAiParsing}
                      onClick={() => processAiText(crewAiText)}
                      data-testid="button-command-palette-process"
                    >
                      {crewAiParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      ✨ Suggest Changes
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Back */}
      <Link href="/voyages">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voyages
        </button>
      </Link>

      {/* ── HEADER CARD ─────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden border-border bg-card" data-testid="voyage-header-card">

        {/* ── ROW 1: Temel Bilgiler ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap px-5 pt-5 pb-4">

          {/* Sol: ship icon + vessel name + purpose pill */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Ship className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight flex items-center gap-2">
                {voyage.vesselName || "Vessel Not Specified"}
                {isShipowner && (
                  <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-bold uppercase tracking-wider h-4 px-1">
                    Read-only
                  </Badge>
                )}
              </h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 bg-muted/40 px-2 py-0.5 rounded-full border border-border/50">
                  {voyage.purposeOfCall}
                </span>
                {!isShipowner && !["Crew Change", "Husbandry"].includes(voyage.purposeOfCall || "") && (
                  <button
                    onClick={() => {
                      setEditCargoType(voyage.cargoType || "");
                      setEditCargoQty(voyage.cargoQuantity != null ? String(voyage.cargoQuantity) : "");
                      setEditCargoOpen(true);
                    }}
                    className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 border border-border/40 hover:border-border rounded-full px-2.5 py-0.5 transition-all"
                    data-testid="button-edit-cargo"
                  >
                    📦{" "}
                    {voyage.cargoType
                      ? `${voyage.cargoType}${voyage.cargoQuantity ? ` · ${Number(voyage.cargoQuantity).toLocaleString()} MT` : ""}`
                      : <span className="italic opacity-60">Set cargo info</span>}
                    <Pen className="w-2.5 h-2.5 ml-0.5 opacity-50" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sağ: status badge + butonlar */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Status badge */}
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border shrink-0 ${
              voyage.status === "active"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                : voyage.status === "planned"
                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                : voyage.status === "completed"
                ? "bg-muted/40 text-muted-foreground border-border"
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`} data-testid="badge-voyage-status">
              <StatusIcon className="w-3.5 h-3.5" />
              {s.label}
              {voyage.status === "active" && (
                <span className="relative flex h-1.5 w-1.5 ml-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
              )}
            </span>

            {/* Rate button */}
            {canReview && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8"
                onClick={() => setShowReviewDialog(true)} data-testid="button-review">
                <Star className="w-3.5 h-3.5" /> Rate
              </Button>
            )}
            {reviewData?.myReview && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Rated
              </span>
            )}

            {/* ⚡ Close Operation button */}
            {!isShipowner && isOwner && (voyage.status === "active" || voyage.status === "completed") && (
              <div className="flex items-center gap-2">
                <Link href={`/voyages/${voyageId}/pnl`}>
                  <Button variant="outline" size="sm" className="gap-1.5 h-8" data-testid="button-pnl">
                    <BarChart2 className="w-3.5 h-3.5" /> P&L
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/api/voyage-reports/${voyageId}/financial-report/pdf`, '_blank')}
                  className="flex items-center gap-2"
                  data-testid="button-download-report"
                >
                  <Download className="w-4 h-4" />
                  Download Report
                </Button>
                <button
                  onClick={() => { setCloseOpAcknowledge(false); setShowCloseOpModal(true); }}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-semibold bg-amber-600/20 hover:bg-amber-600/35 border border-amber-500/40 text-amber-300 hover:text-amber-200 transition-all"
                  data-testid="button-close-operation"
                >
                  ⚡ Operasyonu Kapat ve Finansa Aktar
                </button>
              </div>
            )}

            {isShipowner && (voyage.status === "active" || voyage.status === "completed") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/api/voyage-reports/${voyageId}/financial-report/pdf`, '_blank')}
                className="flex items-center gap-2"
                data-testid="button-download-report"
              >
                <Download className="w-4 h-4" />
                Download Report
              </Button>
            )}
            {voyage.status === "pending_finance" && (
              <span className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-amber-900/25 border border-amber-500/30 text-amber-400" data-testid="badge-pending-finance">
                <DollarSign className="w-3.5 h-3.5" /> Finans Onayı Bekleniyor
              </span>
            )}
            {/* Change Status dropdown */}
            {isOwner && transitions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1" data-testid="button-change-status">
                    Change Status <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {transitions.map(t => {
                    const cfg = STATUS_CONFIG[t];
                    const TIcon = cfg?.icon;
                    return (
                      <DropdownMenuItem
                        key={t}
                        onClick={() => {
                          if (t === "completed") {
                            setShowCloseOutDialog(true);
                          } else if (t === "cancelled") {
                            setPendingStatus(t);
                          } else {
                            statusMutation.mutate(t);
                          }
                        }}
                        className="gap-2"
                      >
                        {TIcon && <TIcon className="w-4 h-4" />}{cfg?.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* ── ROW 2: Port Call Stepper ──────────────────────────────────────── */}
        <div className="px-5 py-5 border-t border-b border-border/50 bg-muted/20" data-testid="port-call-stepper">
          {(() => {
            const activeIdx = getStepperIndex(voyage.status);
            return (
              <div className="flex items-start gap-0">
                {PORT_CALL_STEPS.map((step, idx) => {
                  const StepIcon = step.icon;
                  const isPast   = activeIdx >= 0 && idx < activeIdx;
                  const isActive = activeIdx >= 0 && idx === activeIdx;
                  const isLast   = idx === PORT_CALL_STEPS.length - 1;
                  const stepLabel = step.key === "cargo_ops" ? features.stepperLabel4 : step.label;

                  return (
                    <div key={step.key} className="flex items-center flex-1 min-w-0">
                      {/* Step node + label */}
                      <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <div className={`
                          relative w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                          ${isActive
                            ? "bg-primary border-primary text-primary-foreground shadow-[0_0_20px_rgba(59,130,246,0.55)]"
                            : isPast
                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                            : "bg-muted/30 border-border/50 text-muted-foreground/35"
                          }
                        `}>
                          {isActive && (
                            <span className="absolute inset-0 rounded-full animate-ping bg-primary/25 pointer-events-none" />
                          )}
                          {isPast
                            ? <CheckCheck className="w-4 h-4" />
                            : <StepIcon className="w-4 h-4" />
                          }
                        </div>
                        <span className={`text-[11px] font-bold text-center whitespace-nowrap ${
                          isActive ? "text-primary"
                          : isPast  ? "text-emerald-400/80"
                          : "text-muted-foreground/35"
                        }`}>
                          {stepLabel}
                        </span>
                      </div>

                      {/* Connector line */}
                      {!isLast && (
                        <div className={`
                          h-0.5 flex-1 mx-1 mb-5 rounded-full transition-all
                          ${isPast ? "bg-emerald-500/40" : "bg-border/40"}
                        `} />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ── ROW 3: Kompakt Detay Tag'ları ─────────────────────────────────── */}
        <div className="px-5 py-4 flex flex-wrap items-start gap-3">

          {/* Rota Tag */}
          <div className="flex items-center gap-2.5 bg-muted/30 border border-border/60 rounded-xl px-3 py-2.5"
               data-testid="tag-route">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
              <Navigation className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide leading-none mb-0.5">Rota</p>
              {voyage.originPortName ? (
                <p className="text-sm font-bold leading-tight flex items-center gap-1 flex-wrap">
                  <span className="truncate max-w-[80px]">{voyage.originPortName}</span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <span className="truncate max-w-[80px]">{voyage.portName || `Port #${voyage.portId}`}</span>
                </p>
              ) : (
                <p className="text-sm font-bold truncate leading-tight">
                  {voyage.portName || `Port #${voyage.portId}`}
                </p>
              )}
            </div>
          </div>

          {/* ETA Tag */}
          {voyage.eta && (() => {
            const tag = getDateTag(voyage.eta);
            if (!tag) return null;
            return (
              <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 border ${tag.isOverdue ? "bg-red-500/5 border-red-500/40" : "bg-muted/30 border-border/60"}`}
                   data-testid="tag-eta">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tag.isOverdue ? "bg-red-500/15" : "bg-violet-500/10"}`}>
                  <Calendar className={`w-3.5 h-3.5 ${tag.isOverdue ? "text-red-400" : "text-violet-400"}`} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide leading-none mb-0.5">ETA</p>
                  <p className="text-sm font-bold leading-tight">{tag.label}</p>
                  <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full border mt-0.5 leading-none ${tag.color}`}>
                    {tag.relText}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* ETD Tag */}
          {voyage.etd && (() => {
            const tag = getDateTag(voyage.etd);
            if (!tag) return null;
            return (
              <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 border ${tag.isOverdue ? "bg-red-500/5 border-red-500/40" : "bg-muted/30 border-border/60"}`}
                   data-testid="tag-etd">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tag.isOverdue ? "bg-red-500/15" : "bg-orange-500/10"}`}>
                  <CalendarClock className={`w-3.5 h-3.5 ${tag.isOverdue ? "text-red-400" : "text-orange-400"}`} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide leading-none mb-0.5">ETD</p>
                  <p className="text-sm font-bold leading-tight">{tag.label}</p>
                  <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full border mt-0.5 leading-none ${tag.color}`}>
                    {tag.relText}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Notes chip */}
          {voyage.notes && (
            <div className="flex items-center gap-2.5 bg-muted/30 border border-border/60 rounded-xl px-3 py-2.5 max-w-xs"
                 data-testid="tag-notes">
              <div className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                <Pen className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide leading-none mb-0.5">Notes</p>
                <p className="text-xs text-foreground/80 truncate leading-tight">{voyage.notes}</p>
              </div>
            </div>
          )}
        </div>

      </Card>

      {/* ── Canlı Konum Widget ──────────────────────────────────────────────── */}
      <VoyageLiveTracker
        voyage={voyage}
        portName={voyage.portName || portData?.name || ""}
        imoNumber={voyage.imoNumber || vesselData?.imoNumber || null}
        onOriginPortChange={(portId, portName) => updateOriginPortMutation.mutate({ originPortId: portId, originPortName: portName })}
      />

      {/* Tab Bar — scrollable */}
      <div className="relative border-b border-slate-700/50">
        <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="flex flex-nowrap overflow-x-auto px-2 -mb-px" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <style>{`.vd-tab-scroll::-webkit-scrollbar { display: none; }`}</style>
          {(() => {
            const features2 = getVoyageFeatures(voyage?.purposeOfCall || "");
            const allTabs = [
              { key: "overview",      label: "Overview",      icon: LayoutDashboard },
              ...(features2.hasSOF || features2.hasNOR ? [{ key: "sof", label: "SOF", icon: ClipboardList }] : []),
              { key: "appointments",  label: "Appointments",  icon: CalendarClock },
              ...(features2.hasCargoOps ? [{ key: "cargo", label: "Cargo", icon: Package }] : []),
              ...(features2.hasCrewLogistics ? [{ key: "crew-ops", label: "Crew Ops", icon: UsersIcon }] : []),
              { key: "financials",    label: "Financials",    icon: DollarSign },
              { key: "documents",     label: "Documents",     icon: FolderOpen },
              { key: "team",          label: "Team",          icon: Users2 },
            ].filter(t => !isShipowner || ["overview","financials","documents"].includes(t.key));
            return allTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-all",
                    activeTab === tab.key
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600"
                  )}
                  data-testid={`tab-${tab.key}`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.key === "documents" && chatMessages.length > 0 && (
                    <span className="ml-1 text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-semibold">
                      {chatMessages.length}
                    </span>
                  )}
                </button>
              );
            });
          })()}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
      </div>

      {/* ── MULTI-TAB OPERATIONS AREA ─────────────────────────── */}
      {(["overview","sof","appointments","cargo","crew-ops"].includes(activeTab)) && (
        <div className="space-y-6">
          {/* Operation Content */}
          <div className="space-y-6">
                  {/* ── Husbandry / Crew Change: Operation Badge ── */}
          {activeTab === "crew-ops" && (voyage.purposeOfCall === "Husbandry" || voyage.purposeOfCall === "Crew Change") && (
            <div
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl ${
                voyage.purposeOfCall === "Crew Change"
                  ? "bg-cyan-900/20 border border-cyan-500/30"
                  : "bg-amber-900/20 border border-amber-500/30"
              }`}
              data-testid="husbandry-badge"
            >
              <span className="text-xl flex-shrink-0">
                {voyage.purposeOfCall === "Crew Change" ? "🔵" : "🟡"}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${voyage.purposeOfCall === "Crew Change" ? "text-cyan-400" : "text-amber-400"}`}>
                  {voyage.purposeOfCall === "Crew Change" ? "Crew Change Operation" : "Husbandry & Protecting Agency Only"}
                </p>
                <p className={`text-xs mt-0.5 ${voyage.purposeOfCall === "Crew Change" ? "text-cyan-400/60" : "text-amber-400/60"}`}>
                  {voyage.purposeOfCall === "Crew Change"
                    ? "Crew sign-on/off logistics management. Cargo operations are not applicable for this voyage type."
                    : "Cargo operations are not applicable for this voyage type. Managing crew change, services and port logistics below."}
                </p>
              </div>
            </div>
          )}


          {/* ── Husbandry / Crew Change: Logistics Control Tower ── */}
          {activeTab === "crew-ops" && (voyage.purposeOfCall === "Husbandry" || voyage.purposeOfCall === "Crew Change") && (
            <DndContext sensors={dndSensors} onDragStart={e => { setActiveDragId(Number(e.active.id)); if (!isHotelPanelOpen) { dragAutoOpenedPanel.current = true; setIsHotelPanelOpen(true); } }} onDragEnd={handleCrewDragEnd}>
            <div className="relative flex items-start gap-5" data-testid="husbandry-control-tower">

              {/* LEFT: Crew Logistics Board — grows to fill available space */}
              <div className="relative flex-1 min-w-0 rounded-xl border border-slate-700 bg-slate-800/40 backdrop-blur-sm p-5 space-y-4" data-testid="husbandry-crew-board">
                {/* ── T003 Spotlight Overlay ── */}
                {crewFilterMode === "action" && (
                  <div className="absolute inset-0 z-10 rounded-xl bg-slate-950/65 backdrop-blur-[2px] pointer-events-none" />
                )}
                <div className="relative z-20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                      <UsersIcon className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <h2 className="font-bold text-sm text-slate-50">Crew Logistics Board</h2>
                      <p className="text-xs text-slate-500">Real-time crew change tracking</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* 💾 Auto-save indicator */}
                    {crewSaveStatus === "saving" && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />Kaydediliyor…
                      </span>
                    )}
                    {crewSaveStatus === "saved" && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3 h-3" />Kaydedildi
                      </span>
                    )}
                    {crewSaveStatus === "error" && (
                      <span className="flex items-center gap-1 text-[10px] text-red-400 font-medium">
                        <AlertTriangle className="w-3 h-3" />Hata
                      </span>
                    )}
                    {/* Actions dropdown: Hotels, Ask AI, Send Ops Summary */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-semibold bg-slate-700/40 border border-slate-600/50 text-slate-300 hover:text-slate-100 hover:border-slate-500 transition-all"
                          data-testid="button-actions-dropdown"
                        >
                          ⚡ Actions <ChevronDown className="w-3 h-3" />
                          {crewSigners.filter(c => c.requiresHotel).length > 0 && (
                            <span className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold rounded-full bg-indigo-500 text-white flex-shrink-0">
                              {crewSigners.filter(c => c.requiresHotel).length}
                            </span>
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 z-50">
                        <DropdownMenuItem
                          onClick={() => setIsHotelPanelOpen(v => !v)}
                          className="gap-2"
                          data-testid="dropdown-toggle-hotel-panel"
                        >
                          <span>🏨</span> Hotels &amp; Logistics
                          {crewSigners.filter(c => c.requiresHotel).length > 0 && (
                            <span className="ml-auto text-[9px] font-bold bg-indigo-500 text-white rounded-full px-1.5 py-0.5">
                              {crewSigners.filter(c => c.requiresHotel).length}
                            </span>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setIsCommandPaletteOpen(true)}
                          className="gap-2"
                          data-testid="dropdown-ask-ai"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Ask AI
                          <span className="ml-auto text-[9px] font-mono bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-slate-500">⌘K</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => { setOpsSummaryText(generateOpsSummary(opsSummaryLang)); setOpsSummaryOpen(true); }}
                          className="gap-2"
                          data-testid="dropdown-send-ops-summary"
                        >
                          <span>📧</span> Send Ops Summary
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button
                      onClick={() => setShowCrewDocDialog(true)}
                      disabled={crewSigners.length === 0}
                      className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-semibold bg-teal-700/20 hover:bg-teal-700/35 border border-teal-600/40 text-teal-300 hover:text-teal-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      data-testid="button-generate-crew-docs"
                    >
                      <FileText className="w-3 h-3" />
                      <span className="hidden sm:inline">Belge Oluştur</span>
                    </button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 border-slate-600 text-slate-300 hover:bg-slate-700/50" onClick={() => { setCrewPanelMode("add_on"); setCrewSlideForm({ ...EMPTY_CREW_SLIDE_FORM, side: "on" }); setSlideFormTimeline(ON_TIMELINE_DEFAULT.map(s => ({ ...s }))); setEditingCrewId(null); setShowCrewPanel(true); }} data-testid="button-add-crew">
                      <Plus className="w-3 h-3" /> Add Crew
                    </Button>
                  </div>
                </div>

                {/* ── Active Rules Banner ── */}
                <div className="relative z-20 flex items-start gap-2.5 bg-slate-800/40 border border-slate-700/50 rounded-md py-2 px-4 text-xs text-slate-400" data-testid="crew-rules-banner">
                  <span className="text-sm leading-none mt-0.5 flex-shrink-0">🤖</span>
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-300">Active AI Rules: </span>
                    <span className="inline-block">• On-Signers: Hotel required if flight arrives &gt;6h before Vessel ETA.&nbsp;&nbsp;</span>
                    <span className="inline-block">• Off-Signers: Hotel required if flight departs &gt;12h after Vessel ETD.</span>
                  </div>
                </div>

                {/* ── Quick Filter Bar ── */}
                {(() => {
                  const _etd = voyage?.etd ? new Date(voyage.etd).toTimeString().substring(0, 5) : "";
                  const _eta = voyage?.eta ? new Date(voyage.eta).toTimeString().substring(0, 5) : "";
                  const actionCount = crewSigners.filter(c => {
                    const warns = getCrewWarnings(c, _etd, _eta);
                    return warns.some(w => !isHotelWarning(w)) || (c.requiresHotel && !c.hotelName);
                  }).length;
                  const filterDefs: { mode: "all" | "action" | "ready"; label: string; testId: string }[] = [
                    { mode: "all",    label: "All Crew",                                   testId: "filter-all-crew"        },
                    { mode: "action", label: `⚠️ Action Required${actionCount > 0 ? ` (${actionCount})` : ""}`, testId: "filter-action-required" },
                    { mode: "ready",  label: "✅ Ready",                                   testId: "filter-ready"           },
                  ];
                  return (
                    <div className="relative z-20 flex items-center gap-1.5 flex-wrap" data-testid="crew-filter-bar">
                      {filterDefs.map(({ mode, label, testId }) => (
                        <button
                          key={mode}
                          onClick={() => setCrewFilterMode(mode)}
                          data-testid={testId}
                          className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                            crewFilterMode === mode
                              ? "bg-slate-700 border-slate-500 text-slate-200"
                              : "bg-transparent border-slate-700/50 text-slate-500 hover:border-slate-600 hover:text-slate-400"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        onClick={() => setCrewCompactMode(v => !v)}
                        data-testid="toggle-compact-mode"
                        className={`ml-auto text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 ${
                          crewCompactMode
                            ? "bg-slate-700 border-slate-500 text-slate-200"
                            : "bg-transparent border-slate-700/50 text-slate-500 hover:border-slate-600 hover:text-slate-400"
                        }`}
                      >
                        {crewCompactMode ? "☰ Detailed" : "☰ Compact"}
                      </button>
                    </div>
                  );
                })()}

                {/* ── Rich Data Card helpers ── */}
                {(() => {
                  const flagMap: Record<string, string> = {
                    TUR: "🇹🇷", PHL: "🇵🇭", IND: "🇮🇳", RUS: "🇷🇺", UKR: "🇺🇦",
                    GRC: "🇬🇷", CHN: "🇨🇳", IDN: "🇮🇩", MYS: "🇲🇾", MMR: "🇲🇲",
                    BGD: "🇧🇩", LKA: "🇱🇰", HRV: "🇭🇷", POL: "🇵🇱", ROU: "🇷🇴",
                    GBR: "🇬🇧", USA: "🇺🇸", DEU: "🇩🇪", FRA: "🇫🇷", NOR: "🇳🇴",
                  };
                  const getFlag = (iso: string) => flagMap[iso?.toUpperCase()] ?? "🏳️";

                  const applyCrewFilter = (crew: CrewSigner): boolean => {
                    if (crewFilterMode === "all") return true;
                    const _etd = voyage?.etd ? new Date(voyage.etd).toTimeString().substring(0, 5) : "";
                    const _eta = voyage?.eta ? new Date(voyage.eta).toTimeString().substring(0, 5) : "";
                    const allWarns = getCrewWarnings(crew, _etd, _eta);
                    const hasOperationalWarn = allWarns.some(w => !isHotelWarning(w));
                    const hasHotelPending = crew.requiresHotel && !crew.hotelName;
                    const needsAction = hasOperationalWarn || hasHotelPending;
                    return crewFilterMode === "action" ? needsAction : !needsAction;
                  };

                  const renderCrewCard = (crew: CrewSigner, accent: "emerald" | "rose") => {
                    const accentColors = accent === "emerald"
                      ? { avatar: "bg-emerald-500/20 border-emerald-500/30 text-emerald-400", pulse: "bg-emerald-400" }
                      : { avatar: "bg-rose-500/20 border-rose-500/30 text-rose-400",           pulse: "bg-rose-400"   };

                    const _vesselEtdTime = voyage?.etd ? new Date(voyage.etd).toTimeString().substring(0, 5) : "";
                    const _vesselEtaTime = voyage?.eta ? new Date(voyage.eta).toTimeString().substring(0, 5) : "";
                    const _vesselEtaDisplay = voyage?.eta ? fmtDateTime(voyage.eta) : "—";
                    const _vesselEtdDisplay = voyage?.etd ? fmtDateTime(voyage.etd) : "—";
                    const operationalWarns = getCrewWarnings(crew, _vesselEtdTime, _vesselEtaTime).filter(w => !isHotelWarning(w));
                    const hasCritical = operationalWarns.some(w => w.includes("Critical"));
                    const hasWarning  = operationalWarns.length > 0 && !hasCritical;

                    const cardBorder = hasCritical
                      ? "border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.15)] hover:border-red-500/70"
                      : hasWarning
                        ? "border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.15)] hover:border-amber-500/70"
                        : "border-slate-700 hover:border-slate-600";

                    const openSlideOver = () => { setCrewPanelMode("edit"); setEditingCrewId(crew.id); setCrewSlideForm({ name: crew.name, rank: crew.rank, side: crew.side, nationality: crew.nationality, passportNo: crew.passportNo, flight: crew.flight, flightEta: crew.flightEta, flightDelayed: crew.flightDelayed, visaRequired: crew.visaRequired, eVisaStatus: crew.eVisaStatus, okToBoard: crew.okToBoard, requiresHotel: crew.requiresHotel, hotelName: crew.hotelName, hotelCheckIn: crew.hotelCheckIn, hotelCheckOut: crew.hotelCheckOut, hotelStatus: crew.hotelStatus, hotelPickupTime: crew.hotelPickupTime, dob: crew.dob, seamanBookNo: crew.seamanBookNo, birthPlace: crew.birthPlace }); setSlideFormTimeline(crew.timeline.map(s => ({ ...s }))); setShowCrewPanel(true); };

                    const cardSuggestions = aiPendingSuggestions.filter(s => s.crewId === crew.id);
                    const spotlightZ = crewFilterMode === "action" ? (operationalWarns.length > 0 ? "relative z-20" : "") : "";
                    const aiGlow = cardSuggestions.length > 0 ? "ring-2 ring-blue-500/50 shadow-[0_0_16px_rgba(59,130,246,0.25)]" : "";

                    // ── Adaptive mode: wide when hotel panel is closed ────────
                    const wideMode = !isHotelPanelOpen;

                    // ── MOD B: milestone data ─────────────────────────────────
                    const _hasHotelMilestone = crew.requiresHotel || !!crew.hotelName;
                    const _kontrolTime = crew.timeline.find(s => /customs|police|kontrol|🛂/i.test(s.label + s.icon))?.time || "—";
                    const _msItems = (crew.side === "on" ? [
                      { key: "flight",   icon: "✈️", label: "FLIGHT",   time: crew.flightEta || "—",                                                                         delayed: crew.flightDelayed },
                      { key: "transfer", icon: "🚐", label: "TRANSFER", time: crew.timeline.find(s => /airport.*port|transfer/i.test(s.label))?.time || "—",                 delayed: false },
                      { key: "kontrol",  icon: "🛃", label: "KONTROL",  time: _kontrolTime,                                                                                  delayed: false },
                      { key: "hotel",    icon: "🏨", label: "HOTEL",    time: crew.hotelCheckIn || "—",                                                                       delayed: false },
                      { key: "vessel",   icon: "🚢", label: "VESSEL",   time: _vesselEtaDisplay,                                                                              delayed: false },
                    ] : [
                      { key: "vessel",   icon: "🚢", label: "VESSEL",   time: _vesselEtdDisplay,                                                                              delayed: false },
                      { key: "hotel",    icon: "🏨", label: "HOTEL",    time: crew.hotelPickupTime || crew.hotelCheckOut || "—",                                              delayed: false },
                      { key: "kontrol",  icon: "🛃", label: "KONTROL",  time: _kontrolTime,                                                                                  delayed: false },
                      { key: "transfer", icon: "🚐", label: "TRANSFER", time: crew.timeline.find(s => /port.*airport|transfer/i.test(s.label))?.time || "—",                 delayed: false },
                      { key: "flight",   icon: "✈️", label: "FLIGHT",   time: crew.flightEta || "—",                                                                         delayed: crew.flightDelayed },
                    ]).filter(ms => ms.key !== "hotel" || _hasHotelMilestone);
                    const _getMS = (idx: number): "done" | "active" | "future" => {
                      const terminal = crew.side === "on" ? crew.arrivalStatus === "arrived" : crew.arrivalStatus === "departed";
                      if (terminal) return idx < _msItems.length - 1 ? "done" : "active";
                      return idx === 0 ? "active" : "future";
                    };
                    const _getConnectorState = (idx: number): "done" | "future" | "delayed" => {
                      if (_msItems[idx].delayed) return "delayed";
                      return _getMS(idx - 1) === "done" ? "done" : "future";
                    };
                    const _parseStepTime = (raw: string): { date: string; time: string } => {
                      if (!raw || raw === "—") return { date: "—", time: "—" };
                      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
                        const fmt = fmtDateTime(raw);
                        const parts = fmt.split(" / ");
                        return { date: parts[0] || "—", time: parts[1] || "—" };
                      }
                      if (/^\d{2}\.\d{2}\.\d{4}/.test(raw)) {
                        const parts = raw.split(" / ");
                        return { date: parts[0] || "—", time: parts[1] || "—" };
                      }
                      if (/^\d{2}:\d{2}$/.test(raw)) return { date: "—", time: raw };
                      return { date: "—", time: raw };
                    };
                    const _msIconCls = (s: "done"|"active"|"future") =>
                      s === "done"   ? "text-emerald-400" :
                      s === "active" ? "text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.7)]" :
                                       "text-slate-600";
                    const _hotelPending = crew.requiresHotel && !crew.hotelName;
                    const _hasHotelInfo = crew.requiresHotel && !!crew.hotelName;
                    const _hasStrip     = hasCritical || hasWarning || _hotelPending || crew.flightDelayed;

                    const isReady = !hasCritical && !hasWarning && !_hotelPending;

                    if (crewCompactMode) {
                      return (
                        <DraggableCrewCard key={crew.id} id={crew.id}>
                        <div
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border bg-slate-800 transition-all duration-200 cursor-pointer hover:bg-slate-700/70 ${cardBorder} ${spotlightZ} ${aiGlow}`}
                          onClick={openSlideOver}
                          data-testid={`crew-card-compact-${accent === "emerald" ? "on" : "off"}-${crew.id}`}
                        >
                          <div className={`w-7 h-7 rounded-full ${accentColors.avatar} flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                            {crew.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-200 truncate">{crew.name}</p>
                            <p className="text-[10px] text-slate-500 truncate">{crew.rank} · {getFlag(crew.nationality)} {crew.nationality}</p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="flex items-center gap-1 text-[10px] text-slate-400">
                              <span>✈️</span> <span className="tabular-nums">{crew.flightEta || "—"}</span>
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-slate-400 hidden sm:flex">
                              <span>🚢</span> <span className="tabular-nums">{crew.side === "on" ? _vesselEtaDisplay : _vesselEtdDisplay}</span>
                            </span>
                            {hasCritical && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">⚠️ Critical</span>}
                            {hasWarning && !hasCritical && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">⚠️ Action</span>}
                            {isReady && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">✓ Ready</span>}
                          </div>
                        </div>
                        </DraggableCrewCard>
                      );
                    }

                    return (
                      <DraggableCrewCard key={crew.id} id={crew.id}>
                      <div
                        className={`group rounded-xl border bg-slate-800 transition-all duration-200 relative overflow-hidden hover:bg-slate-800/70 hover:shadow-lg hover:shadow-slate-900/50 ${wideMode ? "p-3" : "p-3 space-y-2.5"} ${cardBorder} ${spotlightZ} ${aiGlow}`}
                        data-testid={`crew-card-${accent === "emerald" ? "on" : "off"}-${crew.id}`}
                      >
                        {/* Right-edge warning colour strip (MOD B only) */}
                        {wideMode && _hasStrip && (
                          <div className={`absolute right-0 top-0 bottom-0 w-[3px] ${hasCritical ? "bg-red-500" : "bg-amber-500"}`} />
                        )}

                        {wideMode ? (
                          /* ══════════════ MOD B: WIDE / DETAIL LAYOUT ══════════════ */
                          <div className="flex items-start gap-4">

                            {/* ── LEFT: Identity block ── */}
                            <div className="flex items-start gap-2 flex-shrink-0" style={{ width: 172 }}>
                              <div className={`w-8 h-8 rounded-full ${accentColors.avatar} flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5`}>
                                {crew.name[0]}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-bold text-slate-100 leading-tight truncate">{crew.name}</p>
                                <p className="text-[10px] text-slate-500 leading-tight truncate">
                                  {crew.rank}{crew.nationality ? <span className="text-slate-600"> · {getFlag(crew.nationality)} {crew.nationality.toUpperCase()}</span> : null}
                                </p>
                                {/* Pre-check: visa badges — horizontal compact row */}
                                <div className="flex flex-wrap items-center gap-1 mt-1.5" data-testid={`crew-visa-row-${crew.id}`}>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                      <button className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer hover:opacity-90 transition-opacity ${crew.visaRequired ? "bg-rose-500/15 text-rose-400 border-rose-500/20" : "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"}`} data-testid={`badge-visa-${crew.id}`}>
                                        {crew.visaRequired ? "⚠️ Visa" : "✅ Visa"}
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="bg-slate-800 border-slate-700 text-slate-200 min-w-[170px] p-1">
                                      <DropdownMenuItem className="text-[11px] cursor-pointer hover:bg-slate-700 focus:bg-slate-700 rounded-md px-2 py-1.5" onClick={e => { e.stopPropagation(); setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, visaRequired: false })); }}>✓ No Visa Required</DropdownMenuItem>
                                      <DropdownMenuItem className="text-[11px] cursor-pointer hover:bg-slate-700 focus:bg-slate-700 rounded-md px-2 py-1.5" onClick={e => { e.stopPropagation(); setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, visaRequired: true })); }}>⚠ Visa Required</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                      <button className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer hover:opacity-90 transition-opacity ${crew.eVisaStatus === "approved" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : crew.eVisaStatus === "pending" ? "bg-amber-500/15 text-amber-400 border-amber-500/20" : "bg-slate-500/15 text-slate-400 border-slate-500/20"}`} data-testid={`badge-evisa-${crew.id}`}>
                                        {crew.eVisaStatus === "approved" ? "✅ e-Visa" : crew.eVisaStatus === "pending" ? "⏳ e-Visa" : "e-Visa: N/A"}
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="bg-slate-800 border-slate-700 text-slate-200 min-w-[170px] p-1">
                                      <DropdownMenuItem className="text-[11px] cursor-pointer hover:bg-slate-700 focus:bg-slate-700 rounded-md px-2 py-1.5" onClick={e => { e.stopPropagation(); setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, eVisaStatus: "n/a" })); }}>e-Visa: N/A</DropdownMenuItem>
                                      <DropdownMenuItem className="text-[11px] cursor-pointer hover:bg-slate-700 focus:bg-slate-700 rounded-md px-2 py-1.5" onClick={e => { e.stopPropagation(); setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, eVisaStatus: "pending" })); }}>⏳ Pending</DropdownMenuItem>
                                      <DropdownMenuItem className="text-[11px] cursor-pointer hover:bg-slate-700 focus:bg-slate-700 rounded-md px-2 py-1.5" onClick={e => { e.stopPropagation(); setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, eVisaStatus: "approved" })); }}>✅ Approved</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  {/* Boarding Control badge */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                      <button className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer hover:opacity-90 transition-opacity ${
                                        crew.okToBoard === "confirmed" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" :
                                        crew.okToBoard === "sent"      ? "bg-amber-500/15 text-amber-400 border-amber-500/20" :
                                                                         "bg-slate-500/15 text-slate-400 border-slate-500/20"
                                      }`} data-testid={`badge-oktoboard-${crew.id}`}>
                                        {crew.okToBoard === "confirmed" ? "✅ Kontrol" : crew.okToBoard === "sent" ? "⏳ Kontrol" : "⏳ Kontrol"}
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="bg-slate-800 border-slate-700 text-slate-200 min-w-[200px] p-1">
                                      <DropdownMenuItem className="text-[11px] cursor-pointer hover:bg-slate-700 focus:bg-slate-700 rounded-md px-2 py-1.5" onClick={e => { e.stopPropagation(); setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, okToBoard: "confirmed" })); }}>✓ Kontrol Onaylandı</DropdownMenuItem>
                                      <DropdownMenuItem className="text-[11px] cursor-pointer hover:bg-slate-700 focus:bg-slate-700 rounded-md px-2 py-1.5" onClick={e => { e.stopPropagation(); setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, okToBoard: "sent" })); }}>📨 Kontrol Formu Gönderildi</DropdownMenuItem>
                                      <DropdownMenuItem className="text-[11px] cursor-pointer hover:bg-slate-700 focus:bg-slate-700 rounded-md px-2 py-1.5" onClick={e => { e.stopPropagation(); setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, okToBoard: "pending" })); }}>⏳ Kontrol Bekliyor</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>

                            {/* ── CENTER: Stepper + flight + hotel + AI suggestions ── */}
                            <div className="flex-1 flex flex-col gap-2.5 min-w-0" onClick={e => e.stopPropagation()}>
                              {/* Horizontal workflow stepper */}
                              <div className="flex items-start justify-between gap-1">
                                {_msItems.map((ms, idx) => {
                                  const st: "done" | "active" | "future" = ms.key === "kontrol"
                                    ? (crew.okToBoard === "confirmed" ? "done" : crew.okToBoard === "sent" ? "active" : "future")
                                    : _getMS(idx);
                                  const tlStep = crew.timeline.find(s => s.icon === ms.icon);
                                  const isEditingThis =
                                    ms.key === "flight"
                                      ? inlineEdit?.crewId === crew.id && inlineEdit?.field === "flightEta"
                                      : tlStep != null && editingCrewTimeline?.crewId === crew.id && editingCrewTimeline?.stepId === tlStep.id;
                                  const { date: _dPart, time: _tPart } = _parseStepTime(ms.time);
                                  const _badgeBase = "flex flex-col items-center rounded-md px-1.5 py-1 mt-0.5 transition-all duration-300";
                                  const _badgeCls = st === "active"
                                    ? `${_badgeBase} bg-slate-800 shadow-[0_0_8px_rgba(34,211,238,0.4)] border border-cyan-500/30`
                                    : st === "done"
                                    ? `${_badgeBase} bg-slate-800/70 border border-emerald-700/25`
                                    : `${_badgeBase} bg-slate-800/40 border border-slate-700/25`;
                                  const _datePartCls = st === "active" ? "text-cyan-500/70" : st === "done" ? "text-emerald-700/70" : "text-slate-600";
                                  const _timePartCls = st === "active" ? "text-cyan-400 font-bold" : st === "done" ? "text-emerald-300 font-semibold" : "text-slate-500";
                                  return (
                                    <div key={ms.key} className="flex items-start">
                                      {/* Dynamic SVG connector */}
                                      {idx > 0 && (() => {
                                        const cs = _getConnectorState(idx);
                                        if (cs === "done") return (
                                          <div className="w-5 h-0.5 bg-emerald-500 flex-shrink-0 mt-4 mx-0.5 transition-all duration-700 rounded-full" />
                                        );
                                        if (cs === "delayed") return (
                                          <div className="w-5 h-0.5 bg-orange-500 flex-shrink-0 mt-4 mx-0.5 rounded-full" style={{ animation: "connectorPulse 1.4s ease-in-out infinite" }} />
                                        );
                                        return (
                                          <div className="w-5 flex-shrink-0 mt-4 mx-0.5 border-t-2 border-dashed border-slate-500/60" />
                                        );
                                      })()}
                                      <div className="flex flex-col items-center gap-0.5" style={{ minWidth: 52 }}>
                                        {/* Icon circle with group-hover glow */}
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base transition-all duration-200 ${
                                          st === "done"   ? "bg-emerald-500/15 text-emerald-400" :
                                          st === "active" ? "bg-cyan-500/15 text-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.4)]" :
                                          "bg-slate-800 text-slate-600 group-hover:bg-slate-700 group-hover:text-slate-400"
                                        }`}>
                                          {ms.icon}
                                        </div>
                                        {isEditingThis ? (
                                          ms.key === "flight" ? (
                                            <input
                                              autoFocus
                                              value={inlineEdit!.val}
                                              onChange={e => setInlineEdit(v => v ? { ...v, val: e.target.value } : v)}
                                              onBlur={() => { setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, flightEta: inlineEdit!.val })); setInlineEdit(null); }}
                                              onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
                                              className="w-12 h-4 text-[10px] font-mono bg-slate-700 border border-blue-500/70 rounded px-1 text-slate-100 outline-none text-center"
                                              placeholder="HH:MM"
                                              data-testid={`inline-edit-flighteta-${crew.id}`}
                                            />
                                          ) : (
                                            <input
                                              autoFocus
                                              value={crewTimelineEditVal}
                                              onChange={e => setCrewTimelineEditVal(e.target.value)}
                                              onBlur={() => { if (tlStep) { setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, timeline: c.timeline.map(s => s.id !== tlStep.id ? s : { ...s, time: crewTimelineEditVal }) })); } setEditingCrewTimeline(null); }}
                                              onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
                                              className="w-12 h-4 text-[10px] font-mono bg-slate-700 border border-blue-500/70 rounded px-1 text-slate-100 outline-none text-center"
                                              placeholder="HH:MM"
                                              data-testid={`inline-edit-timeline-${crew.id}-${tlStep?.id}`}
                                            />
                                          )
                                        ) : ms.time === "—" && ms.key !== "vessel" ? (
                                          <button
                                            className="text-[10px] text-slate-600 group-hover:text-blue-400/70 opacity-40 group-hover:opacity-100 transition-all cursor-pointer leading-tight"
                                            onClick={() => {
                                              if (ms.key === "flight") {
                                                setInlineEdit({ crewId: crew.id, field: "flightEta", val: crew.flightEta || "" });
                                              } else if (tlStep) {
                                                setEditingCrewTimeline({ crewId: crew.id, stepId: tlStep.id });
                                                setCrewTimelineEditVal(tlStep.time);
                                              } else {
                                                openSlideOver();
                                              }
                                            }}
                                            data-testid={`ms-set-${crew.id}-${ms.key}`}
                                          >+ Set</button>
                                        ) : (
                                          <div
                                            className={`${_badgeCls}${ms.key !== "vessel" ? " cursor-pointer hover:border-slate-600/50" : ""}`}
                                            onClick={ms.key !== "vessel" ? () => {
                                              if (ms.key === "flight") {
                                                setInlineEdit({ crewId: crew.id, field: "flightEta", val: crew.flightEta || "" });
                                              } else if (tlStep) {
                                                setEditingCrewTimeline({ crewId: crew.id, stepId: tlStep.id });
                                                setCrewTimelineEditVal(tlStep.time);
                                              } else {
                                                openSlideOver();
                                              }
                                            } : undefined}
                                            title={ms.key !== "vessel" ? `Edit ${ms.label} time` : undefined}
                                            data-testid={`ms-time-${crew.id}-${ms.key}`}
                                          >
                                            <span className={`text-[9px] leading-none font-mono ${_datePartCls}`}>{_dPart}</span>
                                            <span className={`text-[11px] leading-tight font-mono ${_timePartCls}`}>{_tPart}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Flight number row + hotel mini-badge */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[9px] text-slate-600 uppercase">Flight:</span>
                                {inlineEdit?.crewId === crew.id && inlineEdit?.field === "flight" ? (
                                  <input autoFocus value={inlineEdit.val} onChange={e => setInlineEdit(v => v ? { ...v, val: e.target.value } : v)} onBlur={() => { setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, flight: inlineEdit.val })); setInlineEdit(null); }} onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }} className="w-20 h-4 text-[10px] font-semibold bg-slate-700 border border-blue-500/70 rounded px-1 text-slate-100 outline-none" data-testid={`inline-edit-flight-${crew.id}`} />
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-300 cursor-pointer hover:bg-slate-700/60 rounded px-1 py-0.5 transition-colors" onClick={() => setInlineEdit({ crewId: crew.id, field: "flight", val: crew.flight || "" })} data-testid={`text-flight-${crew.id}`}>{crew.flight || "—"}</span>
                                )}
                                {crew.flightDelayed && (
                                  <span className="inline-flex items-center text-[9px] font-bold text-rose-400 bg-rose-900/40 border border-rose-500/30 rounded-full px-1.5 py-0.5">⚠ Delayed</span>
                                )}
                                {_hasHotelInfo && (
                                  <span className={`inline-flex items-center text-[9px] font-bold rounded-full border px-1.5 py-0.5 ${crew.hotelStatus === "checked-in" ? "text-emerald-400 bg-emerald-900/20 border-emerald-500/50" : crew.hotelStatus === "checked-out" ? "text-sky-400 bg-sky-900/20 border-sky-500/50" : crew.hotelStatus === "reserved" ? "text-blue-400 bg-blue-900/20 border-blue-500/50" : "text-emerald-400 bg-emerald-900/20 border-emerald-500/50"}`} data-testid={`badge-hotel-${crew.id}`}>
                                    {crew.hotelStatus === "checked-in" ? `🛏️ ${crew.hotelName}` : crew.hotelStatus === "checked-out" ? `🧳 ${crew.hotelName}` : crew.hotelStatus === "reserved" ? `🔖 ${crew.hotelName}` : `🏨 ${crew.hotelName}`}
                                  </span>
                                )}
                                {_hotelPending && !_hasHotelInfo && (
                                  <button className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-300 bg-amber-950/40 border border-amber-500/35 rounded-full px-1.5 py-0.5 hover:bg-amber-950/60 transition-colors" onClick={e => { e.stopPropagation(); openSlideOver(); }} data-testid={`warning-hotel-pending-${crew.id}`}>🏨 Hotel Req. — Add</button>
                                )}
                              </div>

                              {/* AI Pending Suggestions */}
                              {cardSuggestions.length > 0 && (
                                <div className="space-y-1">
                                  {cardSuggestions.map(suggestion => (
                                    <div key={`${suggestion.crewId}-${suggestion.field}`} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-950/50 border border-blue-500/40 text-[9px]">
                                      <span className="text-blue-300 font-semibold flex-shrink-0">✨ AI:</span>
                                      <span className="text-blue-100 font-bold flex-1 truncate">{suggestion.label}</span>
                                      <button className="text-emerald-400 hover:text-emerald-300 font-bold px-1.5 py-0.5 rounded hover:bg-emerald-900/30 transition-colors flex-shrink-0" onClick={() => { setCrewSigners(cs => cs.map(c => c.id !== suggestion.crewId ? c : { ...c, [suggestion.field]: suggestion.newVal })); setAiPendingSuggestions(prev => prev.filter(s => !(s.crewId === suggestion.crewId && s.field === suggestion.field))); }} data-testid={`button-ai-accept-${crew.id}-${suggestion.field}`}>✓</button>
                                      <button className="text-rose-400 hover:text-rose-300 font-bold px-1.5 py-0.5 rounded hover:bg-rose-900/30 transition-colors flex-shrink-0" onClick={() => setAiPendingSuggestions(prev => prev.filter(s => !(s.crewId === suggestion.crewId && s.field === suggestion.field)))} data-testid={`button-ai-reject-${crew.id}-${suggestion.field}`}>✕</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* ── RIGHT: Status badge + quick actions ── */}
                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pr-1.5" onClick={e => e.stopPropagation()}>
                              {/* Big warning / status badge */}
                              <span className={`inline-flex items-center text-[9px] font-bold rounded-full border px-2 py-1 whitespace-nowrap transition-transform group-hover:scale-105 ${
                                hasCritical        ? "text-red-400 bg-red-950/60 border-red-500/50" :
                                hasWarning         ? "text-amber-400 bg-amber-950/40 border-amber-500/40" :
                                _hotelPending      ? "text-amber-300 bg-amber-950/40 border-amber-500/40" :
                                crew.flightDelayed ? "text-rose-400 bg-rose-950/40 border-rose-500/40" :
                                                     "text-emerald-400 bg-emerald-950/30 border-emerald-500/30"
                              }`} data-testid={`badge-status-${crew.id}`}>
                                {hasCritical ? "🚨 CRITICAL" : hasWarning ? "⚠ Action Req." : _hotelPending ? "🏨 Hotel Req." : crew.flightDelayed ? "⚠ DELAYED" : "✓ Ready"}
                              </span>
                              {/* Arrival / departure status */}
                              {crew.arrivalStatus === "arrived" && (
                                <span className="inline-flex items-center text-[8px] font-bold text-emerald-400 bg-emerald-900/30 border border-emerald-500/40 rounded-full px-1.5 py-0.5">🟢 Arrived</span>
                              )}
                              {crew.arrivalStatus === "departed" && (
                                <span className="inline-flex items-center text-[8px] font-bold text-rose-400 bg-rose-900/30 border border-rose-500/40 rounded-full px-1.5 py-0.5">🔴 Departed</span>
                              )}
                              {/* Quick action buttons — subtle by default, visible on hover */}
                              <div className="flex flex-col gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                              <button
                                className="flex items-center justify-center gap-1 h-6 px-2 w-full text-[10px] font-medium rounded-md border border-slate-600 text-slate-400 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-900/20 transition-colors"
                                onClick={e => { e.stopPropagation(); setCrewPanelMode("edit"); setEditingCrewId(crew.id); setCrewSlideForm({ name: crew.name, rank: crew.rank, side: crew.side, nationality: crew.nationality, passportNo: crew.passportNo, flight: crew.flight, flightEta: crew.flightEta, flightDelayed: crew.flightDelayed, visaRequired: crew.visaRequired, eVisaStatus: crew.eVisaStatus, okToBoard: crew.okToBoard, requiresHotel: crew.requiresHotel, hotelName: crew.hotelName, hotelCheckIn: crew.hotelCheckIn, hotelCheckOut: crew.hotelCheckOut, hotelStatus: crew.hotelStatus, hotelPickupTime: crew.hotelPickupTime, dob: crew.dob, seamanBookNo: crew.seamanBookNo, birthPlace: crew.birthPlace }); setSlideFormTimeline(crew.timeline.map(s => ({ ...s }))); setShowCrewPanel(true); }}
                                data-testid={`button-update-flight-${crew.id}`}
                              >
                                <Plane className="w-3 h-3" /> Edit
                              </button>
                              {crew.side === "on" ? (
                                <button
                                  className={`flex items-center justify-center gap-1 h-6 px-2 w-full text-[10px] font-medium rounded-md border transition-colors ${crew.arrivalStatus === "arrived" ? "border-emerald-500/50 text-emerald-400 bg-emerald-900/20 hover:bg-emerald-900/30" : "border-slate-600 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-900/10"}`}
                                  onClick={e => { e.stopPropagation(); const next = crew.arrivalStatus === "arrived" ? "pending" : "arrived"; setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, arrivalStatus: next })); if (next === "arrived") addActivityLog(`${crew.name} (${crew.rank}) marked as Arrived.`, "Agent"); }}
                                  data-testid={`button-mark-arrived-${crew.id}`}
                                >
                                  <LogIn className="w-3 h-3" /> {crew.arrivalStatus === "arrived" ? "✓ Arrived" : "Arrived"}
                                </button>
                              ) : (
                                <button
                                  className={`flex items-center justify-center gap-1 h-6 px-2 w-full text-[10px] font-medium rounded-md border transition-colors ${crew.arrivalStatus === "departed" ? "border-rose-500/50 text-rose-400 bg-rose-900/20 hover:bg-rose-900/30" : "border-slate-600 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-900/10"}`}
                                  onClick={e => { e.stopPropagation(); const next = crew.arrivalStatus === "departed" ? "pending" : "departed"; setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, arrivalStatus: next })); if (next === "departed") addActivityLog(`${crew.name} (${crew.rank}) marked as Departed.`, "Agent"); }}
                                  data-testid={`button-mark-departed-${crew.id}`}
                                >
                                  <LogOut className="w-3 h-3" /> {crew.arrivalStatus === "departed" ? "✓ Departed" : "Departed"}
                                </button>
                              )}
                              </div>
                              {/* Expand + Remove */}
                              <div className="flex gap-0.5">
                                <button className="p-1 text-slate-600 hover:text-blue-400 transition-colors" onClick={e => { e.stopPropagation(); openSlideOver(); }} data-testid={`button-expand-crew-${crew.id}`} title="Open details"><Maximize2 className="w-3 h-3" /></button>
                                <button className="p-1 text-slate-600 hover:text-rose-400 transition-colors" onClick={e => { e.stopPropagation(); setCrewSigners(cs => cs.filter(c => c.id !== crew.id)); }} data-testid={`button-remove-crew-${crew.id}`}><X className="w-3 h-3" /></button>
                              </div>
                            </div>

                          </div>
                        ) : (
                          /* ══════════════ MOD A: COMPACT LAYOUT (unchanged) ══════════════ */
                          <>
                            {/* ── HEADER: Avatar | Name + Rank | Flag | Status | Expand | Remove ── */}
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full ${accentColors.avatar} flex items-center justify-center text-[12px] font-bold flex-shrink-0`}>
                                {crew.name[0]}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-xs font-bold text-slate-100 truncate leading-tight">{crew.name}</p>
                                  {operationalWarns.length > 0 && (
                                    <span className="relative group/warn flex-shrink-0" data-testid={`warning-icon-${crew.id}`}>
                                      <span className={`text-[11px] cursor-help leading-none ${hasCritical ? "text-red-400" : "text-amber-400"}`}>⚠</span>
                                      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/warn:block z-30 w-max max-w-[220px] bg-slate-900 border border-slate-600/80 rounded-lg px-2.5 py-2 text-[10px] text-slate-200 shadow-2xl whitespace-normal leading-snug">
                                        {operationalWarns.map(w => w.replace("⚠️ ", "").replace("🚨 ", "")).join(" · ")}
                                      </span>
                                    </span>
                                  )}
                                  {crew.arrivalStatus === "arrived" && (
                                    <span className="inline-flex items-center text-[8px] font-bold text-emerald-400 bg-emerald-900/30 border border-emerald-500/40 rounded-full px-1.5 py-0.5 flex-shrink-0">🟢 Arrived</span>
                                  )}
                                  {crew.arrivalStatus === "departed" && (
                                    <span className="inline-flex items-center text-[8px] font-bold text-rose-400 bg-rose-900/30 border border-rose-500/40 rounded-full px-1.5 py-0.5 flex-shrink-0">🔴 Departed</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight">{crew.rank}</p>
                              </div>
                              {crew.nationality && (
                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                  <span className="text-sm leading-none">{getFlag(crew.nationality)}</span>
                                  <span className="text-[9px] text-slate-500 font-mono">{crew.nationality.toUpperCase()}</span>
                                </div>
                              )}
                              <button className="p-1 text-slate-600 hover:text-blue-400 transition-colors flex-shrink-0" onClick={e => { e.stopPropagation(); openSlideOver(); }} data-testid={`button-expand-crew-${crew.id}`} title="Open details"><Maximize2 className="w-3 h-3" /></button>
                              <button className="p-1 text-slate-600 hover:text-rose-400 transition-colors flex-shrink-0" onClick={e => { e.stopPropagation(); setCrewSigners(cs => cs.filter(c => c.id !== crew.id)); }} data-testid={`button-remove-crew-${crew.id}`}><X className="w-3 h-3" /></button>
                            </div>

                            {/* ── VISA & CLEARANCE ROW ── */}
                            <div className="flex flex-wrap gap-1" data-testid={`crew-visa-row-${crew.id}`}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                  <button className={`inline-flex items-center text-[9px] font-bold rounded-full border px-1.5 py-0.5 cursor-pointer hover:opacity-80 transition-opacity ${crew.visaRequired ? "text-rose-400 bg-rose-900/20 border-rose-500/50" : "text-emerald-400 bg-emerald-900/20 border-emerald-500/50"}`} data-testid={`badge-visa-${crew.id}`}>
                                    Visa Req: {crew.visaRequired ? "Yes" : "No"}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="bg-slate-800 border-slate-700 text-slate-200 min-w-[170px] p-1">
                                  <DropdownMenuItem className="text-[11px] cursor-pointer hover:bg-slate-700 focus:bg-slate-700 rounded-md px-2 py-1.5" onClick={e => { e.stopPropagation(); setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, visaRequired: false })); }}>✓ No Visa Required</DropdownMenuItem>
                                  <DropdownMenuItem className="text-[11px] cursor-pointer hover:bg-slate-700 focus:bg-slate-700 rounded-md px-2 py-1.5" onClick={e => { e.stopPropagation(); setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, visaRequired: true })); }}>⚠ Visa Required</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                  <button className={`inline-flex items-center text-[9px] font-bold rounded-full border px-1.5 py-0.5 cursor-pointer hover:opacity-80 transition-opacity ${crew.eVisaStatus === "approved" ? "text-emerald-400 bg-emerald-900/20 border-emerald-500/50" : crew.eVisaStatus === "pending" ? "text-amber-400 bg-amber-900/20 border-amber-500/50" : "text-slate-500 bg-slate-700/40 border-slate-600/50"}`} data-testid={`badge-evisa-${crew.id}`}>
                                    {crew.eVisaStatus === "approved" ? "✅ e-Visa" : crew.eVisaStatus === "pending" ? "⏳ e-Visa" : "e-Visa: N/A"}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="bg-slate-800 border-slate-700 text-slate-200 min-w-[170px] p-1">
                                  <DropdownMenuItem className="text-[11px] cursor-pointer hover:bg-slate-700 focus:bg-slate-700 rounded-md px-2 py-1.5" onClick={e => { e.stopPropagation(); setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, eVisaStatus: "n/a" })); }}>e-Visa: N/A</DropdownMenuItem>
                                  <DropdownMenuItem className="text-[11px] cursor-pointer hover:bg-slate-700 focus:bg-slate-700 rounded-md px-2 py-1.5" onClick={e => { e.stopPropagation(); setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, eVisaStatus: "pending" })); }}>⏳ Pending</DropdownMenuItem>
                                  <DropdownMenuItem className="text-[11px] cursor-pointer hover:bg-slate-700 focus:bg-slate-700 rounded-md px-2 py-1.5" onClick={e => { e.stopPropagation(); setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, eVisaStatus: "approved" })); }}>✅ Approved</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {/* ── HOTEL STATUS BADGE / PENDING WARNING ── */}
                            {(() => {
                              const vesselEtdTime = voyage.etd ? new Date(voyage.etd).toTimeString().substring(0, 5) : "";
                              const vesselEtaTime = voyage.eta ? new Date(voyage.eta).toTimeString().substring(0, 5) : "";
                              const allWarns = getCrewWarnings(crew, vesselEtdTime, vesselEtaTime);
                              const hotelWarn = allWarns.find(isHotelWarning);
                              const hotelPending = crew.requiresHotel && !crew.hotelName;
                              const hasHotelInfo = crew.requiresHotel && crew.hotelName;
                              return (
                                <>
                                  {(hotelWarn || hotelPending) && !hasHotelInfo && (
                                    <button className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[9px] font-semibold border bg-amber-950/40 border-amber-500/35 text-amber-300 hover:bg-amber-950/60 transition-colors text-left" onClick={e => { e.stopPropagation(); openSlideOver(); }} data-testid={`warning-hotel-pending-${crew.id}`}>
                                      <span>🏨</span>
                                      <span className="flex-1 min-w-0">{hotelWarn ? hotelWarn.replace("🏨 Hotel Required: ", "Hotel Required — ") : "Hotel Required"} · Tap to add hotel</span>
                                    </button>
                                  )}
                                  {hasHotelInfo && (
                                    <div className="flex">
                                      <span className={`inline-flex items-center text-[9px] font-bold rounded-full border px-1.5 py-0.5 ${crew.hotelStatus === "checked-in" ? "text-emerald-400 bg-emerald-900/20 border-emerald-500/50" : crew.hotelStatus === "checked-out" ? "text-sky-400 bg-sky-900/20 border-sky-500/50" : crew.hotelStatus === "reserved" ? "text-blue-400 bg-blue-900/20 border-blue-500/50" : "text-emerald-400 bg-emerald-900/20 border-emerald-500/50"}`} data-testid={`badge-hotel-${crew.id}`}>
                                        {crew.hotelStatus === "checked-in" ? `🛏️ At Hotel: ${crew.hotelName}` : crew.hotelStatus === "checked-out" ? `🧳 Checked-Out: ${crew.hotelName}` : crew.hotelStatus === "reserved" ? `🔖 Reserved: ${crew.hotelName}` : `🏨 Hotel: ${crew.hotelName}`}
                                      </span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}

                            {/* ── FLIGHT ROW (inline editable) ── */}
                            <div className="flex items-center gap-1 text-[11px] text-slate-400" onClick={e => e.stopPropagation()}>
                              <span>✈️</span>
                              {inlineEdit?.crewId === crew.id && inlineEdit?.field === "flight" ? (
                                <input autoFocus value={inlineEdit.val} onChange={e => setInlineEdit(v => v ? { ...v, val: e.target.value } : v)} onBlur={() => { setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, flight: inlineEdit.val })); setInlineEdit(null); }} onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }} className="w-20 h-5 text-[11px] font-semibold bg-slate-700 border border-blue-500/70 rounded px-1.5 text-slate-100 outline-none" data-testid={`inline-edit-flight-${crew.id}`} />
                              ) : (
                                <span className="group/fedit inline-flex items-center gap-1 cursor-pointer hover:bg-slate-700/60 hover:text-slate-200 rounded px-1 py-0.5 transition-colors font-semibold text-slate-300" onClick={() => setInlineEdit({ crewId: crew.id, field: "flight", val: crew.flight || "" })} data-testid={`text-flight-${crew.id}`}>{crew.flight || "—"}<Pen className="w-2 h-2 opacity-0 group-hover/fedit:opacity-60 transition-opacity flex-shrink-0" /></span>
                              )}
                              <span className="text-slate-600 mx-0.5">·</span>
                              <span className="text-slate-600 text-[10px]">ETA</span>
                              {inlineEdit?.crewId === crew.id && inlineEdit?.field === "flightEta" ? (
                                <input autoFocus value={inlineEdit.val} onChange={e => setInlineEdit(v => v ? { ...v, val: e.target.value } : v)} onBlur={() => { setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, flightEta: inlineEdit.val })); setInlineEdit(null); }} onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }} className="w-16 h-5 text-[11px] font-mono bg-slate-700 border border-blue-500/70 rounded px-1.5 text-slate-100 outline-none" placeholder="HH:MM" data-testid={`inline-edit-flighteta-${crew.id}`} />
                              ) : (
                                <span className="group/etaedit inline-flex items-center gap-1 cursor-pointer hover:bg-slate-700/60 hover:text-slate-200 rounded px-1 py-0.5 transition-colors font-mono" onClick={() => setInlineEdit({ crewId: crew.id, field: "flightEta", val: crew.flightEta || "" })} data-testid={`text-flighteta-${crew.id}`}>{crew.flightEta || "—"}<Pen className="w-2 h-2 opacity-0 group-hover/etaedit:opacity-60 transition-opacity flex-shrink-0" /></span>
                              )}
                              {crew.flightDelayed && (
                                <span className="ml-auto inline-flex items-center text-[9px] font-bold text-rose-400 bg-rose-900/40 border border-rose-500/30 rounded-full px-1.5 py-0.5">⚠ Delayed</span>
                              )}
                            </div>

                            {/* ── MICRO-TIMELINE ── */}
                            {crew.timeline.length > 0 && (
                              <div className="flex items-center flex-wrap gap-x-0.5 gap-y-0.5 text-[10px]" onClick={e => e.stopPropagation()}>
                                {crew.timeline.map((step, idx) => (
                                  <span key={step.id} className="inline-flex items-center gap-0.5">
                                    {idx > 0 && <span className="text-slate-600 select-none mx-0.5">›</span>}
                                    <span className="text-slate-500 leading-none">{step.icon}</span>
                                    {editingCrewTimeline?.crewId === crew.id && editingCrewTimeline?.stepId === step.id ? (
                                      <input autoFocus value={crewTimelineEditVal} onChange={e => setCrewTimelineEditVal(e.target.value)} onBlur={() => { setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, timeline: c.timeline.map(s => s.id !== step.id ? s : { ...s, time: crewTimelineEditVal }) })); setEditingCrewTimeline(null); }} onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }} className="w-12 h-4 text-[10px] font-mono bg-slate-700 border border-blue-500/70 rounded px-1 text-slate-100 outline-none" placeholder="HH:MM" data-testid={`inline-edit-timeline-${crew.id}-${step.id}`} />
                                    ) : (
                                      <span className="font-mono text-slate-400 cursor-pointer hover:text-slate-200 hover:bg-slate-700/60 rounded px-0.5 py-0.5 transition-colors leading-none" title={step.label} onClick={() => { setEditingCrewTimeline({ crewId: crew.id, stepId: step.id }); setCrewTimelineEditVal(step.time); }} data-testid={`timeline-step-${crew.id}-${step.id}`}>{step.time || "—"}</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* ── QUICK ACTIONS ── */}
                            <div className="flex gap-1.5 pt-1.5 border-t border-slate-700/40" onClick={e => e.stopPropagation()}>
                              <button className="flex-1 flex items-center justify-center gap-1 h-6 text-[10px] font-medium rounded-md border border-slate-600 text-slate-400 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-900/20 transition-colors" onClick={e => { e.stopPropagation(); setCrewPanelMode("edit"); setEditingCrewId(crew.id); setCrewSlideForm({ name: crew.name, rank: crew.rank, side: crew.side, nationality: crew.nationality, passportNo: crew.passportNo, flight: crew.flight, flightEta: crew.flightEta, flightDelayed: crew.flightDelayed, visaRequired: crew.visaRequired, eVisaStatus: crew.eVisaStatus, okToBoard: crew.okToBoard, requiresHotel: crew.requiresHotel, hotelName: crew.hotelName, hotelCheckIn: crew.hotelCheckIn, hotelCheckOut: crew.hotelCheckOut, hotelStatus: crew.hotelStatus, hotelPickupTime: crew.hotelPickupTime, dob: crew.dob, seamanBookNo: crew.seamanBookNo, birthPlace: crew.birthPlace }); setSlideFormTimeline(crew.timeline.map(s => ({ ...s }))); setShowCrewPanel(true); }} data-testid={`button-update-flight-${crew.id}`}><Plane className="w-3 h-3" /> Update Flight</button>
                              {crew.side === "on" ? (
                                <button className={`flex-1 flex items-center justify-center gap-1 h-6 text-[10px] font-medium rounded-md border transition-colors ${crew.arrivalStatus === "arrived" ? "border-emerald-500/50 text-emerald-400 bg-emerald-900/20 hover:bg-emerald-900/30" : "border-slate-600 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-900/10"}`} onClick={e => { e.stopPropagation(); const next = crew.arrivalStatus === "arrived" ? "pending" : "arrived"; setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, arrivalStatus: next })); if (next === "arrived") addActivityLog(`${crew.name} (${crew.rank}) marked as Arrived.`, "Agent"); }} data-testid={`button-mark-arrived-${crew.id}`}><LogIn className="w-3 h-3" /> {crew.arrivalStatus === "arrived" ? "✓ Arrived" : "Mark Arrived"}</button>
                              ) : (
                                <button className={`flex-1 flex items-center justify-center gap-1 h-6 text-[10px] font-medium rounded-md border transition-colors ${crew.arrivalStatus === "departed" ? "border-rose-500/50 text-rose-400 bg-rose-900/20 hover:bg-rose-900/30" : "border-slate-600 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-900/10"}`} onClick={e => { e.stopPropagation(); const next = crew.arrivalStatus === "departed" ? "pending" : "departed"; setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, arrivalStatus: next })); if (next === "departed") addActivityLog(`${crew.name} (${crew.rank}) marked as Departed.`, "Agent"); }} data-testid={`button-mark-departed-${crew.id}`}><LogOut className="w-3 h-3" /> {crew.arrivalStatus === "departed" ? "✓ Departed" : "Mark Departed"}</button>
                              )}
                            </div>

                            {/* ── AI Pending Suggestions ── */}
                            {cardSuggestions.length > 0 && (
                              <div className="space-y-1" onClick={e => e.stopPropagation()}>
                                {cardSuggestions.map(suggestion => (
                                  <div key={`${suggestion.crewId}-${suggestion.field}`} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-950/50 border border-blue-500/40 text-[9px]">
                                    <span className="text-blue-300 font-semibold flex-shrink-0">✨ AI:</span>
                                    <span className="text-blue-100 font-bold flex-1 truncate">{suggestion.label}</span>
                                    <button className="text-emerald-400 hover:text-emerald-300 font-bold px-1.5 py-0.5 rounded hover:bg-emerald-900/30 transition-colors flex-shrink-0" onClick={() => { setCrewSigners(cs => cs.map(c => c.id !== suggestion.crewId ? c : { ...c, [suggestion.field]: suggestion.newVal })); setAiPendingSuggestions(prev => prev.filter(s => !(s.crewId === suggestion.crewId && s.field === suggestion.field))); }} data-testid={`button-ai-accept-${crew.id}-${suggestion.field}`}>✓</button>
                                    <button className="text-rose-400 hover:text-rose-300 font-bold px-1.5 py-0.5 rounded hover:bg-rose-900/30 transition-colors flex-shrink-0" onClick={() => setAiPendingSuggestions(prev => prev.filter(s => !(s.crewId === suggestion.crewId && s.field === suggestion.field)))} data-testid={`button-ai-reject-${crew.id}-${suggestion.field}`}>✕</button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      </DraggableCrewCard>
                    );
                  };

                  return (
                    <div className={`grid ${isHotelPanelOpen ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"} gap-5`}>
                      {/* ON-SIGNERS */}
                      <div className="space-y-2.5">
                        <div className="relative z-20 flex items-center gap-2 pb-2 border-b border-emerald-500/20">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">On-Signers</span>
                          <span className="text-[10px] text-slate-500 bg-emerald-900/30 border border-emerald-700/30 rounded-full px-2 py-0.5">
                            {crewSigners.filter(c => c.side === "on").length} joining
                          </span>
                          <button
                            className="ml-auto flex items-center gap-1 h-6 px-2 text-[10px] font-semibold rounded-md bg-blue-600/20 border border-blue-500/40 text-blue-400 hover:bg-blue-600/30 hover:border-blue-400/60 transition-colors"
                            onClick={() => { setCrewPanelMode("add_on"); setCrewSlideForm({ ...EMPTY_CREW_SLIDE_FORM, side: "on" }); setSlideFormTimeline(ON_TIMELINE_DEFAULT.map(s => ({ ...s }))); setEditingCrewId(null); setShowCrewPanel(true); }}
                            data-testid="button-add-on-signer"
                          >
                            <Plus className="w-2.5 h-2.5" /> Add
                          </button>
                        </div>
                        {crewSigners.filter(c => c.side === "on").filter(applyCrewFilter).map(crew => renderCrewCard(crew, "emerald"))}
                        {crewSigners.filter(c => c.side === "on").length === 0 && (
                          <button
                            className="w-full py-6 rounded-xl border border-dashed border-emerald-500/30 text-xs text-slate-600 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors flex flex-col items-center gap-1"
                            onClick={() => { setCrewPanelMode("add_on"); setCrewSlideForm({ ...EMPTY_CREW_SLIDE_FORM, side: "on" }); setSlideFormTimeline(ON_TIMELINE_DEFAULT.map(s => ({ ...s }))); setEditingCrewId(null); setShowCrewPanel(true); }}
                            data-testid="button-empty-add-on"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add first on-signer</span>
                          </button>
                        )}
                      </div>

                      {/* OFF-SIGNERS */}
                      <div className="space-y-2.5">
                        <div className="relative z-20 flex items-center gap-2 pb-2 border-b border-rose-500/20">
                          <div className="w-2 h-2 rounded-full bg-rose-400" />
                          <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">Off-Signers</span>
                          <span className="text-[10px] text-slate-500 bg-rose-900/30 border border-rose-700/30 rounded-full px-2 py-0.5">
                            {crewSigners.filter(c => c.side === "off").length} departing
                          </span>
                          <button
                            className="ml-auto flex items-center gap-1 h-6 px-2 text-[10px] font-semibold rounded-md bg-blue-600/20 border border-blue-500/40 text-blue-400 hover:bg-blue-600/30 hover:border-blue-400/60 transition-colors"
                            onClick={() => { setCrewPanelMode("add_off"); setCrewSlideForm({ ...EMPTY_CREW_SLIDE_FORM, side: "off" }); setSlideFormTimeline(OFF_TIMELINE_DEFAULT.map(s => ({ ...s }))); setEditingCrewId(null); setShowCrewPanel(true); }}
                            data-testid="button-add-off-signer"
                          >
                            <Plus className="w-2.5 h-2.5" /> Add
                          </button>
                        </div>
                        {crewSigners.filter(c => c.side === "off").filter(applyCrewFilter).map(crew => renderCrewCard(crew, "rose"))}
                        {crewSigners.filter(c => c.side === "off").length === 0 && (
                          <button
                            className="w-full py-8 rounded-xl border border-dashed border-rose-500/30 text-xs text-slate-600 hover:text-rose-400 hover:border-rose-500/50 transition-colors flex flex-col items-center gap-2"
                            onClick={() => { setCrewPanelMode("add_off"); setCrewSlideForm({ ...EMPTY_CREW_SLIDE_FORM, side: "off" }); setSlideFormTimeline(OFF_TIMELINE_DEFAULT.map(s => ({ ...s }))); setEditingCrewId(null); setShowCrewPanel(true); }}
                            data-testid="button-empty-add-off"
                          >
                            <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                              <UsersIcon className="w-5 h-5 text-rose-500/50" />
                            </div>
                            <span className="font-medium">No off-signers yet</span>
                            <span className="text-[10px] text-slate-700">Add crew departing this vessel →</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* RIGHT: Hotel Hub (Crew Change — always mounted, CSS width toggle for reliable DnD) */}
              {voyage.purposeOfCall === "Crew Change" && (
                <div
                  className={`flex-shrink-0 overflow-hidden transition-[width,opacity] ease-in-out ${activeDragId !== null ? "duration-0" : "duration-300"} ${isHotelPanelOpen ? "w-full sm:w-[310px] opacity-100" : "w-0 opacity-0"}`}
                >
                  <div ref={setHotelDropRef} className={`w-full sm:w-[310px] rounded-xl border bg-slate-800/40 backdrop-blur-sm p-5 flex flex-col gap-4 transition-all duration-200 ${isHotelDragOver ? "border-blue-400/60 bg-blue-950/20 shadow-[0_0_24px_rgba(59,130,246,0.25)]" : "border-slate-700"}`} style={{ minHeight: "360px" }} data-testid="hotel-hub-panel">
                      {isHotelDragOver && (
                        <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none z-20">
                          <span className="text-[10px] font-bold text-blue-300 bg-blue-950/80 border border-blue-500/50 rounded-full px-3 py-1">🏨 Drop to assign hotel</span>
                        </div>
                      )}
                  {/* Header */}
                  <div className="flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                        <span className="text-sm leading-none">🏨</span>
                      </div>
                      <div>
                        <h2 className="font-bold text-sm text-slate-50">Hotel Reservations</h2>
                        <p className="text-xs text-slate-500">Accommodation tracker</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-400 bg-indigo-900/30 border border-indigo-500/30 rounded-full px-2 py-0.5">
                      {crewSigners.filter(c => c.requiresHotel).length} staying
                    </span>
                  </div>

                  {/* Hotel cards */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-0.5" data-testid="hotel-cards-list">
                    {crewSigners.filter(c => c.requiresHotel).length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <span className="text-3xl mb-2">🏨</span>
                        <p className="text-xs text-slate-500 font-medium">No hotel reservations</p>
                        <p className="text-[10px] text-slate-600 mt-1">Assign hotel needs to crew members to see reservations here.</p>
                      </div>
                    ) : (
                      crewSigners.filter(c => c.requiresHotel).map(crew => {
                        const statusCfg = {
                          "none":         { label: "📋 Needs Hotel",  cls: "bg-slate-700/60 border-slate-600/50 text-slate-400" },
                          "reserved":     { label: "🔖 Reserved",     cls: "bg-blue-900/30 border-blue-500/40 text-blue-300"  },
                          "checked-in":   { label: "🛏️ In Hotel",     cls: "bg-emerald-900/30 border-emerald-500/40 text-emerald-300" },
                          "checked-out":  { label: "🧳 Checked-Out",  cls: "bg-slate-700/60 border-slate-600/50 text-slate-400" },
                        }[crew.hotelStatus] ?? { label: "📋 Needs Hotel", cls: "bg-slate-700/60 border-slate-600/50 text-slate-400" };

                        const calcDuration = (): string => {
                          if (!crew.hotelCheckIn || !crew.hotelCheckOut) return "";
                          try {
                            const inMs  = new Date(`2000-01-01 ${crew.hotelCheckIn}`).getTime();
                            const outMs = new Date(`2000-01-01 ${crew.hotelCheckOut}`).getTime();
                            const diff  = outMs >= inMs ? outMs - inMs : (outMs + 86400000) - inMs;
                            const h = Math.round(diff / 3600000);
                            const nights = Math.floor(h / 24);
                            return nights > 0 ? `🌙 ${nights} Night${nights > 1 ? "s" : ""} / ${h}h` : `⏱ ${h}h`;
                          } catch { return ""; }
                        };

                        return (
                          <div
                            key={crew.id}
                            className="rounded-xl border border-slate-700 bg-slate-800 p-3 space-y-2.5 cursor-pointer hover:border-indigo-500/40 hover:bg-slate-700/50 transition-colors"
                            onClick={() => { setCrewPanelMode("edit"); setEditingCrewId(crew.id); setCrewSlideForm({ name: crew.name, rank: crew.rank, side: crew.side, nationality: crew.nationality, passportNo: crew.passportNo, flight: crew.flight, flightEta: crew.flightEta, flightDelayed: crew.flightDelayed, visaRequired: crew.visaRequired, eVisaStatus: crew.eVisaStatus, okToBoard: crew.okToBoard, requiresHotel: crew.requiresHotel, hotelName: crew.hotelName, hotelCheckIn: crew.hotelCheckIn, hotelCheckOut: crew.hotelCheckOut, hotelStatus: crew.hotelStatus, hotelPickupTime: crew.hotelPickupTime, dob: crew.dob, seamanBookNo: crew.seamanBookNo, birthPlace: crew.birthPlace }); setSlideFormTimeline(crew.timeline.map(s => ({ ...s }))); setShowCrewPanel(true); }}
                            data-testid={`hotel-card-${crew.id}`}
                          >
                            {/* Row 1: Name + status badge + delete */}
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-slate-100 truncate">{crew.name}</p>
                                <p className="text-[10px] text-slate-500">{crew.rank}</p>
                              </div>
                              <span className={`inline-flex items-center text-[9px] font-bold rounded-full border px-1.5 py-0.5 flex-shrink-0 ${statusCfg.cls}`}>
                                {statusCfg.label}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); setCrewSigners(cs => cs.map(c => c.id !== crew.id ? c : { ...c, requiresHotel: false, hotelName: "", hotelCheckIn: "", hotelCheckOut: "", hotelStatus: "none" as const, hotelPickupTime: "" })); }}
                                className="p-1 text-slate-400 hover:text-red-400 transition-colors flex-shrink-0"
                                data-testid={`button-delete-hotel-${crew.id}`}
                                title="Remove from hotel"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Row 2: Hotel name */}
                            {crew.hotelName && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs leading-none">🏨</span>
                                <span className="text-xs font-semibold text-indigo-300 truncate">{crew.hotelName}</span>
                              </div>
                            )}

                            {/* Row 3: Check-in / Check-out */}
                            {(crew.hotelCheckIn || crew.hotelCheckOut) && (
                              <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div className="rounded-lg bg-slate-700/50 px-2 py-1.5">
                                  <p className="text-slate-500 mb-0.5">Check-in</p>
                                  <p className="font-bold text-slate-200">{crew.hotelCheckIn || "—"}</p>
                                </div>
                                <div className="rounded-lg bg-slate-700/50 px-2 py-1.5">
                                  <p className="text-slate-500 mb-0.5">Check-out</p>
                                  <p className="font-bold text-slate-200">{crew.hotelCheckOut || "—"}</p>
                                </div>
                              </div>
                            )}

                            {/* Row 4: Duration + Pickup */}
                            <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/50 gap-2">
                              <span className="text-[10px] text-slate-500">{calcDuration()}</span>
                              {crew.hotelPickupTime && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold rounded-lg border border-red-500/40 bg-red-900/30 text-red-300 px-2 py-0.5 flex-shrink-0" data-testid={`hotel-pickup-${crew.id}`}>
                                  🚐 Pick-up: {crew.hotelPickupTime}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  </div>
                </div>
              )}

              {/* RIGHT: Service Boat & Deliveries (Husbandry — always visible) */}
              {voyage.purposeOfCall === "Husbandry" && (
              <div className="w-full sm:w-[310px] rounded-xl border border-slate-700 bg-slate-800/40 backdrop-blur-sm p-5 space-y-4" data-testid="husbandry-timeline">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-sky-400" />
                    </div>
                    <div>
                      <h2 className="font-bold text-sm text-slate-50">Service Boat &amp; Deliveries</h2>
                      <p className="text-xs text-slate-500">Logistics schedule</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-slate-400 hover:text-slate-200"
                    onClick={() => {
                      const maxId = Math.max(0, ...hubTimeline.map(s => s.id));
                      setHubTimeline(tl => [...tl, { id: maxId + 1, time: "00:00", emoji: "📋", title: "New Service Step", status: "upcoming" }]);
                    }}
                    data-testid="button-add-timeline-step"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </div>

                {/* Vertical Stepper */}
                <div className="space-y-0">
                  {hubTimeline.map((step, idx) => {
                    const isLast       = idx === hubTimeline.length - 1;
                    const isInProgress = step.status === "in_progress";
                    const isDone       = step.status === "done";
                    const isEditing    = editingTimelineId === step.id;
                    return (
                      <div key={step.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                            isDone       ? "bg-emerald-500/20 border-2 border-emerald-500/60" :
                            isInProgress ? "bg-amber-500/20 border-2 border-amber-500 animate-pulse" :
                                           "bg-slate-700/60 border-2 border-slate-600/40"
                          }`}>
                            {isDone
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              : <span className={`text-base ${isInProgress ? "text-amber-300" : "text-slate-500"}`}>{step.emoji}</span>
                            }
                          </div>
                          {!isLast && (
                            <div className={`w-0.5 flex-1 mt-1 mb-1 min-h-[20px] rounded-full ${isDone ? "bg-emerald-500/30" : isInProgress ? "bg-amber-500/20" : "bg-slate-700/40"}`} />
                          )}
                        </div>
                        <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-5"}`}>
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            {isEditing ? (
                              <input
                                type="text"
                                className="text-xs bg-slate-700 border border-amber-500/60 rounded px-2 py-0.5 w-16 text-slate-50 focus:outline-none tabular-nums"
                                value={timelineEditVal}
                                onChange={e => setTimelineEditVal(e.target.value)}
                                onBlur={() => { setHubTimeline(tl => tl.map(s => s.id === step.id ? { ...s, time: timelineEditVal } : s)); setEditingTimelineId(null); }}
                                onKeyDown={e => { if (e.key === "Enter") { setHubTimeline(tl => tl.map(s => s.id === step.id ? { ...s, time: timelineEditVal } : s)); setEditingTimelineId(null); } if (e.key === "Escape") setEditingTimelineId(null); }}
                                autoFocus
                              />
                            ) : (
                              <span className={`text-xs font-bold tabular-nums ${isInProgress ? "text-amber-300" : isDone ? "text-slate-500" : "text-slate-300"}`}>{step.time}</span>
                            )}
                            <button
                              className="p-0.5 text-slate-600 hover:text-amber-400 transition-colors"
                              onClick={() => { setEditingTimelineId(step.id); setTimelineEditVal(step.time); }}
                              data-testid={`button-edit-timeline-${step.id}`}
                              title="Edit time"
                            >
                              <Pen className="w-3 h-3" />
                            </button>
                            <button
                              className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full border transition-colors ${
                                isDone       ? "text-emerald-400 bg-emerald-900/30 border-emerald-700/40 hover:bg-emerald-900/50" :
                                isInProgress ? "text-amber-400 bg-amber-900/30 border-amber-700/40 hover:bg-amber-900/50" :
                                               "text-slate-500 bg-slate-700/40 border-slate-600/40 hover:bg-slate-700/60"
                              }`}
                              onClick={() => setHubTimeline(tl => tl.map(s => {
                                if (s.id !== step.id) return s;
                                const cycle: Record<string, string> = { upcoming: "in_progress", in_progress: "done", done: "upcoming" };
                                return { ...s, status: cycle[s.status] || "upcoming" };
                              }))}
                              data-testid={`button-cycle-status-${step.id}`}
                            >
                              {isDone ? "✓ Done" : isInProgress ? "● Active" : "○ Upcoming"}
                            </button>
                          </div>
                          <p className={`text-xs leading-relaxed ${isDone ? "text-slate-600" : isInProgress ? "text-slate-300 font-medium" : "text-slate-500"}`}>{step.title}</p>
                          {isInProgress && (
                            <div className="mt-1.5 inline-flex items-center gap-1.5 bg-amber-900/25 border border-amber-500/25 rounded-md px-2 py-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                              <span className="text-[10px] text-amber-300 font-semibold">In Progress</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              )}

              {/* ── DragOverlay: ghost card while dragging ── */}
              <DragOverlay dropAnimation={null}>
                {activeDragId !== null && (() => {
                  const dragging = crewSigners.find(c => c.id === activeDragId);
                  if (!dragging) return null;
                  return (
                    <div className="rounded-xl border border-blue-500/60 bg-slate-800 shadow-[0_0_20px_rgba(59,130,246,0.4)] p-3 flex items-center gap-2 w-[200px] opacity-90 cursor-grabbing">
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-[11px] font-bold text-blue-300 flex-shrink-0">
                        {dragging.name[0]}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-100">{dragging.name}</p>
                        <p className="text-[9px] text-slate-500">{dragging.rank} · ✈️ {dragging.flight || "—"}</p>
                      </div>
                    </div>
                  );
                })()}
              </DragOverlay>
            </div>
            </DndContext>
          )}

          {/* ── Quick Hotel Booking Dialog (after DnD drop onto hotel panel) ── */}
          <Dialog open={dragQuickBook !== null} onOpenChange={open => { if (!open) setDragQuickBook(null); }}>
            <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-sm" data-testid="dialog-quick-hotel-booking">
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <span>🏨</span>
                  <span>Assign Hotel — {dragQuickBook?.crewName}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Hotel Name</label>
                  <input
                    className="w-full h-8 text-sm bg-slate-800 border border-slate-600 rounded-md px-3 text-slate-100 outline-none focus:border-blue-500/70"
                    placeholder="e.g. Grand Hotel Istanbul"
                    value={dragQuickHotelForm.hotelName}
                    onChange={e => setDragQuickHotelForm(f => ({ ...f, hotelName: e.target.value }))}
                    data-testid="input-quickbook-hotel-name"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 mb-1 block">Check-In</label>
                    <input type="date" className="w-full h-8 text-sm bg-slate-800 border border-slate-600 rounded-md px-2 text-slate-100 outline-none focus:border-blue-500/70"
                      value={dragQuickHotelForm.checkIn}
                      onChange={e => setDragQuickHotelForm(f => ({ ...f, checkIn: e.target.value }))}
                      data-testid="input-quickbook-checkin" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 mb-1 block">Check-Out</label>
                    <input type="date" className="w-full h-8 text-sm bg-slate-800 border border-slate-600 rounded-md px-2 text-slate-100 outline-none focus:border-blue-500/70"
                      value={dragQuickHotelForm.checkOut}
                      onChange={e => setDragQuickHotelForm(f => ({ ...f, checkOut: e.target.value }))}
                      data-testid="input-quickbook-checkout" />
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" className="text-slate-400" onClick={() => setDragQuickBook(null)}>Cancel</Button>
                <Button className="bg-indigo-600 hover:bg-indigo-500 text-white" data-testid="button-quickbook-assign"
                  onClick={() => {
                    if (dragQuickBook) {
                      setCrewSigners(cs => cs.map(c => c.id !== dragQuickBook.crewId ? c : {
                        ...c,
                        requiresHotel: true,
                        hotelName: dragQuickHotelForm.hotelName,
                        hotelCheckIn: dragQuickHotelForm.checkIn,
                        hotelCheckOut: dragQuickHotelForm.checkOut,
                        hotelStatus: "reserved",
                      }));
                      addActivityLog(`Hotel "${dragQuickHotelForm.hotelName}" assigned to ${dragQuickBook.crewName} via drag & drop.`, "Agent");
                      toast({ title: "🏨 Hotel Assigned", description: `${dragQuickBook.crewName} → ${dragQuickHotelForm.hotelName}` });
                      setDragQuickBook(null);
                    }
                  }}
                >
                  Assign Hotel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ── Crew Member Slide-Over Panel ── */}
          <Dialog open={showCrewPanel} onOpenChange={setShowCrewPanel}>
            <DialogContent className="max-w-none w-screen h-screen m-0 rounded-none flex flex-col p-0 bg-slate-900 border-0" data-testid="crew-slide-panel">
              {/* Header */}
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-700/60 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${crewPanelMode === "add_on" ? "bg-emerald-500/15 border border-emerald-500/30" : crewPanelMode === "add_off" ? "bg-rose-500/15 border border-rose-500/30" : "bg-blue-500/15 border border-blue-500/30"}`}>
                    {crewPanelMode === "add_on" ? <LogIn className="w-4 h-4 text-emerald-400" /> : crewPanelMode === "add_off" ? <LogOut className="w-4 h-4 text-rose-400" /> : <UserPlus className="w-4 h-4 text-blue-400" />}
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-slate-50">
                      {crewPanelMode === "add_on" ? "Add On-Signer" : crewPanelMode === "add_off" ? "Add Off-Signer" : "Edit Crew Member"}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 mt-0.5">
                      {crewPanelMode === "add_on" ? "Joining the vessel at this port" : crewPanelMode === "add_off" ? "Leaving the vessel at this port" : "Update crew logistics information"}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto px-6 py-5 space-y-5">

                {/* Section 1: Identity */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">Identity</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-400">Full Name</Label>
                      <Input className="h-9 text-sm mt-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" placeholder="John Smith" value={crewSlideForm.name} onChange={e => setCrewSlideForm(f => ({ ...f, name: e.target.value }))} data-testid="input-crew-name" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Rank / Position</Label>
                      <select
                        className="w-full h-9 text-sm mt-1 bg-slate-800 border border-slate-700 rounded-md px-2 text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={crewSlideForm.rank}
                        onChange={e => setCrewSlideForm(f => ({ ...f, rank: e.target.value }))}
                        data-testid="select-crew-rank"
                      >
                        <option value="">— Select Rank —</option>
                        <optgroup label="Deck Officers">
                          <option>Master</option>
                          <option>Chief Officer</option>
                          <option>2nd Officer</option>
                          <option>3rd Officer</option>
                          <option>Deck Cadet</option>
                        </optgroup>
                        <optgroup label="Engine Officers">
                          <option>Chief Engineer</option>
                          <option>2nd Engineer</option>
                          <option>3rd Engineer</option>
                          <option>4th Engineer</option>
                          <option>Electrical Engineer / ETO</option>
                          <option>Engine Cadet</option>
                        </optgroup>
                        <optgroup label="Deck Ratings">
                          <option>Bosun</option>
                          <option>AB Sailor</option>
                          <option>OS (Ordinary Seaman)</option>
                          <option>Deck Fitter</option>
                        </optgroup>
                        <optgroup label="Engine Ratings">
                          <option>Oiler</option>
                          <option>Motorman</option>
                          <option>Wiper</option>
                          <option>Engine Fitter</option>
                          <option>Pumpman</option>
                        </optgroup>
                        <optgroup label="Catering">
                          <option>Chief Cook</option>
                          <option>Cook</option>
                          <option>Messman / Steward</option>
                        </optgroup>
                        <optgroup label="Other">
                          <option>Radio Officer</option>
                          <option>Doctor</option>
                          <option>Security Officer</option>
                          <option>Third Officer</option>
                          <option>Offr on Watch (OOW)</option>
                        </optgroup>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 2: Nationality & Passport */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">Nationality & Documents</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-400">Nationality (ISO-3)</Label>
                      <Input className="h-9 text-sm mt-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600 uppercase" placeholder="TUR" maxLength={3} value={crewSlideForm.nationality} onChange={e => setCrewSlideForm(f => ({ ...f, nationality: e.target.value.toUpperCase() }))} data-testid="input-crew-nationality" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Passport No.</Label>
                      <Input className="h-9 text-sm mt-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" placeholder="TR12345678" value={crewSlideForm.passportNo} onChange={e => setCrewSlideForm(f => ({ ...f, passportNo: e.target.value }))} data-testid="input-crew-passport" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Doğum Tarihi (DOB)</Label>
                      <Input type="date" className="h-9 text-sm mt-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" value={crewSlideForm.dob} onChange={e => setCrewSlideForm(f => ({ ...f, dob: e.target.value }))} data-testid="input-crew-dob" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">Cüzdan No (Seaman Book)</Label>
                      <Input className="h-9 text-sm mt-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" placeholder="T-123456" value={crewSlideForm.seamanBookNo} onChange={e => setCrewSlideForm(f => ({ ...f, seamanBookNo: e.target.value }))} data-testid="input-crew-seamanbook" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs text-slate-400">Doğum Yeri (Birth Place)</Label>
                      <Input className="h-9 text-sm mt-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" placeholder="İstanbul" value={crewSlideForm.birthPlace} onChange={e => setCrewSlideForm(f => ({ ...f, birthPlace: e.target.value }))} data-testid="input-crew-birthplace" />
                    </div>
                  </div>
                </div>

                {/* Section 3: Flight Details */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">Flight Details</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <Label className="text-xs text-slate-400">Flight No.</Label>
                      <Input className="h-9 text-sm mt-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" placeholder="TK2320" value={crewSlideForm.flight} onChange={e => setCrewSlideForm(f => ({ ...f, flight: e.target.value }))} data-testid="input-crew-flight" />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400">{crewPanelMode === "add_off" || crewSlideForm.side === "off" ? "ETD (Departure)" : "ETA (Arrival)"}</Label>
                      <Input className="h-9 text-sm mt-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" placeholder="14:30" value={crewSlideForm.flightEta} onChange={e => setCrewSlideForm(f => ({ ...f, flightEta: e.target.value }))} data-testid="input-crew-flighteta" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg bg-rose-900/10 border border-rose-500/20 hover:bg-rose-900/20 transition-colors">
                    <input type="checkbox" checked={crewSlideForm.flightDelayed} onChange={e => setCrewSlideForm(f => ({ ...f, flightDelayed: e.target.checked }))} className="accent-rose-500 w-4 h-4" data-testid="check-crew-delayed" />
                    <div>
                      <p className="text-xs font-medium text-rose-400">Flight Delayed</p>
                      <p className="text-[10px] text-rose-400/60">Mark if flight has been delayed</p>
                    </div>
                  </label>
                </div>

                {/* Section 3b: Transfer Timeline */}
                {(() => {
                  const isOff = crewSlideForm.side === "off";
                  const vesselEtdTime = voyage.etd ? new Date(voyage.etd).toTimeString().substring(0, 5) : "";
                  const fMins = timeToMins(crewSlideForm.flightEta);
                  const etdMins = timeToMins(vesselEtdTime);
                  const disembarkMins = timeToMins(slideFormTimeline.find(s => /disembark/i.test(s.label))?.time ?? "");
                  const rule1 = !isOff && fMins >= 0 && etdMins >= 0 && fMins > etdMins;
                  const rule2 = isOff && fMins >= 0 && disembarkMins >= 0 && (() => {
                    const gap = fMins >= disembarkMins ? fMins - disembarkMins : 1440 - disembarkMins + fMins;
                    return gap < 300;
                  })();
                  return (
                    <>
                      {/* Smart Rule Engine warnings */}
                      {rule1 && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-xs text-red-400" data-testid="warning-flight-after-etd">
                          <span className="text-sm leading-none mt-0.5">⚠️</span>
                          <div>
                            <p className="font-bold text-red-300">Critical: Flight arrives after Vessel ETD!</p>
                            <p className="text-red-400/70 text-[10px] mt-0.5">Flight ETA {crewSlideForm.flightEta} is after vessel ETD {vesselEtdTime}. Crew may miss the vessel.</p>
                          </div>
                        </div>
                      )}
                      {rule2 && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 text-xs text-amber-400" data-testid="warning-transfer-gap">
                          <span className="text-sm leading-none mt-0.5">⚠️</span>
                          <div>
                            <p className="font-bold text-amber-300">Warning: Insufficient transfer time!</p>
                            <p className="text-amber-400/70 text-[10px] mt-0.5">Minimum 5 hours required between disembarkation and departure flight.</p>
                          </div>
                        </div>
                      )}
                      {/* Transfer Timeline steps */}
                      {(() => {
                        const toDatetimeLocal = (val: string): string => {
                          if (!val) return "";
                          if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) return val.slice(0, 16);
                          if (/^\d{2}:\d{2}$/.test(val)) {
                            const today = new Date().toISOString().slice(0, 10);
                            return `${today}T${val}`;
                          }
                          return "";
                        };
                        const fromDatetimeLocal = (val: string): string => {
                          if (!val) return "";
                          return val.slice(11, 16);
                        };
                        const displayTimeline = (val: string): string => {
                          if (!val) return "—";
                          if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) return fmtDateTime(val);
                          return val;
                        };
                        return (
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">Transfer Timeline</p>
                            <div className="space-y-3">
                              {slideFormTimeline.map((step, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${step.done ? "bg-emerald-400" : "bg-slate-600"}`} />
                                  <span className="text-xs text-slate-300 flex-1 min-w-0 font-medium">{step.icon} {step.label}</span>
                                  <div className="flex flex-col items-end gap-0.5">
                                    <input
                                      type="datetime-local"
                                      className="h-8 text-xs px-2 rounded-md bg-slate-800 border border-slate-700 text-slate-100 [color-scheme:dark]"
                                      value={toDatetimeLocal(step.time)}
                                      onChange={e => {
                                        const raw = e.target.value;
                                        setSlideFormTimeline(prev => prev.map((s, i) => i === idx ? { ...s, time: fromDatetimeLocal(raw) } : s));
                                      }}
                                      data-testid={`input-timeline-step-${idx}`}
                                    />
                                    {step.time && (
                                      <span className="text-[9px] text-slate-500 font-mono">{displayTimeline(toDatetimeLocal(step.time))}</span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    title={step.done ? "Mark incomplete" : "Mark done"}
                                    className={`w-6 h-6 rounded-md border text-[10px] flex items-center justify-center flex-shrink-0 transition-colors ${step.done ? "bg-emerald-900/40 border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/20" : "bg-slate-800 border-slate-700 text-slate-600 hover:border-slate-500 hover:text-slate-400"}`}
                                    onClick={() => setSlideFormTimeline(prev => prev.map((s, i) => i === idx ? { ...s, done: !s.done } : s))}
                                    data-testid={`btn-timeline-done-${idx}`}
                                  >
                                    ✓
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}

                {/* Section 4: Visa & Clearance */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">Visa & Clearance</p>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-slate-400 mb-1.5 block">Visa Required?</Label>
                      <div className="flex gap-2">
                        <button onClick={() => setCrewSlideForm(f => ({ ...f, visaRequired: false }))} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${!crewSlideForm.visaRequired ? "bg-emerald-900/40 border-emerald-500/50 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600"}`} data-testid="btn-visa-no">No</button>
                        <button onClick={() => setCrewSlideForm(f => ({ ...f, visaRequired: true }))} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${crewSlideForm.visaRequired ? "bg-rose-900/40 border-rose-500/50 text-rose-400" : "bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600"}`} data-testid="btn-visa-yes">Yes — Required</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-slate-400">e-Visa Status</Label>
                        <select className="w-full h-9 text-sm mt-1 bg-slate-800 border border-slate-700 rounded-md px-2 text-slate-100" value={crewSlideForm.eVisaStatus} onChange={e => setCrewSlideForm(f => ({ ...f, eVisaStatus: e.target.value as any }))} data-testid="select-evisa-status">
                          <option value="n/a">N/A</option>
                          <option value="pending">⏳ Pending</option>
                          <option value="approved">✅ Approved</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 5: Documents */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">Documents</p>
                  <div className="space-y-2">
                    {([
                      { key: "passport" as const,    icon: "🛂", label: "Passport"      },
                      { key: "seamansBook" as const, icon: "📘", label: "Seaman's Book"  },
                      { key: "medicalCert" as const, icon: "🩺", label: "Medical Cert"   },
                    ] as { key: keyof CrewDocs; icon: string; label: string }[]).map(({ key, icon, label }) => {
                      const existingDoc = crewPanelMode === "edit" && editingCrewId !== null
                        ? crewSigners.find(c => c.id === editingCrewId)?.docs[key] ?? null
                        : null;
                      return (
                        <div key={key} className="flex items-center gap-2.5">
                          <span className="text-base leading-none flex-shrink-0">{icon}</span>
                          <span className="text-xs text-slate-400 w-24 flex-shrink-0">{label}</span>
                          {existingDoc ? (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-xs text-blue-300 truncate flex-1 min-w-0">{existingDoc.name}</span>
                              <button
                                className="text-[10px] text-slate-400 hover:text-blue-400 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded px-2 py-0.5 transition-colors flex-shrink-0"
                                onClick={() => { const a = document.createElement("a"); a.href = existingDoc.dataUrl; a.download = existingDoc.name; a.click(); }}
                                type="button"
                              >
                                ↓ View
                              </button>
                              <button
                                className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors flex-shrink-0"
                                title="Remove"
                                type="button"
                                onClick={() => {
                                  if (editingCrewId !== null) setCrewSigners(cs => cs.map(c => c.id !== editingCrewId ? c : { ...c, docs: { ...c.docs, [key]: null } }));
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <label className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-dashed border-slate-600 text-xs text-slate-500 cursor-pointer hover:border-slate-500 hover:text-slate-400 transition-colors">
                              <Upload className="w-3 h-3 flex-shrink-0" />
                              <span>Upload {label}</span>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (!file || editingCrewId === null) return;
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    setCrewSigners(cs => cs.map(c => c.id !== editingCrewId ? c : { ...c, docs: { ...c.docs, [key]: { name: file.name, dataUrl: reader.result as string } } }));
                                    addActivityLog(`${crewSigners.find(c => c.id === editingCrewId)?.name ?? "Crew"}: ${label} uploaded.`, "Agent");
                                    toast({ title: "Document Uploaded", description: `${label} saved.` });
                                  };
                                  reader.readAsDataURL(file);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {crewPanelMode !== "edit" && (
                    <p className="text-[10px] text-slate-600 mt-2 italic">Documents can be uploaded after saving the crew member.</p>
                  )}
                </div>

                {/* Section 6: Hotel & Accommodation */}
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-3">Hotel & Accommodation</p>
                  {/* Requires Hotel toggle */}
                  <div className="mb-3">
                    <Label className="text-xs text-slate-400 mb-1.5 block">Requires Hotel?</Label>
                    <div className="flex gap-2">
                      <button onClick={() => setCrewSlideForm(f => ({ ...f, requiresHotel: false }))} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${!crewSlideForm.requiresHotel ? "bg-slate-600/60 border-slate-500 text-slate-200" : "bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600"}`} data-testid="toggle-requires-hotel-no">No</button>
                      <button onClick={() => setCrewSlideForm(f => ({ ...f, requiresHotel: true }))} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${crewSlideForm.requiresHotel ? "bg-indigo-900/50 border-indigo-500/60 text-indigo-300" : "bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600"}`} data-testid="toggle-requires-hotel-yes">🏨 Yes — Hotel Required</button>
                    </div>
                  </div>

                  {crewSlideForm.requiresHotel && (
                    <div className="space-y-3 rounded-xl border border-indigo-500/20 bg-indigo-900/10 p-3">
                      {/* Hotel rule warning banner — shows if rule triggered and no hotel name yet */}
                      {(() => {
                        const vesselEtdTime = voyage?.etd ? new Date(voyage.etd).toTimeString().substring(0, 5) : "";
                        const vesselEtaTime = voyage?.eta ? new Date(voyage.eta).toTimeString().substring(0, 5) : "";
                        const fMins = timeToMins(crewSlideForm.flightEta);
                        const isOff = crewSlideForm.side === "off";
                        let hotelRuleMsg = "";
                        if (!isOff && vesselEtaTime) {
                          const etaMins = timeToMins(vesselEtaTime);
                          if (fMins >= 0 && etaMins >= 0 && etaMins - fMins > 360)
                            hotelRuleMsg = `>6h wait before Vessel ETA (${vesselEtaTime}).`;
                        }
                        if (isOff && vesselEtdTime) {
                          const etdMins = timeToMins(vesselEtdTime);
                          if (fMins >= 0 && etdMins >= 0) {
                            const waitMins = fMins >= etdMins ? fMins - etdMins : (1440 - etdMins) + fMins;
                            if (waitMins > 720)
                              hotelRuleMsg = `>12h wait after Vessel ETD (${vesselEtdTime}).`;
                          }
                        }
                        if (!hotelRuleMsg || crewSlideForm.hotelName) return null;
                        return (
                          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-xs text-amber-300" data-testid="warning-hotel-rule-slide">
                            <span className="text-sm leading-none mt-0.5 flex-shrink-0">⚠️</span>
                            <div>
                              <p className="font-bold text-amber-200">Hotel Required by Smart Rule</p>
                              <p className="text-[10px] text-amber-400/70 mt-0.5">{hotelRuleMsg} Please enter hotel details below.</p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Hotel name */}
                      <div>
                        <Label className="text-xs text-slate-400">Hotel Name</Label>
                        <Input className="h-9 text-sm mt-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" placeholder="e.g. Hilton Alsancak" value={crewSlideForm.hotelName} onChange={e => setCrewSlideForm(f => ({ ...f, hotelName: e.target.value }))} data-testid="input-hotel-name" />
                      </div>

                      {/* Check-in / Check-out */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-slate-400">Check-in</Label>
                          <Input className="h-9 text-sm mt-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" placeholder="HH:MM" value={crewSlideForm.hotelCheckIn} onChange={e => setCrewSlideForm(f => ({ ...f, hotelCheckIn: e.target.value }))} data-testid="input-hotel-checkin" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-400">Check-out</Label>
                          <Input className="h-9 text-sm mt-1 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600" placeholder="HH:MM" value={crewSlideForm.hotelCheckOut} onChange={e => setCrewSlideForm(f => ({ ...f, hotelCheckOut: e.target.value }))} data-testid="input-hotel-checkout" />
                        </div>
                      </div>

                      {/* Hotel Status */}
                      <div>
                        <Label className="text-xs text-slate-400">Hotel Status</Label>
                        <select className="w-full h-9 text-sm mt-1 bg-slate-800 border border-slate-700 rounded-md px-2 text-slate-100" value={crewSlideForm.hotelStatus} onChange={e => setCrewSlideForm(f => ({ ...f, hotelStatus: e.target.value as any }))} data-testid="select-hotel-status">
                          <option value="none">📋 Needs Hotel</option>
                          <option value="reserved">🔖 Reserved</option>
                          <option value="checked-in">🛏️ Checked-In</option>
                          <option value="checked-out">🧳 Checked-Out</option>
                        </select>
                      </div>

                      {/* Smart Pickup (auto-computed) */}
                      <div className="rounded-lg border border-red-500/25 bg-red-900/15 p-2.5 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold text-red-300 mb-0.5">🚐 Smart Pick-up Time</p>
                          <p className="text-[9px] text-red-400/60">Auto-set 4 hours before flight ETA</p>
                        </div>
                        <span className="text-sm font-bold text-red-300 font-mono flex-shrink-0" data-testid="text-hotel-pickup">
                          {crewSlideForm.hotelPickupTime || "—"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                </div>
              </div>

              {/* Sticky Footer */}
              <div className="px-6 py-4 border-t border-slate-700/60 flex-shrink-0 flex flex-row gap-2 max-w-2xl mx-auto w-full">
                <Button variant="outline" className="flex-1 border-slate-700 text-slate-400 hover:bg-slate-800" onClick={() => setShowCrewPanel(false)} data-testid="button-cancel-crew-panel">
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => {
                    if (!crewSlideForm.name.trim()) return;
                    if (crewPanelMode === "edit" && editingCrewId !== null) {
                      const existing = crewSigners.find(c => c.id === editingCrewId);
                      setCrewSigners(cs => cs.map(c => c.id !== editingCrewId ? c : { ...c, ...crewSlideForm, timeline: slideFormTimeline }));
                      if (existing && existing.flight !== crewSlideForm.flight && crewSlideForm.flight) {
                        const fromFlight = existing.flight || "(none)";
                        const toFlight   = crewSlideForm.flight;
                        addActivityLog(`Flight updated for ${crewSlideForm.name}: ${fromFlight} → ${toFlight}.`, "Agent", `${fromFlight} → ${toFlight}`);
                      } else if (existing) {
                        addActivityLog(`${crewSlideForm.name} crew details updated.`, "Agent");
                      }
                    } else {
                      const side = crewPanelMode === "add_off" ? "off" : "on";
                      setCrewSigners(cs => [...cs, { ...crewSlideForm, side, id: Date.now(), arrivalStatus: "pending", docs: EMPTY_CREW_DOCS, timeline: slideFormTimeline }]);
                      addActivityLog(`New ${side === "on" ? "On" : "Off"}-signer added: ${crewSlideForm.name}, ${crewSlideForm.rank || "N/A"}.`, "Agent");
                    }
                    setShowCrewPanel(false);
                    setCrewSlideForm(EMPTY_CREW_SLIDE_FORM);
                    setEditingCrewId(null);
                  }}
                  data-testid="button-confirm-add-crew"
                >
                  {crewPanelMode === "edit" ? "Save Changes" : "Add Crew Member"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {/* ── Standard Port Ops (non-crew tabs) ── */}
          {activeTab !== "crew-ops" && voyage.purposeOfCall !== "Husbandry" && voyage.purposeOfCall !== "Crew Change" && (<>
          {/* ── MAIN 3-COLUMN GRID (Overview only) ── */}
          {activeTab === "overview" && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT: Live Port Call Workflow (col-span-2) */}
            <div className="lg:col-span-2">
              <PortCallWorkflow
                voyageId={voyage.id}
                operationType={voyage.purposeOfCall || "Loading"}
                portName={voyage.portName || portData?.name || "Port"}
                userRole={user?.userRole || user?.activeRole || "agency"}
                completedSteps={workflowData?.steps || {}}
                onStepComplete={async (key, dt, notes) => {
                  await apiRequest("POST", `/api/v1/voyages/${voyage.id}/workflow-step`, { stepKey: key, completedAt: dt, notes });
                  refetchWorkflow();
                }}
                onStepEdit={async (key, dt, notes) => {
                  await apiRequest("POST", `/api/v1/voyages/${voyage.id}/workflow-step`, { stepKey: key, completedAt: dt, notes });
                  refetchWorkflow();
                }}
              />
            </div>

            {/* RIGHT: Supporting Modules (col-span-1) */}
            <div className="flex flex-col gap-6">
              {/* Voyage Team */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-sm flex items-center gap-2">
                    <Users2 className="w-4 h-4 text-sky-400" />
                    Voyage Team
                    <span className="text-xs text-muted-foreground">({participants.length + 1})</span>
                  </h3>
                  {(isOwner || isAgent) && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveTab("team")}>
                      <UserPlus className="w-3 h-3 mr-1" /> Invite
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {voyage && (
                    <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
                      <div className="w-5 h-5 rounded-full bg-amber-600 flex items-center justify-center text-[10px] font-bold text-white">
                        {voyage.ownerFirstName?.[0] ?? "O"}
                      </div>
                      <span className="text-xs font-medium">{`${voyage.ownerFirstName ?? ""} ${voyage.ownerLastName ?? ""}`.trim() || "Owner"}</span>
                      <span className="text-[10px] text-amber-400/70">Owner</span>
                    </div>
                  )}
                  {participants.slice(0, 5).map((p: any) => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-muted/40 rounded-full px-3 py-1 border border-border/50">
                      <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                        {p.firstName?.[0] ?? p.inviteeEmail?.[0] ?? "?"}
                      </div>
                      <span className="text-xs font-medium">{`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.email || "—"}</span>
                      <span className="text-[10px] text-muted-foreground capitalize">{p.role}</span>
                    </div>
                  ))}
                  {participants.length > 5 && (
                    <button onClick={() => setActiveTab("team")} className="text-xs text-sky-400 hover:underline">
                      +{participants.length - 5} more
                    </button>
                  )}
                  {participants.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No participants yet. Invite agents, providers or surveyors.</p>
                  )}
                </div>
              </Card>

              {/* Service Requests */}
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                    <h2 className="font-semibold text-sm">Service Requests</h2>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setShowServiceDialog(true)} data-testid="button-add-service-request">
                    <Plus className="w-3 h-3" /> Create Request
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {serviceReqs.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No service requests for this voyage.</p>
                  )}
                  {serviceReqs.map((req: any) => {
                    const cfg = SERVICE_TYPE_CONFIG[req.serviceType] || SERVICE_TYPE_CONFIG.other;
                    const TypeIcon = cfg.icon;
                    return (
                      <Link key={req.id} href={`/service-requests/${req.id}`}>
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer" data-testid={`service-req-${req.id}`}>
                          <TypeIcon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{cfg.label}</p>
                            <p className="text-xs text-muted-foreground truncate">{req.description}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] flex-shrink-0 capitalize">{req.status}</Badge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </Card>

              {/* NOR Card — only for cargo/bunkering voyages */}
              {features.hasNOR && (
              <Card className="p-5 space-y-3" data-testid="card-nor-status">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                    <h2 className="font-semibold text-sm">Notice of Readiness</h2>
                  </div>
                  {!activeNor ? (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" asChild>
                      <Link href={`/nor?voyageId=${voyageId}`}>
                        <Plus className="w-3 h-3" /> Create NOR
                      </Link>
                    </Button>
                  ) : (
                    <Link href={`/nor/${activeNor.id}`}>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">View NOR →</Button>
                    </Link>
                  )}
                </div>
                {!activeNor ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No Notice of Readiness created for this voyage yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Status</span>
                      <Badge className={
                        activeNor.status === "accepted" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                        activeNor.status === "tendered" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                        activeNor.status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      }>{activeNor.status}</Badge>
                    </div>
                    {activeNor.norTenderedAt && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Tendered</span>
                        <span>{fmtDateTime(activeNor.norTenderedAt)}</span>
                      </div>
                    )}
                    {activeNor.laytimeStartsAt && (
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-muted-foreground">Laytime Starts</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {fmtDateTime(activeNor.laytimeStartsAt)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </Card>
              )}
            </div>
          </div>
          )}

          {/* NOR Card — shown in sof tab */}
          {activeTab === "sof" && features.hasNOR && (
          <Card className="p-5 space-y-3" data-testid="card-nor-sof">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                <h2 className="font-semibold text-sm">Notice of Readiness</h2>
              </div>
              {!activeNor ? (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" asChild>
                  <Link href={`/nor?voyageId=${voyageId}`}>
                    <Plus className="w-3 h-3" /> Create NOR
                  </Link>
                </Button>
              ) : (
                <Link href={`/nor/${activeNor.id}`}>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">View NOR →</Button>
                </Link>
              )}
            </div>
            {!activeNor ? (
              <EmptyState icon={FileCheck} title="No Notice of Readiness" description="NOR records when the vessel is ready to load/discharge." compact testId="section-nor-empty-sof" />
            ) : (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className="capitalize">{activeNor.status}</Badge>
                </div>
                {activeNor.tenderedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tendered At</span>
                    <span>{fmtDateTime(activeNor.tenderedAt)}</span>
                  </div>
                )}
              </div>
            )}
          </Card>
          )}

          {/* SOF Card */}
          {activeTab === "sof" && features.hasSOF && (
          <Card className="p-5 space-y-3" data-testid="card-sof-status">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                <h2 className="font-semibold text-sm">Statement of Facts</h2>
              </div>
              {!activeSof ? (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" asChild>
                  <Link href={`/sof?voyageId=${voyageId}`}>
                    <Plus className="w-3 h-3" /> Create SOF
                  </Link>
                </Button>
              ) : (
                <Link href={`/sof/${activeSof.id}`}>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">View SOF →</Button>
                </Link>
              )}
            </div>
            {!activeSof ? (
                  <EmptyState
                    icon={ClipboardList}
                    title="No Statement of Facts"
                    description="SOF will record all port events chronologically."
                    compact
                    testId="section-sof-empty"
                  />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={
                    activeSof.status === "final" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                    activeSof.status === "draft" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }>{activeSof.status}</Badge>
                </div>
                {activeSof.vesselName && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Vessel</span>
                    <span>{activeSof.vesselName}</span>
                  </div>
                )}
              </div>
            )}
          </Card>
          )}

          {/* Liman Koşulları */}
          {(activeTab === "overview" || activeTab === "sof") && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Anchor className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              <h2 className="font-semibold text-sm">Port Conditions</h2>
              {portData?.name && <span className="ml-auto text-xs text-muted-foreground">{portData.name}</span>}
            </div>
            {!voyage?.portId ? (
              <Card className="p-4 flex items-center gap-2 text-muted-foreground text-sm">
                <Cloud className="w-4 h-4 opacity-40" /><span>Port information not found.</span>
              </Card>
            ) : !portData ? (
              <Card className="p-4"><div className="grid grid-cols-2 gap-2">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />)}</div></Card>
            ) : portData.latitude && portData.longitude ? (
              <div className="space-y-3">
                <EtaWeatherAlert lat={portData.latitude} lng={portData.longitude} eta={voyage.eta ?? null} />
                <WeatherPanel lat={portData.latitude} lng={portData.longitude} />
              </div>
            ) : (
              <Card className="p-4 flex items-center gap-2 text-muted-foreground text-sm">
                <Cloud className="w-4 h-4 opacity-40" /><span>No coordinates found for this port — weather cannot be displayed.</span>
              </Card>
            )}
          </div>
          )}

          {/* Port Call Randevuları */}
          {activeTab === "appointments" && (isOwner || isAgent) && (
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                  <h2 className="font-semibold text-sm">Port Call Appointments</h2>
                  {appointments.length > 0 && <span className="text-xs text-muted-foreground">({appointments.length})</span>}
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowApptForm(v => !v)} data-testid="button-add-appointment">
                  <Plus className="w-3.5 h-3.5 mr-1" />Add Appointment
                </Button>
              </div>

              {showApptForm && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-muted/30 rounded-lg">
                  <div>
                    <Select value={apptForm.appointmentType} onValueChange={v => setApptForm(f => ({ ...f, appointmentType: v }))}>
                      <SelectTrigger className="h-8 text-xs" data-testid="select-appt-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pilot">Pilot</SelectItem>
                        <SelectItem value="tugboat">Tugboat</SelectItem>
                        <SelectItem value="health">Health</SelectItem>
                        <SelectItem value="customs">Customs</SelectItem>
                        <SelectItem value="immigration">Immigration</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Input type="datetime-local" className="h-8 text-xs" value={apptForm.scheduledAt} onChange={e => setApptForm(f => ({ ...f, scheduledAt: e.target.value }))} data-testid="input-appt-scheduled" />
                  </div>
                  <div className="flex gap-1">
                    <Input className="h-8 text-xs flex-1" placeholder="Notes (optional)" value={apptForm.notes} onChange={e => setApptForm(f => ({ ...f, notes: e.target.value }))} data-testid="input-appt-notes" />
                    <Button size="sm" className="h-8 px-2" onClick={() => createApptMutation.mutate()} disabled={createApptMutation.isPending} data-testid="button-save-appointment">
                      {createApptMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>
              )}

              {appointments.length === 0 && !showApptForm && (
                <EmptyState
                  icon={Calendar}
                  title="No Appointments"
                  description="Schedule port service appointments — pilots, tugs, agents, surveyors."
                  action={{ label: "Add Appointment", onClick: () => setShowApptForm(true) }}
                  compact
                  testId="section-appointments-empty"
                />
              )}

              <div className="space-y-2">
                {appointments.map((appt: any) => {
                  const typeLabels: Record<string, { label: string; color: string }> = {
                    pilot: { label: "Pilot", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
                    tugboat: { label: "Tugboat", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
                    health: { label: "Health", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
                    customs: { label: "Customs", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
                    immigration: { label: "Immigration", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" },
                    other: { label: "Other", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
                  };
                  const statusLabels: Record<string, { label: string; color: string }> = {
                    pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
                    confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
                    completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
                    cancelled: { label: "Cancelled", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
                  };
                  const typeCfg = typeLabels[appt.appointmentType] || typeLabels.other;
                  const stCfg = statusLabels[appt.status] || statusLabels.pending;
                  return (
                    <div key={appt.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30" data-testid={`appt-row-${appt.id}`}>
                      <Badge className={`text-xs shrink-0 ${typeCfg.color}`}>{typeCfg.label}</Badge>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {appt.scheduledAt ? fmtDateTime(appt.scheduledAt) : "Date not set"}
                      </span>
                      {appt.notes && <span className="text-xs text-muted-foreground truncate flex-1">{appt.notes}</span>}
                      <div className="ml-auto flex items-center gap-1.5 shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" data-testid={`button-appt-status-${appt.id}`}>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${stCfg.color}`}>{stCfg.label}</span>
                              <ChevronDown className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs">
                            {Object.entries(statusLabels).map(([k, v]) => (
                              <DropdownMenuItem key={k} className="text-xs" onClick={() => updateApptMutation.mutate({ id: appt.id, status: k })}>
                                {v.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteApptMutation.mutate(appt.id)} data-testid={`button-delete-appt-${appt.id}`}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Değerlendirmeler */}
          {reviews.length > 0 && (
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <h2 className="font-semibold text-sm">Reviews</h2>
              </div>
              <div className="space-y-3">
                {reviews.map((r: any) => (
                  <div key={r.id} className="flex items-start gap-3 px-3 py-3 rounded-lg bg-muted/30" data-testid={`review-${r.id}`}>
                    <div className="w-8 h-8 rounded-full bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0 text-sm font-bold text-[hsl(var(--maritime-primary))]">
                      {(r.reviewerName || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{r.reviewerName || "User"}</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>
                      </div>
                      <div className="flex gap-0.5 mt-1">
                        {[1,2,3,4,5].map(i => <Star key={i} className={`w-3.5 h-3.5 ${i <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />)}
                      </div>
                      {r.comment && <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          </>)}
          </div>

          {/* Cargo Ops Content — only for cargo voyages */}
          {activeTab === "cargo" && features.hasCargoOps && (() => {
            // Variables for Operation Logs section
            const handledMt = cargoLogs.reduce((sum: number, l: any) => sum + (l.amountHandled || 0), 0);
            const totalLogged = cargoLogs.reduce((s: number, l: any) => {
              if (!l.fromTime || !l.toTime) return s;
              const hours = (new Date(l.toTime).getTime() - new Date(l.fromTime).getTime()) / 3_600_000;
              return s + hours;
            }, 0);
            const avgRate = totalLogged > 0 ? Math.round((handledMt / totalLogged) * 24) : 0;
            const BADGE_COLORS = [
              "bg-sky-500/15 text-sky-400 border-sky-500/25",
              "bg-violet-500/15 text-violet-400 border-violet-500/25",
              "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
              "bg-orange-500/15 text-orange-400 border-orange-500/25",
              "bg-rose-500/15 text-rose-400 border-rose-500/25",
            ];
            const receiverIndexMap: Record<number, number> = Object.fromEntries(receivers.map((r: any, i: number) => [r.id, i]));
            const batchMap = new Map<string, any[]>();
            cargoLogs.forEach((log: any) => {
              const key = log.batchId || String(log.id);
              if (!batchMap.has(key)) batchMap.set(key, []);
              batchMap.get(key)!.push(log);
            });
            const groupedLogs = Array.from(batchMap.values());

            // Parcel dashboard variables
            const PARCEL_COLORS = [
              { bar: "bg-sky-500", badge: "bg-sky-500/15 text-sky-400 border-sky-500/25" },
              { bar: "bg-violet-500", badge: "bg-violet-500/15 text-violet-400 border-violet-500/25" },
              { bar: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
              { bar: "bg-orange-500", badge: "bg-orange-500/15 text-orange-400 border-orange-500/25" },
              { bar: "bg-rose-500", badge: "bg-rose-500/15 text-rose-400 border-rose-500/25" },
              { bar: "bg-amber-500", badge: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
            ];
            const totalTargetMt = cargoParcelsData.reduce((s: number, p: any) => s + (p.targetQuantity || 0), 0);
            const totalHandledParcelMt = cargoParcelsData.reduce((s: number, p: any) => s + (p.handledQuantity || 0), 0);
            const overallPct = totalTargetMt > 0 ? Math.min(100, Math.round((totalHandledParcelMt / totalTargetMt) * 100)) : 0;
            const completedParcels = cargoParcelsData.filter((p: any) => p.status === "completed").length;
            const inProgressParcels = cargoParcelsData.filter((p: any) => p.status === "in_progress").length;

            return (
              <div className="space-y-5" data-testid="tab-content-cargo-ops">

                {/* ── Summary Header ─────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-card border border-border/60 rounded-lg p-3 flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Parcels</span>
                    <span className="text-2xl font-bold" data-testid="stat-total-parcels">{cargoParcelsData.length}</span>
                  </div>
                  <div className="bg-card border border-border/60 rounded-lg p-3 flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Target (MT)</span>
                    <span className="text-2xl font-bold text-sky-400" data-testid="stat-total-target">{totalTargetMt.toLocaleString()}</span>
                  </div>
                  <div className="bg-card border border-border/60 rounded-lg p-3 flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Handled (MT)</span>
                    <span className="text-2xl font-bold text-emerald-400" data-testid="stat-total-handled">{totalHandledParcelMt.toLocaleString()}</span>
                  </div>
                  <div className="bg-card border border-border/60 rounded-lg p-3 flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Progress</span>
                    <span className="text-2xl font-bold text-[hsl(var(--maritime-primary))]" data-testid="stat-progress-pct">{overallPct}%</span>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-[hsl(var(--maritime-primary))] rounded-full transition-all" style={{ width: `${overallPct}%` }} />
                    </div>
                  </div>
                  <div className="bg-card border border-border/60 rounded-lg p-3 flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</span>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-muted-foreground">Completed:</span>
                        <span className="font-semibold">{completedParcels}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-muted-foreground">In Progress:</span>
                        <span className="font-semibold">{inProgressParcels}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── 2-Column Layout ────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

                  {/* Left: Parcel List (3/5) */}
                  <div className="lg:col-span-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <Package className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                        Cargo Parcels
                        {cargoParcelsData.length > 0 && (
                          <span className="text-[10px] text-slate-500 bg-slate-800 rounded-full px-2 py-0.5">{cargoParcelsData.length}</span>
                        )}
                      </h3>
                      <Button size="sm" className="text-xs h-7 gap-1.5" onClick={() => {
                        setEditingParcel(null);
                        setParcelForm({ receiverName: "", cargoType: "", cargoDescription: "", targetQuantity: 0, handledQuantity: 0, unit: "MT", holdNumbers: "", blNumber: "", notes: "" });
                        setShowAddParcelDialog(true);
                      }} data-testid="button-add-parcel">
                        <Plus className="w-3 h-3" /> Add Parcel
                      </Button>
                    </div>

                    {cargoParcelsData.length === 0 ? (
                      <EmptyState
                        icon={Package}
                        title="No Cargo Parcels"
                        description="Add parcels to track cargo by receiver, hold, and B/L number."
                        action={{ label: "Add First Parcel", onClick: () => setShowAddParcelDialog(true) }}
                        compact
                        testId="section-parcels-empty"
                      />
                    ) : (
                      <div className="space-y-2">
                        {cargoParcelsData.map((parcel: any, idx: number) => {
                          const color = PARCEL_COLORS[idx % PARCEL_COLORS.length];
                          const pct = (parcel.targetQuantity ?? 0) > 0
                            ? Math.min(100, Math.round(((parcel.handledQuantity ?? 0) / parcel.targetQuantity) * 100))
                            : 0;
                          const statusColors: Record<string, string> = {
                            completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
                            in_progress: "bg-amber-500/15 text-amber-400 border-amber-500/25",
                            pending: "bg-slate-500/15 text-slate-400 border-slate-500/25",
                          };
                          const statusLabels: Record<string, string> = { completed: "Done", in_progress: "In Progress", pending: "Pending" };
                          return (
                            <Card key={parcel.id} className="p-4" data-testid={`card-parcel-${parcel.id}`}>
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`w-2 h-8 rounded-full ${color.bar} flex-shrink-0`} />
                                  <div className="min-w-0">
                                    <div className="font-semibold text-sm truncate" data-testid={`text-parcel-receiver-${parcel.id}`}>{parcel.receiverName}</div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      {[parcel.cargoType, parcel.holdNumbers && `Hold: ${parcel.holdNumbers}`, parcel.blNumber && `BL: ${parcel.blNumber}`].filter(Boolean).join(" · ")}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColors[parcel.status] ?? statusColors.pending}`} data-testid={`badge-parcel-status-${parcel.id}`}>
                                    {statusLabels[parcel.status] ?? parcel.status}
                                  </span>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      setEditingParcel(parcel);
                                      setParcelForm({
                                        receiverName: parcel.receiverName,
                                        cargoType: parcel.cargoType ?? "",
                                        cargoDescription: parcel.cargoDescription ?? "",
                                        targetQuantity: parcel.targetQuantity ?? 0,
                                        handledQuantity: parcel.handledQuantity ?? 0,
                                        unit: parcel.unit ?? "MT",
                                        holdNumbers: parcel.holdNumbers ?? "",
                                        blNumber: parcel.blNumber ?? "",
                                        notes: parcel.notes ?? "",
                                      });
                                      setShowAddParcelDialog(true);
                                    }}
                                    data-testid={`button-edit-parcel-${parcel.id}`}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                    onClick={() => deleteParcelMutation.mutate(parcel.id)}
                                    data-testid={`button-delete-parcel-${parcel.id}`}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>

                              {/* Progress Bar */}
                              <div className="mb-3">
                                <div className="flex items-center justify-between text-xs mb-1.5">
                                  <span className="text-muted-foreground">Progress</span>
                                  <span className="font-mono font-semibold">{(parcel.handledQuantity ?? 0).toLocaleString()} / {(parcel.targetQuantity ?? 0).toLocaleString()} {parcel.unit}</span>
                                </div>
                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                  <div className={`h-full ${color.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                </div>
                                <div className="text-right text-[10px] text-muted-foreground mt-0.5">{pct}%</div>
                              </div>

                              {/* Inline Handled Qty */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">Update handled:</span>
                                <input
                                  type="number"
                                  min="0"
                                  className="h-7 text-xs w-24 font-mono border border-border/60 bg-background rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                                  value={inlineHandled[parcel.id] ?? String(parcel.handledQuantity ?? 0)}
                                  onChange={e => setInlineHandled(prev => ({ ...prev, [parcel.id]: e.target.value }))}
                                  onBlur={() => {
                                    const raw = inlineHandled[parcel.id];
                                    if (raw === undefined) return;
                                    const val = parseFloat(raw);
                                    if (!isNaN(val) && val !== (parcel.handledQuantity ?? 0)) {
                                      const newStatus = (parcel.targetQuantity ?? 0) > 0 && val >= parcel.targetQuantity ? "completed" : val > 0 ? "in_progress" : "pending";
                                      updateParcelMutation.mutate({ id: parcel.id, handledQuantity: val, status: newStatus });
                                    }
                                  }}
                                  data-testid={`input-handled-${parcel.id}`}
                                />
                                <span className="text-xs text-muted-foreground">{parcel.unit}</span>
                                {parcel.notes && (
                                  <span className="text-xs text-muted-foreground italic truncate ml-auto max-w-[140px]" title={parcel.notes}>{parcel.notes}</span>
                                )}
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right: Stowage Plan (2/5) */}
                  <div className="lg:col-span-2 space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <FileImage className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                      Stowage Plan
                    </h3>
                    <Card className="p-4 space-y-4">
                      {/* File upload area */}
                      <div className="border-2 border-dashed border-border/60 rounded-lg p-5 text-center">
                        {stowagePlanData?.fileUrl ? (
                          <div className="space-y-2">
                            <div className="w-10 h-10 mx-auto bg-sky-500/15 rounded-lg flex items-center justify-center">
                              <FileImage className="w-5 h-5 text-sky-400" />
                            </div>
                            <div className="text-sm font-medium truncate" data-testid="text-stowage-filename">{stowagePlanData.fileName ?? "Stowage Plan"}</div>
                            <div className="flex items-center justify-center gap-2">
                              <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-sky-400 hover:text-sky-300"
                                onClick={() => window.open(stowagePlanData.fileUrl, "_blank")}
                                data-testid="button-view-stowage">
                                <Eye className="w-3 h-3" /> View
                              </Button>
                              <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-destructive"
                                onClick={() => updateStowagePlanMutation.mutate({ fileUrl: null, fileName: null })}
                                data-testid="button-remove-stowage">
                                <Trash2 className="w-3 h-3" /> Remove
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <label className="cursor-pointer block">
                            <div className="space-y-2">
                              <div className="w-10 h-10 mx-auto bg-muted rounded-lg flex items-center justify-center">
                                <Upload className="w-5 h-5 text-muted-foreground" />
                              </div>
                              <div className="text-sm font-medium text-muted-foreground">Upload Stowage Plan</div>
                              <div className="text-xs text-muted-foreground">PDF, PNG, JPG up to 10MB</div>
                            </div>
                            <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = async (ev) => {
                                  const b64 = (ev.target?.result as string).split(",")[1];
                                  try {
                                    const resp = await apiRequest("POST", "/api/upload", { fileBase64: b64, fileName: file.name, mimeType: file.type });
                                    const data = await resp.json();
                                    if (data.url) updateStowagePlanMutation.mutate({ fileUrl: data.url, fileName: file.name });
                                  } catch {
                                    toast({ title: "Upload failed", variant: "destructive" });
                                  }
                                };
                                reader.readAsDataURL(file);
                              }}
                              data-testid="input-stowage-upload" />
                          </label>
                        )}
                      </div>

                      {/* Hold Notes */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hold Notes</label>
                          {!stowageNotesEditing ? (
                            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
                              onClick={() => { setStowageNotes(stowagePlanData?.holdNotes ?? ""); setStowageNotesEditing(true); }}
                              data-testid="button-edit-hold-notes">
                              <Pencil className="w-3 h-3" /> Edit
                            </Button>
                          ) : (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-emerald-400 hover:text-emerald-300"
                                onClick={() => { updateStowagePlanMutation.mutate({ holdNotes: stowageNotes }); setStowageNotesEditing(false); }}
                                data-testid="button-save-hold-notes">
                                <Check className="w-3 h-3" /> Save
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground"
                                onClick={() => setStowageNotesEditing(false)}
                                data-testid="button-cancel-hold-notes">
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                        {stowageNotesEditing ? (
                          <Textarea
                            className="text-xs min-h-[100px] resize-none"
                            placeholder="Hold-by-hold stowage notes, weight distribution, special cargo instructions..."
                            value={stowageNotes}
                            onChange={e => setStowageNotes(e.target.value)}
                            data-testid="textarea-hold-notes"
                          />
                        ) : (
                          <div className="text-xs text-muted-foreground min-h-[60px] p-2 bg-muted/30 rounded-md border border-border/40 whitespace-pre-wrap" data-testid="text-hold-notes">
                            {stowagePlanData?.holdNotes || <span className="italic opacity-60">No hold notes. Click Edit to add.</span>}
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* Voyage Info Summary */}
                    <Card className="p-4 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Voyage Info</div>
                      {[
                        { label: "Vessel", value: (voyage as any)?.vessel?.name ?? voyage?.vesselName },
                        { label: "Port", value: (voyage as any)?.portName ?? voyage?.portOfLoading },
                        { label: "Operation", value: voyage?.purposeOfCall },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium truncate max-w-[140px]">{value ?? "—"}</span>
                        </div>
                      ))}
                    </Card>
                  </div>
                </div>


            {/* ── Operation Logs ───────────────────── */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm">Operation Logs</h3>
                  {groupedLogs.length > 0 && (
                    <span className="text-[10px] text-slate-500 bg-slate-800 rounded-full px-2 py-0.5">{cargoLogs.length} entries</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5 text-slate-400 hover:text-slate-200" onClick={() => window.print()} data-testid="button-export-logs-pdf">
                    <Download className="w-3 h-3" /> Export PDF
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5 text-slate-400 hover:text-slate-200" onClick={() => setShowCargoReportDialog(true)} data-testid="button-send-cargo-report">
                    <Mail className="w-3 h-3" /> Send Report
                  </Button>
                  <Button size="sm" className="text-xs h-7 gap-1.5" onClick={() => setShowAddLogDialog(true)} data-testid="button-add-cargo-log">
                    <Plus className="w-3 h-3" /> Add Log
                  </Button>
                </div>
              </div>

              {groupedLogs.length === 0 ? (
                <EmptyState
                  icon={ScrollText}
                  title="No Operation Logs"
                  description="Add timestamped logs to track cargo handling, weather delays, or operational events."
                  action={{ label: "Add First Log", onClick: () => setShowAddLogDialog(true) }}
                  compact
                  testId="section-logs-empty"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-xs text-muted-foreground">
                        <th className="text-left py-2 pr-4 font-semibold whitespace-nowrap">Period (From → To)</th>
                        <th className="text-left py-2 pr-4 font-semibold">Receiver</th>
                        <th className="text-right py-2 pr-4 font-semibold whitespace-nowrap">Handled (MT & Trucks)</th>
                        <th className="text-right py-2 pr-4 font-semibold whitespace-nowrap">Period Rate</th>
                        <th className="text-right py-2 pr-4 font-semibold whitespace-nowrap">Cumulative</th>
                        <th className="text-left py-2 pr-4 font-semibold">Remarks</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {groupedLogs.map((batch: any[], batchIdx: number) => {
                        const rep = batch[0];
                        const isDelay = rep.logType === "delay";
                        const isTruckWait = isDelay && (rep.remarks || "").toLowerCase().includes("waiting_for_trucks");
                        const fmtDT = (dt: string) => fmtDateTime(dt);
                        const fmtTime = (dt: string) => new Date(dt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                        const batchMt = batch.reduce((s: number, l: any) => s + (l.amountHandled || 0), 0);
                        const batchTrucks = batch.reduce((s: number, l: any) => s + (l.truckCount || 0), 0);
                        const logHours = rep.fromTime && rep.toTime
                          ? (new Date(rep.toTime).getTime() - new Date(rep.fromTime).getTime()) / 3_600_000
                          : 0;
                        const batchRate = logHours > 0 && batchMt > 0 ? parseFloat((batchMt / logHours).toFixed(1)) : null;
                        const prevBatch = batchIdx > 0 ? groupedLogs[batchIdx - 1] : null;
                        const prevMt = prevBatch ? prevBatch.reduce((s: number, l: any) => s + (l.amountHandled || 0), 0) : 0;
                        const prevHours = prevBatch?.[0]?.fromTime && prevBatch?.[0]?.toTime
                          ? (new Date(prevBatch[0].toTime).getTime() - new Date(prevBatch[0].fromTime).getTime()) / 3_600_000
                          : 0;
                        const prevRate = prevHours > 0 && prevMt > 0 ? parseFloat((prevMt / prevHours).toFixed(1)) : 0;
                        const rateTrend = batchRate && prevRate > 0
                          ? (batchRate > prevRate ? "up" : batchRate < prevRate ? "down" : "flat")
                          : null;
                        const periodLabel = rep.fromTime && rep.toTime
                          ? `${fmtDT(rep.fromTime)} → ${fmtTime(rep.toTime)}`
                          : rep.logDate
                          ? fmtDate(rep.logDate)
                          : "—";
                        const batchKey = rep.batchId || String(rep.id);

                        let rowBg = "hover:bg-muted/20";
                        if (isTruckWait) rowBg = "bg-amber-900/20 hover:bg-amber-900/30";
                        else if (isDelay) rowBg = "bg-red-900/20 hover:bg-red-900/30";

                        return (
                          <tr key={batchKey}
                            className={`transition-colors ${rowBg}`}
                            data-testid={`row-cargo-batch-${batchKey}`}>
                            <td className="py-2.5 pr-4 text-xs whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                {isTruckWait && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                                {isDelay && !isTruckWait && <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                                <span>{periodLabel}</span>
                              </div>
                            </td>
                            <td className="py-2.5 pr-4">
                              {isDelay ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {batch.filter((l: any) => l.receiverId).map((l: any) => {
                                    const rName = receivers.find((r: any) => r.id === l.receiverId)?.name;
                                    const rIdx = receiverIndexMap[l.receiverId] ?? 0;
                                    const bc = BADGE_COLORS[rIdx % BADGE_COLORS.length];
                                    return rName ? (
                                      <span key={l.id} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${bc}`}>
                                        {rName}
                                      </span>
                                    ) : null;
                                  })}
                                  {batch.every((l: any) => !l.receiverId) && (
                                    <span className="text-xs text-muted-foreground">General</span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="text-right py-2.5 pr-4 font-mono font-semibold whitespace-nowrap">
                              {isDelay ? (
                                <span className={`text-xs font-semibold ${isTruckWait ? "text-amber-400" : "text-red-400"}`}>
                                  {rep.remarks?.replace("waiting_for_trucks", "Waiting for Trucks") || "Stoppage"}
                                </span>
                              ) : (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="text-green-400">{batchMt.toLocaleString()} MT</span>
                                  {batchTrucks > 0 && (
                                    <span className="text-[10px] text-muted-foreground font-normal">({batchTrucks} Trucks)</span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="text-right py-2.5 pr-4 font-mono text-xs whitespace-nowrap">
                              {batchRate && !isDelay ? (
                                <span className={`flex items-center justify-end gap-1 ${rateTrend === "up" ? "text-green-400" : rateTrend === "down" ? "text-red-400" : "text-sky-300"}`}>
                                  {rateTrend === "up" && <TrendingUp className="w-3 h-3" />}
                                  {rateTrend === "down" && <TrendingDown className="w-3 h-3" />}
                                  {batchRate.toLocaleString()} MT/H
                                </span>
                              ) : "—"}
                            </td>
                            <td className="text-right py-2.5 pr-4 font-mono text-muted-foreground text-xs">
                              {rep.cumulativeTotal ? rep.cumulativeTotal.toLocaleString() : "—"}
                            </td>
                            <td className="py-2.5 pr-4 text-muted-foreground text-xs max-w-[140px] truncate">
                              {isDelay ? "" : (rep.remarks || "—")}
                            </td>
                            <td className="py-2.5 text-right">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => rep.batchId
                                  ? deleteBatchMutation.mutate(rep.batchId)
                                  : deleteCargoLogMutation.mutate(rep.id)}
                                data-testid={`button-delete-batch-${batchKey}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* ── Add / Edit Parcel Dialog ─────────── */}
            <Dialog open={showAddParcelDialog} onOpenChange={v => { setShowAddParcelDialog(v); if (!v) setEditingParcel(null); }}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingParcel ? "Edit Parcel" : "Add Cargo Parcel"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Receiver Name *</label>
                      <input className="w-full h-8 text-sm border border-border/60 bg-background rounded-md px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                        value={parcelForm.receiverName} onChange={e => setParcelForm(p => ({ ...p, receiverName: e.target.value }))}
                        placeholder="e.g. GLENCORE AG" data-testid="input-parcel-receiver" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Cargo Type</label>
                      <input className="w-full h-8 text-sm border border-border/60 bg-background rounded-md px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                        value={parcelForm.cargoType} onChange={e => setParcelForm(p => ({ ...p, cargoType: e.target.value }))}
                        placeholder="e.g. GRAIN" data-testid="input-parcel-cargo-type" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Unit</label>
                      <select className="w-full h-8 text-sm border border-border/60 bg-background rounded-md px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                        value={parcelForm.unit} onChange={e => setParcelForm(p => ({ ...p, unit: e.target.value }))}
                        data-testid="select-parcel-unit">
                        <option value="MT">MT</option>
                        <option value="CBM">CBM</option>
                        <option value="UNIT">UNIT</option>
                        <option value="BAG">BAG</option>
                        <option value="BALE">BALE</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Target Quantity</label>
                      <input type="number" min="0" className="w-full h-8 text-sm border border-border/60 bg-background rounded-md px-3 font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                        value={parcelForm.targetQuantity} onChange={e => setParcelForm(p => ({ ...p, targetQuantity: parseFloat(e.target.value) || 0 }))}
                        data-testid="input-parcel-target" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Handled Quantity</label>
                      <input type="number" min="0" className="w-full h-8 text-sm border border-border/60 bg-background rounded-md px-3 font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                        value={parcelForm.handledQuantity} onChange={e => setParcelForm(p => ({ ...p, handledQuantity: parseFloat(e.target.value) || 0 }))}
                        data-testid="input-parcel-handled" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Hold Numbers</label>
                      <input className="w-full h-8 text-sm border border-border/60 bg-background rounded-md px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                        value={parcelForm.holdNumbers} onChange={e => setParcelForm(p => ({ ...p, holdNumbers: e.target.value }))}
                        placeholder="e.g. 1, 2, 3" data-testid="input-parcel-holds" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">B/L Number</label>
                      <input className="w-full h-8 text-sm border border-border/60 bg-background rounded-md px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                        value={parcelForm.blNumber} onChange={e => setParcelForm(p => ({ ...p, blNumber: e.target.value }))}
                        placeholder="e.g. BL-2024-001" data-testid="input-parcel-bl" />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Notes</label>
                      <Textarea className="text-xs min-h-[60px] resize-none"
                        value={parcelForm.notes} onChange={e => setParcelForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Special instructions, remarks..." data-testid="textarea-parcel-notes" />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setShowAddParcelDialog(false); setEditingParcel(null); }}>Cancel</Button>
                  <Button
                    disabled={!parcelForm.receiverName.trim() || addParcelMutation.isPending || updateParcelMutation.isPending}
                    onClick={() => {
                      if (!parcelForm.receiverName.trim()) return;
                      const payload = { ...parcelForm };
                      if (editingParcel) {
                        updateParcelMutation.mutate({ id: editingParcel.id, ...payload });
                      } else {
                        addParcelMutation.mutate(payload);
                      }
                    }}
                    data-testid="button-save-parcel">
                    {(addParcelMutation.isPending || updateParcelMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : editingParcel ? "Save Changes" : "Add Parcel"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* ── Add Operation Log Dialog ─────────── */}
            {(() => {
              const periodHours = logForm.fromTime && logForm.toTime
                ? (new Date(logForm.toTime).getTime() - new Date(logForm.fromTime).getTime()) / 3_600_000
                : 0;
              const totalEntryMt = Object.values(logForm.receiverEntries).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
              const modalRate = periodHours > 0 && totalEntryMt > 0
                ? parseFloat((totalEntryMt / periodHours).toFixed(1))
                : 0;
              const canSubmit = !!logForm.fromTime && !!logForm.toTime &&
                (logForm.logType === "operation"
                  ? totalEntryMt > 0
                  : !!logForm.delayReason);

              return (
                <Dialog open={showAddLogDialog} onOpenChange={v => {
                  setShowAddLogDialog(v);
                  if (!v) setLogForm({ fromTime: "", toTime: "", logType: "operation", remarks: "", delayReason: "", delayNotes: "", receiverEntries: {} });
                }}>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Add Operation Log</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">

                      {/* Log Type */}
                      <div>
                        <Label className="text-xs">Log Type</Label>
                        <Select value={logForm.logType} onValueChange={v => setLogForm(f => ({ ...f, logType: v }))}>
                          <SelectTrigger className="h-9 text-xs" data-testid="select-log-type"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="operation">Operation (Cargo Handling)</SelectItem>
                            <SelectItem value="delay">Delay / Stoppage</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* From / To */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">From *</Label>
                          <Input type="datetime-local" value={logForm.fromTime}
                            onChange={e => setLogForm(f => ({ ...f, fromTime: e.target.value }))}
                            className="text-xs h-9" data-testid="input-log-from-time" />
                        </div>
                        <div>
                          <Label className="text-xs">To *</Label>
                          <Input type="datetime-local" value={logForm.toTime}
                            onChange={e => setLogForm(f => ({ ...f, toTime: e.target.value }))}
                            className="text-xs h-9" data-testid="input-log-to-time" />
                        </div>
                      </div>

                      {/* ── OPERATION MODE: multi-receiver grid ─────────── */}
                      {logForm.logType === "operation" && (
                        <div className="space-y-2">
                          <Label className="text-xs">Cargo Delivered by Receiver</Label>
                          {receivers.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic py-2">No receivers configured — add cargo parcels first.</p>
                          ) : (
                            <div className="rounded-lg border border-border/60 divide-y divide-border/40 overflow-hidden">
                              {/* Header row */}
                              <div className="grid grid-cols-[1fr_120px_100px] gap-2 px-3 py-1.5 bg-muted/30 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                                <span>Receiver</span>
                                <span className="text-right">Amount (MT)</span>
                                <span className="text-right">Trucks #</span>
                              </div>
                              {receivers.map((r: any, rIdx: number) => {
                                const entry = logForm.receiverEntries[r.id] || { amount: "", trucks: "" };
                                const truckNum = parseInt(entry.trucks) || 0;
                                const truckEst = truckNum > 0 ? truckNum * 24 : 0;
                                const rColor = BADGE_COLORS[rIdx % BADGE_COLORS.length];
                                return (
                                  <div key={r.id} className="grid grid-cols-[1fr_120px_100px] gap-2 px-3 py-2 items-start">
                                    <div className="pt-1.5">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${rColor}`}>
                                        {r.name}
                                      </span>
                                      <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                                        Alloc: {r.allocatedMt.toLocaleString()} MT
                                      </div>
                                    </div>
                                    <div>
                                      <Input
                                        type="number" min={0} placeholder="0"
                                        value={entry.amount}
                                        onChange={e => setLogForm(f => ({
                                          ...f,
                                          receiverEntries: { ...f.receiverEntries, [r.id]: { ...entry, amount: e.target.value } }
                                        }))}
                                        className="h-8 text-xs text-right"
                                        data-testid={`input-receiver-amount-${r.id}`}
                                      />
                                    </div>
                                    <div>
                                      <Input
                                        type="number" min={0} placeholder="—"
                                        value={entry.trucks}
                                        onChange={e => setLogForm(f => ({
                                          ...f,
                                          receiverEntries: { ...f.receiverEntries, [r.id]: { ...entry, trucks: e.target.value } }
                                        }))}
                                        className="h-8 text-xs text-right"
                                        data-testid={`input-receiver-trucks-${r.id}`}
                                      />
                                      {truckEst > 0 && (
                                        <p className="text-[10px] text-muted-foreground/60 text-right mt-0.5">Est: ~{truckEst} MT</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {modalRate > 0 && (
                            <p className="text-xs text-amber-400 font-medium">
                              ✨ Period rate: {modalRate.toLocaleString()} MT/H ({totalEntryMt.toLocaleString()} MT total)
                            </p>
                          )}
                        </div>
                      )}

                      {/* ── DELAY MODE: reason dropdown + notes ─────────── */}
                      {logForm.logType === "delay" && (
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">Delay Reason *</Label>
                            <Select value={logForm.delayReason} onValueChange={v => setLogForm(f => ({ ...f, delayReason: v }))}>
                              <SelectTrigger
                                className={`h-9 text-xs ${logForm.delayReason === "waiting_for_trucks" ? "border-amber-500/60 ring-1 ring-amber-500/30" : ""}`}
                                data-testid="select-delay-reason"
                              >
                                <SelectValue placeholder="Select reason..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="waiting_for_trucks">
                                  ⚠ Waiting for Trucks / Tankers
                                </SelectItem>
                                <SelectItem value="Rain / Weather">Rain / Weather</SelectItem>
                                <SelectItem value="Equipment Breakdown">Equipment Breakdown</SelectItem>
                                <SelectItem value="Shift Change">Shift Change</SelectItem>
                                <SelectItem value="Customs / Inspection">Customs / Inspection</SelectItem>
                                <SelectItem value="Hatch Shifting">Hatch Shifting</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            {logForm.delayReason === "waiting_for_trucks" && (
                              <p className="text-[11px] text-amber-400 mt-1.5 font-medium">
                                ⚠ This stoppage will be highlighted in the log table.
                              </p>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs">Additional Notes (optional)</Label>
                            <Textarea
                              value={logForm.delayNotes}
                              onChange={e => setLogForm(f => ({ ...f, delayNotes: e.target.value }))}
                              placeholder="e.g. 15 trucks pending at gate..." rows={2}
                              data-testid="input-delay-notes"
                            />
                          </div>
                        </div>
                      )}

                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAddLogDialog(false)}>Cancel</Button>
                      <Button
                        onClick={() => addCargoLogMutation.mutate()}
                        disabled={!canSubmit || addCargoLogMutation.isPending}
                        data-testid="button-save-cargo-log"
                      >
                        {addCargoLogMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Save Log
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              );
            })()}

            {/* ── Send Cargo Report Dialog ─────────── */}
            {(() => {
              const autoContacts = voyageContactsList.filter((c: any) =>
                ["owner", "charterer", "receiver"].includes(c.role) && c.includeInDailyReports
              );
              const manualEmailValid = reportManualEmail.includes("@");
              const finalEmails = [
                ...reportSelectedEmails,
                ...(manualEmailValid ? [reportManualEmail.trim().toLowerCase()] : []),
              ].filter((e, i, arr) => arr.indexOf(e) === i);

              return (
                <Dialog open={showCargoReportDialog} onOpenChange={open => {
                  setShowCargoReportDialog(open);
                  if (open) {
                    setReportSelectedEmails(autoContacts.map((c: any) => c.email));
                    setReportManualEmail("");
                  }
                }}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Mail className="w-4 h-4" /> Send Cargo Report
                      </DialogTitle>
                      <DialogDescription>
                        A live cargo operations summary will be emailed to selected recipients.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-1">
                      {/* Auto-suggested recipients */}
                      {autoContacts.length > 0 ? (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Recipients from Contacts (Owner / Charterer / Receiver):</p>
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {autoContacts.map((c: any) => {
                              const ROLE_LABEL: Record<string, string> = { owner: "Owner", charterer: "Charterer", receiver: "Receiver" };
                              const isChecked = reportSelectedEmails.includes(c.email);
                              return (
                                <label key={c.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${isChecked ? "border-sky-500/50 bg-sky-500/5" : "border-muted bg-muted/20"}`} data-testid={`label-recipient-${c.id}`}>
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={checked => {
                                      setReportSelectedEmails(prev =>
                                        checked ? [...prev, c.email] : prev.filter(e => e !== c.email)
                                      );
                                    }}
                                    data-testid={`checkbox-recipient-${c.id}`}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{c.email}</p>
                                    {c.name && <p className="text-xs text-muted-foreground truncate">{c.name}</p>}
                                  </div>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground border shrink-0">
                                    {ROLE_LABEL[c.role] ?? c.role}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-xs">
                          <Mail className="w-5 h-5 mx-auto mb-1.5 opacity-30" />
                          No Owner / Charterer / Receiver contacts with Daily Reports enabled.{" "}
                          <button className="text-sky-400 underline underline-offset-2" onClick={() => { setShowCargoReportDialog(false); setActiveTab("team"); }}>
                            Go to Contacts
                          </button>
                        </div>
                      )}

                      {/* Manual email addition */}
                      <div>
                        <Label className="text-xs">Add Another Recipient (optional)</Label>
                        <Input
                          type="email"
                          value={reportManualEmail}
                          onChange={e => setReportManualEmail(e.target.value)}
                          placeholder="additional@example.com"
                          className="mt-1"
                          data-testid="input-report-email"
                        />
                      </div>

                      {/* Summary */}
                      {finalEmails.length > 0 && (
                        <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-3 text-xs text-sky-300">
                          <p className="font-semibold mb-1">Report will be sent to {finalEmails.length} address{finalEmails.length > 1 ? "es" : ""}:</p>
                          <ul className="list-disc list-inside space-y-0.5 text-sky-400/80">
                            {finalEmails.map(e => <li key={e}>{e}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCargoReportDialog(false)}>Cancel</Button>
                      <Button
                        onClick={() => sendCargoReportMutation.mutate(finalEmails)}
                        disabled={finalEmails.length === 0 || sendCargoReportMutation.isPending}
                        data-testid="button-confirm-send-report"
                      >
                        {sendCargoReportMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Send to {finalEmails.length} Recipient{finalEmails.length !== 1 ? "s" : ""}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              );
            })()}

            {/* ── Add Receiver Dialog ───────────────── */}
            <Dialog open={showAddReceiverDialog} onOpenChange={v => { setShowAddReceiverDialog(v); if (!v) setReceiverForm({ name: "", allocatedMt: 0 }); }}>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>Add Cargo Receiver</DialogTitle></DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label className="text-xs">Receiver / Parcel Name *</Label>
                    <Input placeholder="e.g. IFFCO" value={receiverForm.name}
                      onChange={e => setReceiverForm(f => ({ ...f, name: e.target.value }))}
                      data-testid="input-receiver-name" />
                  </div>
                  <div>
                    <Label className="text-xs">Allocated MT *</Label>
                    <Input type="number" min={0} placeholder="e.g. 30000"
                      value={receiverForm.allocatedMt || ""}
                      onChange={e => setReceiverForm(f => ({ ...f, allocatedMt: parseFloat(e.target.value) || 0 }))}
                      data-testid="input-receiver-allocated-mt" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddReceiverDialog(false)}>Cancel</Button>
                  <Button
                    onClick={() => addReceiverMutation.mutate()}
                    disabled={!receiverForm.name || !receiverForm.allocatedMt || addReceiverMutation.isPending}
                    data-testid="button-save-receiver"
                  >
                    {addReceiverMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Add Receiver
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        );
          })()}
        </div>
      )}

      {/* ── DOCUMENTS TAB ───────────────────────────────────────── */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          {/* Documents Content */}
          <div className="space-y-6">
            <VoyageVaultSection vesselId={voyage.vesselId} />

          {/* ── Existing Document Management ── */}
          <Card
            className={`p-5 space-y-4 relative transition-all duration-150 ${isPanelDragOver ? "ring-2 ring-[hsl(var(--maritime-primary))] bg-[hsl(var(--maritime-primary)/0.03)]" : ""}`}
            onDragOver={e => { e.preventDefault(); setIsPanelDragOver(true); }}
            onDragEnter={e => { e.preventDefault(); setIsPanelDragOver(true); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsPanelDragOver(false); }}
            onDrop={handlePanelDrop}
            data-testid="panel-documents"
          >
            {isPanelDragOver && (
              <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-[hsl(var(--maritime-primary)/0.08)] border-2 border-dashed border-[hsl(var(--maritime-primary))] z-10 pointer-events-none">
                <div className="text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-[hsl(var(--maritime-primary))]" />
                  <p className="text-sm font-semibold text-[hsl(var(--maritime-primary))]">Drop file here</p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                <h2 className="font-semibold text-sm">Documents</h2>
                {Array.isArray(docs) && docs.length > 0 && <span className="text-xs text-muted-foreground">({docs.length})</span>}
              </div>
              <div className="flex items-center gap-1.5">
                {Array.isArray(docs) && docs.length > 0 && (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={handleDownloadAllZip} data-testid="button-download-all-zip">
                    <Archive className="w-3 h-3" /> Download All
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setShowTemplateDialog(true)} data-testid="button-from-template">
                  <LayoutTemplate className="w-3 h-3" /> From Template
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setShowDocDialog(true)} data-testid="button-upload-doc">
                  <Upload className="w-3 h-3" /> Upload
                </Button>
              </div>
            </div>

            {/* Filtre butonları */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: "all",           label: "All" },
                { key: "manifest",      label: "Manifest" },
                { key: "bill_of_lading",label: "Bill of Lading" },
                { key: "certificate",   label: "Certificate" },
                { key: "port_clearance",label: "Port Clearance" },
                { key: "other",         label: "Other" },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setDocFilter(f.key)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    docFilter === f.key ? "bg-[hsl(var(--maritime-primary))] text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  data-testid={`filter-doc-${f.key}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {docsLoading ? (
              <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : (() => {
              const filtered = Array.isArray(docs) ? (docFilter === "all" ? docs : docs.filter((d: any) => d.docType === docFilter)) : [];
              return filtered.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title="No Documents"
                  description="Upload port documents, B/Ls, survey reports, or any voyage-related files."
                  action={{ label: "Upload File", onClick: () => fileInputRef.current?.click(), variant: "outline" }}
                  compact
                  testId="section-docs-empty"
                />
              ) : (
                <div className="space-y-2">
                  {filtered.map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 group" data-testid={`doc-${doc.id}`}>
                      <FileText className="w-4 h-4 flex-shrink-0 text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium truncate">{doc.name}</p>
                          {doc.version > 1 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium flex-shrink-0" data-testid={`badge-doc-version-${doc.id}`}>v{doc.version}</span>
                          )}
                          {doc.templateId && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 font-medium flex-shrink-0">📋 Auto</span>
                          )}
                          {doc.signedAt ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium flex items-center gap-0.5 flex-shrink-0" data-testid={`badge-signed-${doc.id}`}>
                              <BadgeCheck className="w-3 h-3" /> {doc.signatureText}
                            </span>
                          ) : (
                            <button
                              onClick={() => { setSignDocId(doc.id); setShowSignDialog(true); }}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center gap-0.5 flex-shrink-0"
                              data-testid={`button-sign-doc-${doc.id}`}
                            >
                              <Pen className="w-3 h-3" /> Sign
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{DOC_TYPE_CONFIG[doc.docType] || "Other"} · {doc.uploaderName} · {fmtDate(doc.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => downloadDoc(doc)} className="p-1 hover:text-primary transition-colors" data-testid={`button-download-doc-${doc.id}`}><Download className="w-4 h-4" /></button>
                        <button onClick={() => deleteDocMutation.mutate(doc.id)} className="p-1 hover:text-destructive transition-colors" data-testid={`button-delete-doc-${doc.id}`}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>

          {/* ── Port Formalities Auto-Generator ── */}
          {(() => {
        const PORT_TEMPLATES = [
          { id: "police_arrival",    emoji: "🛂", tr: "Emniyet Deniz Limani — GELIS",            en: "Maritime Police — Arrival" },
          { id: "police_departure",  emoji: "🛂", tr: "Emniyet Deniz Limani — GIDIS",            en: "Maritime Police — Departure" },
          { id: "passport_arrival",  emoji: "🪪", tr: "Denizlimani Sube Mdr. — GIRIS",           en: "Port Immigration — Passport Arrival" },
          { id: "tcdd_berth",        emoji: "⚓", tr: "TCDD Izmir — Yanasma Mektubu",            en: "TCDD Berthing Letter" },
          { id: "tcdd_depart",       emoji: "🚢", tr: "TCDD Izmir — Kalkis Mektubu",             en: "TCDD Departure Letter" },
          { id: "kiyi_emniyeti",     emoji: "🛟", tr: "Kiyi Emniyeti — Yanasma/Kalkma Talep",   en: "Coastguard Pilotage/Towage Request" },
          { id: "arrival_decl",      emoji: "📋", tr: "Gelis Bildirim Tutanagi",                 en: "Arrival Declaration (Immigration)" },
          { id: "shore_pass_notif",  emoji: "📝", tr: "Teblig ve Tebellug Belgesi",              en: "Shore Pass Notification Document" },
          { id: "departure_decl",    emoji: "📋", tr: "Gidis Bildirim Tutanagi",                 en: "Departure Declaration (Immigration)" },
          { id: "power_of_attorney", emoji: "🔏", tr: "Hususi Vekaletname",                      en: "Private Power of Attorney" },
          { id: "tcdd_m10",          emoji: "📦", tr: "TCDD M.10 — Yukleme/Bosaltma Talepnamesi",en: "TCDD Cargo Operations Request (M.10)" },
          { id: "tcdd_watch_table",  emoji: "👷", tr: "TCDD Amele Postasi Talep Tablosu",        en: "TCDD Watch/Labour Request Table" },
          { id: "port_arrival",      emoji: "🏛️", tr: "Gemi Gelis Bildirimi — Liman Baskanligi", en: "Vessel Arrival Report — Port Authority" },
          { id: "shore_pass",        emoji: "🆔", tr: "Liman Sehri Gezer Belgesi (Shore Pass)",  en: "Request Shore Pass (Landing Card)" },
        ];

            const generateOnePdf = async (templateId: string) => {
              setLoadingTemplateId(templateId);
              try {
                const resp = await fetch(`/api/voyages/${voyageId}/generate-port-document`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ templateId }),
                });
                if (!resp.ok) throw new Error("PDF generation failed");
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                const tmplName = PORT_TEMPLATES.find(t => t.id === templateId)?.tr || templateId;
                a.href = url;
                a.download = `${templateId}_${(voyage.vesselName || "vessel").replace(/\s+/g, "_")}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "documents"] });
                toast({ title: "PDF Generated", description: `${tmplName} downloaded and saved to Documents.` });
              } catch {
                toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
              } finally {
                setLoadingTemplateId(null);
              }
            };

            const generateAllForms = async () => {
              setIsGeneratingAll(true);
              setGeneratingCount(0);
              for (let i = 0; i < PORT_TEMPLATES.length; i++) {
                setGeneratingCount(i + 1);
                await generateOnePdf(PORT_TEMPLATES[i].id);
                if (i < PORT_TEMPLATES.length - 1) await new Promise(r => setTimeout(r, 400));
              }
              queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "documents"] });
              toast({ title: "✅ All 14 Forms Generated!", description: "All 14 port documents downloaded and saved." });
              setIsGeneratingAll(false);
              setGeneratingCount(0);
            };

            return (
              <div className="space-y-4" data-testid="section-auto-doc-generator">
                {/* Section header */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base">⚡</span>
                      <h3 className="text-sm font-bold text-slate-100">Port Formalities — Auto-Generate</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 font-medium">5 templates</span>
                    </div>
                    <p className="text-xs text-slate-500 ml-6">Generate official port documents pre-filled with vessel data</p>
                  </div>
                  <Button
                    className="bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/25 gap-2 text-sm font-semibold flex-shrink-0 disabled:opacity-60"
                    onClick={generateAllForms}
                    disabled={isGeneratingAll || loadingTemplateId !== null}
                    data-testid="button-generate-all-forms"
                  >
                    {isGeneratingAll ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating {generatingCount}/14...
                      </>
                    ) : (
                      <>🚀 Generate All (14 Forms)</>
                    )}
                  </Button>
                </div>

                {/* Vessel Context Card */}
                <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4" data-testid="card-vessel-context">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium mb-2">Auto-fill data source</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Vessel", value: voyage.vesselName || "—" },
                      { label: "IMO", value: voyage.imoNumber || "—" },
                      { label: "Port", value: voyage.portName || "—" },
                      { label: "ETA", value: fmtDate(voyage.eta) },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <span className="text-[10px] text-slate-500">{label}</span>
                        <p className="text-sm font-semibold text-slate-200 truncate">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Template Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PORT_TEMPLATES.map((template) => {
                    const isLoading = loadingTemplateId === template.id;
                    return (
                      <div
                        key={template.id}
                        className="group bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-start gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/50 hover:border-slate-600/70 cursor-pointer"
                        data-testid={`card-template-${template.id}`}
                      >
                        <span className="text-2xl flex-shrink-0 mt-0.5">{template.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-100 leading-tight">{template.tr}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{template.en}</p>
                          <p className="text-[10px] text-slate-500 mt-1.5">Pre-filled with vessel data · Saved to Documents</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-shrink-0 h-8 px-3 gap-1.5 border-slate-600 hover:border-sky-500 hover:text-sky-400 text-slate-300 text-xs disabled:opacity-50 opacity-60 group-hover:opacity-100 transition-opacity"
                          onClick={() => generateOnePdf(template.id)}
                          disabled={isLoading || isGeneratingAll}
                          data-testid={`button-gen-pdf-${template.id}`}
                        >
                          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                          {isLoading ? "..." : "Generate PDF"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          </div>

        </div>
      )}

      {/* ── FINANCIALS TAB ──────────────────────────────────────────── */}
      {activeTab === "financials" && (
        <div className="space-y-6">
          <div className="space-y-6">
            <Card className="p-5 space-y-4" data-testid="panel-financial">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                  <h2 className="font-semibold text-sm">Invoices</h2>
                  {voyageInvoices.length > 0 && (
                    <span className="text-xs text-muted-foreground">({voyageInvoices.length})</span>
                  )}
                </div>
                <Link href={`/invoices?voyageId=${voyageId}`}>
                  <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1" data-testid="button-view-all-invoices">
                    <ExternalLink className="w-3 h-3" /> View All
                  </Button>
                </Link>
              </div>

            {voyageInvoices.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No Invoices"
                description="Invoices will appear here once FDA is approved and settled."
                compact
                testId="section-invoices-empty"
              />
            ) : (
              <div className="space-y-2" data-testid="section-invoices">
                {voyageInvoices.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors" data-testid={`invoice-row-${inv.id}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{inv.title || `Invoice #${inv.id}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.invoiceType || "invoice"} · {inv.currency || "USD"} {Number(inv.amount || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        inv.status === "paid" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : inv.status === "overdue" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      }`}>
                        {inv.status || "pending"}
                      </span>
                      <Link href={`/invoices?voyageId=${voyageId}`}>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" data-testid={`button-view-invoice-${inv.id}`}>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* PDA Section */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                <h2 className="font-semibold text-sm">Proforma Disbursement Accounts</h2>
                {voyageProformas.length > 0 && (
                  <span className="text-xs text-muted-foreground">({voyageProformas.length})</span>
                )}
              </div>
              <Link href={`/proformas/new?voyageId=${voyageId}`}>
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1" data-testid="button-create-pda">
                  <Plus className="w-3 h-3" /> Create PDA
                </Button>
              </Link>
            </div>
            {voyageProformas.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No Proformas Yet"
                description="Create a Proforma Disbursement Account to estimate port costs for this voyage."
                action={{ label: "Create PDA", onClick: () => window.location.href = `/proformas/new?voyageId=${voyageId}` }}
                testId="section-pdas-empty"
              />
            ) : (
              <div className="space-y-2" data-testid="section-pdas">
                {voyageProformas.map((p: any) => {
                  const statusColors: Record<string, string> = {
                    draft: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                    sent: "bg-sky-500/10 text-sky-400 border-sky-500/20",
                    final: "bg-violet-500/10 text-violet-400 border-violet-500/20",
                  };
                  const approvalColors: Record<string, string> = {
                    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
                    pending: "bg-amber-500/10 text-amber-300 border-amber-500/20",
                  };
                  const stBadge = statusColors[p.status] || "bg-slate-500/10 text-slate-400 border-slate-500/20";
                  const approvalBadge = p.approvalStatus ? approvalColors[p.approvalStatus] : null;
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card/50 hover:bg-card/80 transition-colors" data-testid={`pda-row-${p.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-foreground">PDA #{p.id}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${stBadge}`}>{p.status?.toUpperCase()}</span>
                          {approvalBadge && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${approvalBadge}`}>{p.approvalStatus?.toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {p.vesselName && <span>{p.vesselName}</span>}
                          {p.portName && <><span className="opacity-40">→</span><span>{p.portName}</span></>}
                          {p.totalUsd != null && <span className="font-semibold text-emerald-400 ml-auto">${p.totalUsd.toLocaleString()}</span>}
                        </div>
                      </div>
                      <Link href={`/proformas/${p.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs gap-1 flex-shrink-0" data-testid={`button-view-pda-${p.id}`}>
                          View →
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* FDA Section */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                <h2 className="font-semibold text-sm">Final Disbursement Accounts</h2>
                {voyageFdas.length > 0 && (
                  <span className="text-xs text-muted-foreground">({voyageFdas.length})</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {voyageProformas.length > 0 && (
                  <Link href={`/fda?voyageId=${voyageId}&proformaId=${voyageProformas[voyageProformas.length - 1]?.id}`}>
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1" data-testid="button-create-fda-from-pda">
                      <Plus className="w-3 h-3" /> From PDA
                    </Button>
                  </Link>
                )}
                <Link href={`/fda?voyageId=${voyageId}`}>
                  <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1" data-testid="button-create-fda">
                    <Plus className="w-3 h-3" /> Create FDA
                  </Button>
                </Link>
              </div>
            </div>
            {voyageFdas.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground" data-testid="section-fdas-empty">
                <Calculator className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Create a Final Disbursement Account to compare estimated vs actual costs.</p>
                <Link href={`/fda?voyageId=${voyageId}`}>
                  <Button size="sm" variant="default" className="mt-3 gap-1.5" data-testid="button-create-fda-cta">
                    <Plus className="w-3.5 h-3.5" /> New FDA
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2" data-testid="section-fdas">
                {voyageFdas.map((f: any) => {
                  const fdaStatusColors: Record<string, string> = {
                    draft: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                    pending_approval: "bg-amber-500/10 text-amber-300 border-amber-500/20",
                    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                    sent: "bg-sky-500/10 text-sky-400 border-sky-500/20",
                  };
                  const stBadge = fdaStatusColors[f.status] || "bg-slate-500/10 text-slate-400 border-slate-500/20";
                  const varUsd = f.varianceUsd || 0;
                  const varPct = f.variancePercent || 0;
                  return (
                    <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card/50 hover:bg-card/80 transition-colors" data-testid={`fda-row-${f.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-foreground">{f.referenceNumber || `FDA-${f.id}`}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${stBadge}`}>{(f.status || "draft").toUpperCase()}</span>
                          {varPct !== 0 && (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${varUsd > 0 ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                              {varUsd > 0 ? "+" : ""}{varPct.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Est: <span className="text-foreground/70">${(f.totalEstimatedUsd || 0).toLocaleString()}</span></span>
                          <span>Act: <span className="font-semibold text-emerald-400">${(f.totalActualUsd || 0).toLocaleString()}</span></span>
                        </div>
                      </div>
                      <Link href={`/fda/${f.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs gap-1 flex-shrink-0" data-testid={`button-view-fda-${f.id}`}>
                          View →
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Laytime Sheets Section */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                <h2 className="font-semibold text-sm">Laytime Calculations</h2>
                {(voyageLaytimeSheets as any[]).length > 0 && (
                  <span className="text-xs text-muted-foreground">({(voyageLaytimeSheets as any[]).length})</span>
                )}
              </div>
              <Link href={`/laytime-calculator?voyageId=${voyageId}`}>
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1" data-testid="button-new-laytime">
                  <Plus className="w-3 h-3" /> New Calculation
                </Button>
              </Link>
            </div>
            {(voyageLaytimeSheets as any[]).length === 0 ? (
              <div className="text-center py-5 text-muted-foreground text-sm">
                <Scale className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No laytime calculations for this voyage.
              </div>
            ) : (
              <div className="space-y-2" data-testid="section-laytime-sheets">
                {(voyageLaytimeSheets as any[]).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors" data-testid={`laytime-row-${s.id}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{s.title || `Laytime #${s.id}`}</p>
                      <p className="text-xs text-muted-foreground">{s.vesselName || ""}{s.portName ? ` · ${s.portName}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      {s.result?.status === "on_demurrage" && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                          DEM -{(s.result.demurrageAmount || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </span>
                      )}
                      {s.result?.status === "on_despatch" && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          DES +{(s.result.despatchAmount || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </span>
                      )}
                      <Link href={`/laytime-calculator?sheetId=${s.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" data-testid={`button-view-laytime-${s.id}`}>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* DA Advances Section */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                <h2 className="font-semibold text-sm">DA Advance Requests</h2>
                {(voyageDaAdvances as any[]).length > 0 && (
                  <span className="text-xs text-muted-foreground">({(voyageDaAdvances as any[]).length})</span>
                )}
              </div>
              <Link href={`/da-advances?voyageId=${voyageId}`}>
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1" data-testid="button-new-da-advance">
                  <Plus className="w-3 h-3" /> New Advance
                </Button>
              </Link>
            </div>
            {(voyageDaAdvances as any[]).length === 0 ? (
              <div className="text-center py-5 text-muted-foreground text-sm">
                <Banknote className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No advance requests for this voyage.
              </div>
            ) : (
              <div className="space-y-2" data-testid="section-da-advances">
                {(voyageDaAdvances as any[]).map((a: any) => {
                  const pct = a.requestedAmount > 0 ? Math.min(100, ((a.receivedAmount || 0) / a.requestedAmount) * 100) : 0;
                  return (
                    <div key={a.id} className="px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors" data-testid={`da-advance-row-${a.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{a.title}</p>
                          <p className="text-xs text-muted-foreground">{a.principalName || ""} · {a.currency} {Number(a.requestedAmount || 0).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            a.status === "fully_received" ? "bg-emerald-100 text-emerald-700" :
                            a.status === "partially_received" ? "bg-blue-100 text-blue-700" :
                            a.status === "cancelled" ? "bg-slate-100 text-slate-600" :
                            "bg-amber-100 text-amber-700"
                          }`}>{(a.status || "pending").replace(/_/g, " ")}</span>
                          <Link href={`/da-advances?voyageId=${voyageId}`}>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-blue-500" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Commission Section */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-amber-400" />
                <h2 className="font-semibold text-sm">Agency Commission</h2>
                {voyageCommissions.length > 0 && (
                  <span className="text-xs text-muted-foreground">({voyageCommissions.length})</span>
                )}
              </div>
              {!isShipowner && (
                <Link href={`/voyages/${voyageId}/pnl`}>
                  <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1" data-testid="button-commission-pnl">
                    <BarChart2 className="w-3 h-3" /> View P&L
                  </Button>
                </Link>
              )}
            </div>
            {voyageCommissions.length === 0 ? (
              <div className="text-center py-5 text-muted-foreground text-sm">
                <Percent className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No commission records yet.
              </div>
            ) : (
              <div className="space-y-2" data-testid="section-commissions">
                {voyageCommissions.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors" data-testid={`commission-row-${c.id}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{c.commissionType === "percentage" ? `${c.rate}% of ${(c.invoiceTypes || []).join(", ")}` : `Fixed: ${c.currency || "USD"} ${Number(c.fixedAmount || 0).toLocaleString()}`}</p>
                      {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                    </div>
                    <div className="text-sm font-bold text-amber-400 ml-3 shrink-0">
                      {c.currency || "USD"} {Number(c.calculatedAmount || 0).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          </div>
        </div>
      )}

      {/* ── Tab: Activity Timeline ─────────────────────────────── */}
      {activeTab === "documents" && (
        <div className="space-y-4" data-testid="tab-content-activity">
          {/* Header with Add Note button */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              Activity Timeline
            </h2>
            <Button size="sm" variant="outline" onClick={() => setShowNoteDialog(true)} data-testid="button-add-note">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Note
            </Button>
          </div>

          {/* Timeline */}
          {activities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No activity yet. Events will appear here as the voyage progresses.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[1.125rem] top-0 bottom-0 w-px bg-border/40" />
              <div className="space-y-3">
                {activities.map((activity: any) => {
                  const style = getActivityStyle(activity.activityType);
                  const isSystem = style.isSystem;
                  const initials = activity.user
                    ? `${(activity.user.firstName || '')[0] ?? ''}${(activity.user.lastName || '')[0] ?? ''}`.toUpperCase()
                    : '';
                  return (
                    <div key={activity.id} className="relative flex gap-3.5" data-testid={`activity-item-${activity.id}`}>
                      {/* Left icon */}
                      {isSystem ? (
                        <div className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-muted/60 border border-border/50 text-muted-foreground">
                          <Settings className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-blue-500/15 border border-blue-500/25 text-blue-400 text-xs font-bold">
                          {initials || <MessageCircle className="w-3.5 h-3.5" />}
                        </div>
                      )}
                      {/* Content card */}
                      <div className={`flex-1 rounded-xl border px-4 py-3 min-w-0 ${
                        isSystem
                          ? "bg-card border-border/60"
                          : "bg-blue-500/5 border-blue-500/15"
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-sm font-medium leading-snug ${isSystem ? "text-muted-foreground" : "text-foreground"}`}>
                            {isSystem
                              ? `System: ${activity.title}`
                              : `${activity.user?.firstName ?? 'User'} added a note: ${activity.title}`}
                          </span>
                          <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap flex-shrink-0 mt-0.5 tabular-nums">
                            {formatActivityTime(activity.createdAt)}
                          </span>
                        </div>
                        {activity.description && (
                          <p className={`text-xs mt-1.5 leading-relaxed ${isSystem ? "text-muted-foreground/70" : "text-foreground/70"}`}>
                            {activity.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Load More */}
          {activities.length >= 50 && (
            <div className="text-center">
              <Button variant="ghost" size="sm">Load More</Button>
            </div>
          )}

          {/* Add Note Dialog */}
          <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Activity Note</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <Label>Title</Label>
                  <Input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Brief description..." data-testid="input-note-title" />
                </div>
                <div>
                  <Label>Details (optional)</Label>
                  <Textarea value={noteDesc} onChange={e => setNoteDesc(e.target.value)} placeholder="Additional details..." rows={3} data-testid="input-note-desc" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNoteDialog(false)}>Cancel</Button>
                <Button onClick={() => addActivityMutation.mutate()} disabled={!noteTitle.trim() || addActivityMutation.isPending} data-testid="button-save-note">
                  {addActivityMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Note"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ── Cargo Edit Dialog ── */}
          <Dialog open={editCargoOpen} onOpenChange={setEditCargoOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  📦 Cargo Information
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-1">
                <div className="space-y-1.5">
                  <Label className="text-sm">Cargo Type</Label>
                  <Input
                    value={editCargoType}
                    onChange={e => setEditCargoType(e.target.value.toUpperCase())}
                    placeholder="e.g. WHEAT, IRON ORE, CRUDE OIL"
                    className="uppercase placeholder:normal-case"
                    data-testid="input-edit-cargo-type"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Cargo Quantity (MT)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      value={editCargoQty}
                      onChange={e => setEditCargoQty(e.target.value)}
                      placeholder="e.g. 45000"
                      className="pr-12"
                      data-testid="input-edit-cargo-qty"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">MT</span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditCargoOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => updateCargoMutation.mutate({ cargoType: editCargoType, cargoQuantity: editCargoQty })}
                  disabled={updateCargoMutation.isPending}
                  data-testid="button-save-cargo"
                >
                  {updateCargoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ── TEAM & CONTACTS TAB ────────────────────────────────── */}
      {activeTab === "team" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT COLUMN: Chat + Timeline ──────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* VOYAGE CHAT */}
            {(() => {
              const canChat = isOwner || isAgent || (user as any)?.activeRole === "admin";
              const formatRelTime = (dt: string) => {
                const diff = Date.now() - new Date(dt).getTime();
                if (diff < 60000) return "just now";
                if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
                return new Date(dt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
              };
              return (
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 overflow-hidden flex flex-col" style={{ minHeight: "400px", maxHeight: "520px" }}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-semibold">Team Chat</h3>
                    {chatMessages.length > 0 && (
                      <span className="text-[10px] text-slate-500 bg-slate-800 rounded-full px-2 py-0.5">{chatMessages.length} messages</span>
                    )}
                  </div>
                  {/* Online avatars — unique chat participants */}
                  <div className="flex items-center">
                    {Array.from(new Map(chatMessages.map((m: any) => [m.senderId, m.senderName])).values())
                      .slice(0, 4).map((name: any, i: number) => (
                      <div key={i} title={name} className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-slate-900" style={{ marginLeft: i === 0 ? 0 : -6 }}>
                        {(name || "?")[0].toUpperCase()}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-12">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-3">
                        <MessageSquare className="w-6 h-6 text-slate-600" />
                      </div>
                      <p className="text-sm text-slate-400">No messages yet</p>
                      <p className="text-xs text-slate-500 mt-1">Start the conversation with your team</p>
                    </div>
                  ) : (
                    chatMessages.map((msg: any, i: number) => {
                      const isOwn = msg.senderId === userId;
                      const prevMsg = chatMessages[i - 1];
                      const showAvatar = i === 0 || prevMsg?.senderId !== msg.senderId;
                      return (
                        <div key={msg.id} className={cn("flex gap-2.5", isOwn && "flex-row-reverse")} data-testid={`chat-msg-${msg.id}`}>
                          {showAvatar ? (
                            <div className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0",
                              isOwn ? "bg-blue-500/20 text-blue-400" : "bg-slate-700 text-slate-300"
                            )}>
                              {(msg.senderName || "?")[0].toUpperCase()}
                            </div>
                          ) : (
                            <div className="w-7 shrink-0" />
                          )}
                          <div className={cn("max-w-[75%]", isOwn && "text-right")}>
                            {showAvatar && (
                              <div className={cn("flex items-center gap-2 mb-1", isOwn && "flex-row-reverse")}>
                                <span className="text-[11px] font-medium text-slate-300">{msg.senderName}</span>
                                <span className="text-[10px] text-slate-600">{formatRelTime(msg.createdAt)}</span>
                              </div>
                            )}
                            <div className={cn(
                              "inline-block px-3 py-2 rounded-xl text-sm leading-relaxed",
                              isOwn
                                ? "bg-blue-600/20 text-blue-100 rounded-tr-sm"
                                : "bg-slate-800/80 text-slate-200 rounded-tl-sm"
                            )}>
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Input */}
                <div className="border-t border-slate-700/30 p-3 flex-shrink-0">
                  {canChat ? (
                    <div className="flex items-end gap-2">
                      <div className="flex-1 relative">
                        <Input
                          value={chatMessage}
                          onChange={e => setChatMessage(e.target.value)}
                          onKeyDown={handleChatKeyDown}
                          placeholder="Type a message… (Enter to send)"
                          className="bg-slate-800/50 border-slate-700/50 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus-visible:ring-blue-500/30 focus-visible:border-blue-500/30 h-10"
                          data-testid="input-chat-message"
                          autoCorrect="off"
                          autoCapitalize="off"
                        />
                      </div>
                      <Button
                        size="sm"
                        className={cn(
                          "w-10 h-10 rounded-xl p-0 shrink-0 transition-all",
                          chatMessage.trim()
                            ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                            : "bg-slate-800 text-slate-600 cursor-not-allowed"
                        )}
                        onClick={() => sendChatMutation.mutate()}
                        disabled={!chatMessage.trim() || sendChatMutation.isPending}
                        data-testid="button-send-chat"
                      >
                        {sendChatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-1">You are not a participant in this voyage.</p>
                  )}
                </div>
              </div>
              );
            })()}

            {/* ACTIVITY TIMELINE */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold">Activity Timeline</h3>
                  {activities.length > 0 && (
                    <span className="text-[10px] text-slate-500 bg-slate-800 rounded-full px-2 py-0.5">{activities.length}</span>
                  )}
                </div>
              </div>
              <div className="px-4 py-3 max-h-72 overflow-y-auto">
                {activities.length === 0 ? (
                  <div className="flex flex-col items-center py-6">
                    <Activity className="w-8 h-8 text-slate-700 mb-2" />
                    <p className="text-xs text-slate-600">No activity recorded yet</p>
                  </div>
                ) : (
                  activities.map((activity: any, i: number) => {
                    const diff = Date.now() - new Date(activity.createdAt).getTime();
                    const relTime = diff < 60000 ? "just now" : diff < 3600000 ? `${Math.floor(diff / 60000)}m ago` : diff < 86400000 ? `${Math.floor(diff / 3600000)}h ago` : new Date(activity.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
                    const iconCls = activity.type === "user" ? "bg-blue-500/15 text-blue-400" : activity.type === "status" ? "bg-emerald-500/15 text-emerald-400" : activity.type === "warning" ? "bg-amber-500/15 text-amber-400" : "bg-slate-800 text-slate-500";
                    return (
                      <div key={i} className="flex gap-3 relative">
                        {i < activities.length - 1 && (
                          <div className="absolute left-[11px] top-7 w-0.5 h-[calc(100%-4px)] bg-slate-800" />
                        )}
                        <div className={cn("relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5", iconCls)}>
                          {activity.type === "status" ? <CheckCircle2 className="w-3 h-3" /> : activity.type === "warning" ? <AlertTriangle className="w-3 h-3" /> : activity.type === "user" ? <UsersIcon className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 pb-4 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-300 font-medium truncate">{activity.title || activity.action}</span>
                            <span className="text-[10px] text-slate-600 shrink-0">{relTime}</span>
                          </div>
                          {activity.description && (
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">{activity.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Tasks + Contacts + Quick Actions ─────── */}
          <div className="flex flex-col gap-5">

            {/* TASKS & CHECKLIST */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold">Tasks</h3>
                  {(voyage?.checklist?.length ?? 0) > 0 && (
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">
                      {(voyage?.checklist ?? []).filter((t: any) => !t.isCompleted).length} open
                    </span>
                  )}
                </div>
              </div>

              <div className="px-3 py-2 max-h-56 overflow-y-auto space-y-0.5">
                {(voyage?.checklist ?? []).length === 0 && (
                  <div className="flex flex-col items-center py-4">
                    <CheckSquare className="w-6 h-6 text-slate-700 mb-1.5" />
                    <p className="text-[11px] text-slate-600">No tasks</p>
                  </div>
                )}
                {(voyage?.checklist ?? []).map((item: any) => (
                  <div key={item.id} className="flex items-start gap-2 py-1.5 group">
                    <button
                      onClick={() => toggleTaskMutation.mutate(item.id)}
                      className={cn(
                        "w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-colors",
                        item.isCompleted
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                          : "border-slate-600 hover:border-blue-500/50"
                      )}
                    >
                      {item.isCompleted && <Check className="w-2.5 h-2.5" />}
                    </button>
                    <span className={cn(
                      "text-xs flex-1 min-w-0",
                      item.isCompleted ? "text-slate-600 line-through" : "text-slate-300"
                    )}>
                      {item.title}
                    </span>
                    <button
                      onClick={() => deleteTaskMutation.mutate(item.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400 shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add task input */}
              <div className="px-3 py-2 border-t border-slate-800/60">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Add task…"
                    value={newTask}
                    onChange={e => setNewTask(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && newTask.trim()) addTaskMutation.mutate(); }}
                    className="h-7 text-xs bg-slate-800/40 border-slate-700/50 text-slate-300 placeholder:text-slate-600"
                    data-testid="input-new-task"
                  />
                  <Button
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    disabled={!newTask.trim() || addTaskMutation.isPending}
                    onClick={() => addTaskMutation.mutate()}
                    data-testid="button-add-task"
                  >
                    {addTaskMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* CONTACTS */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30">
                <div className="flex items-center gap-2">
                  <Users2 className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold">Contacts</h3>
                  {voyageContactsList.length > 0 && (
                    <span className="text-[10px] text-slate-500 bg-slate-800 rounded-full px-1.5 py-0.5">{voyageContactsList.length}</span>
                  )}
                </div>
              </div>

              <div className="divide-y divide-slate-800/50 max-h-52 overflow-y-auto">
                {voyageContactsList.length === 0 && (
                  <div className="flex flex-col items-center py-5">
                    <Users2 className="w-6 h-6 text-slate-700 mb-1.5" />
                    <p className="text-[11px] text-slate-600">No contacts added</p>
                  </div>
                )}
                {voyageContactsList.map((c: any) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/30 transition-colors group">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center text-[11px] font-bold text-slate-300 shrink-0">
                      {(c.name || c.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-300 truncate">{c.name || c.email}</div>
                      <div className="text-[10px] text-slate-500 truncate capitalize">{c.role || "Contact"}</div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="w-6 h-6 rounded-md hover:bg-slate-700 flex items-center justify-center" title={c.email}>
                          <Mail className="w-3 h-3 text-slate-400" />
                        </a>
                      )}
                      {(isOwner || isAgent) && (
                        <button onClick={() => deleteContactMutation.mutate(c.id)} className="w-6 h-6 rounded-md hover:bg-slate-700 flex items-center justify-center" data-testid={`button-delete-contact-${c.id}`}>
                          <X className="w-3 h-3 text-slate-500 hover:text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add contact inline */}
              {(isOwner || isAgent) && (
              <div className="px-3 py-2 border-t border-slate-800/60">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Email address…"
                    value={newContactEmail}
                    onChange={e => setNewContactEmail(e.target.value)}
                    type="email"
                    onKeyDown={e => { if (e.key === "Enter" && newContactEmail.includes("@")) addContactMutation.mutate({ email: newContactEmail, name: newContactName || undefined, role: newContactRole }); }}
                    className="h-7 text-xs bg-slate-800/40 border-slate-700/50 text-slate-300 placeholder:text-slate-600"
                    data-testid="input-contact-email"
                  />
                  <Button
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    disabled={!newContactEmail.includes("@") || addContactMutation.isPending}
                    onClick={() => addContactMutation.mutate({ email: newContactEmail, name: newContactName || undefined, role: newContactRole })}
                    data-testid="button-add-contact"
                  >
                    {addContactMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
              )}
            </div>

            {/* QUICK ACTIONS */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 p-4">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Actions</h3>
              <div className="flex flex-col gap-1">
                <Link href={`/agent-report/${voyageId}`}>
                  <button className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors text-left group w-full">
                    <FileText className="w-4 h-4 shrink-0 text-blue-400" />
                    <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">Agent Report</span>
                  </button>
                </Link>
                {features.hasSOF && (
                  <Link href={`/sof?voyageId=${voyageId}`}>
                    <button className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors text-left group w-full">
                      <ClipboardList className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">SOF Report</span>
                    </button>
                  </Link>
                )}
                <Link href={`/voyages/${voyageId}/pnl`}>
                  <button className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors text-left group w-full">
                    <BarChart2 className="w-4 h-4 shrink-0 text-amber-400" />
                    <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">P&L Summary</span>
                  </button>
                </Link>
                {(isOwner || isAgent) && (
                  <button onClick={() => setShowInviteDialog(true)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors text-left group" data-testid="button-quick-invite">
                    <UserPlus className="w-4 h-4 shrink-0 text-purple-400" />
                    <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">Invite Team Member</span>
                  </button>
                )}
              </div>
            </div>

            {/* TEAM MEMBERS (compact) */}
            {participants.length > 0 && (
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/30 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-700/30 flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-semibold">Team</h3>
                  <span className="text-[10px] text-slate-500 bg-slate-800 rounded-full px-1.5 py-0.5">{participants.length + 1}</span>
                </div>
                <div className="divide-y divide-slate-800/50">
                  {/* Owner */}
                  <div className="flex items-center gap-3 px-4 py-2">
                    <div className="w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                      {voyage?.ownerFirstName?.[0] ?? "O"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-300 truncate">{`${voyage?.ownerFirstName ?? ""} ${voyage?.ownerLastName ?? ""}`.trim() || "Owner"}</div>
                      <div className="text-[10px] text-amber-400">Owner</div>
                    </div>
                  </div>
                  {participants.slice(0, 5).map((p: any) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2">
                      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                        {(p.firstName?.[0] ?? p.email?.[0] ?? "?").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-300 truncate">{`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.email}</div>
                        <div className="text-[10px] text-slate-500 capitalize">{p.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Tab: Notes & Tasks ─────────────────────────────────────── */}
      {activeTab === "documents" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-4 bg-card/50 backdrop-blur-sm border-muted/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-primary" />
                  Voyage Timeline & Notes
                </h3>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 text-xs gap-1"
                  onClick={() => setShowNoteForm(!showNoteForm)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Note
                </Button>
              </div>

              {showNoteForm && (
                <div className="mb-6 p-4 rounded-xl bg-muted/30 border border-muted/50 space-y-4 animate-in zoom-in-95 duration-200">
                  <Textarea 
                    placeholder="Write a note, observation or alert..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    className="min-h-[100px] bg-background border-muted/40"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Select value={noteType} onValueChange={(val: any) => setNoteType(val)}>
                        <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs">
                          <SelectValue placeholder="Note Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="comment">💬 Comment</SelectItem>
                          <SelectItem value="observation">👁️ Observation</SelectItem>
                          <SelectItem value="alert">⚠️ Alert</SelectItem>
                          <SelectItem value="milestone">🏁 Milestone</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2 px-3 h-9 rounded-md border border-muted/40 bg-background/50">
                        <Label htmlFor="private-note" className="text-xs cursor-pointer">Private</Label>
                        <Switch 
                          id="private-note" 
                          checked={isPrivateNote} 
                          onCheckedChange={setIsPrivateNote}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <Button size="sm" variant="ghost" className="h-9 text-xs" onClick={() => setShowNoteForm(false)}>Cancel</Button>
                      <Button 
                        size="sm" 
                        className="h-9 text-xs px-4" 
                        onClick={() => addNoteMutation.mutate({
                          content: noteContent,
                          noteType,
                          isPrivate: isPrivateNote
                        })}
                        disabled={!noteContent.trim() || addNoteMutation.isPending}
                      >
                        {addNoteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Post Note"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {voyageNotes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                    <p className="text-sm">No notes yet. Share observations or updates here.</p>
                  </div>
                ) : (
                  voyageNotes.map((note: any) => (
                    <div key={note.id} className="relative pl-4 border-l-2 border-muted/30 pb-4 last:pb-0">
                      <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-background border-2 border-muted flex items-center justify-center">
                        {note.noteType === 'alert' && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                        {note.noteType === 'milestone' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        {note.noteType === 'observation' && <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />}
                        {note.noteType === 'comment' && <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />}
                      </div>
                      <div className="bg-muted/20 rounded-xl p-3 border border-muted/10 hover:border-muted/30 transition-colors group">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                              {note.authorName?.slice(0, 2).toUpperCase() || "UN"}
                            </div>
                            <span className="text-xs font-semibold">{note.authorName}</span>
                            <span className="text-[10px] text-muted-foreground">{fmtDateTime(note.createdAt)}</span>
                            {note.isPrivate && (
                              <Badge variant="outline" className="text-[9px] h-4 py-0 bg-amber-500/10 text-amber-500 border-amber-500/20">Private</Badge>
                            )}
                            <Badge className={`text-[9px] h-4 py-0 capitalize ${
                              note.noteType === 'alert' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                              note.noteType === 'milestone' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                              note.noteType === 'observation' ? 'bg-sky-500/10 text-sky-500 border-sky-500/20' :
                              'bg-slate-500/10 text-slate-500 border-slate-500/20'
                            }`}>
                              {note.noteType}
                            </Badge>
                          </div>
                          {note.authorId === userId && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deleteNoteMutation.mutate(note.id)}
                            >
                              <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                          {note.content}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-4 bg-card/50 backdrop-blur-sm border-muted/20">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Tasks & Checklist
              </h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex flex-col gap-2">
                  <Input 
                    placeholder="New task title..." 
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <div className="flex gap-2">
                    <Input 
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="h-9 text-xs flex-1"
                    />
                    <Select value={taskAssignedTo} onValueChange={setTaskAssignedTo}>
                      <SelectTrigger className="h-9 text-xs w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">Both</SelectItem>
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="owner">Owner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="w-full h-9 text-xs" 
                    disabled={!newTask.trim() || addTaskMutation.isPending}
                    onClick={() => addTaskMutation.mutate()}
                  >
                    {addTaskMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                    Add Task
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {voyage.checklist?.length === 0 ? (
                  <p className="text-center py-6 text-xs text-muted-foreground italic">No tasks assigned.</p>
                ) : (
                  voyage.checklist?.map((item: any) => (
                    <div key={item.id} className={`group flex items-start gap-3 p-3 rounded-xl border transition-all ${
                      item.isCompleted ? 'bg-muted/10 border-muted/20' : 'bg-background border-muted/30 hover:border-primary/30'
                    }`}>
                      <Checkbox 
                        checked={item.isCompleted} 
                        onCheckedChange={(checked) => updateTaskMutation.mutate({ id: item.id, data: { isCompleted: !!checked } })}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium leading-tight ${item.isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {item.dueDate && (
                            <span className={`text-[10px] flex items-center gap-1 ${
                              new Date(item.dueDate) < new Date() && !item.isCompleted ? 'text-red-500 font-bold' : 'text-muted-foreground'
                            }`}>
                              <Calendar className="w-3 h-3" />
                              {new Date(item.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          <Badge variant="outline" className="text-[9px] h-4 py-0 capitalize border-muted/50">
                            {item.assignedTo}
                          </Badge>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity -mr-1"
                        onClick={() => deleteTaskMutation.mutate(item.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Contacts Content */}
          <div className="space-y-5">
            {/* Bulk Paste Section */}
          <Card className="p-5">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-sky-400" />
              Bulk Import
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Paste multiple email addresses (separated by comma, semicolon, or newline). The system will parse and add them automatically.</p>
            <Textarea
              value={contactBulkText}
              onChange={e => setContactBulkText(e.target.value)}
              placeholder="owner@example.com, charterer@shipping.com; receiver@port.com"
              rows={4}
              className="mb-3 font-mono text-xs"
              data-testid="textarea-bulk-contacts"
            />
            <Button
              onClick={() => bulkImportContactsMutation.mutate(contactBulkText)}
              disabled={!contactBulkText.trim() || bulkImportContactsMutation.isPending}
              data-testid="button-bulk-import"
              size="sm"
            >
              {bulkImportContactsMutation.isPending && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
              Import Contacts
            </Button>
          </Card>

          {/* Contact List */}
          <Card className="p-5">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
              <Users2 className="w-4 h-4 text-sky-400" />
              Contact List
              <span className="text-xs text-muted-foreground font-normal">({voyageContactsList.length})</span>
            </h3>

            {voyageContactsList.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Mail className="w-7 h-7 mx-auto mb-2 opacity-25" />
                <p className="text-sm font-medium">No contacts yet</p>
                <p className="text-xs mt-1">Use bulk import above or add individually below.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Role color map */}
                {voyageContactsList.map((c: any) => {
                  const ROLE_BADGE: Record<string, string> = {
                    owner: "bg-amber-500/15 text-amber-400 border-amber-500/30",
                    charterer: "bg-blue-500/15 text-blue-400 border-blue-500/30",
                    receiver: "bg-green-500/15 text-green-400 border-green-500/30",
                    sub_agent: "bg-violet-500/15 text-violet-400 border-violet-500/30",
                    other: "bg-muted/50 text-muted-foreground border-muted",
                  };
                  const roleColor = ROLE_BADGE[c.role] ?? ROLE_BADGE.other;
                  const initials = (c.name || c.email).slice(0, 2).toUpperCase();
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors" data-testid={`contact-row-${c.id}`}>
                      <div className="w-8 h-8 rounded-full bg-sky-700 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" data-testid={`contact-email-${c.id}`}>{c.email}</p>
                        {c.name && <p className="text-xs text-muted-foreground truncate">{c.name}</p>}
                      </div>

                      {/* Role Select */}
                      <Select
                        value={c.role}
                        onValueChange={val => updateContactMutation.mutate({ contactId: c.id, updates: { role: val } })}
                      >
                        <SelectTrigger className="w-32 h-7 text-xs" data-testid={`select-role-${c.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="charterer">Charterer</SelectItem>
                          <SelectItem value="receiver">Receiver</SelectItem>
                          <SelectItem value="sub_agent">Sub-Agent</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Daily Reports Toggle */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Switch
                          checked={c.includeInDailyReports}
                          onCheckedChange={val => updateContactMutation.mutate({ contactId: c.id, updates: { includeInDailyReports: val } })}
                          data-testid={`switch-daily-${c.id}`}
                        />
                        <span className="text-[10px] text-muted-foreground hidden sm:block">Daily</span>
                      </div>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                        onClick={() => deleteContactMutation.mutate(c.id)}
                        data-testid={`button-delete-contact-${c.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Single Contact Form */}
            <div className="mt-5 pt-4 border-t space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Add Contact Manually</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  placeholder="Email address *"
                  value={newContactEmail}
                  onChange={e => setNewContactEmail(e.target.value)}
                  className="flex-1 h-8 text-xs"
                  data-testid="input-new-contact-email"
                />
                <Input
                  placeholder="Display name (optional)"
                  value={newContactName}
                  onChange={e => setNewContactName(e.target.value)}
                  className="flex-1 h-8 text-xs"
                  data-testid="input-new-contact-name"
                />
                <Select value={newContactRole} onValueChange={setNewContactRole}>
                  <SelectTrigger className="w-32 h-8 text-xs" data-testid="select-new-contact-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="charterer">Charterer</SelectItem>
                    <SelectItem value="receiver">Receiver</SelectItem>
                    <SelectItem value="sub_agent">Sub-Agent</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={() => addContactMutation.mutate({ email: newContactEmail, name: newContactName || undefined, role: newContactRole })}
                  disabled={!newContactEmail.includes("@") || addContactMutation.isPending}
                  data-testid="button-add-contact"
                >
                  {addContactMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  <span className="ml-1">Add</span>
                </Button>
              </div>
            </div>
          </Card>
          </div>
        </div>
      )}

      <Dialog open={isAddExpenseDialogOpen} onOpenChange={setIsAddExpenseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Port Expense</DialogTitle>
            <DialogDescription>Record a new expense for this voyage.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createExpenseMutation.mutate(data))} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="port_dues">Port Dues</SelectItem>
                        <SelectItem value="pilotage">Pilotage</SelectItem>
                        <SelectItem value="towage">Towage</SelectItem>
                        <SelectItem value="agency_fee">Agency Fee</SelectItem>
                        <SelectItem value="mooring">Mooring</SelectItem>
                        <SelectItem value="anchorage">Anchorage</SelectItem>
                        <SelectItem value="launch_hire">Launch Hire</SelectItem>
                        <SelectItem value="garbage">Garbage</SelectItem>
                        <SelectItem value="fresh_water">Fresh Water</SelectItem>
                        <SelectItem value="bunker">Bunker</SelectItem>
                        <SelectItem value="survey">Survey</SelectItem>
                        <SelectItem value="customs">Customs</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="USD" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="TRY">TRY</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="vendor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <FormControl>
                      <Input placeholder="Vendor name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expenseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={createExpenseMutation.isPending} className="w-full">
                  {createExpenseMutation.isPending ? "Saving..." : "Save Expense"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Voyage Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog} data-testid="dialog-invite-participant">
        <DialogContent className="max-w-lg" data-testid="dialog-invite-participant">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Invite to Voyage
            </DialogTitle>
          </DialogHeader>
          {/* Invite Tabs */}
          <div className="flex gap-1 bg-muted/30 p-1 rounded-lg mb-4">
            {[
              { key: "email", label: "By Email" },
              { key: "directory", label: "From Directory" },
              { key: "bulk", label: "Bulk" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setInviteTab(key as any)}
                className={`flex-1 py-1.5 text-sm rounded-md transition-all ${inviteTab === key ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
                data-testid={`tab-invite-${key}`}
              >
                {label}
              </button>
            ))}
          </div>

          {inviteTab === "email" && (
            <div className="space-y-4">
              <div>
                <Label>Email Address *</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  data-testid="input-invite-email-field"
                />
              </div>
              <div>
                <Label>Role *</Label>
                <Select value={inviteRole} onValueChange={setInviteRole} data-testid="select-invite-role">
                  <SelectTrigger data-testid="select-invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent Staff — Full Access</SelectItem>
                    <SelectItem value="observer">Shipowner — View Only</SelectItem>
                    <SelectItem value="broker">Charterer</SelectItem>
                    <SelectItem value="provider">Provider / Supplier</SelectItem>
                    <SelectItem value="surveyor">Surveyor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {inviteRole === "provider" && (
                <div>
                  <Label>Service Type</Label>
                  <Select value={inviteServiceType} onValueChange={setInviteServiceType}>
                    <SelectTrigger><SelectValue placeholder="Select service..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stevedoring">Stevedoring</SelectItem>
                      <SelectItem value="surveying">Surveying</SelectItem>
                      <SelectItem value="fumigation">Fumigation</SelectItem>
                      <SelectItem value="customs">Customs</SelectItem>
                      <SelectItem value="forwarding">Forwarding</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Personal Message <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Textarea
                  value={inviteMessage}
                  onChange={e => setInviteMessage(e.target.value)}
                  placeholder="Add a personal note to your invitation..."
                  rows={3}
                  maxLength={500}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
                <Button
                  onClick={() => sendInviteMutation.mutate({ inviteeEmail: inviteEmail, role: inviteRole, serviceType: inviteServiceType || undefined, message: inviteMessage || undefined })}
                  disabled={!inviteEmail.includes("@") || sendInviteMutation.isPending}
                  data-testid="button-send-voyage-invite"
                >
                  {sendInviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Send Invitation
                </Button>
              </DialogFooter>
            </div>
          )}

          {inviteTab === "directory" && (
            <div className="space-y-4">
              <div>
                <Label>Search Companies</Label>
                <Input
                  value={directorySearch}
                  onChange={e => setDirectorySearch(e.target.value)}
                  placeholder="Search by company name..."
                />
              </div>
              {directorySearch.length >= 2 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(directoryResults as any[]).map((co: any) => (
                    <div key={co.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 cursor-pointer" onClick={() => { setInviteEmail(co.email || ""); setDirectorySearch(""); }}>
                      <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold">{co.companyName?.[0] ?? "?"}</div>
                      <div>
                        <p className="text-sm font-medium">{co.companyName}</p>
                        <p className="text-xs text-muted-foreground">{co.portName ?? co.city}</p>
                      </div>
                    </div>
                  ))}
                  {(directoryResults as any[]).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No results</p>}
                </div>
              )}
              <div>
                <Label>Role *</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent Staff — Full Access</SelectItem>
                    <SelectItem value="observer">Shipowner — View Only</SelectItem>
                    <SelectItem value="broker">Charterer</SelectItem>
                    <SelectItem value="provider">Provider / Supplier</SelectItem>
                    <SelectItem value="surveyor">Surveyor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
                <Button
                  onClick={() => sendInviteMutation.mutate({ inviteeEmail: inviteEmail, role: inviteRole })}
                  disabled={!inviteEmail.includes("@") || sendInviteMutation.isPending}
                  data-testid="button-send-voyage-invite"
                >
                  {sendInviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Send Invitation
                </Button>
              </DialogFooter>
            </div>
          )}

          {inviteTab === "bulk" && (
            <div className="space-y-4" data-testid="tab-invite-bulk">
              <div>
                <Label>Email Addresses <span className="text-muted-foreground text-xs">(one per line)</span></Label>
                <Textarea
                  value={bulkEmails}
                  onChange={e => setBulkEmails(e.target.value)}
                  placeholder={"agent@company.com\nsurveyor@firm.com\nprovider@service.com"}
                  rows={6}
                  data-testid="textarea-bulk-emails"
                />
                <p className="text-xs text-muted-foreground mt-1">{bulkEmails.split("\n").filter(l => l.trim()).length} emails</p>
              </div>
              <div>
                <Label>Role for all *</Label>
                <Select value={bulkRole} onValueChange={setBulkRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent Staff — Full Access</SelectItem>
                    <SelectItem value="observer">Shipowner — View Only</SelectItem>
                    <SelectItem value="broker">Charterer</SelectItem>
                    <SelectItem value="provider">Provider / Supplier</SelectItem>
                    <SelectItem value="surveyor">Surveyor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    const invitations = bulkEmails.split("\n").filter(l => l.trim()).map(email => ({ email: email.trim(), role: bulkRole }));
                    sendBulkInviteMutation.mutate({ invitations });
                  }}
                  disabled={bulkEmails.trim().length === 0 || sendBulkInviteMutation.isPending}
                >
                  {sendBulkInviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Send All
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Service Request Dialog */}
      <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Create Service Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Service Type *</Label>
              <Select value={serviceForm.serviceType} onValueChange={v => setServiceForm(f => ({ ...f, serviceType: v }))}>
                <SelectTrigger data-testid="select-service-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SERVICE_TYPE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vessel Name *</Label>
              <Input value={serviceForm.vesselName || voyage?.vesselName || ""} onChange={e => setServiceForm(f => ({ ...f, vesselName: e.target.value }))} placeholder="Vessel name" />
            </div>
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Textarea value={serviceForm.description} onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))} placeholder="Enter service details..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" value={serviceForm.quantity} onChange={e => setServiceForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Input value={serviceForm.unit} onChange={e => setServiceForm(f => ({ ...f, unit: e.target.value }))} placeholder="MT, LT, pcs..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Preferred Date</Label>
              <Input type="datetime-local" value={serviceForm.preferredDate} onChange={e => setServiceForm(f => ({ ...f, preferredDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowServiceDialog(false)}>Cancel</Button>
            <Button onClick={() => createServiceMutation.mutate()} disabled={createServiceMutation.isPending || !serviceForm.description.trim()} data-testid="button-save-service-request">
              {createServiceMutation.isPending ? "Creating..." : "Create Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Upload Dialog */}
      <Dialog open={showDocDialog} onOpenChange={setShowDocDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Select File *</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-150 ${
                  isDragOverDropzone
                    ? "border-[hsl(var(--maritime-primary))] bg-[hsl(var(--maritime-primary)/0.06)]"
                    : "hover:border-primary/50 hover:bg-muted/30"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragOverDropzone(true); }}
                onDragEnter={e => { e.preventDefault(); setIsDragOverDropzone(true); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOverDropzone(false); }}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragOverDropzone(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) processDroppedFile(file);
                }}
                data-testid="doc-dropzone"
              >
                {docUploading ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </div>
                ) : docForm.fileName ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">{docForm.fileName}</span>
                    {docForm.fileSize > 0 && <span className="text-xs text-muted-foreground">({(docForm.fileSize / 1024).toFixed(0)} KB)</span>}
                    <button
                      onClick={e => { e.stopPropagation(); setDocForm(f => ({ ...f, fileBase64: "", fileUrl: "", fileName: "", fileSize: 0 })); }}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                    >×</button>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    <Upload className={`w-7 h-7 mx-auto mb-2 transition-colors ${isDragOverDropzone ? "text-[hsl(var(--maritime-primary))]" : "opacity-40"}`} />
                    <p className="text-sm font-medium">{isDragOverDropzone ? "Drop file here" : "Drag & drop or click to select"}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">PDF, PNG, JPG, DOCX — max 20 MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.docx"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-doc-file"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Document Name *</Label>
              <Input value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))} placeholder="Document name" data-testid="input-doc-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Document Type</Label>
              <Select value={docForm.docType} onValueChange={v => setDocForm(f => ({ ...f, docType: v }))}>
                <SelectTrigger data-testid="select-doc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={docForm.notes} onChange={e => setDocForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" data-testid="input-doc-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDocDialog(false)}>Cancel</Button>
            <Button
              onClick={() => uploadDocMutation.mutate()}
              disabled={uploadDocMutation.isPending || docUploading || (!docForm.fileBase64 && !docForm.fileUrl) || !docForm.name.trim()}
              data-testid="button-save-doc"
            >
              {uploadDocMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Picker Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-lg" data-testid="dialog-template-picker">
          <DialogHeader>
            <DialogTitle className="font-serif">Create Document from Template</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {docTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No templates found</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {docTemplates.map((tmpl: any) => (
                  <button
                    key={tmpl.id}
                    onClick={() => fromTemplateMutation.mutate(tmpl.id)}
                    disabled={fromTemplateMutation.isPending}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:border-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.04)] transition-all text-left"
                    data-testid={`template-option-${tmpl.id}`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{tmpl.name}</p>
                      <p className="text-xs text-muted-foreground">{tmpl.category}</p>
                    </div>
                    {fromTemplateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature Dialog */}
      <Dialog open={showSignDialog} onOpenChange={v => { setShowSignDialog(v); if (!v) { setSignDocId(null); setSignatureText(""); } }}>
        <DialogContent className="max-w-sm" data-testid="dialog-sign-doc">
          <DialogHeader>
            <DialogTitle className="font-serif">Sign Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name / Title *</Label>
              <Input
                value={signatureText}
                onChange={e => setSignatureText(e.target.value)}
                placeholder="Your name and title"
                data-testid="input-signature-text"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Signature Date</Label>
              <Input value={fmtDate(new Date())} disabled className="bg-muted" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignDialog(false)}>Cancel</Button>
            <Button
              onClick={() => { if (signDocId && signatureText.trim()) signDocMutation.mutate({ docId: signDocId, sigText: signatureText.trim() }); }}
              disabled={signDocMutation.isPending || !signatureText.trim()}
              data-testid="button-confirm-sign"
            >
              {signDocMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Voyage Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Rate your experience on this voyage.</p>
            <div className="space-y-1.5">
              <Label>Rating *</Label>
              <StarRatingInput value={reviewForm.rating} onChange={v => setReviewForm(f => ({ ...f, rating: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Comment</Label>
              <Textarea
                value={reviewForm.comment}
                onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
                placeholder="Describe your experience..."
                rows={3}
                data-testid="textarea-review-comment"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createReviewMutation.mutate()}
              disabled={createReviewMutation.isPending || reviewForm.rating === 0}
              data-testid="button-save-review"
            >
              {createReviewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Ops Summary Report Dialog ────────────────────────────────────────── */}
      <Dialog open={opsSummaryOpen} onOpenChange={setOpsSummaryOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-700 text-slate-100" data-testid="dialog-ops-summary">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-base font-bold text-slate-100">📋 Operations Summary Report</DialogTitle>
              <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-0.5">
                {(["EN", "TR"] as const).map(l => (
                  <button
                    key={l}
                    onClick={() => { setOpsSummaryLang(l); setOpsSummaryText(generateOpsSummary(l)); }}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${opsSummaryLang === l ? "bg-cyan-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                    data-testid={`toggle-lang-${l}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-0.5 pt-1">
              <p className="text-xs text-slate-400">Auto-generated from current crew data. You may edit before sending.</p>
              <p className="text-[11px] text-slate-500 font-mono">
                Vessel: <span className="text-slate-400">{voyage?.vesselName || "—"}</span>
                {" "}|{" "}Port: <span className="text-slate-400">{voyage?.portName || "—"}</span>
                {" "}|{" "}Generated: <span className="text-slate-400">{new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })} / {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
              </p>
            </div>
          </DialogHeader>

          <div className="py-1">
            <textarea
              value={opsSummaryText}
              onChange={e => setOpsSummaryText(e.target.value)}
              rows={18}
              className="w-full rounded-md bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono px-3 py-2.5 resize-none focus:outline-none focus:border-cyan-600/60 focus:ring-1 focus:ring-cyan-600/30 transition-all"
              data-testid="textarea-ops-summary"
              spellCheck={false}
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-0">
            <button
              onClick={() => {
                navigator.clipboard.writeText(opsSummaryText).then(() => {
                  const t = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                  addActivityLog(`Operation summary copied to clipboard (${opsSummaryLang}) at ${t}.`, "Agent");
                });
              }}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 transition-all"
              data-testid="button-ops-copy"
            >
              📋 Copy to Clipboard
            </button>
            <button
              onClick={() => {
                const subject = encodeURIComponent(`Operations Summary — ${voyage?.vesselName || "Vessel"}`);
                const body = encodeURIComponent(opsSummaryText);
                window.open(`mailto:?subject=${subject}&body=${body}`);
                const t = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
                addActivityLog(`Operation summary sent via email in ${opsSummaryLang} at ${t}.`, "Agent");
              }}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-semibold bg-emerald-700/30 hover:bg-emerald-700/50 border border-emerald-600/50 text-emerald-300 hover:text-emerald-200 transition-all"
              data-testid="button-ops-send-email"
            >
              📧 Send via Email
            </button>
            <button
              onClick={() => setOpsSummaryOpen(false)}
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 transition-all ml-auto"
              data-testid="button-ops-close"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Crew Document Generator Dialog ───────────────────────────────────── */}
      <Dialog open={showCrewDocDialog} onOpenChange={setShowCrewDocDialog}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-100">
              <FileText className="w-5 h-5 text-teal-400" />
              Resmi Belgeler Oluştur
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              {crewSigners.filter(c => c.side === "on").length} katılan, {crewSigners.filter(c => c.side === "off").length} ayrılan mürettebat için belge seçin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {[
              { key: "gumruk",      label: "Gümrük – Personel Değişikliği",        desc: `${crewSigners.filter(c => c.side === "on").length} katılım, ${crewSigners.filter(c => c.side === "off").length} ayrılış` },
              { key: "polisYurttan", label: "Polis – Yurttan Çıkış",                desc: `${crewSigners.filter(c => c.side === "on").length} kişi`, disabled: crewSigners.filter(c => c.side === "on").length === 0 },
              { key: "polisYurda",  label: "Polis – Yurda Giriş",                  desc: `${crewSigners.filter(c => c.side === "off").length} kişi`, disabled: crewSigners.filter(c => c.side === "off").length === 0 },
              { key: "vize",        label: "Vize Talep Formu",                     desc: `${crewSigners.filter(c => c.visaRequired).length} kişi`, disabled: crewSigners.filter(c => c.visaRequired).length === 0 },
              { key: "acente",      label: "Acente Personeli Liman Giriş İzni",    desc: "Acente personeli" },
              { key: "ekimTur",     label: "Ekim Tur Giriş İzni",                  desc: "Transfer acentesi" },
            ].map(opt => (
              <label key={opt.key} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${opt.disabled ? "opacity-40 cursor-not-allowed border-slate-700/40 bg-slate-800/20" : docSel[opt.key as keyof DocSelection] ? "border-teal-500/50 bg-teal-900/20" : "border-slate-700 bg-slate-800/40 hover:border-slate-600"}`}>
                <Checkbox
                  checked={docSel[opt.key as keyof DocSelection]}
                  disabled={opt.disabled}
                  onCheckedChange={v => setDocSel(s => ({ ...s, [opt.key]: !!v }))}
                  className="border-slate-600"
                  data-testid={`check-doc-${opt.key}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{opt.label}</p>
                  <p className="text-xs text-slate-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowCrewDocDialog(false)}
              className="h-9 px-4 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-all"
              data-testid="button-crew-doc-cancel"
            >
              İptal
            </button>
            <button
              onClick={() => {
                const docDate = new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
                const mappedCrew = crewSigners.map(c => ({
                  id: c.id,
                  husbandryOrderId: 0,
                  vesselId: voyage?.vesselId ?? 0,
                  changeType: c.side === "on" ? "sign_on" : "sign_off",
                  seafarerName: c.name,
                  rank: c.rank ?? null,
                  nationality: c.nationality ?? null,
                  passportNumber: c.passportNo ?? null,
                  seamanBookNumber: c.seamanBookNo ?? null,
                  dateOfBirth: c.dob ? new Date(c.dob) : null,
                  birthPlace: c.birthPlace ?? null,
                  visaRequired: c.visaRequired ?? false,
                  port: voyage?.portName ?? null,
                  passportIssueDate: null,
                  passportExpiry: null,
                  seamanBookIssueDate: null,
                  seamanBookExpiry: null,
                  departureDate: null,
                  arrivalDate: null,
                  visaStatus: null,
                  flightDetails: c.flight ?? null,
                  hotelRequired: c.requiresHotel ?? false,
                  hotelName: c.hotelName ?? null,
                  changeDate: null,
                  notes: null,
                  createdAt: new Date(),
                }));
                generateAndPrintCrewDocs(
                  {
                    crewChanges: mappedCrew as any,
                    vessel: {
                      name: voyage?.vesselName ?? "",
                      flag: vesselData?.flag ?? "",
                      imoNumber: voyage?.imoNumber ?? null,
                    },
                    config: crewDocConfig ?? null,
                  },
                  docSel,
                  docDate
                );
                setShowCrewDocDialog(false);
              }}
              disabled={!Object.values(docSel).some(Boolean)}
              className="h-9 px-5 rounded-lg text-sm font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="button-crew-doc-generate"
            >
              <FileText className="w-4 h-4 inline mr-1.5" />
              Belgeleri Oluştur
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Close Operation / Finance Handover Modal ─────────────────────────── */}
      {showCloseOpModal && (() => {
        const isCrewOp = voyage.purposeOfCall === "Crew Change" || voyage.purposeOfCall === "Husbandry";
        const hasPdaDoc = docs.some((d: any) => /proforma|pda/i.test((d.name || "") + (d.docType || "")));
        const hasHotelDoc = docs.some((d: any) => /hotel|otel/i.test((d.name || "") + (d.docType || "")));
        const checkItems = [
          {
            id: "op_status",
            label: "Operasyon Durumu",
            ok: voyage.status === "active" || voyage.status === "completed",
            detailOk: "Sefer aktif/tamamlandı durumunda.",
            detailFail: "Sefer henüz planlama aşamasında, finansa aktarılamaz.",
            actionLabel: null as string | null,
            critical: true,
          },
          {
            id: "pda",
            label: "Acente PDA Proforması",
            ok: hasPdaDoc,
            detailOk: "PDA/Proforma belgesi sisteme yüklendi.",
            detailFail: "Proforma henüz oluşturulmadı ya da belge yüklenmedi.",
            actionLabel: "PDA Oluştur",
            actionHref: `/proformas/new?voyageId=${voyageId}`,
            critical: false,
          },
          {
            id: "docs",
            label: "Operasyon Belgeleri",
            ok: docs.length > 0,
            detailOk: `${docs.length} belge sisteme yüklendi.`,
            detailFail: "Hiç operasyon belgesi yüklenmedi.",
            actionLabel: "Belge Yükle",
            critical: false,
          },
          ...(isCrewOp ? [{
            id: "hotel_docs",
            label: "Otel Faturaları / Belgeleri",
            ok: hasHotelDoc,
            detailOk: "Otel belgesi sisteme yüklendi.",
            detailFail: "Otel faturası / rezervasyon belgesi yüklenmedi.",
            actionLabel: "Şimdi Yükle" as string | null,
            critical: false,
          }] : []),
        ];
        const hasCriticalFail = checkItems.some(i => i.critical && !i.ok);
        const hasNonCriticalFail = checkItems.some(i => !i.critical && !i.ok);
        const canConfirm = !hasCriticalFail && (!hasNonCriticalFail || closeOpAcknowledge);
        return (
          <Dialog open={showCloseOpModal} onOpenChange={v => { if (!v) setShowCloseOpModal(false); }}>
            <DialogContent className="max-w-lg bg-slate-900 border-slate-700 text-slate-100" data-testid="dialog-close-operation">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-slate-100 flex items-center gap-2">
                  ⚡ Operasyonu Finansa Devret
                </DialogTitle>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {voyage.vesselName || "—"} · {voyage.portName || "—"}
                </p>
              </DialogHeader>

              <div className="space-y-2 py-1">
                <p className="text-xs text-slate-400 pb-1">Sistem operasyon verilerini taradı. Lütfen aşağıdaki kalemleri gözden geçirin:</p>
                {checkItems.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      item.ok
                        ? "bg-emerald-950/30 border-emerald-700/30"
                        : item.critical
                        ? "bg-red-950/40 border-red-500/50 shadow-[0_0_8px_rgba(239,68,68,0.15)]"
                        : "bg-amber-950/30 border-amber-700/30"
                    }`}
                    data-testid={`check-item-${item.id}`}
                  >
                    <span className="text-lg leading-none mt-0.5 flex-shrink-0">
                      {item.ok ? "✅" : item.critical ? "❌" : "⚠️"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${item.ok ? "text-emerald-300" : item.critical ? "text-red-300" : "text-amber-300"}`}>{item.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.ok ? item.detailOk : item.detailFail}</p>
                    </div>
                    {!item.ok && item.actionLabel && (
                      "actionHref" in item && (item as any).actionHref ? (
                        <a
                          href={(item as any).actionHref}
                          onClick={() => setShowCloseOpModal(false)}
                          className="flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-md bg-amber-700/30 border border-amber-600/40 text-amber-300 hover:bg-amber-700/50 transition-colors"
                          data-testid={`action-${item.id}`}
                        >
                          {item.actionLabel}
                        </a>
                      ) : (
                        <button
                          onClick={() => setShowCloseOpModal(false)}
                          className="flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-md bg-amber-700/30 border border-amber-600/40 text-amber-300 hover:bg-amber-700/50 transition-colors"
                          data-testid={`action-${item.id}`}
                        >
                          {item.actionLabel}
                        </button>
                      )
                    )}
                  </div>
                ))}

                {hasCriticalFail && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-500/40 mt-2">
                    <span className="text-base">🚫</span>
                    <p className="text-xs text-red-300 font-semibold">Kritik eksikler tamamlanmadan operasyon finansa aktarılamaz.</p>
                  </div>
                )}
                {!hasCriticalFail && hasNonCriticalFail && (
                  <label className="flex items-start gap-2 p-3 rounded-lg bg-amber-950/30 border border-amber-700/30 cursor-pointer mt-2" data-testid="label-acknowledge">
                    <input
                      type="checkbox"
                      checked={closeOpAcknowledge}
                      onChange={e => setCloseOpAcknowledge(e.target.checked)}
                      className="mt-0.5 accent-amber-500"
                      data-testid="checkbox-acknowledge"
                    />
                    <span className="text-xs text-amber-300">Eksik kalemlerin farkındayım, yine de devam etmek istiyorum.</span>
                  </label>
                )}
              </div>

              <DialogFooter className="gap-2 pt-1">
                <button
                  onClick={() => setShowCloseOpModal(false)}
                  className="h-8 px-4 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 transition-all"
                  data-testid="button-closeop-cancel"
                >
                  İptal
                </button>
                <button
                  disabled={!canConfirm}
                  onClick={() => {
                    statusMutation.mutate("pending_finance");
                    addActivityLog("Operasyon finansa devredildi (Pending Finance).", "Agent");
                    setShowCloseOpModal(false);
                  }}
                  className={`h-8 px-4 rounded-lg text-xs font-bold border transition-all ${
                    canConfirm
                      ? "bg-amber-600/30 hover:bg-amber-600/50 border-amber-500/50 text-amber-200"
                      : "bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed"
                  }`}
                  data-testid="button-closeop-confirm"
                >
                  ✓ Onayla ve Finansa Gönder
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Status Confirmation Dialog */}
      <AlertDialog open={pendingStatus !== null} onOpenChange={open => { if (!open) setPendingStatus(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancel This Voyage?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This voyage will be marked as cancelled. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingStatus(null)} data-testid="button-cancel-status">Go Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (pendingStatus) { statusMutation.mutate(pendingStatus); setPendingStatus(null); } }}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-status"
            >
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close-out Checklist Dialog */}
      <Dialog open={showCloseOutDialog} onOpenChange={setShowCloseOutDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Voyage Close-out Checklist
            </DialogTitle>
            <DialogDescription>
              Verify the following items before completing the voyage.
            </DialogDescription>
          </DialogHeader>

          {isLoadingCloseOutStatus ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    {closeOutStatus?.fdaApproved ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">FDA Status</p>
                      <p className="text-xs text-muted-foreground">
                        {closeOutStatus?.fdaApproved ? "Approved FDA exists" : "No approved FDA found"}
                      </p>
                    </div>
                  </div>
                  <Badge variant={closeOutStatus?.fdaApproved ? "default" : "outline"}>
                    {closeOutStatus?.fdaCount} FDAs
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    {closeOutStatus?.allInvoicesPaid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">Invoices</p>
                      <p className="text-xs text-muted-foreground">
                        {closeOutStatus?.allInvoicesPaid ? "All invoices paid" : `${closeOutStatus?.pendingInvoiceCount} invoices pending`}
                      </p>
                    </div>
                  </div>
                  <Badge variant={closeOutStatus?.allInvoicesPaid ? "default" : "destructive"}>
                    ${closeOutStatus?.pendingInvoiceTotal} Pending
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    {closeOutStatus?.daAdvancesSettled ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">DA Advances</p>
                      <p className="text-xs text-muted-foreground">
                        {closeOutStatus?.daAdvancesSettled ? "All advances settled" : `${closeOutStatus?.pendingAdvanceCount} advances pending`}
                      </p>
                    </div>
                  </div>
                  <Badge variant={closeOutStatus?.daAdvancesSettled ? "default" : "outline"}>
                    {closeOutStatus?.pendingAdvanceCount} Pending
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg bg-muted/30 flex flex-col items-center justify-center">
                    <p className="text-2xl font-bold">{closeOutStatus?.sofsCount}</p>
                    <p className="text-xs text-muted-foreground uppercase">SOF Records</p>
                  </div>
                  <div className="p-3 border rounded-lg bg-muted/30 flex flex-col items-center justify-center">
                    <p className="text-2xl font-bold">{closeOutStatus?.norsCount}</p>
                    <p className="text-xs text-muted-foreground uppercase">NOR Records</p>
                  </div>
                </div>
              </div>

              {closeOutStatus?.warnings?.length > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Attention Required
                  </h4>
                  <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc pl-5 space-y-1">
                    {closeOutStatus.warnings.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCloseOutDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => completeVoyageMutation.mutate()}
              disabled={completeVoyageMutation.isPending}
              data-testid="button-complete-voyage-final"
            >
              {completeVoyageMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Complete Voyage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voyage Summary Dialog */}
      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheck className="w-6 h-6 text-emerald-500" />
              Voyage Summary
            </DialogTitle>
            <DialogDescription>
              Performance metrics for Voyage #{voyageId}
            </DialogDescription>
          </DialogHeader>

          {closeOutSummary && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase">Total PDA (Estimated)</p>
                  <p className="text-xl font-bold">${closeOutSummary.totalPda.toLocaleString()}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs text-muted-foreground uppercase">Total FDA (Actual)</p>
                  <p className="text-xl font-bold text-emerald-600">${closeOutSummary.totalActual.toLocaleString()}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl border-2 border-dashed flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Variance</p>
                  <p className="text-xs text-muted-foreground">Difference between estimated and actual</p>
                </div>
                <div className={`text-xl font-black ${closeOutSummary.variance <= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {closeOutSummary.variance > 0 ? "+" : ""}{closeOutSummary.variance.toLocaleString()} USD
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Voyage Duration</span>
                <span className="font-semibold">{closeOutSummary.durationDays} Days</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button className="w-full" onClick={() => setShowSummaryDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
