import { useState, useRef, useEffect } from "react";
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
  ChevronDown, ChevronUp, Database, Ship, AlertTriangle, X, Search, PlusCircle, Globe, Info,
  Lightbulb, Briefcase, BarChart2, Anchor, ShieldCheck, Radio, FolderPlus, Eye, Receipt
} from "lucide-react";

// ── Human-readable label maps ────────────────────────────────────────────────
const SERVICE_LABELS: Record<string, string> = {
  turkish: "Turkish Flag",
  foreign: "Foreign Flag",
  all: "All Vessels",
  kabotaj: "Cabotage Pilotage",
  kabotaj_yeni: "Cabotage Pilotage (New)",
  uluslararasi: "International Pilotage",
  uluslararasi_yeni: "International Pilotage (New)",
  "romorkör_kabotaj": "Cabotage Tugboat",
  "romorkör_kabotaj_yeni": "Cabotage Tugboat (New)",
  "romorkör_uluslararasi": "International Tugboat",
  "romorkör_uluslararasi_yeni": "International Tugboat (New)",
  palamar_kabotaj: "Cabotage Mooring",
  palamar_kabotaj_yeni: "Cabotage Mooring (New)",
  palamar_uluslararasi: "International Mooring",
  palamar_uluslararasi_yeni: "International Mooring (New)",
  acentelik: "Agency Fee",
  koruyucu_acentelik: "Protective Agency Fee",
  motorboat: "Motorboat Exp.",
  facilities: "Facilities & Other Exp.",
  transportation: "Transportation Exp.",
  fiscal: "Fiscal & Notary Exp.",
  communication: "Communication & Copy & Stamp Exp.",
  vts: "VTS Fee",
  customs: "Customs Overtime",
  chamber_dto: "Chamber of Shipping Fee",
  anchorage: "Anchorage Dues (per day)",
};

const CATEGORY_LABELS: Record<string, string> = {
  calisan_gemiler: "Cabotage Vessels",
  konteyner: "Container Vessels",
  diger_yuk: "Other Cargo Vessels",
  diger_tum: "Other Cargo Vessels",
  yolcu_feribot_roro_car_carrier: "Passenger Ferry / Ro-Ro / Car Carrier",
  tanker: "Tanker",
};

const VESSEL_CATEGORY_OPTIONS = [
  { value: "calisan_gemiler", label: "Cabotage Vessels" },
  { value: "konteyner", label: "Container Vessels" },
  { value: "diger_yuk", label: "Other Cargo Vessels" },
  { value: "yolcu_feribot_roro_car_carrier", label: "Passenger Ferry / Ro-Ro / Car Carrier" },
];

const FLAG_CATEGORY_OPTIONS = [
  { value: "turkish", label: "Turkish Flag" },
  { value: "foreign", label: "Foreign Flag" },
  { value: "all",     label: "All Vessels" },
];

const PILOTAGE_SERVICE_OPTIONS = [
  { value: "kabotaj", label: "Cabotage Pilotage" },
  { value: "kabotaj_yeni", label: "Cabotage Pilotage (New)" },
  { value: "uluslararasi", label: "International Pilotage" },
  { value: "uluslararasi_yeni", label: "International Pilotage (New)" },
  { value: "romorkör_kabotaj", label: "Cabotage Tugboat" },
  { value: "romorkör_kabotaj_yeni", label: "Cabotage Tugboat (New)" },
  { value: "romorkör_uluslararasi", label: "International Tugboat" },
  { value: "romorkör_uluslararasi_yeni", label: "International Tugboat (New)" },
  { value: "palamar_kabotaj", label: "Cabotage Mooring" },
  { value: "palamar_kabotaj_yeni", label: "Cabotage Mooring (New)" },
  { value: "palamar_uluslararasi", label: "International Mooring" },
  { value: "palamar_uluslararasi_yeni", label: "International Mooring (New)" },
];

// Gerçek Türkçe isim + LOCODE haritası (DB'deki ASCII isimler için override)
const PORT_DISPLAY: Record<number, { name: string; code: string }> = {
  1: { name: "Tekirdağ", code: "TRTEK" },
  2: { name: "İstanbul", code: "TRIST" },
  3: { name: "İzmir", code: "TRIZM" },
  4: { name: "Mersin", code: "TRMER" },
  5: { name: "Aliağa", code: "TRALI" },
};

const getPortDisplay = (port: { id: number; name: string; code: string }) =>
  PORT_DISPLAY[port.id] ?? { name: port.name, code: port.code };

const DEFAULT_PORT_IDS = [2, 3, 1];

const loadActivePortIds = (): number[] => {
  try {
    const stored = localStorage.getItem("tariff_active_ports");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return DEFAULT_PORT_IDS;
};

// ── Category definitions ──────────────────────────────────────────────────────
type ColDef = {
  key: string;
  label: string;
  type?: "number" | "text" | "currency" | "year" | "textarea" | "vessel_category_select" | "service_type_select" | "flag_category_select";
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
    label: "Pilotage Fees",
    icon: Navigation,
    defaultCurrency: "USD",
    columns: [
      { key: "service_type", label: "Service Type", type: "service_type_select" },
      { key: "vessel_category", label: "Vessel Type", type: "vessel_category_select" },
      { key: "grt_min", label: "GRT Min", type: "number" },
      { key: "grt_max", label: "GRT Max", type: "number" },
      { key: "base_fee", label: "Base Fee", type: "number" },
      { key: "per_1000_grt", label: "+1000 GRT", type: "number" },
      { key: "currency", label: "CCY", type: "currency" },
      { key: "valid_year", label: "Year", type: "year" },
    ],
    formFields: [
      { key: "service_type", label: "Service Type", type: "service_type_select" },
      { key: "vessel_category", label: "Vessel Category", type: "vessel_category_select" },
      { key: "grt_min", label: "GRT Min", type: "number" },
      { key: "grt_max", label: "GRT Max", type: "number" },
      { key: "base_fee", label: "Base Fee", type: "number" },
      { key: "per_1000_grt", label: "Fee per 1,000 GRT", type: "number" },
      { key: "currency", label: "Currency", type: "currency" },
      { key: "valid_year", label: "Valid Year", type: "year" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    key: "berthing_tariffs",
    label: "Berthing Fees",
    icon: Warehouse,
    defaultCurrency: "USD",
    columns: [
      { key: "gt_min", label: "GT Min", type: "number" },
      { key: "gt_max", label: "GT Max", type: "number" },
      { key: "intl_foreign_flag", label: "Foreign Flag / Day", type: "number" },
      { key: "intl_turkish_flag", label: "Turkish Flag Intl. / Day", type: "number" },
      { key: "cabotage_turkish", label: "Cabotage Turkish / Day", type: "number" },
      { key: "currency", label: "CCY", type: "currency" },
      { key: "valid_year", label: "Year", type: "year" },
    ],
    formFields: [
      { key: "gt_min", label: "GT Min", type: "number" },
      { key: "gt_max", label: "GT Max", type: "number" },
      { key: "intl_foreign_flag", label: "Foreign Flag (Daily)", type: "number" },
      { key: "intl_turkish_flag", label: "Turkish Flag Intl. (Daily)", type: "number" },
      { key: "cabotage_turkish", label: "Cabotage Turkish (Daily)", type: "number" },
      { key: "currency", label: "Currency", type: "currency" },
      { key: "valid_year", label: "Valid Year", type: "year" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    key: "agency_fees",
    label: "Agency Fees",
    icon: Building2,
    defaultCurrency: "EUR",
    columns: [
      { key: "tariff_no", label: "Tariff No." },
      { key: "service_type", label: "Service Type" },
      { key: "nt_min", label: "NT Min", type: "number" },
      { key: "nt_max", label: "NT Max", type: "number" },
      { key: "fee", label: "Fee (EUR)", type: "number" },
      { key: "per_1000_nt", label: "+1000 NT", type: "number" },
      { key: "currency", label: "CCY", type: "currency" },
      { key: "valid_year", label: "Year", type: "year" },
    ],
    formFields: [
      { key: "tariff_no", label: "Tariff No. (T1 / T2 etc.)", type: "text" },
      { key: "service_type", label: "Service Type (acentelik / koruyucu_acentelik)", type: "text" },
      { key: "nt_min", label: "NT Min", type: "number" },
      { key: "nt_max", label: "NT Max", type: "number" },
      { key: "fee", label: "Fee (EUR) — Base fee for this NT bracket", type: "number" },
      { key: "per_1000_nt", label: "+1000 NT Surcharge (EUR per each 1000 NT above nt_min)", type: "number" },
      { key: "currency", label: "Currency", type: "currency" },
      { key: "valid_year", label: "Valid Year", type: "year" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    key: "marpol_tariffs",
    label: "MARPOL Waste Fees",
    icon: Leaf,
    defaultCurrency: "EUR",
    columns: [
      { key: "grt_min", label: "GRT Min", type: "number" },
      { key: "grt_max", label: "GRT Max", type: "number" },
      { key: "fixed_fee", label: "Fixed Fee (EUR)", type: "number" },
      { key: "marpol_ek1_included", label: "Annex I Incl. m³", type: "number" },
      { key: "marpol_ek4_included", label: "Annex IV Incl. m³", type: "number" },
      { key: "currency", label: "CCY", type: "currency" },
      { key: "valid_year", label: "Year", type: "year" },
    ],
    formFields: [
      { key: "grt_min", label: "GRT Min", type: "number" },
      { key: "grt_max", label: "GRT Max", type: "number" },
      { key: "fixed_fee", label: "Fixed Fee (EUR)", type: "number" },
      { key: "marpol_ek1_included", label: "Annex I Incl. m³ (bilge/oil)", type: "number" },
      { key: "marpol_ek4_included", label: "Annex IV Incl. m³ (sewage)", type: "number" },
      { key: "marpol_ek5_included", label: "Annex V Incl. m³ (garbage)", type: "number" },
      { key: "weekday_ek1_rate", label: "Weekday Annex I EUR/m³", type: "number" },
      { key: "weekday_ek4_rate", label: "Weekday Annex IV EUR/m³", type: "number" },
      { key: "weekday_ek5_rate", label: "Weekday Annex V EUR/m³", type: "number" },
      { key: "weekend_ek1_rate", label: "Weekend Annex I EUR/m³", type: "number" },
      { key: "weekend_ek4_rate", label: "Weekend Annex IV EUR/m³", type: "number" },
      { key: "weekend_ek5_rate", label: "Weekend Annex V EUR/m³", type: "number" },
      { key: "currency", label: "Currency", type: "currency" },
      { key: "valid_year", label: "Valid Year", type: "year" },
    ],
  },
  {
    key: "lcb_tariffs",
    label: "LCB / Tonnage Fees",
    icon: Layers,
    defaultCurrency: "TRY",
    columns: [
      { key: "nrt_min", label: "NRT Min", type: "number" },
      { key: "nrt_max", label: "NRT Max", type: "number" },
      { key: "amount", label: "Amount (TRY)", type: "number" },
      { key: "currency", label: "CCY", type: "currency" },
      { key: "valid_year", label: "Year", type: "year" },
    ],
    formFields: [
      { key: "nrt_min", label: "NRT Min", type: "number" },
      { key: "nrt_max", label: "NRT Max", type: "number" },
      { key: "amount", label: "Amount (TRY)", type: "number" },
      { key: "currency", label: "Currency", type: "currency" },
      { key: "valid_year", label: "Valid Year", type: "year" },
    ],
  },
  {
    key: "other_services",
    label: "Other Services",
    icon: MoreHorizontal,
    defaultCurrency: "EUR",
    columns: [
      { key: "service_name", label: "Service Name" },
      { key: "fee", label: "Fee", type: "number" },
      { key: "unit", label: "Unit" },
      { key: "currency", label: "CCY", type: "currency" },
      { key: "valid_year", label: "Year", type: "year" },
    ],
    formFields: [
      { key: "service_name", label: "Service Name", type: "text" },
      { key: "fee", label: "Fee", type: "number" },
      { key: "unit", label: "Unit (per call / per ton / etc.)", type: "text" },
      { key: "currency", label: "Currency", type: "currency" },
      { key: "valid_year", label: "Valid Year", type: "year" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    key: "light_dues",
    label: "Light Dues",
    icon: Lightbulb,
    defaultCurrency: "USD",
    columns: [
      { key: "vessel_category", label: "Vessel Type" },
      { key: "service_type", label: "Service Type" },
      { key: "service_desc", label: "Description" },
      { key: "rate_up_to_800", label: "Rate ≤800 NT", type: "number" },
      { key: "rate_above_800", label: "Rate >800 NT", type: "number" },
      { key: "currency", label: "CCY", type: "currency" },
      { key: "valid_year", label: "Year", type: "year" },
    ],
    formFields: [
      { key: "vessel_category", label: "Vessel Category", type: "text" },
      { key: "service_type", label: "Service Type", type: "text" },
      { key: "service_desc", label: "Service Description", type: "text" },
      { key: "rate_up_to_800", label: "Rate per NT (≤800 NT)", type: "number" },
      { key: "rate_above_800", label: "Rate per NT (>800 NT, leave blank if single rate)", type: "number" },
      { key: "currency", label: "Currency", type: "currency" },
      { key: "valid_year", label: "Valid Year", type: "year" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    key: "chamber_of_shipping_fees",
    label: "Chamber of Shipping Fee",
    icon: Briefcase,
    defaultCurrency: "TRY",
    columns: [
      { key: "flag_category", label: "Flag", type: "flag_category_select" },
      { key: "gt_min", label: "GT Min", type: "number" },
      { key: "gt_max", label: "GT Max", type: "number" },
      { key: "fee", label: "Fee", type: "number" },
      { key: "currency", label: "CCY", type: "currency" },
      { key: "valid_year", label: "Year", type: "year" },
    ],
    formFields: [
      { key: "flag_category", label: "Flag Category", type: "flag_category_select" },
      { key: "gt_min", label: "GT Min", type: "number" },
      { key: "gt_max", label: "GT Max", type: "number" },
      { key: "fee", label: "Fee", type: "number" },
      { key: "currency", label: "Currency", type: "currency" },
      { key: "valid_year", label: "Valid Year", type: "year" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    key: "chamber_freight_share",
    label: "Chamber of Shipping (Freight Share)",
    icon: BarChart2,
    defaultCurrency: "USD",
    columns: [
      { key: "flag_category", label: "Flag", type: "flag_category_select" },
      { key: "cargo_min", label: "Cargo Min (MT)", type: "number" },
      { key: "cargo_max", label: "Cargo Max (MT)", type: "number" },
      { key: "fee", label: "Fee (USD)", type: "number" },
      { key: "currency", label: "CCY", type: "currency" },
      { key: "valid_year", label: "Year", type: "year" },
    ],
    formFields: [
      { key: "flag_category", label: "Flag Category", type: "flag_category_select" },
      { key: "cargo_min", label: "Cargo Min (MT)", type: "number" },
      { key: "cargo_max", label: "Cargo Max (MT)", type: "number" },
      { key: "fee", label: "Fee (USD)", type: "number" },
      { key: "currency", label: "Currency", type: "currency" },
      { key: "valid_year", label: "Valid Year", type: "year" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    key: "harbour_master_dues",
    label: "Harbour Master Dues",
    icon: Anchor,
    defaultCurrency: "USD",
    columns: [
      { key: "gt_min", label: "GT Min", type: "number" },
      { key: "gt_max", label: "GT Max", type: "number" },
      { key: "fee", label: "Fee", type: "number" },
      { key: "currency", label: "CCY", type: "currency" },
      { key: "valid_year", label: "Year", type: "year" },
    ],
    formFields: [
      { key: "gt_min", label: "GT Min", type: "number" },
      { key: "gt_max", label: "GT Max", type: "number" },
      { key: "fee", label: "Fee", type: "number" },
      { key: "currency", label: "Currency", type: "currency" },
      { key: "valid_year", label: "Valid Year", type: "year" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    key: "sanitary_dues",
    label: "Sanitary Dues",
    icon: ShieldCheck,
    defaultCurrency: "TRY",
    columns: [
      { key: "nrt_rate", label: "Rate per NRT (TL)", type: "number" },
      { key: "currency", label: "CCY", type: "currency" },
      { key: "valid_year", label: "Year", type: "year" },
    ],
    formFields: [
      { key: "nrt_rate", label: "Rate per NRT (TL)", type: "number" },
      { key: "currency", label: "Currency", type: "currency" },
      { key: "valid_year", label: "Valid Year", type: "year" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    key: "vts_fees",
    label: "VTS Fee",
    icon: Radio,
    defaultCurrency: "USD",
    columns: [
      { key: "service_name", label: "Service Name" },
      { key: "fee", label: "Fee", type: "number" },
      { key: "unit", label: "Unit" },
      { key: "currency", label: "CCY", type: "currency" },
      { key: "valid_year", label: "Year", type: "year" },
    ],
    formFields: [
      { key: "service_name", label: "Service Name", type: "text" },
      { key: "fee", label: "Fee", type: "number" },
      { key: "unit", label: "Unit (per call / per vessel / etc.)", type: "text" },
      { key: "currency", label: "Currency", type: "currency" },
      { key: "valid_year", label: "Valid Year", type: "year" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    key: "supervision_fees",
    label: "Supervision Fee",
    icon: Eye,
    defaultCurrency: "EUR",
    columns: [
      { key: "category", label: "Category" },
      { key: "cargo_type", label: "Cargo Type" },
      { key: "quantity_range", label: "Qty Range" },
      { key: "rate", label: "Rate", type: "number" },
      { key: "unit", label: "Unit" },
      { key: "currency", label: "CCY", type: "currency" },
      { key: "valid_year", label: "Year", type: "year" },
    ],
    formFields: [
      { key: "category", label: "Category (A - Dokme Esya / Genel Kural / etc.)", type: "text" },
      { key: "cargo_type", label: "Cargo Type", type: "text" },
      { key: "quantity_range", label: "Quantity Range", type: "text" },
      { key: "rate", label: "Rate", type: "number" },
      { key: "unit", label: "Unit (EUR/MT / EUR/Adet / EUR/Metre)", type: "text" },
      { key: "currency", label: "Currency", type: "currency" },
      { key: "valid_year", label: "Valid Year", type: "year" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    key: "misc_expenses",
    label: "Miscellaneous Expenses",
    icon: Receipt,
    defaultCurrency: "USD",
    columns: [
      { key: "expense_type", label: "Expense Type" },
      { key: "fee_usd", label: "Fee (USD)", type: "number" },
      { key: "currency", label: "CCY", type: "currency" },
      { key: "valid_year", label: "Year", type: "year" },
    ],
    formFields: [
      { key: "expense_type", label: "Expense Type (motorboat / facilities / transportation / fiscal / communication)", type: "text" },
      { key: "fee_usd", label: "Fee (USD)", type: "number" },
      { key: "currency", label: "Currency", type: "currency" },
      { key: "valid_year", label: "Valid Year", type: "year" },
      { key: "notes", label: "Notes", type: "textarea" },
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
  if (field.type === "vessel_category_select") {
    return (
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger data-testid={`form-field-${field.key}`}>
          <SelectValue placeholder="Select vessel category" />
        </SelectTrigger>
        <SelectContent>
          {VESSEL_CATEGORY_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (field.type === "service_type_select") {
    return (
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger data-testid={`form-field-${field.key}`}>
          <SelectValue placeholder="Select service type" />
        </SelectTrigger>
        <SelectContent>
          {PILOTAGE_SERVICE_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (field.type === "flag_category_select") {
    return (
      <Select value={value ?? "turkish"} onValueChange={onChange}>
        <SelectTrigger data-testid={`form-field-${field.key}`}>
          <SelectValue placeholder="Select flag category" />
        </SelectTrigger>
        <SelectContent>
          {FLAG_CATEGORY_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
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

  if (col.type === "vessel_category_select") {
    return (
      <Select
        value={editData[col.key] ?? ""}
        onValueChange={v => setEditData(d => ({ ...d, [col.key]: v }))}
      >
        <SelectTrigger className="h-7 w-52 text-xs" data-testid={`inline-${col.key}-${editData.id}`}>
          <SelectValue placeholder="Select category" />
        </SelectTrigger>
        <SelectContent>
          {VESSEL_CATEGORY_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (col.type === "service_type_select") {
    return (
      <Select
        value={editData[col.key] ?? ""}
        onValueChange={v => setEditData(d => ({ ...d, [col.key]: v }))}
      >
        <SelectTrigger className="h-7 w-52 text-xs" data-testid={`inline-${col.key}-${editData.id}`}>
          <SelectValue placeholder="Select service type" />
        </SelectTrigger>
        <SelectContent>
          {PILOTAGE_SERVICE_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (col.type === "flag_category_select") {
    return (
      <Select
        value={editData[col.key] ?? "turkish"}
        onValueChange={v => setEditData(d => ({ ...d, [col.key]: v }))}
      >
        <SelectTrigger className="h-7 w-40 text-xs" data-testid={`inline-${col.key}-${editData.id}`}>
          <SelectValue placeholder="Select flag" />
        </SelectTrigger>
        <SelectContent>
          {FLAG_CATEGORY_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
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
function CategorySection({
  cat, portId, portName, isGlobal,
}: {
  cat: CategoryDef; portId: number | "global"; portName: string; isGlobal: boolean;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addData, setAddData] = useState<Record<string, any>>({});
  const [editRowId, setEditRowId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPercent, setBulkPercent] = useState("5");
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [catImportProgress, setCatImportProgress] = useState<{ current: number; total: number } | null>(null);
  const catCsvInputRef = useRef<HTMLInputElement>(null);
  const hasAutoOpened = useRef(false);
  const Icon = cat.icon;

  const qk = ["/api/admin/tariffs", cat.key, portId];
  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: qk,
    queryFn: async () => {
      const params = new URLSearchParams({ portId: String(portId) });
      const res = await fetch(`/api/admin/tariffs/${cat.key}?${params}`);
      if (!res.ok) throw new Error("Failed to load data");
      return res.json();
    },
  });

  useEffect(() => {
    if (!hasAutoOpened.current && !isLoading && rows.length > 0) {
      setOpen(true);
      hasAutoOpened.current = true;
    }
  }, [rows, isLoading]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/tariffs", cat.key, portId] });

  // ── Per-category CSV Export ──────────────────────────────────────────────────
  const handleCategoryExport = async () => {
    try {
      const params = new URLSearchParams({ portId: String(portId) });
      const res = await fetch(`/api/admin/tariffs/${cat.key}?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const rows: any[] = await res.json();

      const lines: string[] = [
        "tablo,id,port_id,alan1,alan2,aralik_min,aralik_max,ucret1,ucret2,ucret3,para_birimi,yil,notlar",
      ];

      rows.forEach(row => {
        const esc = (v: any) => {
          const s = String(v ?? "");
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"` : s;
        };
        let alan1, alan2, rMin, rMax, f1, f2, f3;
        if (cat.key === "light_dues") {
          alan1 = row.vessel_category ?? "";
          alan2 = row.service_type ?? "";
          rMin = row.service_desc ?? "";
          rMax = "";
          f1 = row.rate_up_to_800 ?? "";
          f2 = row.rate_above_800 ?? "";
          f3 = "";
        } else if (cat.key === "supervision_fees") {
          alan1 = row.category ?? "";
          alan2 = row.cargo_type ?? "";
          rMin = row.quantity_range ?? "";
          rMax = row.unit ?? "";
          f1 = row.rate ?? "";
          f2 = "";
          f3 = "";
        } else {
          alan1 = row.service_type ?? row.cargo_type ?? row.service_name ?? row.fee_name ?? "";
          alan2 = row.vessel_category ?? row.operation ?? row.tariff_no ?? row.service_description ?? "";
          rMin = row.grt_min ?? row.gt_min ?? row.nrt_min ?? row.nt_min ?? "";
          rMax = row.grt_max ?? row.gt_max ?? row.nrt_max ?? row.nt_max ?? "";
          f1 = row.base_fee ?? row.fixed_fee ?? row.intl_foreign_flag ?? row.fee ?? row.amount ?? row.rate ?? "";
          f2 = row.per_1000_grt ?? row.per_1000_nt ?? row.intl_turkish_flag ?? "";
          f3 = row.cabotage_turkish ?? row.per_additional_1000_grt ?? "";
        }
        lines.push([
          esc(cat.key), esc(row.id), esc(row.port_id ?? portId),
          esc(alan1), esc(alan2), esc(rMin), esc(rMax),
          esc(f1), esc(f2), esc(f3),
          esc(row.currency ?? ""), esc(row.valid_year ?? ""), esc(row.notes ?? ""),
        ].join(","));
      });

      const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safePort = portName.toLowerCase().replace(/\s/g, "_");
      a.download = `tariffs_${safePort}_${cat.key}_2026.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV downloaded", description: `${cat.label} — ${portName} (${rows.length} records)` });
    } catch {
      toast({ title: "Error", description: "Failed to generate CSV", variant: "destructive" });
    }
  };

  // ── Per-category CSV Import ──────────────────────────────────────────────────
  const handleCategoryImport = async (file: File) => {
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) {
      toast({ title: "Invalid file", description: "CSV is empty or has no data rows", variant: "destructive" });
      return;
    }

    const headers = lines[0].split(",").map(h => h.trim().replace(/^\uFEFF/, "").replace(/^"|"$/g, ""));
    const idIdx = headers.indexOf("id");

    const col = (name: string, cols: string[]) => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? (cols[idx] ?? "").replace(/^"|"$/g, "") : "";
    };
    const numOrNull = (v: string) => (v === "" ? null : Number(v));

    const dataRows = lines.slice(1);
    setCatImportProgress({ current: 0, total: dataRows.length });
    let success = 0;
    let failed = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const cols = dataRows[i].split(",");
      const tableKey = col("tablo", cols) || cat.key;
      // On the global tab, always INSERT — never PATCH port-specific records by CSV id
      const rowId = (!isGlobal && idIdx >= 0) ? parseInt(col("id", cols)) : NaN;

      if (tableKey !== cat.key) {
        failed++;
        setCatImportProgress({ current: i + 1, total: dataRows.length });
        continue;
      }

      const alan1 = col("alan1", cols);
      const alan2 = col("alan2", cols);
      const rMin = col("aralik_min", cols);
      const rMax = col("aralik_max", cols);
      const f1 = col("ucret1", cols);
      const f2 = col("ucret2", cols);
      const f3 = col("ucret3", cols);
      const currency = col("para_birimi", cols) || cat.defaultCurrency;
      const year = col("yil", cols) || "2026";
      const notes = col("notlar", cols);

      const payload: Record<string, any> = isGlobal ? {} : { port_id: portId };

      if (cat.key === "pilotage_tariffs") {
        Object.assign(payload, { service_type: alan1, vessel_category: alan2, grt_min: numOrNull(rMin), grt_max: numOrNull(rMax), base_fee: numOrNull(f1), per_1000_grt: numOrNull(f2), currency, valid_year: parseInt(year), notes });
      } else if (cat.key === "berthing_tariffs") {
        Object.assign(payload, { gt_min: numOrNull(rMin), gt_max: numOrNull(rMax), intl_foreign_flag: numOrNull(f1), intl_turkish_flag: numOrNull(f2), cabotage_turkish: numOrNull(f3), currency, valid_year: parseInt(year), notes });
      } else if (cat.key === "agency_fees") {
        Object.assign(payload, { tariff_no: alan2, service_type: alan1, nt_min: numOrNull(rMin), nt_max: numOrNull(rMax), fee: numOrNull(f1), currency, valid_year: parseInt(year), notes });
      } else if (cat.key === "marpol_tariffs") {
        Object.assign(payload, { grt_min: numOrNull(rMin), grt_max: numOrNull(rMax), fixed_fee: numOrNull(f1), currency, valid_year: parseInt(year) });
      } else if (cat.key === "lcb_tariffs") {
        Object.assign(payload, { nrt_min: numOrNull(rMin), nrt_max: numOrNull(rMax), amount: numOrNull(f1), currency, valid_year: parseInt(year) });
      } else if (cat.key === "other_services") {
        Object.assign(payload, { service_name: alan1, fee: numOrNull(f1), unit: alan2, currency, valid_year: parseInt(year), notes });
      } else if (cat.key === "supervision_fees") {
        Object.assign(payload, { category: alan1, cargo_type: alan2, quantity_range: rMin, unit: rMax || null, rate: numOrNull(f1), currency, valid_year: parseInt(year), notes });
      } else if (cat.key === "light_dues") {
        Object.assign(payload, { vessel_category: alan1, service_type: alan2, service_desc: rMin || null, rate_up_to_800: numOrNull(f1), rate_above_800: numOrNull(f2) || null, currency, valid_year: parseInt(year), notes });
      } else if (cat.key === "chamber_of_shipping_fees") {
        Object.assign(payload, { flag_category: alan1 || "turkish", gt_min: numOrNull(rMin), gt_max: numOrNull(rMax), fee: numOrNull(f1), currency, valid_year: parseInt(year), notes });
      } else if (cat.key === "chamber_freight_share") {
        Object.assign(payload, { flag_category: alan1 || "foreign", cargo_min: numOrNull(rMin), cargo_max: numOrNull(rMax), fee: numOrNull(f1), currency, valid_year: parseInt(year), notes });
      } else if (cat.key === "harbour_master_dues") {
        Object.assign(payload, { gt_min: numOrNull(rMin), gt_max: numOrNull(rMax), fee: numOrNull(f1), currency, valid_year: parseInt(year), notes });
      } else if (cat.key === "sanitary_dues") {
        Object.assign(payload, { nrt_rate: numOrNull(f1), currency, valid_year: parseInt(year), notes });
      }

      try {
        if (!isNaN(rowId) && rowId > 0) {
          await apiRequest("PATCH", `/api/admin/tariffs/${cat.key}/${rowId}`, payload);
        } else {
          await apiRequest("POST", `/api/admin/tariffs/${cat.key}`, payload);
        }
        success++;
      } catch {
        failed++;
      }
      setCatImportProgress({ current: i + 1, total: dataRows.length });
    }

    setCatImportProgress(null);
    invalidate();
    toast({
      title: "Import complete",
      description: `${cat.label}: ${success} succeeded${failed > 0 ? `, ${failed} failed` : ""}`,
      variant: failed > 0 ? "destructive" : "default",
    });
  };

  const addMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/admin/tariffs/${cat.key}`,
        portId === "global"
          ? { ...addData }
          : { ...addData, port_id: portId }
      ),
    onSuccess: () => {
      invalidate();
      toast({ title: portId === "global" ? "Global tariff added" : "Tariff added" });
      setAddOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to add", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/admin/tariffs/${cat.key}/${editRowId}`, editData),
    onSuccess: () => {
      invalidate();
      toast({ title: "Tariff updated" });
      setEditRowId(null);
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/admin/tariffs/${cat.key}/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Tariff deleted" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete", variant: "destructive" }),
  });

  const bulkMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/admin/tariffs/${cat.key}/bulk-increase`, {
        ids: rows.map((r: any) => r.id),
        percent: parseFloat(bulkPercent),
      }),
    onSuccess: () => {
      invalidate();
      toast({ title: `${bulkPercent}% increase applied`, description: `${rows.length} records updated` });
      setBulkOpen(false);
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to apply increase", variant: "destructive" }),
  });

  const clearAllMutation = useMutation({
    mutationFn: () =>
      apiRequest("DELETE", `/api/admin/tariffs/${cat.key}/clear?portId=${portId}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "All records cleared", description: `${rows.length} records removed from ${cat.label}` });
      setClearAllOpen(false);
    },
    onError: () =>
      toast({ title: "Error", description: "Failed to clear records", variant: "destructive" }),
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
            {isLoading ? "Loading..." : `${rows.length} records · ${cat.defaultCurrency}`}
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
              <TrendingUp className="w-3 h-3" /> % Increase
            </Button>
          )}
          {rows.length > 0 && (
            <Button
              size="sm" variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={e => { e.stopPropagation(); setClearAllOpen(true); }}
              title="Clear all records for this port"
              data-testid={`button-clear-all-${cat.key}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            size="sm" variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={e => { e.stopPropagation(); handleCategoryExport(); }}
            data-testid={`button-export-csv-${cat.key}`}
            title={`Export ${cat.label} as CSV`}
          >
            <Download className="w-3 h-3" /> CSV
          </Button>
          <Button
            size="sm" variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={e => { e.stopPropagation(); catCsvInputRef.current?.click(); }}
            disabled={!!catImportProgress}
            data-testid={`button-import-csv-${cat.key}`}
            title={`Import ${cat.label} from CSV`}
          >
            {catImportProgress ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                {catImportProgress.current}/{catImportProgress.total}
              </>
            ) : (
              <>
                <Upload className="w-3 h-3" /> Import
              </>
            )}
          </Button>
          <input
            ref={catCsvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) handleCategoryImport(f);
            }}
          />
          <Button
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={openAdd}
            data-testid={`button-add-${cat.key}`}
          >
            <Plus className="w-3 h-3" /> Add
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
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Actions</th>
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
                    {portId === "global"
                      ? "No global tariffs — click \"Add\" to create tariffs that apply to all ports"
                      : "No records for this port — click \"Add\" to create a new tariff"}
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
                              Cancel
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
                                : "Save"}
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
              {cat.label} — New Entry
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
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending}
              data-testid={`button-confirm-add-${cat.key}`}
            >
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
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
            <AlertDialogTitle>Delete Tariff Entry</AlertDialogTitle>
            <AlertDialogDescription>
              This tariff entry will be permanently deleted. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Clear All Confirm ── */}
      <AlertDialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all records?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all <span className="font-semibold">{rows.length}</span> records
              in <span className="font-semibold">"{cat.label}"</span> for this port. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`button-cancel-clear-all-${cat.key}`}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending}
              data-testid={`button-confirm-clear-all-${cat.key}`}
            >
              {clearAllMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yes, Clear All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk Increase Dialog ── */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Bulk Increase — {cat.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              A fee increase will be applied to{" "}
              <span className="font-semibold text-foreground">{rows.length}</span>{" "}
              records for this port.
            </p>
            <div>
              <Label>Increase Percentage (%)</Label>
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
              All fee fields will be increased by {bulkPercent}%. This cannot be undone.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button
              onClick={() => bulkMutation.mutate()}
              disabled={bulkMutation.isPending}
              data-testid="button-confirm-bulk"
            >
              {bulkMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : `Apply ${bulkPercent}%`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── CustomCategorySection ─────────────────────────────────────────────────────
function CustomCategorySection({
  section, portId, isGlobal,
}: {
  section: { id: number; label: string; default_currency: string };
  portId: number | "global";
  isGlobal: boolean;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addData, setAddData] = useState<Record<string, any>>({});
  const [editRowId, setEditRowId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteSectionOpen, setDeleteSectionOpen] = useState(false);
  const hasAutoOpened = useRef(false);

  const qk = ["/api/admin/tariff-custom-sections", section.id, portId];
  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: qk,
    queryFn: async () => {
      const params = new URLSearchParams({ portId: String(portId) });
      const res = await fetch(`/api/admin/tariff-custom-sections/${section.id}/entries?${params}`);
      if (!res.ok) throw new Error("Failed to load data");
      return res.json();
    },
  });

  useEffect(() => {
    if (!hasAutoOpened.current && !isLoading && rows.length > 0) {
      setOpen(true);
      hasAutoOpened.current = true;
    }
  }, [rows, isLoading]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/tariff-custom-sections", section.id, portId] });

  const addMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/admin/tariff-custom-sections/${section.id}/entries`, {
        ...addData,
        port_id: portId === "global" ? null : portId,
        updated_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      setAddOpen(false);
      setAddData({});
      invalidate();
      toast({ title: "Entry added", description: `Added to ${section.label}` });
    },
    onError: () => toast({ title: "Error", description: "Failed to add entry", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/admin/tariff-custom-sections/${section.id}/entries/${editRowId}`, {
        ...editData,
        updated_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      setEditRowId(null);
      invalidate();
      toast({ title: "Entry updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update entry", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/admin/tariff-custom-sections/${section.id}/entries/${id}`),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
      toast({ title: "Entry deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete entry", variant: "destructive" }),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: () =>
      apiRequest("DELETE", `/api/admin/tariff-custom-sections/${section.id}`),
    onSuccess: () => {
      setDeleteSectionOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tariff-custom-sections"] });
      toast({ title: "Section deleted", description: `"${section.label}" has been removed` });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete section", variant: "destructive" }),
  });

  const columns = [
    { key: "service_name", label: "Service Name" },
    { key: "fee", label: "Fee", type: "number" as const },
    { key: "unit", label: "Unit" },
    { key: "currency", label: "CCY", type: "currency" as const },
    { key: "valid_year", label: "Year", type: "year" as const },
  ];

  const openAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAddData({ currency: section.default_currency, valid_year: 2026 });
    setAddOpen(true);
  };

  return (
    <Card className="overflow-hidden border-dashed border-2 border-muted">
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
        data-testid={`custom-section-toggle-${section.id}`}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
          <FolderPlus className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{section.label}</p>
          <p className="text-xs text-muted-foreground">
            {isLoading ? "Loading..." : `${rows.length} records · ${section.default_currency}`}
            <span className="ml-2 text-muted-foreground/60 text-[10px] italic">Custom section</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          <Button
            size="sm" variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={openAdd}
            data-testid={`button-add-custom-${section.id}`}
          >
            <Plus className="w-3 h-3" /> Add
          </Button>
          <Button
            size="sm" variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={e => { e.stopPropagation(); setDeleteSectionOpen(true); }}
            title="Delete this section"
            data-testid={`button-delete-section-${section.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          {open
            ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-1" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground ml-1" />}
        </div>
      </button>

      {open && (
        <div className="border-t overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/30 border-b">
                {columns.map(col => (
                  <th key={col.key} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td colSpan={columns.length + 1} className="px-3 py-2.5">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-3 py-10 text-center text-muted-foreground italic text-xs">
                    {isGlobal
                      ? 'No entries yet — click "+ Add" to create the first entry'
                      : 'No records for this port — click "+ Add" to create a new entry'}
                  </td>
                </tr>
              ) : (
                rows.map((row: any) => {
                  const isEditing = editRowId === row.id;
                  return (
                    <tr key={row.id} className={`border-b transition-colors ${isEditing ? "bg-primary/5" : "hover:bg-muted/20"}`}>
                      {columns.map(col => (
                        <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                          <InlineCell col={col} value={row[col.key]} editData={editData} setEditData={setEditData} editing={isEditing} />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setEditRowId(null)}>Cancel</Button>
                            <Button size="sm" className="h-6 text-xs px-2" onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
                              {editMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setEditRowId(row.id); setEditData({ ...row }); }}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(row.id)}>
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

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-primary" />
              {section.label} — New Entry
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {[
              { key: "service_name", label: "Service Name", type: "text" },
              { key: "fee", label: "Fee", type: "number" },
              { key: "unit", label: "Unit (per call / per vessel / etc.)", type: "text" },
              { key: "currency", label: "Currency", type: "currency" },
              { key: "valid_year", label: "Valid Year", type: "year" },
              { key: "notes", label: "Notes", type: "textarea" },
            ].map(field => (
              <div key={field.key} className={field.type === "textarea" ? "col-span-2" : ""}>
                <Label className="text-xs mb-1 block">{field.label}</Label>
                <FormField field={field as any} value={addData[field.key]} onChange={v => setAddData(d => ({ ...d, [field.key]: v }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Entry Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>This entry will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Section Confirm */}
      <AlertDialog open={deleteSectionOpen} onOpenChange={setDeleteSectionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section</AlertDialogTitle>
            <AlertDialogDescription>
              "{section.label}" and all its entries will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteSectionMutation.mutate()}>
              {deleteSectionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete Section"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TariffManagement() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const userRole = (user as any)?.userRole;
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [activePorts, setActivePorts] = useState<number[]>(() => loadActivePortIds());
  const [activePort, setActivePort] = useState<number | "global">(() => loadActivePortIds()[0] ?? "global");
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  const [addPortOpen, setAddPortOpen] = useState(false);
  const [portSearch, setPortSearch] = useState("");
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [newSectionLabel, setNewSectionLabel] = useState("");
  const [newSectionCurrency, setNewSectionCurrency] = useState("USD");

  const { data: customSections = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/tariff-custom-sections"],
    queryFn: async () => {
      const res = await fetch("/api/admin/tariff-custom-sections");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/tariff-custom-sections", {
        label: newSectionLabel.trim(),
        default_currency: newSectionCurrency,
      }),
    onSuccess: () => {
      setNewSectionOpen(false);
      setNewSectionLabel("");
      setNewSectionCurrency("USD");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tariff-custom-sections"] });
      toast({ title: "Section created", description: `"${newSectionLabel}" added to tariff list` });
    },
    onError: () => toast({ title: "Error", description: "Failed to create section", variant: "destructive" }),
  });

  const verifyTariffsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/tariff-seed-verify"),
    onSuccess: (data: any) => {
      toast({
        title: data.status === "seeded" ? "Tarifeler Güncellendi" : "✓ Tarifeler Doğrulandı",
        description: data.message,
      });
    },
    onError: () => toast({ title: "Hata", description: "Tarife doğrulaması başarısız", variant: "destructive" }),
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || userRole !== "admin") {
    navigate("/dashboard");
    return null;
  }

  const saveActivePorts = (ids: number[]) => {
    try { localStorage.setItem("tariff_active_ports", JSON.stringify(ids)); } catch {}
  };

  const addActivePort = (portId: number) => {
    if (activePorts.includes(portId)) return;
    const updated = [...activePorts, portId];
    setActivePorts(updated);
    saveActivePorts(updated);
    setActivePort(portId);
    setAddPortOpen(false);
    setPortSearch("");
  };

  const removeActivePort = (portId: number) => {
    const updated = activePorts.filter(id => id !== portId);
    setActivePorts(updated);
    saveActivePorts(updated);
    if (activePort === portId) setActivePort(updated[0] ?? "global");
  };

  // Türk limanlarını API'den çek (Liman Ekle dialog için)
  const { data: allTurkishPorts = [] } = useQuery<any[]>({
    queryKey: ["/api/ports", "turkish"],
    queryFn: async () => {
      const res = await fetch("/api/ports?country=Turkey");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const isGlobalTab = activePort === "global";
  const activePortData = isGlobalTab
    ? { id: 0, name: "All Ports (Global)", code: "GLOBAL" }
    : (allTurkishPorts.find((p: any) => p.id === activePort)
        ?? { id: activePort as number, name: PORT_DISPLAY[activePort as number]?.name ?? "Port", code: PORT_DISPLAY[activePort as number]?.code ?? "" });

  const activePortDisplay = isGlobalTab
    ? { name: "All Ports (Global)", code: "" }
    : getPortDisplay(activePortData as any);
  const activePortName = activePortDisplay.name;

  const filteredTurkishPorts = allTurkishPorts
    .filter((p: any) => !activePorts.includes(p.id))
    .filter((p: any) => {
      const disp = getPortDisplay(p);
      const q = portSearch.toLowerCase();
      return !q || disp.name.toLowerCase().includes(q) || disp.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
    })
    .slice(0, 50);

  const { data: summary } = useQuery<any>({
    queryKey: ["/api/admin/tariffs/summary"],
    queryFn: async () => {
      const res = await fetch("/api/admin/tariffs/summary");
      if (!res.ok) throw new Error("Failed to load summary");
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
      a.download = `tariffs_${activePortName.toLowerCase().replace(/\s/g, "_")}_2026.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV downloaded", description: `${activePortName} tariffs exported` });
    } catch {
      toast({ title: "Error", description: "Failed to generate CSV", variant: "destructive" });
    }
  };

  // ── CSV Import ──────────────────────────────────────────────────────────────
  const handleImportCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) {
      toast({ title: "Invalid file", description: "CSV is empty or has an invalid format", variant: "destructive" });
      return;
    }

    const headers = lines[0].split(",").map(h => h.trim().replace(/^\uFEFF/, "").replace(/^"|"$/g, ""));
    const tabloIdx = headers.indexOf("tablo");
    const idIdx = headers.indexOf("id");

    if (tabloIdx === -1) {
      toast({
        title: "Invalid CSV",
        description: "'tablo' column not found. Please use a CSV exported from VesselPDA.",
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
      // On the global tab, always INSERT — never PATCH port-specific records by CSV id
      const rowId = (!isGlobalTab && idIdx >= 0) ? parseInt(col("id", cols)) : NaN;
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

      const payload: Record<string, any> = isGlobalTab ? {} : { port_id: activePort };

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
      } else if (tableKey === "supervision_fees") {
        Object.assign(payload, { category: alan1, cargo_type: alan2, quantity_range: rMin, unit: rMax || null, rate: numOrNull(f1), currency, valid_year: parseInt(year), notes });
      } else if (tableKey === "light_dues") {
        Object.assign(payload, { vessel_category: alan1, service_type: alan2, service_desc: rMin || null, rate_up_to_800: numOrNull(f1), rate_above_800: numOrNull(f2) || null, currency, valid_year: parseInt(year), notes });
      } else if (tableKey === "chamber_of_shipping_fees") {
        Object.assign(payload, { flag_category: alan1 || "turkish", gt_min: numOrNull(rMin), gt_max: numOrNull(rMax), fee: numOrNull(f1), currency, valid_year: parseInt(year), notes });
      } else if (tableKey === "chamber_freight_share") {
        Object.assign(payload, { flag_category: alan1 || "foreign", cargo_min: numOrNull(rMin), cargo_max: numOrNull(rMax), fee: numOrNull(f1), currency, valid_year: parseInt(year), notes });
      } else if (tableKey === "harbour_master_dues") {
        Object.assign(payload, { gt_min: numOrNull(rMin), gt_max: numOrNull(rMax), fee: numOrNull(f1), currency, valid_year: parseInt(year), notes });
      } else if (tableKey === "sanitary_dues") {
        Object.assign(payload, { nrt_rate: numOrNull(f1), currency, valid_year: parseInt(year), notes });
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
      title: "Import complete",
      description: `${success} succeeded${failed > 0 ? `, ${failed} failed` : ""}`,
      variant: failed > 0 ? "destructive" : "default",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <PageMeta
        title="Tariff Management | VesselPDA Admin"
        description="Turkish port tariff management panel"
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
              <h1 className="text-base font-black font-serif leading-tight">Tariff Management</h1>
              <p className="text-xs text-muted-foreground">Official 2026 Turkish Port Tariffs</p>
            </div>
          </div>

          {/* Port tabs */}
          <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1 flex-wrap">
            {/* Tüm Limanlar (Global) tab — her zaman ilk */}
            <button
              onClick={() => setActivePort("global")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isGlobalTab
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60 border border-dashed border-muted-foreground/30"
              }`}
              data-testid="port-tab-global"
              title="Tariffs shared across all ports"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>All Ports (Global)</span>
            </button>

            {activePorts.map(portId => {
              const portData = allTurkishPorts.find((p: any) => p.id === portId)
                ?? { id: portId, name: PORT_DISPLAY[portId]?.name ?? `Port #${portId}`, code: PORT_DISPLAY[portId]?.code ?? "" };
              const disp = getPortDisplay(portData as any);
              const isActive = activePort === portId;
              return (
                <div key={portId} className="relative group">
                  <button
                    onClick={() => setActivePort(portId)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all pr-6 ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                    }`}
                    data-testid={`port-tab-${portId}`}
                  >
                    <span>{disp.name}</span>
                    <span className={`text-[10px] font-mono font-bold px-1 rounded ${
                      isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                    }`}>{disp.code}</span>
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); removeActivePort(portId); }}
                    className={`absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 flex items-center justify-center rounded-full ${
                      isActive ? "hover:bg-white/20 text-white" : "hover:bg-muted-foreground/20 text-muted-foreground"
                    }`}
                    title="Remove port"
                    data-testid={`button-remove-port-${portId}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            })}
            {/* + Liman Ekle butonu */}
            <button
              onClick={() => { setPortSearch(""); setAddPortOpen(true); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-primary hover:bg-background/60 transition-all"
              title="Add new port"
              data-testid="button-add-port"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Port</span>
            </button>
          </div>

          {/* CSV Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline" size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={handleExportCSV}
              data-testid="button-export-csv"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
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
                  <Upload className="w-3.5 h-3.5" /> Import CSV
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
            <Button
              variant="outline" size="sm"
              className="gap-1.5 text-xs h-8 border-dashed"
              onClick={() => setNewSectionOpen(true)}
              data-testid="button-new-section"
            >
              <FolderPlus className="w-3.5 h-3.5" /> New Section
            </Button>
            {userRole === "admin" && (
              <Button
                variant="outline" size="sm"
                className="gap-1.5 text-xs h-8 border-green-500/50 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30"
                onClick={() => verifyTariffsMutation.mutate()}
                disabled={verifyTariffsMutation.isPending}
                data-testid="button-verify-tariffs"
              >
                {verifyTariffsMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <ShieldCheck className="w-3.5 h-3.5" />
                }
                Tarifeleri Doğrula
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Info bar ── */}
      <div className="max-w-5xl mx-auto px-6 py-3">
        {isGlobalTab ? (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs flex-wrap">
            <Globe className="w-4 h-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold">Shared Tariffs for All Ports</span>
              <span className="ml-2 font-normal opacity-80">
                — Tariffs added here apply to all ports automatically as a fallback when no port-specific tariff is found. Use the <strong>+ Add</strong> button in each category below to add tariff entries.
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1.5">
              <Ship className="w-3.5 h-3.5" />
              <span>
                Selected port:{" "}
                <span className="font-semibold text-foreground">{activePortName}</span>
                {activePortDisplay.code && (
                  <span className="ml-1.5 font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">
                    {activePortDisplay.code}
                  </span>
                )}
              </span>
            </div>
            {summary?.totalRecords !== undefined && (
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                <span>
                  Total records:{" "}
                  <span className="font-semibold text-foreground">{summary.totalRecords}</span>
                </span>
              </div>
            )}
            {summary?.outdatedCount > 0 && (
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{summary.outdatedCount} outdated records</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Category sections ── */}
      <div className="max-w-5xl mx-auto px-6 pb-16 space-y-3">
        {CATEGORIES.map(cat => (
          <CategorySection
            key={`${cat.key}-${activePort}`}
            cat={cat}
            portId={activePort}
            portName={activePortName}
            isGlobal={isGlobalTab}
          />
        ))}
        {customSections.map((section: any) => (
          <CustomCategorySection
            key={`custom-${section.id}-${activePort}`}
            section={section}
            portId={activePort}
            isGlobal={isGlobalTab}
          />
        ))}
      </div>

      {/* ── New Section Dialog ── */}
      <Dialog open={newSectionOpen} onOpenChange={o => { setNewSectionOpen(o); if (!o) { setNewSectionLabel(""); setNewSectionCurrency("USD"); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-primary" /> New Tariff Section
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs mb-1 block">Section Name</Label>
              <Input
                placeholder="e.g. ISPS Fee, Wharfage, Port Security..."
                value={newSectionLabel}
                onChange={e => setNewSectionLabel(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newSectionLabel.trim()) createSectionMutation.mutate(); }}
                data-testid="input-new-section-label"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Default Currency</Label>
              <Select value={newSectionCurrency} onValueChange={setNewSectionCurrency}>
                <SelectTrigger data-testid="select-new-section-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="TRY">TRY</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSectionOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createSectionMutation.mutate()}
              disabled={!newSectionLabel.trim() || createSectionMutation.isPending}
              data-testid="button-create-section"
            >
              {createSectionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Section"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Port Dialog ── */}
      <Dialog open={addPortOpen} onOpenChange={o => { setAddPortOpen(o); if (!o) setPortSearch(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-primary" />
              Add Turkish Port
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Select a Turkish port to manage tariffs for. The selected port will be added as a tab.
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8 text-sm"
                placeholder="Search by port name or LOCODE..."
                value={portSearch}
                onChange={e => setPortSearch(e.target.value)}
                data-testid="input-port-search"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-1">
              {filteredTurkishPorts.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-6">
                  {portSearch ? "No matching port found" : "All Turkish ports have already been added"}
                </p>
              ) : (
                filteredTurkishPorts.map((p: any) => {
                  const disp = getPortDisplay(p);
                  return (
                    <button
                      key={p.id}
                      onClick={() => addActivePort(p.id)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted text-left transition-colors"
                      data-testid={`port-option-${p.id}`}
                    >
                      <span className="text-sm font-medium">{disp.name}</span>
                      <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {disp.code}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            {allTurkishPorts.length === 0 && (
              <p className="text-xs text-muted-foreground text-center">Loading ports...</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPortOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
