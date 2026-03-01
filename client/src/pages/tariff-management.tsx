import { useState, useRef } from "react";
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
import {
  Navigation, Warehouse, Building2, Leaf, Layers, MoreHorizontal,
  Plus, Pencil, Trash2, Loader2, TrendingUp, Download, Upload,
  ChevronDown, ChevronUp, Database, Ship, AlertTriangle
} from "lucide-react";

// ── Human-readable label maps ────────────────────────────────────────────────
const SERVICE_LABELS: Record<string, string> = {
  kabotaj: "Kabotaj Kılavuzluk",
  kabotaj_yeni: "Kabotaj Kılavuzluk (Yeni)",
  uluslararasi: "Uluslararası Kılavuzluk",
  uluslararasi_yeni: "Uluslararası Kılavuzluk (Yeni)",
  "romorkör_kabotaj": "Kabotaj Römorkör",
  "romorkör_kabotaj_yeni": "Kabotaj Römorkör (Yeni)",
  "romorkör_uluslararasi": "Uluslararası Römorkör",
  "romorkör_uluslararasi_yeni": "Uluslararası Römorkör (Yeni)",
  palamar_kabotaj: "Kabotaj Palamar",
  palamar_kabotaj_yeni: "Kabotaj Palamar (Yeni)",
  palamar_uluslararasi: "Uluslararası Palamar",
  palamar_uluslararasi_yeni: "Uluslararası Palamar (Yeni)",
  acentelik: "Acentelik",
  koruyucu_acentelik: "Koruyucu Acentelik",
};

const CATEGORY_LABELS: Record<string, string> = {
  diger_tum: "Tüm Gemiler",
  diger_yuk: "Genel Yük",
  konteyner: "Konteyner",
  yolcu_feribot_roro_car_carrier: "Yolcu / RoRo / Feribot",
  calisan_gemiler: "Çalışan Gemiler",
  tanker: "Tanker",
};

const PORTS = [
  { id: 2, name: "İstanbul", code: "TRIST" },
  { id: 3, name: "İzmir", code: "TRIZM" },
  { id: 1, name: "Tekirdağ", code: "TRTEK" },
];

// ── Category definitions ──────────────────────────────────────────────────────
type ColDef = {
  key: string;
  label: string;
  type?: "number" | "text" | "currency" | "year" | "textarea";
};

interface CategoryDef {
  key: string;
  label: string;
  icon: any;
  defaultCurrency: string;
  columns: ColDef[];
  formFields: ColDef[];
}

const CATEGORIES: CategoryDef[] = [
  {
    key: "pilotage_tariffs",
    label: "Kılavuzluk Ücretleri",
    icon: Navigation,
    defaultCurrency: "USD",
    columns: [
      { key: "service_type", label: "Hizmet Türü" },
      { key: "vessel_category", label: "Gemi Tipi" },
      { key: "grt_min", label: "GRT Alt", type: "number" },
      { key: "grt_max", label: "GRT Üst", type: "number" },
      { key: "base_fee", label: "Taban Ücret", type: "number" },
      { key: "per_1000_grt", label: "+1000 GRT", type: "number" },
      { key: "currency", label: "Kur", type: "currency" },
      { key: "valid_year", label: "Yıl", type: "year" },
    ],
    formFields: [
      { key: "service_type", label: "Hizmet Türü (örn: kabotaj)", type: "text" },
      { key: "vessel_category", label: "Gemi Kategorisi (örn: konteyner)", type: "text" },
      { key: "grt_min", label: "GRT Alt Sınır", type: "number" },
      { key: "grt_max", label: "GRT Üst Sınır", type: "number" },
      { key: "base_fee", label: "Taban Ücret", type: "number" },
      { key: "per_1000_grt", label: "Her 1000 GRT Ücreti", type: "number" },
      { key: "currency", label: "Para Birimi", type: "currency" },
      { key: "valid_year", label: "Geçerlilik Yılı", type: "year" },
      { key: "notes", label: "Notlar", type: "textarea" },
    ],
  },
  {
    key: "berthing_tariffs",
    label: "Barınma Ücretleri",
    icon: Warehouse,
    defaultCurrency: "USD",
    columns: [
      { key: "gt_min", label: "GT Alt", type: "number" },
      { key: "gt_max", label: "GT Üst", type: "number" },
      { key: "intl_foreign_flag", label: "Yabancı Bayrak / Gün", type: "number" },
      { key: "intl_turkish_flag", label: "Türk Bayrak Int. / Gün", type: "number" },
      { key: "cabotage_turkish", label: "Kabotaj Türk / Gün", type: "number" },
      { key: "currency", label: "Kur", type: "currency" },
      { key: "valid_year", label: "Yıl", type: "year" },
    ],
    formFields: [
      { key: "gt_min", label: "GT Alt Sınır", type: "number" },
      { key: "gt_max", label: "GT Üst Sınır", type: "number" },
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
    label: "Acente Ücretleri",
    icon: Building2,
    defaultCurrency: "EUR",
    columns: [
      { key: "tariff_no", label: "Tarife No" },
      { key: "service_type", label: "Hizmet Türü" },
      { key: "nt_min", label: "NT Alt", type: "number" },
      { key: "nt_max", label: "NT Üst", type: "number" },
      { key: "fee", label: "Ücret", type: "number" },
      { key: "currency", label: "Kur", type: "currency" },
      { key: "valid_year", label: "Yıl", type: "year" },
    ],
    formFields: [
      { key: "tariff_no", label: "Tarife No (T1 / T2 vb.)", type: "text" },
      { key: "service_type", label: "Hizmet Türü (acentelik / koruyucu_acentelik)", type: "text" },
      { key: "nt_min", label: "NT Alt Sınır", type: "number" },
      { key: "nt_max", label: "NT Üst Sınır", type: "number" },
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
    defaultCurrency: "EUR",
    columns: [
      { key: "grt_min", label: "GRT Alt", type: "number" },
      { key: "grt_max", label: "GRT Üst", type: "number" },
      { key: "fixed_fee", label: "Sabit Ücret (EUR)", type: "number" },
      { key: "marpol_ek1_included", label: "EK-1 Dahil m³", type: "number" },
      { key: "marpol_ek4_included", label: "EK-4 Dahil m³", type: "number" },
      { key: "currency", label: "Kur", type: "currency" },
      { key: "valid_year", label: "Yıl", type: "year" },
    ],
    formFields: [
      { key: "grt_min", label: "GRT Alt Sınır", type: "number" },
      { key: "grt_max", label: "GRT Üst Sınır", type: "number" },
      { key: "fixed_fee", label: "Sabit Ücret (EUR)", type: "number" },
      { key: "marpol_ek1_included", label: "EK-1 Dahil m³ (sintine/yağ)", type: "number" },
      { key: "marpol_ek4_included", label: "EK-4 Dahil m³ (pis su)", type: "number" },
      { key: "marpol_ek5_included", label: "EK-5 Dahil m³ (çöp)", type: "number" },
      { key: "weekday_ek1_rate", label: "Hf. İçi EK-1 EUR/m³", type: "number" },
      { key: "weekday_ek4_rate", label: "Hf. İçi EK-4 EUR/m³", type: "number" },
      { key: "weekday_ek5_rate", label: "Hf. İçi EK-5 EUR/m³", type: "number" },
      { key: "weekend_ek1_rate", label: "Hf. Sonu EK-1 EUR/m³", type: "number" },
      { key: "weekend_ek4_rate", label: "Hf. Sonu EK-4 EUR/m³", type: "number" },
      { key: "weekend_ek5_rate", label: "Hf. Sonu EK-5 EUR/m³", type: "number" },
      { key: "currency", label: "Para Birimi", type: "currency" },
      { key: "valid_year", label: "Geçerlilik Yılı", type: "year" },
    ],
  },
  {
    key: "lcb_tariffs",
    label: "LCB / Tonaj Ücretleri",
    icon: Layers,
    defaultCurrency: "TRY",
    columns: [
      { key: "nrt_min", label: "NRT Alt", type: "number" },
      { key: "nrt_max", label: "NRT Üst", type: "number" },
      { key: "amount", label: "Tutar (TRY)", type: "number" },
      { key: "currency", label: "Kur", type: "currency" },
      { key: "valid_year", label: "Yıl", type: "year" },
    ],
    formFields: [
      { key: "nrt_min", label: "NRT Alt Sınır", type: "number" },
      { key: "nrt_max", label: "NRT Üst Sınır", type: "number" },
      { key: "amount", label: "Tutar (TRY)", type: "number" },
      { key: "currency", label: "Para Birimi", type: "currency" },
      { key: "valid_year", label: "Geçerlilik Yılı", type: "year" },
    ],
  },
  {
    key: "other_services",
    label: "Diğer Hizmetler",
    icon: MoreHorizontal,
    defaultCurrency: "EUR",
    columns: [
      { key: "service_name", label: "Hizmet Adı" },
      { key: "fee", label: "Ücret", type: "number" },
      { key: "unit", label: "Birim" },
      { key: "currency", label: "Kur", type: "currency" },
      { key: "valid_year", label: "Yıl", type: "year" },
    ],
    formFields: [
      { key: "service_name", label: "Hizmet Adı", type: "text" },
      { key: "fee", label: "Ücret", type: "number" },
      { key: "unit", label: "Birim (sefer başı / ton / vb.)", type: "text" },
      { key: "currency", label: "Para Birimi", type: "currency" },
      { key: "valid_year", label: "Geçerlilik Yılı", type: "year" },
      { key: "notes", label: "Notlar", type: "textarea" },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtNum = (v: any) =>
  v === null || v === undefined || v === ""
    ? "—"
    : Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const readableLabel = (key: string, value: any): string => {
  if (!value && value !== 0) return "—";
  if (key === "service_type") return SERVICE_LABELS[String(value)] ?? String(value);
  if (key === "vessel_category") return CATEGORY_LABELS[String(value)] ?? String(value);
  return String(value);
};

const currencyColor = (c: string) =>
  c === "EUR"
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    : c === "TRY"
    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";

// ── FormField ─────────────────────────────────────────────────────────────────
function FormField({
  field, value, onChange,
}: {
  field: ColDef; value: any; onChange: (v: any) => void;
}) {
  if (field.type === "textarea") {
    return (
      <Textarea
        rows={2}
        value={value ?? ""}
        onChange={e => onChange(e.target.value)}
        className="text-sm"
        data-testid={`form-field-${field.key}`}
      />
    );
  }
  if (field.type === "currency") {
    return (
      <Select value={value ?? "USD"} onValueChange={onChange}>
        <SelectTrigger data-testid={`form-field-${field.key}`}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="USD">USD</SelectItem>
          <SelectItem value="EUR">EUR</SelectItem>
          <SelectItem value="TRY">TRY</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (field.type === "year") {
    return (
      <Select value={String(value ?? 2026)} onValueChange={v => onChange(parseInt(v))}>
        <SelectTrigger data-testid={`form-field-${field.key}`}><SelectValue /></SelectTrigger>
        <SelectContent>
          {[2024, 2025, 2026, 2027, 2028].map(y => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      type={field.type === "number" ? "number" : "text"}
      value={value ?? ""}
      onChange={e =>
        onChange(
          field.type === "number"
            ? e.target.value === "" ? "" : Number(e.target.value)
            : e.target.value,
        )
      }
      className="text-sm"
      data-testid={`form-field-${field.key}`}
    />
  );
}

// ── InlineCell ────────────────────────────────────────────────────────────────
function InlineCell({
  col, value, editData, setEditData, editing,
}: {
  col: ColDef; value: any; editData: Record<string, any>; setEditData: (fn: (d: any) => any) => void; editing: boolean;
}) {
  if (!editing) {
    if (col.type === "currency") {
      return <Badge className={`text-[10px] px-1.5 ${currencyColor(value)}`}>{value}</Badge>;
    }
    if (col.type === "year") {
      return <Badge variant="outline" className="text-[10px]">{value}</Badge>;
    }
    if (col.type === "number") {
      return <span className="font-mono tabular-nums text-foreground">{fmtNum(value)}</span>;
    }
    return <span className="text-foreground">{readableLabel(col.key, value)}</span>;
  }

  if (col.type === "currency") {
    return (
      <Select
        value={editData[col.key] ?? "USD"}
        onValueChange={v => setEditData(d => ({ ...d, [col.key]: v }))}
      >
        <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="USD">USD</SelectItem>
          <SelectItem value="EUR">EUR</SelectItem>
          <SelectItem value="TRY">TRY</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (col.type === "year") {
    return (
      <Select
        value={String(editData[col.key] ?? 2026)}
        onValueChange={v => setEditData(d => ({ ...d, [col.key]: parseInt(v) }))}
      >
        <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {[2024, 2025, 2026, 2027, 2028].map(y => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      type={col.type === "number" ? "number" : "text"}
      value={editData[col.key] ?? ""}
      onChange={e =>
        setEditData(d => ({
          ...d,
          [col.key]: col.type === "number"
            ? e.target.value === "" ? "" : Number(e.target.value)
            : e.target.value,
        }))
      }
      className={`h-7 text-xs ${col.type === "number" ? "w-28" : "w-36"}`}
      data-testid={`inline-${col.key}-${editData.id}`}
    />
  );
}

// ── CategorySection ───────────────────────────────────────────────────────────
function CategorySection({ cat, portId }: { cat: CategoryDef; portId: number }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addData, setAddData] = useState<Record<string, any>>({});
  const [editRowId, setEditRowId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPercent, setBulkPercent] = useState("5");
  const Icon = cat.icon;

  const qk = ["/api/admin/tariffs", cat.key, portId];
  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: qk,
    queryFn: async () => {
      const params = new URLSearchParams({ portId: String(portId) });
      const res = await fetch(`/api/admin/tariffs/${cat.key}?${params}`);
      if (!res.ok) throw new Error("Veri alınamadı");
      return res.json();
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/tariffs", cat.key, portId] });

  const addMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/admin/tariffs/${cat.key}`, { ...addData, port_id: portId }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Tarife eklendi" });
      setAddOpen(false);
    },
    onError: () => toast({ title: "Hata", description: "Eklenemedi", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/admin/tariffs/${cat.key}/${editRowId}`, editData),
    onSuccess: () => {
      invalidate();
      toast({ title: "Tarife güncellendi" });
      setEditRowId(null);
    },
    onError: () =>
      toast({ title: "Hata", description: "Güncellenemedi", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/admin/tariffs/${cat.key}/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Tarife silindi" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Hata", description: "Silinemedi", variant: "destructive" }),
  });

  const bulkMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/admin/tariffs/${cat.key}/bulk-increase`, {
        ids: rows.map((r: any) => r.id),
        percent: parseFloat(bulkPercent),
      }),
    onSuccess: () => {
      invalidate();
      toast({ title: `%${bulkPercent} zam uygulandı`, description: `${rows.length} kayıt güncellendi` });
      setBulkOpen(false);
    },
    onError: () =>
      toast({ title: "Hata", description: "Zam uygulanamadı", variant: "destructive" }),
  });

  const openAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAddData({ currency: cat.defaultCurrency, valid_year: 2026 });
    setAddOpen(true);
  };

  const openEdit = (row: any) => {
    setEditRowId(row.id);
    setEditData({ ...row });
  };

  return (
    <Card className="overflow-hidden">
      {/* ── Section header ── */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
        data-testid={`category-toggle-${cat.key}`}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{cat.label}</p>
          <p className="text-xs text-muted-foreground">
            {isLoading ? "Yükleniyor..." : `${rows.length} kayıt · ${cat.defaultCurrency} bazlı`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          {rows.length > 0 && (
            <Button
              size="sm" variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={e => { e.stopPropagation(); setBulkOpen(true); }}
              data-testid={`button-bulk-${cat.key}`}
            >
              <TrendingUp className="w-3 h-3" /> % Zam
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={openAdd}
            data-testid={`button-add-${cat.key}`}
          >
            <Plus className="w-3 h-3" /> Ekle
          </Button>
          {open
            ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-1" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />}
        </div>
      </button>

      {/* ── Table ── */}
      {open && (
        <div className="border-t overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/30 border-b">
                {cat.columns.map(col => (
                  <th key={col.key} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={cat.columns.length + 1} className="px-3 py-2.5">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={cat.columns.length + 1}
                    className="px-3 py-10 text-center text-muted-foreground italic text-xs"
                  >
                    Bu liman için kayıt bulunamadı — "Ekle" butonuyla yeni tarife oluşturun
                  </td>
                </tr>
              ) : (
                rows.map((row: any) => {
                  const isEditing = editRowId === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={`border-b transition-colors ${isEditing ? "bg-primary/5" : "hover:bg-muted/20"}`}
                    >
                      {cat.columns.map(col => (
                        <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                          <InlineCell
                            col={col}
                            value={row[col.key]}
                            editData={editData}
                            setEditData={setEditData}
                            editing={isEditing}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm" variant="outline"
                              className="h-6 text-xs px-2"
                              onClick={() => setEditRowId(null)}
                            >
                              İptal
                            </Button>
                            <Button
                              size="sm"
                              className="h-6 text-xs px-2"
                              onClick={() => editMutation.mutate()}
                              disabled={editMutation.isPending}
                              data-testid={`button-save-${row.id}`}
                            >
                              {editMutation.isPending
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : "Kaydet"}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon" variant="ghost"
                              className="h-6 w-6"
                              onClick={() => openEdit(row)}
                              data-testid={`button-edit-${row.id}`}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(row.id)}
                              data-testid={`button-delete-${row.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" />
              {cat.label} — Yeni Kayıt
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {cat.formFields.map(field => (
              <div key={field.key} className={field.type === "textarea" ? "col-span-2" : ""}>
                <Label className="text-xs mb-1 block">{field.label}</Label>
                <FormField
                  field={field}
                  value={addData[field.key]}
                  onChange={v => setAddData(d => ({ ...d, [field.key]: v }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>İptal</Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending}
              data-testid={`button-confirm-add-${cat.key}`}
            >
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={o => { if (!o) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tarife Kaydını Sil</AlertDialogTitle>
            <AlertDialogDescription>
              Bu tarife kalıcı olarak silinecek. Devam edilsin mi?
            </AlertDialogDescription>
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

      {/* ── Bulk Increase Dialog ── */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Toplu Zam — {cat.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Bu limanın{" "}
              <span className="font-semibold text-foreground">{rows.length}</span>{" "}
              kaydına ücret zamı uygulanacak.
            </p>
            <div>
              <Label>Zam Yüzdesi (%)</Label>
              <Input
                type="number"
                min="0.1" max="500" step="0.5"
                value={bulkPercent}
                onChange={e => setBulkPercent(e.target.value)}
                data-testid="input-bulk-percent"
              />
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300 flex gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Tüm ücret alanları %{bulkPercent} artırılacak. Geri alınamaz.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>İptal</Button>
            <Button
              onClick={() => bulkMutation.mutate()}
              disabled={bulkMutation.isPending}
              data-testid="button-confirm-bulk"
            >
              {bulkMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : `%${bulkPercent} Uygula`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TariffManagement() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const userRole = (user as any)?.userRole;
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [activePort, setActivePort] = useState(2);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  if (userRole && userRole !== "admin") {
    navigate("/dashboard");
    return null;
  }

  const activePortName = PORTS.find(p => p.id === activePort)?.name ?? "Liman";

  const { data: summary } = useQuery<any>({
    queryKey: ["/api/admin/tariffs/summary"],
    queryFn: async () => {
      const res = await fetch("/api/admin/tariffs/summary");
      if (!res.ok) throw new Error("Özet alınamadı");
      return res.json();
    },
  });

  // ── CSV Export ──────────────────────────────────────────────────────────────
  const handleExportCSV = async () => {
    try {
      const lines: string[] = [
        "tablo,id,port_id,alan1,alan2,aralik_min,aralik_max,ucret1,ucret2,ucret3,para_birimi,yil,notlar",
      ];

      for (const cat of CATEGORIES) {
        const params = new URLSearchParams({ portId: String(activePort) });
        const res = await fetch(`/api/admin/tariffs/${cat.key}?${params}`);
        if (!res.ok) continue;
        const rows: any[] = await res.json();

        rows.forEach(row => {
          const esc = (v: any) => {
            const s = String(v ?? "");
            return s.includes(",") || s.includes('"') || s.includes("\n")
              ? `"${s.replace(/"/g, '""')}"` : s;
          };
          const alan1 = row.service_type ?? row.cargo_type ?? row.service_name ?? row.fee_name ?? "";
          const alan2 = row.vessel_category ?? row.operation ?? row.tariff_no ?? row.service_description ?? "";
          const rMin = row.grt_min ?? row.gt_min ?? row.nrt_min ?? row.nt_min ?? "";
          const rMax = row.grt_max ?? row.gt_max ?? row.nrt_max ?? row.nt_max ?? "";
          const f1 = row.base_fee ?? row.fixed_fee ?? row.intl_foreign_flag ?? row.fee ?? row.amount ?? row.rate ?? "";
          const f2 = row.per_1000_grt ?? row.per_1000_nt ?? row.intl_turkish_flag ?? "";
          const f3 = row.cabotage_turkish ?? row.per_additional_1000_grt ?? "";
          lines.push([
            esc(cat.key), esc(row.id), esc(row.port_id ?? activePort),
            esc(alan1), esc(alan2), esc(rMin), esc(rMax),
            esc(f1), esc(f2), esc(f3),
            esc(row.currency ?? ""), esc(row.valid_year ?? ""), esc(row.notes ?? ""),
          ].join(","));
        });
      }

      const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tarifeleri_${activePortName.toLowerCase().replace(/\s/g, "_")}_2026.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV indirildi", description: `${activePortName} tarifeleri dışa aktarıldı` });
    } catch {
      toast({ title: "Hata", description: "CSV oluşturulamadı", variant: "destructive" });
    }
  };

  // ── CSV Import ──────────────────────────────────────────────────────────────
  const handleImportCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) {
      toast({ title: "Hatalı dosya", description: "CSV boş veya hatalı format", variant: "destructive" });
      return;
    }

    const headers = lines[0].split(",").map(h => h.trim().replace(/^\uFEFF/, "").replace(/^"|"$/g, ""));
    const tabloIdx = headers.indexOf("tablo");
    const idIdx = headers.indexOf("id");

    if (tabloIdx === -1) {
      toast({
        title: "Hatalı CSV",
        description: "'tablo' sütunu bulunamadı. VesselPDA'dan indirilen CSV kullanın.",
        variant: "destructive",
      });
      return;
    }

    const dataRows = lines.slice(1);
    setImportProgress({ current: 0, total: dataRows.length });
    let success = 0;
    let failed = 0;

    const col = (name: string, cols: string[]) => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? (cols[idx] ?? "").replace(/^"|"$/g, "") : "";
    };
    const numOrNull = (v: string) => (v === "" ? null : Number(v));

    for (let i = 0; i < dataRows.length; i++) {
      const cols = dataRows[i].split(",");
      const tableKey = col("tablo", cols);
      const rowId = idIdx >= 0 ? parseInt(col("id", cols)) : NaN;
      const catDef = CATEGORIES.find(c => c.key === tableKey);

      if (!catDef) {
        failed++;
        setImportProgress({ current: i + 1, total: dataRows.length });
        continue;
      }

      const alan1 = col("alan1", cols);
      const alan2 = col("alan2", cols);
      const rMin = col("aralik_min", cols);
      const rMax = col("aralik_max", cols);
      const f1 = col("ucret1", cols);
      const f2 = col("ucret2", cols);
      const f3 = col("ucret3", cols);
      const currency = col("para_birimi", cols) || catDef.defaultCurrency;
      const year = col("yil", cols) || "2026";
      const notes = col("notlar", cols);

      const payload: Record<string, any> = { port_id: activePort };

      if (tableKey === "pilotage_tariffs") {
        Object.assign(payload, { service_type: alan1, vessel_category: alan2, grt_min: numOrNull(rMin), grt_max: numOrNull(rMax), base_fee: numOrNull(f1), per_1000_grt: numOrNull(f2), currency, valid_year: parseInt(year), notes });
      } else if (tableKey === "berthing_tariffs") {
        Object.assign(payload, { gt_min: numOrNull(rMin), gt_max: numOrNull(rMax), intl_foreign_flag: numOrNull(f1), intl_turkish_flag: numOrNull(f2), cabotage_turkish: numOrNull(f3), currency, valid_year: parseInt(year), notes });
      } else if (tableKey === "agency_fees") {
        Object.assign(payload, { tariff_no: alan2, service_type: alan1, nt_min: numOrNull(rMin), nt_max: numOrNull(rMax), fee: numOrNull(f1), currency, valid_year: parseInt(year), notes });
      } else if (tableKey === "marpol_tariffs") {
        Object.assign(payload, { grt_min: numOrNull(rMin), grt_max: numOrNull(rMax), fixed_fee: numOrNull(f1), currency, valid_year: parseInt(year) });
      } else if (tableKey === "lcb_tariffs") {
        Object.assign(payload, { nrt_min: numOrNull(rMin), nrt_max: numOrNull(rMax), amount: numOrNull(f1), currency, valid_year: parseInt(year) });
      } else if (tableKey === "other_services") {
        Object.assign(payload, { service_name: alan1, fee: numOrNull(f1), unit: alan2, currency, valid_year: parseInt(year), notes });
      }

      try {
        if (!isNaN(rowId) && rowId > 0) {
          await apiRequest("PATCH", `/api/admin/tariffs/${tableKey}/${rowId}`, payload);
        } else {
          await apiRequest("POST", `/api/admin/tariffs/${tableKey}`, payload);
        }
        success++;
      } catch {
        failed++;
      }
      setImportProgress({ current: i + 1, total: dataRows.length });
    }

    setImportProgress(null);
    queryClient.invalidateQueries({ queryKey: ["/api/admin/tariffs"] });
    toast({
      title: "İçe aktarım tamamlandı",
      description: `${success} başarılı${failed > 0 ? `, ${failed} başarısız` : ""}`,
      variant: failed > 0 ? "destructive" : "default",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title="Tarife Yönetimi | VesselPDA Admin"
        description="Türk liman tarifeleri yönetim paneli"
      />

      {/* ── Sticky Header ── */}
      <div className="border-b bg-card/80 backdrop-blur px-6 py-3 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center gap-4 flex-wrap">

          {/* Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 shrink-0">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black font-serif leading-tight">Tarife Yönetimi</h1>
              <p className="text-xs text-muted-foreground">Resmi 2026 Türk Liman Tarifeleri</p>
            </div>
          </div>

          {/* Port tabs */}
          <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1">
            {PORTS.map(p => (
              <button
                key={p.id}
                onClick={() => setActivePort(p.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activePort === p.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                }`}
                data-testid={`port-tab-${p.id}`}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* CSV Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline" size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={handleExportCSV}
              data-testid="button-export-csv"
            >
              <Download className="w-3.5 h-3.5" /> CSV İndir
            </Button>
            <Button
              variant="outline" size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => csvInputRef.current?.click()}
              disabled={!!importProgress}
              data-testid="button-import-csv"
            >
              {importProgress ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {importProgress.current}/{importProgress.total}
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" /> CSV Yükle
                </>
              )}
            </Button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleImportCSV(f);
                e.target.value = "";
              }}
              data-testid="input-csv-file"
            />
          </div>
        </div>
      </div>

      {/* ── Info bar ── */}
      <div className="max-w-5xl mx-auto px-6 py-3">
        <div className="flex items-center gap-6 text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1.5">
            <Ship className="w-3.5 h-3.5" />
            <span>
              Seçili liman:{" "}
              <span className="font-semibold text-foreground">{activePortName}</span>
            </span>
          </div>
          {summary?.totalRecords !== undefined && (
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>
                Sistemdeki toplam kayıt:{" "}
                <span className="font-semibold text-foreground">{summary.totalRecords}</span>
              </span>
            </div>
          )}
          {summary?.outdatedCount > 0 && (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{summary.outdatedCount} eski tarife kaydı var</span>
            </div>
          )}
          <span className="ml-auto hidden sm:block">
            Liman sekmesini değiştirerek o limana ait tarifeleri görüntüleyin ve düzenleyin
          </span>
        </div>
      </div>

      {/* ── Category sections ── */}
      <div className="max-w-5xl mx-auto px-6 pb-16 space-y-3">
        {CATEGORIES.map(cat => (
          <CategorySection
            key={`${cat.key}-${activePort}`}
            cat={cat}
            portId={activePort}
          />
        ))}
      </div>
    </div>
  );
}
