import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { EmptyState } from "@/components/empty-state";
import { Ship, Plus, MapPin, Calendar, ChevronRight, Anchor, CheckCircle2, Clock, XCircle, PlayCircle, Search, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import type { Vessel, Port } from "@shared/schema";
import { fmtDate } from "@/lib/formatDate";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  planned:         { label: "Planned",         color: "bg-blue-900/30 text-blue-400 border border-blue-500/30",       icon: Clock },
  active:          { label: "Active",          color: "bg-green-900/30 text-green-400 border border-green-500/30",    icon: PlayCircle },
  completed:       { label: "Completed",       color: "bg-slate-700/50 text-slate-400 border border-slate-600/30",    icon: CheckCircle2 },
  cancelled:       { label: "Cancelled",       color: "bg-red-900/30 text-red-400 border border-red-500/30",          icon: XCircle },
  pending_finance: { label: "Pending Finance", color: "bg-amber-900/30 text-amber-400 border border-amber-500/30",    icon: AlertCircle },
  archived:        { label: "Archived",        color: "bg-slate-800/50 text-slate-500 border border-slate-700/30",    icon: CheckCircle },
};

const PURPOSE_STYLE: Record<string, { bg: string; text: string; border: string; icon: string; label: string; pill: string; pillActive: string; bar: string }> = {
  "Crew Change": { bg: "bg-purple-900/50", text: "text-purple-300", border: "border-purple-500/20", icon: "🟣", label: "CREW CHANGE",  pill: "border-purple-500/40 text-purple-300 hover:bg-purple-900/40", pillActive: "bg-purple-900/50 border-purple-400/60 text-purple-200 ring-1 ring-purple-400/30", bar: "bg-purple-500" },
  "Husbandry":   { bg: "bg-purple-900/50", text: "text-purple-300", border: "border-purple-500/20", icon: "🟣", label: "HUSBANDRY",    pill: "border-purple-500/40 text-purple-300 hover:bg-purple-900/40", pillActive: "bg-purple-900/50 border-purple-400/60 text-purple-200 ring-1 ring-purple-400/30", bar: "bg-purple-500" },
  "Loading":     { bg: "bg-emerald-900/50", text: "text-emerald-300", border: "border-emerald-500/20", icon: "🟢", label: "LOADING",    pill: "border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40", pillActive: "bg-emerald-900/50 border-emerald-400/60 text-emerald-200 ring-1 ring-emerald-400/30", bar: "bg-emerald-500" },
  "Discharging": { bg: "bg-orange-900/50", text: "text-orange-300", border: "border-orange-500/20", icon: "🟠", label: "DISCHARGING",  pill: "border-orange-500/40 text-orange-300 hover:bg-orange-900/40", pillActive: "bg-orange-900/50 border-orange-400/60 text-orange-200 ring-1 ring-orange-400/30", bar: "bg-orange-500" },
  "Transit":     { bg: "bg-blue-900/50",   text: "text-blue-300",   border: "border-blue-500/20",   icon: "🔵", label: "TRANSIT",      pill: "border-blue-500/40 text-blue-300 hover:bg-blue-900/40",     pillActive: "bg-blue-900/50 border-blue-400/60 text-blue-200 ring-1 ring-blue-400/30",     bar: "bg-blue-500"    },
  "Bunkering":   { bg: "bg-blue-900/50",   text: "text-blue-300",   border: "border-blue-500/20",   icon: "🔵", label: "BUNKERING",    pill: "border-blue-500/40 text-blue-300 hover:bg-blue-900/40",     pillActive: "bg-blue-900/50 border-blue-400/60 text-blue-200 ring-1 ring-blue-400/30",     bar: "bg-blue-500"    },
  "Repair":      { bg: "bg-red-900/50",    text: "text-red-300",    border: "border-red-500/20",    icon: "🔴", label: "REPAIR",       pill: "border-red-500/40 text-red-300 hover:bg-red-900/40",         pillActive: "bg-red-900/50 border-red-400/60 text-red-200 ring-1 ring-red-400/30",         bar: "bg-red-500"     },
  "Inspection":  { bg: "bg-blue-900/50",   text: "text-blue-300",   border: "border-blue-500/20",   icon: "🔵", label: "INSPECTION",   pill: "border-blue-500/40 text-blue-300 hover:bg-blue-900/40",     pillActive: "bg-blue-900/50 border-blue-400/60 text-blue-200 ring-1 ring-blue-400/30",     bar: "bg-blue-500"    },
};
const DEFAULT_PURPOSE_STYLE = { bg: "bg-blue-900/50", text: "text-blue-300", border: "border-blue-500/20", icon: "🔵", label: "OPERATION", pill: "border-blue-500/40 text-blue-300 hover:bg-blue-900/40", pillActive: "bg-blue-900/50 border-blue-400/60 text-blue-200 ring-1 ring-blue-400/30", bar: "bg-blue-500" };

// Port call operational stage — derived from voyage.status
// If a dedicated portCallStage field is added to the voyage table in the future, extend this config
const PORT_CALL_STAGE: Record<string, { label: string; dot: string; text: string }> = {
  planned:         { label: "Pre-Arrival",    dot: "bg-blue-400",   text: "text-blue-400"   },
  active:          { label: "In Port",        dot: "bg-green-400",  text: "text-green-400"  },
  completed:       { label: "Departed",       dot: "bg-slate-400",  text: "text-slate-400"  },
  cancelled:       { label: "Cancelled",      dot: "bg-red-400",    text: "text-red-400"    },
  pending_finance: { label: "Finance Review", dot: "bg-amber-400",  text: "text-amber-400"  },
  archived:        { label: "Archived",       dot: "bg-slate-500",  text: "text-slate-500"  },
};

const PURPOSE_OPTIONS = ["Loading", "Discharging", "Transit", "Bunkering", "Repair", "Crew Change", "Inspection", "Husbandry"];

const FLAG_EMOJI: Record<string, string> = {
  "Turkey": "🇹🇷", "Malta": "🇲🇹", "Panama": "🇵🇦", "Liberia": "🇱🇷",
  "Marshall Islands": "🇲🇭", "Bahamas": "🇧🇸", "Greece": "🇬🇷", "Cyprus": "🇨🇾",
  "Singapore": "🇸🇬", "Hong Kong": "🇭🇰", "Norway": "🇳🇴", "United Kingdom": "🇬🇧",
  "Antigua & Barbuda": "🇦🇬", "Belize": "🇧🇿", "Comoros": "🇰🇲",
};

interface VesselInfo {
  name: string;
  flag: string;
  vesselType: string;
  imoNumber: string;
  mmsi: string | null;
  callSign: string;
  grt: number | null;
  dwt: number | null;
}

function getCountryFlag(country: string): string {
  if (!country) return "🌍";
  if (country === "Turkey") return "🇹🇷";
  if (country.length === 2) {
    const base = 0x1F1E6;
    const offset = "A".charCodeAt(0);
    return String.fromCodePoint(base + country.charCodeAt(0) - offset) +
           String.fromCodePoint(base + country.charCodeAt(1) - offset);
  }
  return "🌍";
}

function getCountryLabel(country: string): string {
  if (!country) return "";
  if (country === "Turkey") return "Turkey (TR)";
  if (country.length === 2) return `(${country})`;
  return country;
}

function PortSearch({ value, onChange }: { value: string; onChange: (portId: number, portName: string) => void }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useState(() => ({ current: null as HTMLDivElement | null }))[0];
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
      <Input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        placeholder="Search port name or LOCODE (e.g. Antwerp, Rotterdam)..."
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        data-testid="input-port-search"
      />
      {open && ports && ports.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto divide-y">
          {ports.map(p => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors flex items-center gap-3"
              onMouseDown={() => {
                onChange(p.id, p.name);
                setQuery(p.name);
                setOpen(false);
              }}
              data-testid={`option-port-${p.id}`}
            >
              <span className="text-xl flex-shrink-0 leading-none">{getCountryFlag(p.country || "")}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {getCountryLabel(p.country || "")}
                  {p.code ? `, Unlocode: ${p.code}` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const CARGO_PURPOSES = ["Loading", "Discharging", "Transit", "Bunkering", "Repair", "Inspection"];

const EMPTY_FORM = {
  portId: 0,
  portName: "",
  vesselId: null as number | null,
  vesselName: "",
  agentUserId: "",
  status: "planned",
  eta: "",
  etd: "",
  purposeOfCall: "Loading",
  notes: "",
  cargoType: "",
  cargoQuantity: "",
};

export default function Voyages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // IMO lookup state
  const [imoQuery, setImoQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [vesselInfo, setVesselInfo] = useState<VesselInfo | null>(null);

  const [activeFilter, setActiveFilter] = useState<string>("all");

  const role = (user as any)?.activeRole || (user as any)?.userRole || "shipowner";

  const { data: voyageList, isLoading } = useQuery<any[]>({
    queryKey: ["/api/voyages"],
  });

  const { data: vessels } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
    enabled: role !== "agent",
  });

  const handleImoLookup = async () => {
    const imo = imoQuery.replace(/\D/g, "");
    if (imo.length < 5) {
      setLookupError("Enter a valid IMO number (5-7 digits).");
      return;
    }
    setLookupLoading(true);
    setLookupError("");
    setVesselInfo(null);
    try {
      const res = await fetch(`/api/vessels/lookup?imo=${imo}`);
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.message || "Vessel not found. You can enter details manually.");
        return;
      }
      setVesselInfo(data);
      setForm(f => ({ ...f, vesselName: data.name, vesselId: null }));
    } catch {
      setLookupError("Connection error. Try again or enter manually.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleFleetSelect = (id: string) => {
    const v = vessels?.find(v => String(v.id) === id);
    if (!v) return;
    const info: VesselInfo = {
      name: v.name,
      flag: v.flag || "",
      vesselType: v.vesselType || "",
      imoNumber: v.imoNumber || "",
      mmsi: null,
      callSign: v.callSign || "",
      grt: v.grt || null,
      dwt: v.dwt || null,
    };
    setVesselInfo(info);
    setImoQuery(v.imoNumber || "");
    setForm(f => ({ ...f, vesselId: v.id, vesselName: v.name }));
    setLookupError("");
  };

  const clearVesselInfo = () => {
    setVesselInfo(null);
    setImoQuery("");
    setLookupError("");
    setForm(f => ({ ...f, vesselId: null, vesselName: "" }));
  };

  const handleDialogClose = (open: boolean) => {
    setShowCreate(open);
    if (!open) {
      setForm(EMPTY_FORM);
      setVesselInfo(null);
      setImoQuery("");
      setLookupError("");
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        portId: form.portId,
        purposeOfCall: form.purposeOfCall,
        notes: form.notes || null,
        status: "planned",
      };
      if (form.vesselId) payload.vesselId = form.vesselId;
      if (form.vesselName) payload.vesselName = form.vesselName;
      if (form.agentUserId) payload.agentUserId = form.agentUserId;
      if (form.eta) payload.eta = form.eta;
      if (form.etd) payload.etd = form.etd;
      if (vesselInfo?.imoNumber) payload.imoNumber = vesselInfo.imoNumber;
      if (vesselInfo?.flag) payload.flag = vesselInfo.flag;
      if (vesselInfo?.vesselType) payload.vesselType = vesselInfo.vesselType;
      if (vesselInfo?.grt) payload.grt = vesselInfo.grt;
      if (vesselInfo?.mmsi) payload.mmsi = vesselInfo.mmsi;
      if (vesselInfo?.callSign) payload.callSign = vesselInfo.callSign;
      if (form.cargoType) payload.cargoType = form.cargoType;
      if (form.cargoQuantity) payload.cargoQuantity = parseFloat(form.cargoQuantity);
      const res = await apiRequest("POST", "/api/voyages", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages"] });
      toast({ title: "Voyage created" });
      handleDialogClose(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to create voyage", variant: "destructive" }),
  });

  // ── Filtering logic ──────────────────────────────────────────────────────
  const now = new Date();
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const filteredVoyages = (voyageList ?? []).filter((v: any) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "next24h") {
      if (!v.eta) return false;
      const eta = new Date(v.eta);
      return eta >= now && eta <= next24h;
    }
    return v.purposeOfCall === activeFilter;
  });

  // Build unique pill options from actual data
  const purposeCounts: Record<string, number> = {};
  (voyageList ?? []).forEach((v: any) => {
    const p = v.purposeOfCall || "Other";
    purposeCounts[p] = (purposeCounts[p] || 0) + 1;
  });
  const next24hCount = (voyageList ?? []).filter((v: any) => {
    if (!v.eta) return false;
    const eta = new Date(v.eta);
    return eta >= now && eta <= next24h;
  }).length;

  const PILL_ORDER = ["Loading", "Discharging", "Crew Change", "Husbandry", "Transit", "Bunkering", "Repair", "Inspection"];
  const activePurposes = PILL_ORDER.filter(p => purposeCounts[p]);
  const otherPurposes = Object.keys(purposeCounts).filter(p => !PILL_ORDER.includes(p));

  // ── Glanceable Card Helpers ──────────────────────────────────────────────
  const calcCountdown = (v: any): { text: string; urgent: boolean } => {
    const st = v.status;
    if (st === "cancelled")      return { text: "❌ Cancelled",      urgent: false };
    if (st === "archived")       return { text: "🗄️ Archived",       urgent: false };
    if (st === "pending_finance") return { text: "💰 Finance Review", urgent: false };
    if (st === "completed")      return { text: "✅ Departed",        urgent: false };
    const target = st === "active" && v.etd ? new Date(v.etd) : v.eta ? new Date(v.eta) : null;
    if (!target) return st === "active" ? { text: "🟢 In Port", urgent: false } : { text: "—", urgent: false };
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) return st === "active" ? { text: "🟢 In Port", urgent: false } : { text: "⏰ Overdue", urgent: true };
    const diffH = Math.floor(diffMs / 3_600_000);
    const diffM = Math.floor((diffMs % 3_600_000) / 60_000);
    const diffD = Math.floor(diffH / 24);
    if (diffH < 24) return { text: `⏰ ${diffH}h ${diffM}m Left`, urgent: true };
    return { text: `⏳ ${diffD}d ${diffH % 24}h Left`, urgent: false };
  };

  const calcProgress = (v: any): number => {
    if (v.status === "cancelled")       return 0;
    if (v.status === "planned")         return 10;
    if (v.status === "archived")        return 100;
    if (v.status === "completed")       return 100;
    if (v.status === "pending_finance") return 95;
    if (v.status === "active") {
      if (v.eta && v.etd) {
        const start = new Date(v.eta).getTime();
        const end   = new Date(v.etd).getTime();
        const span  = end - start;
        if (span > 0) {
          const pct = Math.round(((now.getTime() - start) / span) * 100);
          return Math.max(15, Math.min(90, pct));
        }
      }
      return 50;
    }
    return 10;
  };

  const getPdaStatus = (v: any): { label: string; color: string } => {
    if (v.status === "cancelled") return { label: "—", color: "text-slate-500" };
    if (v.proformaCount > 0) {
      const totalK = v.proformaTotalUsd ? `$${Math.round(v.proformaTotalUsd / 1000)}K` : "";
      const st = v.proformaLatestStatus;
      const approvalSt = v.proformaLatestApprovalStatus;
      if (approvalSt === "approved")  return { label: `✅ ${totalK}`,    color: "text-emerald-400" };
      if (st === "sent")              return { label: `📤 ${totalK}`,    color: "text-sky-400" };
      if (st === "final")             return { label: `🏁 ${totalK}`,    color: "text-violet-400" };
      return                                 { label: `📝 Draft ${totalK}`, color: "text-amber-300" };
    }
    if (v.status === "archived")        return { label: "✅ Archived",    color: "text-slate-400" };
    if (v.status === "pending_finance") return { label: "💰 In Review",   color: "text-amber-400" };
    if (v.status === "completed")       return { label: "✅ Finalized",   color: "text-emerald-400" };
    if (v.status === "active")          return { label: "⏳ Pending",     color: "text-amber-300" };
    return                                     { label: "📝 Not Started", color: "text-slate-400" };
  };

  return (
    <div className="px-3 py-5 space-y-5 max-w-7xl mx-auto">
      <PageMeta title="Voyages | VesselPDA" description="Voyage and operations management" />

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-voyages-title">Voyages</h1>
          <p className="text-muted-foreground text-sm">Operations files and voyage management</p>
        </div>
        {role !== "provider" && (
          <Button onClick={() => setShowCreate(true)} className="gap-2" data-testid="button-create-voyage">
            <Plus className="w-4 h-4" /> New Voyage
          </Button>
        )}
      </div>

      {/* ── Smart Filter Bar ── */}
      {!isLoading && voyageList && voyageList.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap" data-testid="filter-bar-voyages">
          {/* All Voyages */}
          <button
            onClick={() => setActiveFilter("all")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              activeFilter === "all"
                ? "bg-slate-600 border-slate-500 text-slate-100 ring-1 ring-slate-400/30"
                : "bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-700/60 hover:text-slate-300"
            }`}
            data-testid="filter-pill-all"
          >
            <Anchor className="w-3 h-3" />
            All Voyages
            <span className="ml-0.5 opacity-70">({voyageList.length})</span>
          </button>

          {/* Purpose pills */}
          {[...activePurposes, ...otherPurposes].map(purpose => {
            const ps = PURPOSE_STYLE[purpose] || DEFAULT_PURPOSE_STYLE;
            const isActive = activeFilter === purpose;
            return (
              <button
                key={purpose}
                onClick={() => setActiveFilter(purpose)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  isActive ? ps.pillActive : `bg-slate-800/40 ${ps.pill}`
                }`}
                data-testid={`filter-pill-${purpose.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <span className="text-[11px] leading-none">{ps.icon}</span>
                {purpose}
                <span className="ml-0.5 opacity-70">({purposeCounts[purpose]})</span>
              </button>
            );
          })}

          {/* Next 24h */}
          {next24hCount > 0 && (
            <button
              onClick={() => setActiveFilter("next24h")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                activeFilter === "next24h"
                  ? "bg-amber-900/60 border-amber-400/60 text-amber-200 ring-1 ring-amber-400/30"
                  : "bg-slate-800/40 border-amber-500/30 text-amber-400 hover:bg-amber-900/30"
              }`}
              data-testid="filter-pill-next24h"
            >
              <Clock className="w-3 h-3" />
              Next 24h
              <span className="ml-0.5 opacity-70">({next24hCount})</span>
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : filteredVoyages.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredVoyages.map((v: any) => {
            const s = STATUS_CONFIG[v.status] || STATUS_CONFIG.planned;
            const StatusIcon = s.icon;
            const rawPs = PURPOSE_STYLE[v.purposeOfCall] || DEFAULT_PURPOSE_STYLE;
            const ps = v.status?.toLowerCase() === "cancelled"
              ? { ...rawPs, bg: "bg-slate-800/60", border: "border-slate-600/30", text: "text-slate-500", icon: "⬛", bar: "bg-slate-600" }
              : rawPs;
            const countdown = calcCountdown(v);
            const progress  = calcProgress(v);
            const pdaSt     = getPdaStatus(v);
            const stage     = PORT_CALL_STAGE[v.status] || PORT_CALL_STAGE.planned;
            const isActive  = v.status === "active";

            return (
              <Link key={v.id} href={`/voyages/${v.id}`}>
                <Card
                  className="relative p-0 overflow-hidden hover:shadow-xl hover:shadow-black/40 transition-all cursor-pointer border border-slate-700/60 hover:border-slate-500/50 group bg-slate-800/70 rounded-xl"
                  data-testid={`card-voyage-${v.id}`}
                >
                  {/* ── LAYER 1: CANLI ZİRVE ─────────────────────────────── */}
                  <div className={`${ps.bg} px-4 py-2.5 flex items-center justify-between border-b ${ps.border}`}>
                    <div className="flex items-center gap-2">
                      {/* Pulsing indicator */}
                      <span className="relative flex h-2 w-2 flex-shrink-0">
                        {isActive && (
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${ps.bar}`} />
                        )}
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isActive ? ps.bar : "bg-slate-600"}`} />
                      </span>
                      <span className={`text-[10px] font-bold tracking-widest uppercase ${ps.text}`}>{ps.label} OPERATION</span>
                    </div>
                    <span className={`text-[10px] font-semibold ${countdown.urgent ? "text-amber-300" : "text-slate-400"}`}>
                      {countdown.text}
                    </span>
                  </div>

                  {/* ── LAYER 2: KİMLİK VE LOKASYON ──────────────────────── */}
                  <div className="px-4 pt-3.5 pb-2.5">
                    {/* Vessel name + status badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold text-slate-100 leading-tight truncate">{v.vesselName || "Vessel TBN"}</p>
                        {v.imoNumber && (
                          <span className="font-mono text-[10px] text-slate-500">IMO: {v.imoNumber}</span>
                        )}
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full flex-shrink-0 mt-0.5 ${s.color}`}>
                        <StatusIcon className="w-2.5 h-2.5" />{s.label}
                      </span>
                    </div>
                    {/* Port + berth row */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-300 mb-1">
                      <span className="text-slate-500">📍</span>
                      <span className="truncate font-medium">
                        {v.portName || `Port #${v.portId}`}
                        {v.berthStayDays ? <span className="text-slate-500 font-normal ml-1">· {v.berthStayDays}d berth</span> : ""}
                      </span>
                    </div>
                    {/* ETA formatted */}
                    {v.eta && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span>📅</span>
                        <span>ETA: <span className="text-slate-400 font-medium">
                          {(() => {
                            const d = new Date(v.eta);
                            const dd = String(d.getDate()).padStart(2,"0");
                            const mm = String(d.getMonth()+1).padStart(2,"0");
                            const yyyy = d.getFullYear();
                            const hh = String(d.getHours()).padStart(2,"0");
                            const min = String(d.getMinutes()).padStart(2,"0");
                            return `${dd}.${mm}.${yyyy} - ${hh}:${min}`;
                          })()}
                        </span></span>
                        {countdown.urgent && (
                          <span className="inline-flex items-center text-[9px] font-bold text-amber-400 bg-amber-900/30 border border-amber-500/30 rounded-full px-1.5 py-0.5 ml-1">⏰ &lt;24h</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── LAYER 3: HAYATİ VERİ IZGARASI ────────────────────── */}
                  <div className="px-4 pb-3">
                    <div className="border-t border-slate-700/50 pt-2.5 grid grid-cols-3 gap-2">
                      {/* Col 1: Cargo Info */}
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase text-slate-500 tracking-wide mb-0.5">📦 Cargo</p>
                        <p className="text-[11px] font-semibold text-slate-200 truncate">
                          {v.cargoType || (v.purposeOfCall === "Crew Change" || v.purposeOfCall === "Husbandry" ? "N/A" : "—")}
                        </p>
                      </div>
                      {/* Col 2: PDA Status */}
                      <div
                        className={`min-w-0 ${v.proformaLatestId ? "cursor-pointer group/pda" : ""}`}
                        onClick={v.proformaLatestId ? (e) => { e.preventDefault(); e.stopPropagation(); setLocation(`/proformas/${v.proformaLatestId}`); } : undefined}
                        data-testid={`pda-status-${v.id}`}
                      >
                        <p className="text-[10px] uppercase text-slate-500 tracking-wide mb-0.5">💰 PDA</p>
                        <p className={`text-[11px] font-semibold truncate ${pdaSt.color} ${v.proformaLatestId ? "group-hover/pda:underline" : ""}`}>{pdaSt.label}</p>
                      </div>
                      {/* Col 3: Live Status */}
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase text-slate-500 tracking-wide mb-0.5">⚓ Live</p>
                        <div className="flex items-center gap-1">
                          <span className={`inline-flex h-1.5 w-1.5 rounded-full flex-shrink-0 ${stage.dot}`} />
                          <p className={`text-[11px] font-semibold truncate ${stage.text}`}>{stage.label}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── LAYER 4: DİNAMİK İLERLEME ÇUBUĞU ────────────────── */}
                  <div className="px-4 pb-3.5" data-testid={`progress-voyage-${v.id}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wide">İlerleme</span>
                      <span className="text-[9px] font-bold text-slate-400">{progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${ps.bar}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* ── Hover Open hint ── */}
                  <div className="absolute bottom-3.5 right-4 flex items-center gap-0.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-medium">Open</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : voyageList && voyageList.length > 0 ? (
        /* Active filter returns no results */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-3">
            <Ship className="w-6 h-6 text-slate-600" />
          </div>
          <p className="text-sm font-semibold text-slate-400">No voyages match this filter</p>
          <p className="text-xs text-slate-600 mt-1">Try a different category or clear the filter</p>
          <button onClick={() => setActiveFilter("all")} className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2">Show all voyages</button>
        </div>
      ) : (
        <EmptyState
          icon="🗺️"
          title="No Voyages Yet"
          description="Voyages are created automatically when a tender is nominated, or you can create one manually."
          actionLabel="+ Create Voyage"
          onAction={() => setShowCreate(true)}
          secondaryLabel="Browse Tenders"
          secondaryHref="/tenders"
          tips={[
            "Create a voyage to manage operations, checklists, and documents",
            "Nominate an agent to automatically generate a voyage file",
            "Invite service providers to submit offers for the voyage",
            "Track voyage progress and status in real-time"
          ]}
        />
      )}

      {/* Create Voyage Dialog */}
      <Dialog open={showCreate} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Create New Voyage</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">

            {/* ── SECTION 1: Gemi Tanımlama ─────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[hsl(var(--maritime-primary))] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</div>
                <span className="text-sm font-semibold">Vessel Identification</span>
              </div>

              {vesselInfo ? (
                /* ── Gemi Bilgi Kartı ── */
                <div className="rounded-lg border-2 border-green-500/30 bg-green-500/5 dark:bg-green-900/10 p-4 relative" data-testid="card-vessel-info">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wide">Verified</span>
                    </div>
                    <button
                      type="button"
                      onClick={clearVesselInfo}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      data-testid="button-clear-vessel"
                    >
                      <X className="w-3 h-3" /> Change
                    </button>
                  </div>

                  <div className="mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{FLAG_EMOJI[vesselInfo.flag] || "🚢"}</span>
                      <Input
                        value={form.vesselName}
                        onChange={e => setForm(f => ({ ...f, vesselName: e.target.value }))}
                        className="font-semibold text-sm h-8 border-0 border-b rounded-none bg-transparent px-0 focus-visible:ring-0 focus-visible:border-primary"
                        data-testid="input-vessel-name"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {vesselInfo.vesselType && (
                      <Badge variant="secondary" className="text-[10px] font-medium">{vesselInfo.vesselType}</Badge>
                    )}
                    {vesselInfo.flag && (
                      <Badge variant="secondary" className="text-[10px] font-medium">{vesselInfo.flag}</Badge>
                    )}
                    {vesselInfo.grt && (
                      <Badge variant="outline" className="text-[10px] font-mono">GRT {vesselInfo.grt.toLocaleString()}</Badge>
                    )}
                    {vesselInfo.dwt && (
                      <Badge variant="outline" className="text-[10px] font-mono">DWT {vesselInfo.dwt.toLocaleString()}</Badge>
                    )}
                  </div>

                  <div className="flex gap-3 mt-3 text-xs text-muted-foreground font-mono">
                    {vesselInfo.imoNumber && <span>IMO: <span className="text-foreground font-semibold">{vesselInfo.imoNumber}</span></span>}
                    {vesselInfo.mmsi && <span>MMSI: <span className="text-foreground">{vesselInfo.mmsi}</span></span>}
                    {vesselInfo.callSign && <span>CS: <span className="text-foreground">{vesselInfo.callSign}</span></span>}
                  </div>
                </div>
              ) : (
                /* ── IMO Arama + Filo ── */
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Auto-fill with IMO Number</Label>
                    <div className="flex gap-2">
                      <Input
                        value={imoQuery}
                        onChange={e => { setImoQuery(e.target.value); setLookupError(""); }}
                        onKeyDown={e => e.key === "Enter" && handleImoLookup()}
                        placeholder="e.g. 9123456"
                        className="font-mono"
                        data-testid="input-imo-number"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleImoLookup}
                        disabled={lookupLoading || imoQuery.length < 5}
                        className="gap-1.5 shrink-0"
                        data-testid="button-imo-lookup"
                      >
                        {lookupLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                        {lookupLoading ? "Searching..." : "Look Up"}
                      </Button>
                    </div>
                    {lookupError && (
                      <div className="flex items-center gap-1.5 text-xs text-destructive" data-testid="text-lookup-error">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        {lookupError}
                      </div>
                    )}
                  </div>

                  {vessels && vessels.length > 0 && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">or select from fleet</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      <Select onValueChange={handleFleetSelect}>
                        <SelectTrigger data-testid="select-vessel" className="text-sm">
                          <SelectValue placeholder="Select from my fleet..." />
                        </SelectTrigger>
                        <SelectContent>
                          {vessels.map(v => (
                            <SelectItem key={v.id} value={String(v.id)}>
                              <span className="font-medium">{v.name}</span>
                              <span className="ml-2 text-muted-foreground text-xs">{v.vesselType}</span>
                              {v.imoNumber && <span className="ml-2 font-mono text-xs text-muted-foreground">IMO {v.imoNumber}</span>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}

                  {/* Manuel giriş (IMO bulunamazsa) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {vessels && vessels.length > 0 ? "or enter vessel name manually" : "Vessel Name"}
                    </Label>
                    <Input
                      value={form.vesselName}
                      onChange={e => setForm(f => ({ ...f, vesselName: e.target.value }))}
                      placeholder="Enter vessel name"
                      data-testid="input-vessel-name-manual"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Divider ─────────────────────────────────────── */}
            <div className="h-px bg-border" />

            {/* ── SECTION 2: Sefer Detayları ───────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[hsl(var(--maritime-primary))] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</div>
                <span className="text-sm font-semibold">Voyage Details</span>
              </div>

              <div className="space-y-1.5">
                <Label>Port <span className="text-destructive">*</span></Label>
                <PortSearch
                  value={form.portName}
                  onChange={(id, name) => setForm(f => ({ ...f, portId: id, portName: name }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Purpose <span className="text-destructive">*</span></Label>
                <Select value={form.purposeOfCall} onValueChange={v => setForm(f => ({ ...f, purposeOfCall: v }))}>
                  <SelectTrigger data-testid="select-purpose">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PURPOSE_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>ETA</Label>
                  <Input type="datetime-local" value={form.eta} onChange={e => setForm(f => ({ ...f, eta: e.target.value }))} data-testid="input-eta" />
                </div>
                <div className="space-y-1.5">
                  <Label>ETD</Label>
                  <Input type="datetime-local" value={form.etd} onChange={e => setForm(f => ({ ...f, etd: e.target.value }))} data-testid="input-etd" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Additional notes..."
                  rows={2}
                  data-testid="textarea-notes"
                />
              </div>
            </div>

            {/* ── SECTION 3: Cargo Information (cargo-relevant purposes only) ── */}
            {CARGO_PURPOSES.includes(form.purposeOfCall) && (
              <>
                <div className="h-px bg-border" />
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[hsl(var(--maritime-primary))] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</div>
                    <span className="text-sm font-semibold">Cargo Information</span>
                    <span className="text-xs text-muted-foreground">(optional)</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Cargo Type</Label>
                    <Input
                      value={form.cargoType}
                      onChange={e => setForm(f => ({ ...f, cargoType: e.target.value.toUpperCase() }))}
                      placeholder="e.g. WHEAT, IRON ORE, CRUDE OIL"
                      className="uppercase placeholder:normal-case"
                      data-testid="input-cargo-type"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Cargo Quantity (MT)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        value={form.cargoQuantity}
                        onChange={e => setForm(f => ({ ...f, cargoQuantity: e.target.value }))}
                        placeholder="e.g. 45000"
                        className="pr-12"
                        data-testid="input-cargo-quantity"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">MT</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => handleDialogClose(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.portId}
              data-testid="button-save-voyage"
            >
              {createMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
              ) : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
