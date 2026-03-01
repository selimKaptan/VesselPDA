import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Anchor, Navigation, Warehouse, Building2, Leaf, FileText, Layers, Package, MoreHorizontal,
  Plus, Pencil, Trash2, Loader2, AlertTriangle, TrendingUp, Copy, Database, Filter, ChevronRight
} from "lucide-react";

// ── Table config ─────────────────────────────────────────────────────────────
const TARIFF_TABLES = [
  {
    key: "pilotage_tariffs",
    label: "Kılavuzluk Ücretleri",
    icon: Navigation,
    currency: "USD",
    columns: [
      { key: "service_type", label: "Hizmet Tipi" },
      { key: "vessel_category", label: "Gemi Kategorisi" },
      { key: "grt_min", label: "GRT Min" },
      { key: "grt_max", label: "GRT Max" },
      { key: "base_fee", label: "Taban Ücret" },
      { key: "per_1000_grt", label: "Her 1000 GRT" },
      { key: "currency", label: "Para Birimi" },
      { key: "valid_year", label: "Yıl" },
      { key: "notes", label: "Notlar" },
    ],
    formFields: [
      { key: "service_type", label: "Hizmet Tipi", type: "text", placeholder: "kabotaj / romorkör_kabotaj vb." },
      { key: "vessel_category", label: "Gemi Kategorisi", type: "text", placeholder: "konteyner / diger_yuk vb." },
      { key: "grt_min", label: "GRT Min", type: "number" },
      { key: "grt_max", label: "GRT Max", type: "number" },
      { key: "base_fee", label: "Taban Ücret (USD)", type: "number" },
      { key: "per_1000_grt", label: "Her 1000 GRT Ücreti", type: "number" },
      { key: "currency", label: "Para Birimi", type: "currency" },
      { key: "valid_year", label: "Geçerlilik Yılı", type: "year" },
      { key: "notes", label: "Notlar", type: "textarea" },
    ],
  },
  {
    key: "external_pilotage_tariffs",
    label: "Liman Dışı Kılavuzluk",
    icon: Anchor,
    currency: "USD",
    columns: [
      { key: "service_description", label: "Hizmet Açıklaması" },
      { key: "grt_up_to_1000", label: "0-1000 GRT" },
      { key: "per_additional_1000_grt", label: "İlave 1000 GRT" },
      { key: "currency", label: "Para Birimi" },
      { key: "valid_year", label: "Yıl" },
    ],
    formFields: [
      { key: "service_description", label: "Hizmet Açıklaması", type: "textarea" },
      { key: "grt_up_to_1000", label: "0-1000 GRT Ücreti", type: "number" },
      { key: "per_additional_1000_grt", label: "İlave Her 1000 GRT", type: "number" },
      { key: "currency", label: "Para Birimi", type: "currency" },
      { key: "valid_year", label: "Geçerlilik Yılı", type: "year" },
    ],
  },
  {
    key: "berthing_tariffs",
    label: "Barınma Ücretleri",
    icon: Warehouse,
    currency: "USD",
    columns: [
      { key: "gt_min", label: "GT Min" },
      { key: "gt_max", label: "GT Max" },
      { key: "intl_foreign_flag", label: "Yabancı Bayrak" },
      { key: "intl_turkish_flag", label: "Türk Bayrak (Int.)" },
      { key: "cabotage_turkish", label: "Kabotaj Türk" },
      { key: "currency", label: "Para Birimi" },
      { key: "valid_year", label: "Yıl" },
    ],
    formFields: [
      { key: "gt_min", label: "GT Min", type: "number" },
      { key: "gt_max", label: "GT Max", type: "number" },
      { key: "intl_foreign_flag", label: "Yabancı Bayraklı (Günlük)", type: "number" },
      { key: "intl_turkish_flag", label: "Türk Bayraklı Int. (Günlük)", type: "number" },
      { key: "cabotage_turkish", label: "Kabotaj Türk (Günlük)", type: "number" },
      { key: "currency", label: "Para Birimi", type: "currency" },
      { key: "valid_year", label: "Geçerlilik Yılı", type: "year" },
      { key: "notes", label: "Notlar", type: "textarea" },
    ],
  },
  {
    key: "agency_fees",
    label: "Acentelik Ücretleri",
    icon: Building2,
    currency: "EUR",
    columns: [
      { key: "tariff_no", label: "Tarife No" },
      { key: "service_type", label: "Hizmet Tipi" },
      { key: "nt_min", label: "NT Min" },
      { key: "nt_max", label: "NT Max" },
      { key: "fee", label: "Ücret" },
      { key: "currency", label: "Para Birimi" },
      { key: "valid_year", label: "Yıl" },
    ],
    formFields: [
      { key: "tariff_no", label: "Tarife No", type: "text", placeholder: "T1 / T2" },
      { key: "service_type", label: "Hizmet Tipi", type: "text", placeholder: "acentelik / koruyucu_acentelik" },
      { key: "nt_min", label: "NT Min", type: "number" },
      { key: "nt_max", label: "NT Max", type: "number" },
      { key: "fee", label: "Ücret (EUR)", type: "number" },
      { key: "currency", label: "Para Birimi", type: "currency" },
      { key: "valid_year", label: "Geçerlilik Yılı", type: "year" },
      { key: "notes", label: "Notlar", type: "textarea" },
    ],
  },
  {
    key: "marpol_tariffs",
    label: "MARPOL Atık Ücretleri",
    icon: Leaf,
    currency: "EUR",
    columns: [
      { key: "grt_min", label: "GRT Min" },
      { key: "grt_max", label: "GRT Max" },
      { key: "fixed_fee", label: "Sabit Ücret" },
      { key: "marpol_ek1_included", label: "EK-1 Dahil (m³)" },
      { key: "marpol_ek4_included", label: "EK-4 Dahil (m³)" },
      { key: "marpol_ek5_included", label: "EK-5 Dahil (m³)" },
      { key: "weekday_ek1_rate", label: "Hfti EK-1 EUR/m³" },
      { key: "currency", label: "Para Birimi" },
      { key: "valid_year", label: "Yıl" },
    ],
    formFields: [
      { key: "grt_min", label: "GRT Min", type: "number" },
      { key: "grt_max", label: "GRT Max", type: "number" },
      { key: "fixed_fee", label: "Sabit Ücret (EUR)", type: "number" },
      { key: "marpol_ek1_included", label: "EK-1 Dahil m³ (sintine/yağ)", type: "number" },
      { key: "marpol_ek4_included", label: "EK-4 Dahil m³ (pis su)", type: "number" },
      { key: "marpol_ek5_included", label: "EK-5 Dahil m³ (çöp)", type: "number" },
      { key: "weekday_ek1_rate", label: "Hafta İçi EK-1 EUR/m³", type: "number" },
      { key: "weekday_ek4_rate", label: "Hafta İçi EK-4 EUR/m³", type: "number" },
      { key: "weekday_ek5_rate", label: "Hafta İçi EK-5 EUR/m³", type: "number" },
      { key: "weekend_ek1_rate", label: "Hafta Sonu EK-1 EUR/m³", type: "number" },
      { key: "weekend_ek4_rate", label: "Hafta Sonu EK-4 EUR/m³", type: "number" },
      { key: "weekend_ek5_rate", label: "Hafta Sonu EK-5 EUR/m³", type: "number" },
      { key: "currency", label: "Para Birimi", type: "currency" },
      { key: "valid_year", label: "Geçerlilik Yılı", type: "year" },
    ],
  },
  {
    key: "port_authority_fees",
    label: "Liman Resmi Ücretleri",
    icon: FileText,
    currency: "TRY",
    columns: [
      { key: "fee_name", label: "Ücret Adı" },
      { key: "fee_no", label: "No" },
      { key: "size_min", label: "Boyut Min" },
      { key: "amount", label: "Tutar" },
      { key: "unit", label: "Birim" },
      { key: "currency", label: "Para Birimi" },
      { key: "valid_year", label: "Yıl" },
    ],
    formFields: [
      { key: "fee_name", label: "Ücret Adı", type: "text" },
      { key: "fee_no", label: "Ücret No", type: "number" },
      { key: "size_min", label: "Boyut/Tonaj Min", type: "text" },
      { key: "size_max", label: "Boyut/Tonaj Max", type: "text" },
      { key: "amount", label: "Tutar", type: "number" },
      { key: "unit", label: "Birim", type: "text", placeholder: "TL / m³ / ton" },
      { key: "currency", label: "Para Birimi", type: "currency" },
      { key: "valid_year", label: "Geçerlilik Yılı", type: "year" },
      { key: "multiplier_rule", label: "Çarpan Kuralı", type: "textarea" },
    ],
  },
  {
    key: "lcb_tariffs",
    label: "LCB / Tonaj",
    icon: Layers,
    currency: "TRY",
    columns: [
      { key: "nrt_min", label: "NRT Min" },
      { key: "nrt_max", label: "NRT Max" },
      { key: "amount", label: "Tutar (TRY)" },
      { key: "currency", label: "Para Birimi" },
      { key: "valid_year", label: "Yıl" },
    ],
    formFields: [
      { key: "nrt_min", label: "NRT Min", type: "number" },
      { key: "nrt_max", label: "NRT Max", type: "number" },
      { key: "amount", label: "Tutar (TRY)", type: "number" },
      { key: "currency", label: "Para Birimi", type: "currency" },
      { key: "valid_year", label: "Geçerlilik Yılı", type: "year" },
    ],
  },
  {
    key: "tonnage_tariffs",
    label: "Tonaj Ücretleri",
    icon: Layers,
    currency: "TRY",
    columns: [
      { key: "nrt_min", label: "NRT Min" },
      { key: "nrt_max", label: "NRT Max" },
      { key: "ithalat", label: "İthalat (TRY)" },
      { key: "ihracat", label: "İhracat (TRY)" },
      { key: "currency", label: "Para Birimi" },
      { key: "valid_year", label: "Yıl" },
    ],
    formFields: [
      { key: "nrt_min", label: "NRT Min", type: "number" },
      { key: "nrt_max", label: "NRT Max", type: "number" },
      { key: "ithalat", label: "İthalat (TRY)", type: "number" },
      { key: "ihracat", label: "İhracat (TRY)", type: "number" },
      { key: "currency", label: "Para Birimi", type: "currency" },
      { key: "valid_year", label: "Geçerlilik Yılı", type: "year" },
    ],
  },
  {
    key: "cargo_handling_tariffs",
    label: "Yükleme/Boşaltma",
    icon: Package,
    currency: "USD",
    columns: [
      { key: "cargo_type", label: "Kargo Tipi" },
      { key: "operation", label: "Operasyon" },
      { key: "rate", label: "Ücret" },
      { key: "unit", label: "Birim" },
      { key: "currency", label: "Para Birimi" },
      { key: "valid_year", label: "Yıl" },
    ],
    formFields: [
      { key: "cargo_type", label: "Kargo Tipi", type: "text", placeholder: "General Kargo / Konteyner" },
      { key: "operation", label: "Operasyon", type: "text", placeholder: "yukleme / bosaltma / her ikisi" },
      { key: "rate", label: "Ücret", type: "number" },
      { key: "unit", label: "Birim", type: "text", placeholder: "ton / adet" },
      { key: "currency", label: "Para Birimi", type: "currency" },
      { key: "valid_year", label: "Geçerlilik Yılı", type: "year" },
      { key: "notes", label: "Notlar", type: "textarea" },
    ],
  },
  {
    key: "other_services",
    label: "Diğer Hizmetler",
    icon: MoreHorizontal,
    currency: "EUR",
    columns: [
      { key: "service_name", label: "Hizmet Adı" },
      { key: "fee", label: "Ücret" },
      { key: "unit", label: "Birim" },
      { key: "currency", label: "Para Birimi" },
      { key: "notes", label: "Notlar" },
      { key: "valid_year", label: "Yıl" },
    ],
    formFields: [
      { key: "service_name", label: "Hizmet Adı", type: "text" },
      { key: "fee", label: "Ücret", type: "number" },
      { key: "unit", label: "Birim", type: "text", placeholder: "sefer başı / kişi başı / ton" },
      { key: "currency", label: "Para Birimi", type: "currency" },
      { key: "valid_year", label: "Geçerlilik Yılı", type: "year" },
      { key: "notes", label: "Notlar", type: "textarea" },
    ],
  },
];

const fmtNum = (v: any) => (v === null || v === undefined || v === "") ? "—" : Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const currencyBadge = (c: string) => c === "EUR" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : c === "TRY" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";

// ── Main Component ────────────────────────────────────────────────────────────
export default function TariffManagement() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const userRole = (user as any)?.userRole;

  if (userRole && userRole !== "admin") {
    navigate("/dashboard");
    return null;
  }

  const [activeTable, setActiveTable] = useState("pilotage_tariffs");
  const [filterPortId, setFilterPortId] = useState("all");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [bulkIncreaseOpen, setBulkIncreaseOpen] = useState(false);
  const [bulkIncreasePercent, setBulkIncreasePercent] = useState("5");
  const [bulkCopyOpen, setBulkCopyOpen] = useState(false);
  const [bulkCopyYear, setBulkCopyYear] = useState("2027");

  const currentTableConfig = TARIFF_TABLES.find(t => t.key === activeTable)!;

  // Summary
  const { data: summary } = useQuery<any>({
    queryKey: ["/api/admin/tariffs/summary"],
    queryFn: async () => {
      const res = await fetch("/api/admin/tariffs/summary");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  // Ports for filter
  const { data: ports = [] } = useQuery<any[]>({
    queryKey: ["/api/ports"],
    queryFn: async () => {
      const res = await fetch("/api/ports?limit=50");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Tariff data
  const tariffQK = ["/api/admin/tariffs", activeTable, filterPortId, filterCurrency, filterYear];
  const { data: tariffRows = [], isLoading: tariffLoading } = useQuery<any[]>({
    queryKey: tariffQK,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterPortId !== "all") params.set("portId", filterPortId);
      if (filterCurrency !== "all") params.set("currency", filterCurrency);
      if (filterYear !== "all") params.set("year", filterYear);
      const res = await fetch(`/api/admin/tariffs/${activeTable}?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...formData };
      if (filterPortId !== "all" && !payload.port_id) payload.port_id = parseInt(filterPortId);
      if (editRow?.id) {
        return apiRequest("PATCH", `/api/admin/tariffs/${activeTable}/${editRow.id}`, payload);
      }
      return apiRequest("POST", `/api/admin/tariffs/${activeTable}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tariffs"] });
      toast({ title: editRow?.id ? "Tarife güncellendi" : "Tarife eklendi" });
      setFormOpen(false);
    },
    onError: () => toast({ title: "Hata", description: "İşlem başarısız", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/tariffs/${activeTable}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tariffs"] });
      toast({ title: "Tarife silindi" });
      setDeleteTarget(null);
    },
  });

  const bulkIncreaseMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/tariffs/${activeTable}/bulk-increase`, { ids: selectedIds, percent: parseFloat(bulkIncreasePercent) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tariffs"] });
      toast({ title: `%${bulkIncreasePercent} zam uygulandı`, description: `${selectedIds.length} kayıt güncellendi` });
      setBulkIncreaseOpen(false);
      setSelectedIds([]);
    },
  });

  const bulkCopyMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/admin/tariffs/${activeTable}/bulk-copy-year`, { ids: selectedIds, targetYear: parseInt(bulkCopyYear) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tariffs"] });
      toast({ title: `${bulkCopyYear} yılına kopyalandı`, description: `${selectedIds.length} kayıt kopyalandı` });
      setBulkCopyOpen(false);
      setSelectedIds([]);
    },
  });

  const openAdd = () => {
    setEditRow(null);
    const defaults: Record<string, any> = { currency: currentTableConfig.currency, valid_year: 2026 };
    setFormData(defaults);
    setFormOpen(true);
  };

  const openEdit = (row: any) => {
    setEditRow(row);
    setFormData({ ...row });
    setFormOpen(true);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === tariffRows.length) setSelectedIds([]);
    else setSelectedIds(tariffRows.map((r: any) => r.id));
  };

  const portName = (id: number) => {
    const p = ports.find((p: any) => p.id === id);
    return p ? p.name : `Liman #${id}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <PageMeta title="Tarife Yönetimi | VesselPDA Admin" description="Türk liman tarifeleri yönetim paneli" />

      {/* Header */}
      <div className="border-b bg-card/50 px-6 py-4">
        <div className="max-w-screen-xl mx-auto flex items-center gap-3">
          <Database className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-black font-serif">Tarife Yönetimi</h1>
            <p className="text-sm text-muted-foreground">Türk Liman Tarifeleri — Resmi 2026 Verileri</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="max-w-screen-xl mx-auto px-6 py-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Aktif Limanlar</p>
          <p className="text-2xl font-black mt-1">{summary?.portCount ?? "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Toplam Tarife</p>
          <p className="text-2xl font-black mt-1">{summary?.totalRecords ?? "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Son Güncelleme</p>
          <p className="text-lg font-bold mt-1">
            {summary?.lastUpdated ? new Date(summary.lastUpdated).toLocaleDateString("tr-TR") : "—"}
          </p>
        </Card>
        <Card className={`p-4 ${summary?.outdatedCount > 0 ? "border-amber-400 bg-amber-50 dark:bg-amber-950/20" : ""}`}>
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            {summary?.outdatedCount > 0 && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
            Eski Tarife (&gt;1 yıl)
          </p>
          <p className={`text-2xl font-black mt-1 ${summary?.outdatedCount > 0 ? "text-amber-600" : ""}`}>
            {summary?.outdatedCount ?? "—"}
          </p>
        </Card>
      </div>

      {/* Two-column layout */}
      <div className="max-w-screen-xl mx-auto px-6 pb-10 flex gap-4">

        {/* Left menu */}
        <div className="w-56 shrink-0 space-y-1">
          {TARIFF_TABLES.map(t => {
            const Icon = t.icon;
            const count = summary?.tableCounts?.[t.key];
            return (
              <button
                key={t.key}
                onClick={() => { setActiveTable(t.key); setSelectedIds([]); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm transition-all ${activeTable === t.key ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                data-testid={`tariff-menu-${t.key}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 leading-tight">{t.label}</span>
                {count !== undefined && (
                  <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-bold ${activeTable === t.key ? "bg-white/20" : "bg-muted"}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Filters + Actions bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <Select value={filterPortId} onValueChange={v => { setFilterPortId(v); setSelectedIds([]); }}>
              <SelectTrigger className="w-44 h-8 text-xs" data-testid="filter-port">
                <SelectValue placeholder="Tüm Limanlar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Limanlar</SelectItem>
                {ports.slice(0, 30).map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCurrency} onValueChange={v => { setFilterCurrency(v); setSelectedIds([]); }}>
              <SelectTrigger className="w-28 h-8 text-xs" data-testid="filter-currency">
                <SelectValue placeholder="Para Birimi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="TRY">TRY</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterYear} onValueChange={v => { setFilterYear(v); setSelectedIds([]); }}>
              <SelectTrigger className="w-24 h-8 text-xs" data-testid="filter-year">
                <SelectValue placeholder="Yıl" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Yıllar</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto flex items-center gap-2">
              {selectedIds.length > 0 && (
                <>
                  <span className="text-xs text-muted-foreground">{selectedIds.length} seçili</span>
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setBulkIncreaseOpen(true)} data-testid="button-bulk-increase">
                    <TrendingUp className="w-3.5 h-3.5" /> % Zam
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setBulkCopyOpen(true)} data-testid="button-bulk-copy">
                    <Copy className="w-3.5 h-3.5" /> Yıla Kopyala
                  </Button>
                </>
              )}
              <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={openAdd} data-testid="button-add-tariff">
                <Plus className="w-3.5 h-3.5" /> Yeni Ekle
              </Button>
            </div>
          </div>

          {/* Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="w-8 px-3 py-2.5">
                      <Checkbox
                        checked={tariffRows.length > 0 && selectedIds.length === tariffRows.length}
                        onCheckedChange={toggleAll}
                        data-testid="checkbox-select-all"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">ID</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Liman</th>
                    {currentTableConfig.columns.map(col => (
                      <th key={col.key} className="px-3 py-2.5 text-left font-semibold text-muted-foreground whitespace-nowrap">{col.label}</th>
                    ))}
                    <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {tariffLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-3 py-2.5" colSpan={currentTableConfig.columns.length + 4}>
                          <Skeleton className="h-4 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : tariffRows.length === 0 ? (
                    <tr>
                      <td colSpan={currentTableConfig.columns.length + 4} className="px-3 py-12 text-center text-muted-foreground">
                        Bu tabloda kayıt bulunamadı
                      </td>
                    </tr>
                  ) : (
                    tariffRows.map((row: any) => (
                      <tr key={row.id} className={`border-b hover:bg-muted/20 transition-colors ${selectedIds.includes(row.id) ? "bg-primary/5" : ""}`}>
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={selectedIds.includes(row.id)}
                            onCheckedChange={() => toggleSelect(row.id)}
                            data-testid={`checkbox-row-${row.id}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{row.id}</td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {row.port_id ? portName(row.port_id) : <span className="italic">Genel</span>}
                        </td>
                        {currentTableConfig.columns.map(col => (
                          <td key={col.key} className="px-3 py-2 whitespace-nowrap max-w-[160px] truncate">
                            {col.key === "currency" ? (
                              <Badge className={`text-[10px] px-1.5 ${currencyBadge(row[col.key])}`}>{row[col.key]}</Badge>
                            ) : col.key === "valid_year" ? (
                              <Badge variant="outline" className="text-[10px]">{row[col.key]}</Badge>
                            ) : typeof row[col.key] === "number" || (!isNaN(Number(row[col.key])) && row[col.key] !== null && row[col.key] !== "") ? (
                              <span className="font-mono">{fmtNum(row[col.key])}</span>
                            ) : (
                              <span title={row[col.key]}>{row[col.key] ?? "—"}</span>
                            )}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(row)} data-testid={`button-edit-${row.id}`}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(row.id)} data-testid={`button-delete-${row.id}`}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {tariffRows.length > 0 && (
              <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
                {tariffRows.length} kayıt gösteriliyor
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editRow?.id ? "Tarife Düzenle" : `${currentTableConfig.label} — Yeni Ekle`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Port selector */}
            <div>
              <Label>Liman</Label>
              <Select
                value={formData.port_id ? String(formData.port_id) : "global"}
                onValueChange={v => setFormData(f => ({ ...f, port_id: v === "global" ? null : parseInt(v) }))}
              >
                <SelectTrigger data-testid="form-port-select">
                  <SelectValue placeholder="Liman seçin..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Genel (Liman Bağımsız)</SelectItem>
                  {ports.slice(0, 30).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic fields */}
            <div className="grid grid-cols-2 gap-3">
              {currentTableConfig.formFields.map(field => (
                <div key={field.key} className={field.type === "textarea" ? "col-span-2" : ""}>
                  <Label>{field.label}</Label>
                  {field.type === "textarea" ? (
                    <Textarea
                      rows={2}
                      value={formData[field.key] ?? ""}
                      onChange={e => setFormData(f => ({ ...f, [field.key]: e.target.value }))}
                      placeholder={(field as any).placeholder || ""}
                      data-testid={`form-field-${field.key}`}
                      className="text-sm"
                    />
                  ) : field.type === "currency" ? (
                    <Select value={formData[field.key] ?? "USD"} onValueChange={v => setFormData(f => ({ ...f, [field.key]: v }))}>
                      <SelectTrigger data-testid={`form-field-${field.key}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="TRY">TRY</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : field.type === "year" ? (
                    <Select value={String(formData[field.key] ?? 2026)} onValueChange={v => setFormData(f => ({ ...f, [field.key]: parseInt(v) }))}>
                      <SelectTrigger data-testid={`form-field-${field.key}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2026">2026</SelectItem>
                        <SelectItem value="2025">2025</SelectItem>
                        <SelectItem value="2024">2024</SelectItem>
                        <SelectItem value="2027">2027</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={field.type}
                      value={formData[field.key] ?? ""}
                      onChange={e => setFormData(f => ({ ...f, [field.key]: field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value }))}
                      placeholder={(field as any).placeholder || ""}
                      data-testid={`form-field-${field.key}`}
                      className="text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>İptal</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-tariff">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tarife Kaydını Sil</AlertDialogTitle>
            <AlertDialogDescription>Bu tarife kalıcı olarak silinecek. Devam edilsin mi?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Increase Dialog */}
      <Dialog open={bulkIncreaseOpen} onOpenChange={setBulkIncreaseOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> % Zam Uygula
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Seçili <span className="font-bold text-foreground">{selectedIds.length}</span> kayda zam uygulanacak.</p>
            <div>
              <Label>Zam Yüzdesi (%)</Label>
              <Input
                type="number"
                min="0.1"
                max="500"
                value={bulkIncreasePercent}
                onChange={e => setBulkIncreasePercent(e.target.value)}
                data-testid="input-bulk-percent"
              />
            </div>
            <p className="text-xs text-muted-foreground bg-muted rounded p-2">
              Ücret alanları ({currentTableConfig.label}) <span className="font-semibold">%{bulkIncreasePercent}</span> artırılacak.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkIncreaseOpen(false)}>İptal</Button>
            <Button onClick={() => bulkIncreaseMutation.mutate()} disabled={bulkIncreaseMutation.isPending} data-testid="button-confirm-increase">
              {bulkIncreaseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Uygula"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Copy Year Dialog */}
      <Dialog open={bulkCopyOpen} onOpenChange={setBulkCopyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-4 h-4 text-primary" /> Yıla Kopyala
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Seçili <span className="font-bold text-foreground">{selectedIds.length}</span> kayıt hedef yıla kopyalanacak.</p>
            <div>
              <Label>Hedef Yıl</Label>
              <Select value={bulkCopyYear} onValueChange={setBulkCopyYear}>
                <SelectTrigger data-testid="select-copy-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2027">2027</SelectItem>
                  <SelectItem value="2028">2028</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground bg-muted rounded p-2">
              Kayıtlar <span className="font-semibold">{bulkCopyYear}</span> yılı olarak yeni kayıt olarak eklenecek.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkCopyOpen(false)}>İptal</Button>
            <Button onClick={() => bulkCopyMutation.mutate()} disabled={bulkCopyMutation.isPending} data-testid="button-confirm-copy">
              {bulkCopyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kopyala"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
