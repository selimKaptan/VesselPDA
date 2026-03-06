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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  planned:   { label: "Planned",    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",   icon: Clock },
  active:    { label: "Active",     color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: PlayCircle },
  completed: { label: "Completed",  color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",       icon: CheckCircle2 },
  cancelled: { label: "Cancelled",  color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",        icon: XCircle },
};

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

  return (
    <div className="px-3 py-5 space-y-6 max-w-7xl mx-auto">
      <PageMeta title="Voyages | VesselPDA" description="Voyage and operations management" />

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

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : voyageList && voyageList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {voyageList.map((v: any) => {
            const s = STATUS_CONFIG[v.status] || STATUS_CONFIG.planned;
            const Icon = s.icon;
            return (
              <Link key={v.id} href={`/voyages/${v.id}`}>
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer border hover:border-primary/30 group" data-testid={`card-voyage-${v.id}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0">
                        <Ship className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm leading-tight">{v.vesselName || "Gemi Belirtilmedi"}</p>
                        <p className="text-xs text-muted-foreground">{v.purposeOfCall}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${s.color}`}>
                      <Icon className="w-3 h-3" />{s.label}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{v.portName || `Port #${v.portId}`}</span>
                    </div>
                    {v.eta && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>ETA: {new Date(v.eta).toLocaleDateString("tr-TR")}</span>
                      </div>
                    )}
                    {v.imoNumber && (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">IMO {v.imoNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Port call operational stage badge */}
                  {(() => {
                    const stage = PORT_CALL_STAGE[v.status] || PORT_CALL_STAGE.planned;
                    return (
                      <div className="flex items-center justify-between pt-1.5 border-t border-dashed border-border/50 mt-1.5">
                        <div className="flex items-center gap-1.5" data-testid={`badge-stage-${v.id}`}>
                          <span className={`inline-flex h-1.5 w-1.5 rounded-full ${stage.dot}`} />
                          <span className={`text-[11px] font-semibold ${stage.text}`}>{stage.label}</span>
                        </div>
                        <div className="flex items-center text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs font-medium">Detaylar</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    );
                  })()}
                </Card>
              </Link>
            );
          })}
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
