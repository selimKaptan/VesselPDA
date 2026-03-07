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
import { Link } from "wouter";
import type { Vessel, Port } from "@shared/schema";
import { fmtDate } from "@/lib/formatDate";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  planned:   { label: "Planned",    color: "bg-blue-900/30 text-blue-400 border border-blue-500/30",    icon: Clock },
  active:    { label: "Active",     color: "bg-green-900/30 text-green-400 border border-green-500/30", icon: PlayCircle },
  completed: { label: "Completed",  color: "bg-slate-700/50 text-slate-400 border border-slate-600/30", icon: CheckCircle2 },
  cancelled: { label: "Cancelled",  color: "bg-red-900/30 text-red-400 border border-red-500/30",       icon: XCircle },
};

const PURPOSE_STYLE: Record<string, { bg: string; text: string; border: string; icon: string; label: string; pill: string; pillActive: string }> = {
  "Crew Change": { bg: "bg-purple-900/50", text: "text-purple-300", border: "border-purple-500/20", icon: "🟣", label: "CREW CHANGE",  pill: "border-purple-500/40 text-purple-300 hover:bg-purple-900/40", pillActive: "bg-purple-900/50 border-purple-400/60 text-purple-200 ring-1 ring-purple-400/30" },
  "Husbandry":   { bg: "bg-purple-900/50", text: "text-purple-300", border: "border-purple-500/20", icon: "🟣", label: "HUSBANDRY",    pill: "border-purple-500/40 text-purple-300 hover:bg-purple-900/40", pillActive: "bg-purple-900/50 border-purple-400/60 text-purple-200 ring-1 ring-purple-400/30" },
  "Loading":     { bg: "bg-emerald-900/50", text: "text-emerald-300", border: "border-emerald-500/20", icon: "🟢", label: "LOADING",    pill: "border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40", pillActive: "bg-emerald-900/50 border-emerald-400/60 text-emerald-200 ring-1 ring-emerald-400/30" },
  "Discharging": { bg: "bg-orange-900/50", text: "text-orange-300", border: "border-orange-500/20", icon: "🟠", label: "DISCHARGING",  pill: "border-orange-500/40 text-orange-300 hover:bg-orange-900/40", pillActive: "bg-orange-900/50 border-orange-400/60 text-orange-200 ring-1 ring-orange-400/30" },
  "Transit":     { bg: "bg-blue-900/50",   text: "text-blue-300",   border: "border-blue-500/20",   icon: "🔵", label: "TRANSIT",      pill: "border-blue-500/40 text-blue-300 hover:bg-blue-900/40",     pillActive: "bg-blue-900/50 border-blue-400/60 text-blue-200 ring-1 ring-blue-400/30" },
  "Bunkering":   { bg: "bg-blue-900/50",   text: "text-blue-300",   border: "border-blue-500/20",   icon: "🔵", label: "BUNKERING",    pill: "border-blue-500/40 text-blue-300 hover:bg-blue-900/40",     pillActive: "bg-blue-900/50 border-blue-400/60 text-blue-200 ring-1 ring-blue-400/30" },
  "Repair":      { bg: "bg-blue-900/50",   text: "text-blue-300",   border: "border-blue-500/20",   icon: "🔵", label: "REPAIR",       pill: "border-blue-500/40 text-blue-300 hover:bg-blue-900/40",     pillActive: "bg-blue-900/50 border-blue-400/60 text-blue-200 ring-1 ring-blue-400/30" },
  "Inspection":  { bg: "bg-blue-900/50",   text: "text-blue-300",   border: "border-blue-500/20",   icon: "🔵", label: "INSPECTION",   pill: "border-blue-500/40 text-blue-300 hover:bg-blue-900/40",     pillActive: "bg-blue-900/50 border-blue-400/60 text-blue-200 ring-1 ring-blue-400/30" },
};
const DEFAULT_PURPOSE_STYLE = { bg: "bg-blue-900/50", text: "text-blue-300", border: "border-blue-500/20", icon: "🔵", label: "OPERATION", pill: "border-blue-500/40 text-blue-300 hover:bg-blue-900/40", pillActive: "bg-blue-900/50 border-blue-400/60 text-blue-200 ring-1 ring-blue-400/30" };

// Port call operational stage — derived from voyage.status
// If a dedicated portCallStage field is added to the voyage table in the future, extend this config
const PORT_CALL_STAGE: Record<string, { label: string; dot: string; text: string }> = {
  planned:   { label: "Pre-Arrival", dot: "bg-blue-400",   text: "text-blue-400"   },
  active:    { label: "In Port",     dot: "bg-green-400",  text: "text-green-400"  },
  completed: { label: "Departed",    dot: "bg-slate-400",  text: "text-slate-400"  },
  cancelled: { label: "Cancelled",   dot: "bg-red-400",    text: "text-red-400"    },
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
};

export default function Voyages() {
  const { user } = useAuth();
  const { toast } = useToast();
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
            const Icon = s.icon;
            const rawPs = PURPOSE_STYLE[v.purposeOfCall] || DEFAULT_PURPOSE_STYLE;
            const ps = v.status?.toLowerCase() === "cancelled"
              ? { ...rawPs, bg: "bg-slate-800/60", border: "border-slate-600/30", text: "text-slate-500", icon: "⬛" }
              : rawPs;
            return (
              <Link key={v.id} href={`/voyages/${v.id}`}>
                <Card className="p-0 overflow-hidden hover:shadow-lg hover:shadow-black/30 transition-all cursor-pointer border border-slate-700/60 hover:border-slate-500/60 group bg-slate-800/60" data-testid={`card-voyage-${v.id}`}>

                  {/* ── Colour-Coded Header Strip ── */}
                  <div className={`${ps.bg} px-4 py-2.5 flex items-center justify-between border-b ${ps.border}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm leading-none">{ps.icon}</span>
                      <span className={`text-[10px] font-bold tracking-widest uppercase ${ps.text}`}>{ps.label} OPERATION</span>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${s.color}`}>
                      <Icon className="w-2.5 h-2.5" />{s.label}
                    </span>
                  </div>

                  {/* ── Card Body ── */}
                  <div className="p-4 space-y-3">
                    {/* Vessel name + IMO */}
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-slate-700/60 border border-slate-600/50 flex items-center justify-center flex-shrink-0">
                        <Ship className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-100 leading-tight truncate">{v.vesselName || "Vessel TBN"}</p>
                        {v.imoNumber && (
                          <span className="font-mono text-[10px] text-slate-500">IMO {v.imoNumber}</span>
                        )}
                      </div>
                    </div>

                    {/* Port + ETA row */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                        <span className="truncate font-medium text-slate-300">{v.portName || `Port #${v.portId}`}</span>
                      </div>
                      {v.eta && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>ETA: <span className="text-slate-400 font-medium">{fmtDate(v.eta)}</span></span>
                          {/* Urgency indicator */}
                          {(() => {
                            const eta = new Date(v.eta);
                            if (eta >= now && eta <= next24h) {
                              return <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-400 bg-amber-900/30 border border-amber-500/30 rounded-full px-1.5 py-0.5 ml-1">⏰ &lt;24h</span>;
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Port call stage + arrow */}
                    {(() => {
                      const stage = PORT_CALL_STAGE[v.status] || PORT_CALL_STAGE.planned;
                      return (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-700/50" data-testid={`badge-stage-${v.id}`}>
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex h-1.5 w-1.5 rounded-full ${stage.dot}`} />
                            <span className={`text-[11px] font-semibold ${stage.text}`}>{stage.label}</span>
                          </div>
                          <div className="flex items-center gap-0.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[11px] font-medium">Open</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      );
                    })()}
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
