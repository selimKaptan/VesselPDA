import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import {
  Ship, Plus, Trash2, Edit2, Search, Loader2,
  ArrowRight, AlertTriangle, Anchor, MapPin, Calendar,
  Gauge, Users, FileText, X, ChevronRight, Activity
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { PageMeta } from "@/components/page-meta";
import type { Vessel } from "@shared/schema";
import { useLocation, Link } from "wouter";

// ─── Config ───────────────────────────────────────────────────────────────────

const vesselTypes = [
  "Bulk Carrier", "Container Ship", "General Cargo", "Tanker", "Ro-Ro",
  "Passenger", "Chemical Tanker", "LPG Carrier", "LNG Carrier", "Reefer",
];

const flags = [
  "Turkey", "Malta", "Panama", "Liberia", "Marshall Islands", "Bahamas",
  "Greece", "Cyprus", "Singapore", "Hong Kong", "Norway", "United Kingdom",
];

const FLAG_EMOJI: Record<string, string> = {
  "Turkey": "🇹🇷", "Malta": "🇲🇹", "Panama": "🇵🇦", "Liberia": "🇱🇷",
  "Marshall Islands": "🇲🇭", "Bahamas": "🇧🇸", "Greece": "🇬🇷",
  "Cyprus": "🇨🇾", "Singapore": "🇸🇬", "Hong Kong": "🇭🇰",
  "Norway": "🇳🇴", "United Kingdom": "🇬🇧",
};

const STATUS_CFG: Record<string, { bar: string; badge: string; dot: string; label: string }> = {
  active:  { bar: "#10b981", badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800", dot: "bg-emerald-500", label: "Seyirde" },
  planned: { bar: "#3b82f6", badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",     dot: "bg-blue-500",    label: "Planlandı" },
  idle:    { bar: "#94a3b8", badge: "bg-muted text-muted-foreground border-border",                                                                dot: "bg-muted-foreground", label: "Atıl" },
};

function getVesselStatus(voyage: any): string {
  if (!voyage) return "idle";
  if (voyage.status === "active") return "active";
  if (voyage.status === "planned") return "planned";
  return "idle";
}

function getProgress(voyage: any): number {
  if (!voyage?.etd || !voyage?.eta) return 0;
  const now = Date.now();
  const start = new Date(voyage.etd).getTime();
  const end = new Date(voyage.eta).getTime();
  if (end <= start) return 0;
  return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
}

// ─── Types ────────────────────────────────────────────────────────────────────

type VesselFormData = {
  name: string; flag: string; vesselType: string; imoNumber: string;
  callSign: string; grt: string; nrt: string; dwt: string; loa: string; beam: string;
};

const emptyForm = (): VesselFormData => ({
  name: "", flag: "", vesselType: "", imoNumber: "", callSign: "",
  grt: "", nrt: "", dwt: "", loa: "", beam: "",
});

const vesselToForm = (v: Vessel): VesselFormData => ({
  name: v.name || "", flag: v.flag || "", vesselType: v.vesselType || "",
  imoNumber: v.imoNumber || "", callSign: v.callSign || "",
  grt: v.grt != null ? String(v.grt) : "", nrt: v.nrt != null ? String(v.nrt) : "",
  dwt: v.dwt != null ? String(v.dwt) : "", loa: v.loa != null ? String(v.loa) : "",
  beam: v.beam != null ? String(v.beam) : "",
});

type LookupResult = {
  name: string; flag: string; vesselType: string; imoNumber: string;
  callSign: string; grt: number | null; nrt: number | null;
  dwt: number | null; loa: number | null; beam: number | null;
};

// ─── VesselForm ───────────────────────────────────────────────────────────────

function VesselForm({
  vessel, onSave, onCancel, isSaving,
}: {
  vessel?: Vessel | null;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<VesselFormData>(vessel ? vesselToForm(vessel) : emptyForm());
  const [lookupDone, setLookupDone] = useState(false);

  const set = (field: keyof VesselFormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const lookupMutation = useMutation({
    mutationFn: async (imo: string) => {
      const res = await apiRequest("GET", `/api/vessels/lookup?imo=${encodeURIComponent(imo)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Lookup failed");
      }
      return res.json() as Promise<LookupResult>;
    },
    onSuccess: (data) => {
      setForm({
        name: data.name || form.name,
        flag: data.flag || form.flag,
        vesselType: data.vesselType || form.vesselType,
        imoNumber: data.imoNumber || form.imoNumber,
        callSign: data.callSign || form.callSign,
        grt: data.grt != null ? String(data.grt) : form.grt,
        nrt: data.nrt != null ? String(data.nrt) : form.nrt,
        dwt: data.dwt != null ? String(data.dwt) : form.dwt,
        loa: data.loa != null ? String(data.loa) : form.loa,
        beam: data.beam != null ? String(data.beam) : form.beam,
      });
      setLookupDone(true);
      toast({ title: "Vessel details auto-filled", description: `Found: ${data.name}` });
    },
    onError: (err: Error) => {
      toast({ title: "Lookup failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: form.name,
      flag: form.flag || null,
      vesselType: form.vesselType || null,
      grt: form.grt ? parseFloat(form.grt) : null,
      nrt: form.nrt ? parseFloat(form.nrt) : null,
      dwt: form.dwt ? parseFloat(form.dwt) : null,
      loa: form.loa ? parseFloat(form.loa) : null,
      beam: form.beam ? parseFloat(form.beam) : null,
      imoNumber: form.imoNumber || null,
      callSign: form.callSign || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="imoNumber">
            IMO Number
            {lookupDone && <Badge variant="secondary" className="ml-2 text-[10px]">Auto-filled</Badge>}
          </Label>
          <div className="flex gap-2">
            <Input
              id="imoNumber"
              placeholder="e.g. 9321483"
              value={form.imoNumber}
              onChange={(e) => { set("imoNumber", e.target.value); setLookupDone(false); }}
              className="flex-1"
              data-testid="input-imo"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Auto-fill from vessel registry"
              disabled={!form.imoNumber.trim() || lookupMutation.isPending}
              onClick={() => lookupMutation.mutate(form.imoNumber.trim())}
              data-testid="button-lookup-imo"
            >
              {lookupMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Search className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Enter IMO and click <Search className="w-3 h-3 inline" /> to auto-fill details</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Vessel Name *</Label>
          <Input
            id="name"
            placeholder="MV CHELSEA 2"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            data-testid="input-vessel-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="flag">Flag *</Label>
          <Select value={form.flag} onValueChange={(v) => set("flag", v)} required>
            <SelectTrigger data-testid="select-flag"><SelectValue placeholder="Select flag" /></SelectTrigger>
            <SelectContent>
              {flags.map((f) => <SelectItem key={f} value={f}>{FLAG_EMOJI[f] || "🏳️"} {f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vesselType">Vessel Type *</Label>
          <Select value={form.vesselType} onValueChange={(v) => set("vesselType", v)} required>
            <SelectTrigger data-testid="select-vessel-type"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {vesselTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="grt">GRT (Gross Tonnage) *</Label>
          <Input id="grt" type="number" step="0.01" placeholder="5166" value={form.grt} onChange={(e) => set("grt", e.target.value)} required data-testid="input-grt" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nrt">NRT (Net Tonnage) *</Label>
          <Input id="nrt" type="number" step="0.01" placeholder="2906" value={form.nrt} onChange={(e) => set("nrt", e.target.value)} required data-testid="input-nrt" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dwt">DWT</Label>
          <Input id="dwt" type="number" step="0.01" placeholder="8500" value={form.dwt} onChange={(e) => set("dwt", e.target.value)} data-testid="input-dwt" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loa">LOA (m)</Label>
          <Input id="loa" type="number" step="0.01" placeholder="118.5" value={form.loa} onChange={(e) => set("loa", e.target.value)} data-testid="input-loa" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="beam">Beam (m)</Label>
          <Input id="beam" type="number" step="0.01" placeholder="17.2" value={form.beam} onChange={(e) => set("beam", e.target.value)} data-testid="input-beam" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="callSign">Call Sign</Label>
          <Input id="callSign" placeholder="9HA4567" value={form.callSign} onChange={(e) => set("callSign", e.target.value)} data-testid="input-callsign" />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-vessel">İptal</Button>
        <Button type="submit" disabled={isSaving} data-testid="button-save-vessel">
          {isSaving ? "Kaydediliyor..." : vessel ? "Güncelle" : "Gemi Ekle"}
        </Button>
      </div>
    </form>
  );
}

// ─── Rich Vessel Card ─────────────────────────────────────────────────────────

function VesselCard({ vessel, voyage, onSelect, onEdit, onDelete }: {
  vessel: Vessel;
  voyage: any;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const vstatus = getVesselStatus(voyage);
  const cfg = STATUS_CFG[vstatus];
  const progress = getProgress(voyage);
  const flag = FLAG_EMOJI[vessel.flag || ""] || "🏳️";

  return (
    <div
      className="bg-card rounded-2xl border-2 border-border hover:border-[hsl(var(--maritime-primary)/0.4)] hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden group relative"
      onClick={onSelect}
      data-testid={`card-vessel-${vessel.id}`}
    >
      {/* Status color bar */}
      <div className="h-1" style={{ background: cfg.bar }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-[hsl(var(--maritime-primary)/0.1)] rounded-xl flex items-center justify-center text-xl flex-shrink-0">
              🚢
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm leading-tight truncate" data-testid={`text-vessel-name-${vessel.id}`}>
                {flag} {vessel.name}
              </h3>
              <p className="text-xs text-muted-foreground">{vessel.vesselType || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${cfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Position / port */}
        <div className="bg-muted/40 rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-xs font-medium truncate">
            {voyage?.portName || "Konum bilinmiyor"}
          </span>
        </div>

        {/* Voyage progress */}
        {voyage ? (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs min-w-0">
                <span className="text-muted-foreground truncate max-w-[80px]">{voyage.portName || "—"}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="font-semibold truncate max-w-[80px]">{voyage.portName || "—"}</span>
              </div>
              <span className="text-[10px] text-muted-foreground capitalize flex-shrink-0 ml-2">
                {voyage.purposeOfCall || voyage.status}
              </span>
            </div>
            <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progress}%`, background: cfg.bar }}
              />
            </div>
            <div className="flex justify-between mt-1">
              {voyage.etd && <span className="text-[10px] text-muted-foreground">ETD: {new Date(voyage.etd).toLocaleDateString("tr-TR")}</span>}
              {voyage.eta && <span className="text-[10px] text-muted-foreground">ETA: {new Date(voyage.eta).toLocaleDateString("tr-TR")}</span>}
            </div>
          </div>
        ) : (
          <div className="mb-3 h-10 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Aktif sefer yok</span>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {[
            { label: "GRT", value: vessel.grt?.toLocaleString("tr-TR") },
            { label: "DWT", value: vessel.dwt?.toLocaleString("tr-TR") ?? "—" },
            { label: "IMO", value: vessel.imoNumber || "—" },
          ].map((s) => (
            <div key={s.label} className="bg-muted/30 rounded-lg py-2 text-center">
              <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
              <p className="text-[11px] font-bold truncate px-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border/50">
          <div className="flex items-center gap-2">
            <button
              className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              data-testid={`button-edit-vessel-${vessel.id}`}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              data-testid={`button-delete-vessel-${vessel.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            className="flex items-center gap-1 text-xs text-[hsl(var(--maritime-primary))] font-medium hover:underline"
            onClick={onSelect}
            data-testid={`button-detail-vessel-${vessel.id}`}
          >
            Detay <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Vessels() {
  const [showForm, setShowForm] = useState(false);
  const [editingVessel, setEditingVessel] = useState<Vessel | null>(null);
  const [deleteVesselId, setDeleteVesselId] = useState<number | null>(null);
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [detailTab, setDetailTab] = useState<"general" | "voyage" | "technical">("general");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "planned" | "idle">("all");
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const [location] = useLocation();

  useEffect(() => {
    if (location.includes("new=true")) setShowForm(true);
  }, [location]);

  const { data: vessels = [], isLoading } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
  const { data: voyages = [] } = useQuery<any[]>({ queryKey: ["/api/voyages"] });

  const vesselVoyageMap = useMemo(() => {
    const map = new Map<number, any>();
    const priority: Record<string, number> = { active: 3, planned: 2, completed: 1, cancelled: 0 };
    (voyages as any[]).forEach((v) => {
      if (v.vesselId) {
        const existing = map.get(v.vesselId);
        if (!existing || (priority[v.status] ?? 0) > (priority[existing.status] ?? 0)) {
          map.set(v.vesselId, v);
        }
      }
    });
    return map;
  }, [voyages]);

  const enriched = useMemo(() => vessels.map((v) => ({
    vessel: v,
    voyage: vesselVoyageMap.get(v.id) ?? null,
    vstatus: getVesselStatus(vesselVoyageMap.get(v.id) ?? null),
  })), [vessels, vesselVoyageMap]);

  const filtered = useMemo(() => enriched.filter(({ vessel, vstatus }) => {
    if (statusFilter !== "all" && vstatus !== statusFilter) return false;
    if (search.trim() && !vessel.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [enriched, statusFilter, search]);

  const stats = useMemo(() => ({
    total:   enriched.length,
    active:  enriched.filter(e => e.vstatus === "active").length,
    planned: enriched.filter(e => e.vstatus === "planned").length,
    idle:    enriched.filter(e => e.vstatus === "idle").length,
  }), [enriched]);

  const selectedVoyage = selectedVessel ? vesselVoyageMap.get(selectedVessel.id) ?? null : null;

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/vessels", data);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/vessels"] }); setShowForm(false); toast({ title: "Gemi eklendi" }); },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) { toast({ title: "Oturum süresi doldu", variant: "destructive" }); setTimeout(() => { window.location.href = "/login"; }, 500); return; }
      toast({ title: "Gemi eklenemedi", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/vessels/${id}`, data);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/vessels"] }); setEditingVessel(null); toast({ title: "Gemi güncellendi" }); },
    onError: (error: Error) => { toast({ title: "Güncellenemedi", description: error.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/vessels/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/vessels"] }); toast({ title: "Gemi silindi" }); },
    onError: (error: Error) => { toast({ title: "Silinemedi", description: error.message, variant: "destructive" }); },
  });

  const handleSave = (data: Record<string, unknown>) => {
    if (editingVessel) updateMutation.mutate({ id: editingVessel.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div className="px-3 py-5 space-y-6 max-w-7xl mx-auto">
      <PageMeta title="Filo Yönetimi | VesselPDA" description="Filonuzdaki gemileri yönetin ve takip edin." />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-vessels-title">Filo Yönetimi</h1>
          <p className="text-muted-foreground text-sm">Filonuzdaki tüm gemileri ve aktif seferleri takip edin.</p>
        </div>
        <Button onClick={() => { setEditingVessel(null); setShowForm(true); }} className="gap-2" data-testid="button-add-vessel">
          <Plus className="w-4 h-4" /> Gemi Ekle
        </Button>
      </div>

      {/* Stat Cards */}
      {!isLoading && vessels.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Toplam Gemi",  value: stats.total,   icon: Ship,     color: "bg-[hsl(var(--maritime-primary)/0.1)] text-[hsl(var(--maritime-primary))]", filter: "all" },
            { label: "Seyirde",      value: stats.active,  icon: Activity, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400", filter: "active" },
            { label: "Planlandı",    value: stats.planned, icon: Calendar,  color: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400", filter: "planned" },
            { label: "Atıl",         value: stats.idle,    icon: Anchor,   color: "bg-muted text-muted-foreground", filter: "idle" },
          ].map(({ label, value, icon: Icon, color, filter }) => (
            <Card
              key={label}
              className={`p-4 flex items-center gap-4 cursor-pointer transition-all hover:shadow-md ${statusFilter === filter ? "ring-2 ring-[hsl(var(--maritime-primary))]" : ""}`}
              onClick={() => setStatusFilter(filter as any)}
              data-testid={`stat-${filter}`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-black leading-none">{value}</p>
                <p className="text-xs font-medium text-muted-foreground mt-0.5">{label}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Search + Filter Bar */}
      {vessels.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Gemi ara..."
              className="pl-9"
              data-testid="input-search-vessel"
            />
          </div>
          <div className="flex gap-1 bg-muted/40 p-1 rounded-xl flex-shrink-0">
            {([
              { key: "all",     label: "Tümü" },
              { key: "active",  label: "Seyirde" },
              { key: "planned", label: "Planlandı" },
              { key: "idle",    label: "Atıl" },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                data-testid={`filter-${key}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Vessel Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(({ vessel, voyage }) => (
            <VesselCard
              key={vessel.id}
              vessel={vessel}
              voyage={voyage}
              onSelect={() => { setSelectedVessel(vessel); setDetailTab("general"); }}
              onEdit={() => setEditingVessel(vessel)}
              onDelete={() => setDeleteVesselId(vessel.id)}
            />
          ))}
        </div>
      ) : vessels.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground" data-testid="text-no-vessels">
          <Ship className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-lg">Filonuzda henüz gemi yok</p>
          <p className="text-sm mt-2">İlk geminizi ekleyerek proforma oluşturmaya başlayın.</p>
          <Button className="mt-5 gap-2" onClick={() => setShowForm(true)} data-testid="button-add-first-vessel">
            <Plus className="w-4 h-4" /> İlk Gemiyi Ekle
          </Button>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Arama sonucu bulunamadı</p>
          <button className="text-sm text-[hsl(var(--maritime-primary))] mt-2 hover:underline" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Filtreleri temizle</button>
        </div>
      )}

      {/* ── Detail Sheet ──────────────────────────────────────────────────── */}
      <Sheet open={!!selectedVessel} onOpenChange={(o) => { if (!o) setSelectedVessel(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
          {selectedVessel && (() => {
            const v = selectedVessel;
            const voy = selectedVoyage;
            const vstatus = getVesselStatus(voy);
            const cfg = STATUS_CFG[vstatus];
            const flag = FLAG_EMOJI[v.flag || ""] || "🏳️";
            const progress = getProgress(voy);
            return (
              <>
                {/* Sheet Header */}
                <SheetHeader className="px-6 pt-6 pb-4 border-b sticky top-0 bg-background z-10">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[hsl(var(--maritime-primary))] rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">🚢</div>
                      <div>
                        <SheetTitle className="font-black text-base leading-tight">{flag} {v.name}</SheetTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">{v.vesselType || "—"} · {v.flag || "—"}</p>
                      </div>
                    </div>
                  </div>
                  {/* Detail Tabs */}
                  <div className="flex gap-1 bg-muted/40 p-1 rounded-xl mt-3">
                    {([
                      { key: "general",   label: "Genel" },
                      { key: "voyage",    label: "Sefer" },
                      { key: "technical", label: "Teknik" },
                    ] as const).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setDetailTab(key)}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${detailTab === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </SheetHeader>

                <div className="p-6 space-y-4">

                  {/* ── Genel ── */}
                  {detailTab === "general" && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full border flex items-center gap-1.5 ${cfg.badge}`}>
                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        {v.imoNumber && <span className="text-xs text-muted-foreground font-mono">IMO {v.imoNumber}</span>}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { icon: MapPin,    label: "Konum",       value: voy?.portName || "Bilinmiyor" },
                          { icon: Activity,  label: "Sefer Durumu", value: voy ? (voy.status === "active" ? "Aktif" : "Planlandı") : "Atıl" },
                          { icon: Calendar,  label: "ETA",          value: voy?.eta ? new Date(voy.eta).toLocaleDateString("tr-TR") : "—" },
                          { icon: Calendar,  label: "ETD",          value: voy?.etd ? new Date(voy.etd).toLocaleDateString("tr-TR") : "—" },
                          { icon: FileText,  label: "Amaç",         value: voy?.purposeOfCall || "—" },
                          { icon: Ship,      label: "Call Sign",    value: v.callSign || "—" },
                        ].map(({ icon: Icon, label, value }) => (
                          <div key={label} className="bg-muted/30 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground font-medium">{label}</p>
                            </div>
                            <p className="text-sm font-bold truncate">{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="flex-1 gap-1.5 h-9" onClick={() => { setSelectedVessel(null); setEditingVessel(v); }}>
                          <Edit2 className="w-3.5 h-3.5" /> Düzenle
                        </Button>
                        <Link href={`/voyages?vesselId=${v.id}`}>
                          <Button size="sm" className="flex-1 gap-1.5 h-9">
                            <Plus className="w-3.5 h-3.5" /> Sefer Oluştur
                          </Button>
                        </Link>
                      </div>
                    </>
                  )}

                  {/* ── Sefer ── */}
                  {detailTab === "voyage" && (
                    <>
                      {voy ? (
                        <>
                          <div className="bg-muted/30 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_CFG[voy.status === "active" ? "active" : voy.status === "planned" ? "planned" : "idle"].badge}`}>
                                {voy.status === "active" ? "Aktif Sefer" : voy.status === "planned" ? "Planlanmış" : "Tamamlandı"}
                              </span>
                              <span className="text-xs text-muted-foreground">{voy.purposeOfCall}</span>
                            </div>

                            {/* Progress */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">Kalkış</p>
                                  <p className="text-sm font-bold">{voy.portName || "—"}</p>
                                  {voy.etd && <p className="text-xs text-muted-foreground">{new Date(voy.etd).toLocaleDateString("tr-TR")}</p>}
                                </div>
                                <div className="flex-1 mx-4 relative">
                                  <div className="h-0.5 bg-muted rounded-full" />
                                  <div className="h-0.5 bg-emerald-500 rounded-full absolute top-0 left-0 transition-all" style={{ width: `${progress}%` }} />
                                  <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">{Math.round(progress)}%</span>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-muted-foreground">Varış</p>
                                  <p className="text-sm font-bold">{voy.portName || "—"}</p>
                                  {voy.eta && <p className="text-xs text-muted-foreground">{new Date(voy.eta).toLocaleDateString("tr-TR")}</p>}
                                </div>
                              </div>
                            </div>
                          </div>

                          <Link href={`/voyages/${voy.id}`}>
                            <Button variant="outline" className="w-full gap-2" size="sm">
                              Sefer Detayına Git <ChevronRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        </>
                      ) : (
                        <div className="text-center py-10 text-muted-foreground">
                          <Anchor className="w-10 h-10 mx-auto mb-3 opacity-20" />
                          <p className="font-medium">Bu gemi için aktif sefer yok</p>
                          <p className="text-xs mt-1">Yeni bir sefer oluşturabilirsiniz.</p>
                          <Link href="/voyages">
                            <Button size="sm" className="mt-4 gap-2">
                              <Plus className="w-3.5 h-3.5" /> Sefer Oluştur
                            </Button>
                          </Link>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Teknik ── */}
                  {detailTab === "technical" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "IMO No",    value: v.imoNumber || "—" },
                          { label: "Call Sign", value: v.callSign || "—" },
                          { label: "Bayrak",    value: `${flag} ${v.flag || "—"}` },
                          { label: "Tip",       value: v.vesselType || "—" },
                          { label: "GRT",       value: v.grt ? v.grt.toLocaleString("tr-TR") + " GT" : "—" },
                          { label: "NRT",       value: v.nrt ? v.nrt.toLocaleString("tr-TR") + " GT" : "—" },
                          { label: "DWT",       value: v.dwt ? v.dwt.toLocaleString("tr-TR") + " MT" : "—" },
                          { label: "LOA",       value: v.loa ? v.loa + " m" : "—" },
                          { label: "Genişlik",  value: v.beam ? v.beam + " m" : "—" },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-muted/30 rounded-xl p-3">
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">{label}</p>
                            <p className="text-sm font-bold">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* ── Add / Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog
        open={showForm || !!editingVessel}
        onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingVessel(null); } }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">{editingVessel ? "Gemi Düzenle" : "Yeni Gemi Ekle"}</DialogTitle>
          </DialogHeader>
          <VesselForm
            key={editingVessel?.id ?? "new"}
            vessel={editingVessel}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingVessel(null); }}
            isSaving={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteVesselId} onOpenChange={(open) => { if (!open) setDeleteVesselId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gemi Silinecek</AlertDialogTitle>
            <AlertDialogDescription>
              Bu gemiyi kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve gemiye ait tüm proformalar da silinecektir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-vessel">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteVesselId) { deleteMutation.mutate(deleteVesselId); setDeleteVesselId(null); } }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-vessel"
            >
              {deleteMutation.isPending ? "Siliniyor..." : "Evet, Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
