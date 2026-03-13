import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { FileText, Ship, ArrowLeft, Calculator, Loader2, ChevronDown, ChevronUp, Anchor, Package, AlertTriangle, ChevronsUpDown, Check, MapPin, RefreshCw, Zap, Waves, PenLine, List, Landmark, Download, BarChart3, Navigation, Building2, ShieldCheck, Layers, Receipt, Award, X, Link2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { PortLookupInput } from "@/components/port-lookup-input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { Link, useLocation } from "wouter";
import type { Vessel, Port, ProformaLineItem, CompanyProfile } from "@shared/schema";
import { fmtDate, fmtDateTime } from "@/lib/formatDate";

const purposeOptions = ["Loading", "Discharging", "Loading/Discharging", "Transit", "Bunkering", "Repair", "Survey"];
const cargoUnits = ["MT", "CBM", "TEU", "Units"];

const CARGO_TYPE_OPTIONS = [
  { value: "grain",      label: "🌾 Grain (Wheat / Barley / Corn / Soya)",   unit: "MT",    isDangerous: false, examples: "Wheat, barley, corn, soya, sunflower seed" },
  { value: "coal",       label: "⚫ Coal",                                    unit: "MT",    isDangerous: false, examples: "Thermal coal, coking coal, petcoke" },
  { value: "ore",        label: "🪨 Iron Ore / Bauxite / Metal Ore",          unit: "MT",    isDangerous: false, examples: "Iron ore, bauxite, copper ore, manganese" },
  { value: "fertilizer", label: "🌱 Fertilizer (Urea / DAP / NPK)",          unit: "MT",    isDangerous: false, examples: "Urea, DAP, NPK, ammonium nitrate (non-classified)" },
  { value: "scrap",      label: "🔧 Scrap Metal",                             unit: "MT",    isDangerous: false, examples: "Steel scrap, HMS, shredded scrap" },
  { value: "clinker",    label: "🏗️ Clinker & Cement",                       unit: "MT",    isDangerous: false, examples: "Clinker, bulk cement, fly ash, gypsum" },
  { value: "bulk_dry",   label: "📦 Other Dry Bulk",                         unit: "MT",    isDangerous: false, examples: "Salt, sand, aggregate, timber, sugar" },
  { value: "steel",      label: "🔩 Steel Products (Coil / Pipe / Plate)",   unit: "MT",    isDangerous: false, examples: "Steel coil, HR coil, steel pipes, plates" },
  { value: "general",    label: "📦 General Cargo / Breakbulk",              unit: "MT",    isDangerous: false, examples: "Project cargo, bagged goods, machinery, timber" },
  { value: "container",  label: "🚢 Container (FCL / LCL)",                  unit: "TEU",   isDangerous: false, examples: "FCL, LCL, ISO containers" },
  { value: "roro",       label: "🚗 Ro-Ro / Vehicles",                       unit: "Units", isDangerous: false, examples: "Automobiles, trucks, heavy machinery, roll-on cargo" },
  { value: "crude",      label: "🛢️ Crude Oil & Condensate",                 unit: "MT",    isDangerous: true,  examples: "Crude oil, condensate, slop oil" },
  { value: "petroleum",  label: "⛽ Petroleum Products (Gasoil / Naphtha)",  unit: "MT",    isDangerous: true,  examples: "Gasoil, diesel, naphtha, fuel oil, lube oil, bitumen" },
  { value: "liquid",     label: "🌻 Edible Oils & Molasses",                 unit: "MT",    isDangerous: false, examples: "Vegetable oil, palm oil, molasses, glycerin" },
  { value: "chemical",   label: "⚗️ Chemical Tanker (Acids / Methanol)",     unit: "MT",    isDangerous: true,  examples: "Methanol, caustic soda, acids, ethanol, solvents" },
  { value: "gas",        label: "💨 LPG / LNG / Gas",                        unit: "MT",    isDangerous: true,  examples: "LPG, LNG, propane, butane, ammonia" },
  { value: "ammonia",    label: "🧪 Ammonia",                                unit: "MT",    isDangerous: true,  examples: "Anhydrous ammonia, aqueous ammonia" },
];

const COMMON_FLAGS = [
  "Turkey", "Panama", "Marshall Islands", "Bahamas", "Liberia",
  "Malta", "Cyprus", "Antigua & Barbuda", "Greece", "Norway",
  "United Kingdom", "Singapore", "Hong Kong", "Italy", "Germany",
  "Denmark", "Netherlands", "Portugal", "Croatia", "Tuvalu",
];

const isTurkishFlag = (flag: string): boolean => {
  const f = (flag || "").toLowerCase().trim();
  return f === "turkey" || f === "turkish" || f === "türk" || f === "türkiye" || f === "tr" || f === "turk";
};

export default function ProformaNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Vessel mode: "fleet" = pick from fleet, "manual" = type in manually
  const [vesselMode, setVesselMode] = useState<"fleet" | "manual">("fleet");

  // Fleet mode state
  const [selectedVessel, setSelectedVessel] = useState<string>("");

  // Manual mode state
  const [manualVesselName, setManualVesselName] = useState<string>("");
  const [manualFlag, setManualFlag] = useState<string>("Panama");
  const [manualGrt, setManualGrt] = useState<string>("");
  const [manualNrt, setManualNrt] = useState<string>("");

  // Port state
  const [selectedPort, setSelectedPort] = useState<string>("");
  const [portOpen, setPortOpen] = useState(false);
  const [portSearch, setPortSearch] = useState("");
  const [portCountry, setPortCountry] = useState<string>("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");

  // Trip parameters
  const [berthStayDays, setBerthStayDays] = useState<number>(4);
  const [anchorageDays, setAnchorageDays] = useState<number>(0);
  const [purposeOfCall, setPurposeOfCall] = useState<string>("Discharging");
  const [cargoQuantity, setCargoQuantity] = useState<string>("3001");
  const [cargoCategory, setCargoCategory] = useState<string>("grain");
  const [cargoType, setCargoType] = useState<string>("");
  const [cargoUnit, setCargoUnit] = useState<string>("MT");
  const [isDangerousCargo, setIsDangerousCargo] = useState<boolean>(false);

  // Tariff categories (auto-derived from flag, not shown to user)
  const [flagCategory, setFlagCategory] = useState<string>("foreign");
  const [dtoCategory, setDtoCategory] = useState<string>("foreign");
  const [lighthouseCategory, setLighthouseCategory] = useState<string>("foreign");
  const [vtsCategory, setVtsCategory] = useState<string>("foreign");
  const [wharfageCategory, setWharfageCategory] = useState<string>("foreign");

  // Exchange rates
  const [usdTryRate, setUsdTryRate] = useState<number>(43.86);
  const [eurTryRate, setEurTryRate] = useState<number>(51.73);
  const [rates, setRates] = useState<any>(null);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null);

  // Advanced / save fields
  const [toCompany, setToCompany] = useState<string>("");
  const [toCountry, setToCountry] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [bankName, setBankName] = useState<string>("");
  const [beneficiary, setBeneficiary] = useState<string>("");
  const [usdIban, setUsdIban] = useState<string>("");
  const [eurIban, setEurIban] = useState<string>("");
  const [swiftCode, setSwiftCode] = useState<string>("");
  const [bankBranch, setBankBranch] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Results
  const [calculatedItems, setCalculatedItems] = useState<ProformaLineItem[] | null>(null);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  const [totalEur, setTotalEur] = useState<number>(0);
  const [eurUsdParity, setEurUsdParity] = useState<number>(1.178);

  type GroupedBreakdownItem = {
    category: string;
    items: { description: string; amountUsd: number; amountEur: number; notes?: string }[];
    subtotalUsd: number;
    subtotalEur: number;
    pct: number;
  };

  // Quick estimate
  const [quickEstimate, setQuickEstimate] = useState<{
    lineItems: ProformaLineItem[];
    totalUsd: number;
    totalEur: number;
    vesselName: string;
    portName: string;
    exchangeRates: { usdTry: number; eurTry: number; eurUsd: number };
    groupedBreakdown?: GroupedBreakdownItem[];
    tariffSource?: string;
    portTariffName?: string;
  } | null>(null);
  const [calculatedGroupedBreakdown, setCalculatedGroupedBreakdown] = useState<GroupedBreakdownItem[]>([]);
  const [quickEstimateLoading, setQuickEstimateLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: vessels, isLoading: vesselsLoading } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
  const { data: myCompanyProfile } = useQuery<CompanyProfile | null>({ queryKey: ["/api/company-profile/me"] });
  const { data: portCountries = [] } = useQuery<string[]>({ queryKey: ["/api/ports/countries"], staleTime: 10 * 60 * 1000 });

  // ── Voyage pre-fill from ?voyageId= URL param ─────────────────────────────
  const linkedVoyageId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const vid = params.get("voyageId");
    return vid ? parseInt(vid) : null;
  }, []);

  const [voyageBannerDismissed, setVoyageBannerDismissed] = useState(false);
  const voyagePreFilled = useRef(false);

  const { data: linkedVoyage } = useQuery<any>({
    queryKey: ["/api/voyages", linkedVoyageId],
    queryFn: async () => {
      const res = await fetch(`/api/voyages/${linkedVoyageId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!linkedVoyageId,
  });

  useEffect(() => {
    if (!linkedVoyage || voyagePreFilled.current) return;
    if (linkedVoyage.vesselId && !vessels?.length) return;
    voyagePreFilled.current = true;
    if (linkedVoyage.vesselId) {
      setVesselMode("fleet");
      setSelectedVessel(String(linkedVoyage.vesselId));
      const vessel = vessels?.find((v) => v.id === linkedVoyage.vesselId);
      if (vessel) applyFlagCategories(vessel.flag || "");
    }
    if (linkedVoyage.purposeOfCall) setPurposeOfCall(linkedVoyage.purposeOfCall);
    if (linkedVoyage.cargoType) setCargoType(linkedVoyage.cargoType);
    if (linkedVoyage.cargoQuantity) setCargoQuantity(String(linkedVoyage.cargoQuantity));
    if (linkedVoyage.portId && linkedVoyage.portName) {
      setSelectedPort(String(linkedVoyage.portId));
      setPortSearch(linkedVoyage.portName);
      setSelectedPortObj({ id: linkedVoyage.portId, name: linkedVoyage.portName, code: null, country: null, lat: null, lng: null, timezone: null } as any);
    }
  }, [linkedVoyage, vessels]);

  // URL param pre-fill: ?vesselId=X auto-selects vessel from fleet
  useEffect(() => {
    if (!vessels?.length) return;
    const params = new URLSearchParams(window.location.search);
    const vid = params.get("vesselId");
    if (vid && vessels.find(v => v.id.toString() === vid)) {
      setVesselMode("fleet");
      setSelectedVessel(vid);
      const vessel = vessels.find(v => v.id.toString() === vid);
      if (vessel) applyFlagCategories(vessel.flag || "");
    }
  }, [vessels]);

  // Port search — server-side, debounced
  const [portSearchQuery, setPortSearchQuery] = useState("");
  const portDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedPortObj, setSelectedPortObj] = useState<Port | null>(null);

  useEffect(() => {
    if (portDebounceRef.current) clearTimeout(portDebounceRef.current);
    portDebounceRef.current = setTimeout(() => setPortSearchQuery(portSearch), 300);
    return () => { if (portDebounceRef.current) clearTimeout(portDebounceRef.current); };
  }, [portSearch]);

  const { data: portSearchResults, isLoading: portsSearchLoading } = useQuery<Port[]>({
    queryKey: ["/api/ports", { q: portSearchQuery }],
    queryFn: async () => {
      const res = await fetch(`/api/ports?q=${encodeURIComponent(portSearchQuery)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: portSearchQuery.trim().length >= 2,
    staleTime: 60_000,
  });

  // Derive flag categories from a flag string
  const applyFlagCategories = (flag: string) => {
    const turkish = isTurkishFlag(flag);
    setFlagCategory(turkish ? "turkish" : "foreign");
    setDtoCategory(turkish ? "turkish" : "foreign");
    setLighthouseCategory(turkish ? "turkish" : "foreign");
    setVtsCategory(turkish ? "turkish" : "foreign");
    setWharfageCategory(turkish ? "cabotage" : "foreign");
  };

  const handleVesselChange = (vesselId: string) => {
    setSelectedVessel(vesselId);
    const vessel = vessels?.find(v => v.id.toString() === vesselId);
    if (vessel) applyFlagCategories(vessel.flag || "");
  };

  const handleManualFlagChange = (flag: string) => {
    setManualFlag(flag);
    applyFlagCategories(flag);
  };

  // Whether vessel data is ready for calculation
  const vesselReady = vesselMode === "fleet"
    ? !!selectedVessel
    : !!(manualGrt && parseFloat(manualGrt) > 0);

  const filteredPorts = portSearchResults ?? [];

  // Build payload for quick-estimate
  const buildEstimatePayload = () => {
    const base = {
      portId: parseInt(selectedPort),
      berthStayDays,
      cargoQuantity: cargoQuantity ? parseFloat(cargoQuantity) : 5000,
      cargoType: cargoType || cargoCategory,
      isDangerousCargo,
      purposeOfCall,
    };
    if (vesselMode === "manual") {
      return { ...base, externalVesselName: manualVesselName || "Manual Vessel", externalFlag: manualFlag, externalGrt: parseFloat(manualGrt) || 2000, externalNrt: parseFloat(manualNrt) || 1000 };
    }
    return { ...base, vesselId: parseInt(selectedVessel) };
  };

  // Auto quick-estimate on inputs change
  useEffect(() => {
    if (!vesselReady || !selectedPort) { setQuickEstimate(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setQuickEstimateLoading(true);
      try {
        const res = await apiRequest("POST", "/api/proformas/quick-estimate", buildEstimatePayload());
        if (res.ok) { const data = await res.json(); setQuickEstimate(data); }
      } catch (_) {}
      setQuickEstimateLoading(false);
    }, 900);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [vesselMode, selectedVessel, manualVesselName, manualFlag, manualGrt, manualNrt, selectedPort, berthStayDays, cargoQuantity, cargoType, cargoCategory, isDangerousCargo, purposeOfCall]);

  const calculateMutation = useMutation({
    mutationFn: async (params: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/proformas/calculate", params);
      return res.json();
    },
    onSuccess: (data: { lineItems: ProformaLineItem[]; totalUsd: number; totalEur: number; eurUsdParity: number; groupedBreakdown?: GroupedBreakdownItem[] }) => {
      setCalculatedItems(data.lineItems);
      setTotalUsd(data.totalUsd);
      setTotalEur(data.totalEur);
      if (data.eurUsdParity) setEurUsdParity(data.eurUsdParity);
      if (data.groupedBreakdown) setCalculatedGroupedBreakdown(data.groupedBreakdown);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", variant: "destructive" });
        setTimeout(() => { window.location.href = "/login"; }, 500);
        return;
      }
      toast({ title: "Calculation failed", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/proformas", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/proformas"] });
      toast({ title: "Proforma created successfully" });
      setLocation(`/proformas/${data.id}`);
    },
    onError: (error: any) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", variant: "destructive" });
        setTimeout(() => { window.location.href = "/login"; }, 500);
        return;
      }
      if (error.message?.includes("limit reached") || error.message?.includes("LIMIT_REACHED") || error.message?.includes("upgrade")) {
        toast({ title: "Proforma Limit Reached", description: "You've used all proformas in your plan. Upgrade to continue.", variant: "destructive" });
        setTimeout(() => { setLocation("/pricing"); }, 1500);
        return;
      }
      toast({ title: "Failed to create proforma", description: error.message, variant: "destructive" });
    },
  });

  const liveRatesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/exchange-rates");
      return res.json() as Promise<{ usdTry: number; eurTry: number; gbpTry: number; jpyTry: number; cnyTry: number; nokTry: number; sgdTry: number; eurUsd?: number; source: string; updatedAt: string | null }>;
    },
    onSuccess: (data) => {
      setUsdTryRate(data.usdTry);
      setEurTryRate(data.eurTry);
      setRates(data);
      setRatesUpdatedAt(data.updatedAt);
    },
    onError: () => {
      toast({ title: "Could not fetch live rates", description: "TCMB may be unavailable. Enter rates manually.", variant: "destructive" });
    },
  });

  useEffect(() => { liveRatesMutation.mutate(); }, []);

  const triggerCalculation = useCallback(() => {
    if (!vesselReady || !selectedPort) {
      toast({ title: "Please provide vessel details and select a port", variant: "destructive" });
      return;
    }

    const base = {
      portId: parseInt(selectedPort),
      berthStayDays,
      anchorageDays,
      cargoQuantity: cargoQuantity ? parseFloat(cargoQuantity) : undefined,
      cargoType: cargoType || cargoCategory,
      purposeOfCall,
      isDangerousCargo,
      flagCategory,
      dtoCategory,
      lighthouseCategory,
      vtsCategory,
      wharfageCategory,
      usdTryRate,
      eurTryRate,
    };

    if (vesselMode === "manual") {
      calculateMutation.mutate({
        ...base,
        externalVesselName: manualVesselName || "Manual Vessel",
        externalFlag: manualFlag,
        externalGrt: parseFloat(manualGrt) || 2000,
        externalNrt: parseFloat(manualNrt) || 1000,
      });
    } else {
      calculateMutation.mutate({ ...base, vesselId: parseInt(selectedVessel) });
    }
  }, [vesselMode, selectedVessel, manualVesselName, manualFlag, manualGrt, manualNrt, selectedPort, berthStayDays, anchorageDays, cargoQuantity, cargoType, cargoCategory, purposeOfCall, isDangerousCargo, flagCategory, dtoCategory, lighthouseCategory, vtsCategory, wharfageCategory, usdTryRate, eurTryRate]);

  const handleSave = () => {
    if (!calculatedItems || !selectedPort) return;
    createMutation.mutate({
      vesselId: vesselMode === "fleet" ? parseInt(selectedVessel) : null,
      portId: parseInt(selectedPort),
      toCompany: toCompany || null,
      toCountry: toCountry || null,
      purposeOfCall,
      cargoType: cargoType || null,
      cargoQuantity: cargoQuantity ? parseFloat(cargoQuantity) : null,
      cargoUnit,
      berthStayDays,
      exchangeRate: eurUsdParity,
      lineItems: calculatedItems,
      totalUsd,
      totalEur,
      notes: notes || null,
      status: "draft",
      bankDetails: (bankName || usdIban || swiftCode) ? { bankName, beneficiary, usdIban, eurIban, swiftCode, branch: bankBranch } : undefined,
      voyageId: linkedVoyageId ?? undefined,
    });
  };

  const selectedVesselData = vessels?.find((v) => v.id.toString() === selectedVessel);
  const selectedPortData = selectedPortObj;
  const selectedCargoOption = CARGO_TYPE_OPTIONS.find(o => o.value === cargoCategory);

  // Effective vessel display name for the results panel
  const effectiveVesselName = vesselMode === "manual"
    ? (manualVesselName || "Manual Vessel")
    : (selectedVesselData?.name || "");

  const effectiveFlag = vesselMode === "manual" ? manualFlag : (selectedVesselData?.flag || "");

  return (
    <div className="px-3 py-5 space-y-6 max-w-7xl mx-auto">

      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Link href="/proformas">
          <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-back-proformas">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-new-proforma-title">New Proforma</h1>
          <p className="text-muted-foreground text-sm">Select vessel and port, set parameters, then click "Calculate Proforma".</p>
        </div>
      </div>

      {/* ── Voyage Linked Banner ── */}
      {linkedVoyageId && linkedVoyage && !voyageBannerDismissed && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[hsl(var(--maritime-primary)/0.08)] border border-[hsl(var(--maritime-primary)/0.25)] text-[hsl(var(--maritime-primary))]" data-testid="banner-voyage-linked">
          <Link2 className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold">Linked to voyage: </span>
            <span className="text-sm">
              {linkedVoyage.vesselName || "Vessel"} → {linkedVoyage.portName || "Port"}
              {linkedVoyage.purposeOfCall ? ` · ${linkedVoyage.purposeOfCall}` : ""}
              {linkedVoyage.cargoType ? ` · ${linkedVoyage.cargoType}` : ""}
            </span>
          </div>
          <button onClick={() => setVoyageBannerDismissed(true)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity" data-testid="button-dismiss-voyage-banner">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">

        {/* ── LEFT COLUMN: Form ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* SECTION 1: Vessel & Port */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-[hsl(var(--maritime-primary)/0.04)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center">
                  <Ship className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                </div>
                <h2 className="font-serif font-semibold text-base">Vessel & Port</h2>
              </div>

              {/* Mode toggle */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border">
                <button
                  onClick={() => setVesselMode("fleet")}
                  data-testid="tab-vessel-fleet"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    vesselMode === "fleet"
                      ? "bg-background text-foreground shadow-sm border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  From Fleet
                </button>
                <button
                  onClick={() => setVesselMode("manual")}
                  data-testid="tab-vessel-manual"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    vesselMode === "manual"
                      ? "bg-background text-foreground shadow-sm border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <PenLine className="w-3.5 h-3.5" />
                  Manual Entry
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">

              {/* ─── Fleet mode: vessel dropdown ─── */}
              {vesselMode === "fleet" && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Vessel <span className="text-red-500">*</span></Label>
                  {vesselsLoading ? <Skeleton className="h-10" /> : vessels && vessels.length > 0 ? (
                    <Select value={selectedVessel} onValueChange={handleVesselChange}>
                      <SelectTrigger className="h-10" data-testid="select-vessel">
                        <SelectValue placeholder="Select vessel from your fleet" />
                      </SelectTrigger>
                      <SelectContent>
                        {vessels.map((v) => (
                          <SelectItem key={v.id} value={v.id.toString()} data-testid={`option-vessel-${v.id}`}>
                            {v.name} <span className="text-muted-foreground ml-1">({v.flag})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/30">
                      No vessels in your fleet yet.{" "}
                      <Link href="/vessels" className="text-[hsl(var(--maritime-primary))] underline font-medium">Add a vessel</Link>
                      {" "}or switch to{" "}
                      <button onClick={() => setVesselMode("manual")} className="text-[hsl(var(--maritime-primary))] underline font-medium">Manual Entry</button>.
                    </div>
                  )}

                  {selectedVesselData && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground px-3 py-2.5 rounded-lg bg-muted/40 border" data-testid="text-vessel-summary">
                      <span><strong className="text-foreground">Flag:</strong> {selectedVesselData.flag}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span><strong className="text-foreground">Type:</strong> {selectedVesselData.vesselType}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span><strong className="text-foreground">GRT:</strong> {selectedVesselData.grt?.toLocaleString()}</span>
                      {selectedVesselData.nrt && <><span className="text-muted-foreground/40">·</span><span><strong className="text-foreground">NRT:</strong> {selectedVesselData.nrt?.toLocaleString()}</span></>}
                      {selectedVesselData.dwt && <><span className="text-muted-foreground/40">·</span><span><strong className="text-foreground">DWT:</strong> {selectedVesselData.dwt?.toLocaleString()}</span></>}
                      <Badge variant={isTurkishFlag(selectedVesselData.flag) ? "default" : "secondary"} className="text-[10px] ml-auto shrink-0" data-testid="badge-flag-category">
                        {isTurkishFlag(selectedVesselData.flag) ? "🇹🇷 Turkish Flag" : "🏳️ Foreign Flag"}
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Manual mode: vessel fields ─── */}
              {vesselMode === "manual" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                    <PenLine className="w-3.5 h-3.5 shrink-0" />
                    Enter vessel details manually — tariff categories are auto-determined from the flag.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Vessel Name</Label>
                      <Input
                        value={manualVesselName}
                        onChange={(e) => setManualVesselName(e.target.value)}
                        placeholder="e.g. MV OCEAN STAR"
                        className="h-10"
                        data-testid="input-manual-vessel-name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Flag <span className="text-red-500">*</span></Label>
                      <Select value={manualFlag} onValueChange={handleManualFlagChange}>
                        <SelectTrigger className="h-10" data-testid="select-manual-flag">
                          <SelectValue placeholder="Select flag state" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {COMMON_FLAGS.map(f => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">GRT — Gross Tonnage <span className="text-red-500">*</span></Label>
                      <Input
                        type="number"
                        value={manualGrt}
                        onChange={(e) => setManualGrt(e.target.value)}
                        placeholder="e.g. 28 500"
                        className="h-10 font-mono"
                        min={0}
                        data-testid="input-manual-grt"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">NRT — Net Tonnage</Label>
                      <Input
                        type="number"
                        value={manualNrt}
                        onChange={(e) => setManualNrt(e.target.value)}
                        placeholder="e.g. 14 200"
                        className="h-10 font-mono"
                        min={0}
                        data-testid="input-manual-nrt"
                      />
                      <p className="text-[10px] text-muted-foreground">Leave blank to auto-estimate (≈ 50% of GRT)</p>
                    </div>
                  </div>
                  {/* Flag badge */}
                  <div className="flex items-center gap-2">
                    <Badge variant={isTurkishFlag(manualFlag) ? "default" : "secondary"} className="text-xs" data-testid="badge-manual-flag-category">
                      {isTurkishFlag(manualFlag) ? "🇹🇷 Turkish Flag — Turkish tariffs applied" : "🏳️ Foreign Flag — International tariffs applied"}
                    </Badge>
                  </div>
                </div>
              )}

              <Separator />

              {/* Port / Terminal selector — Country → Terminal hierarchy */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
                  Port / Terminal <span className="text-red-500">*</span>
                </Label>

                {/* Step 1 – Country */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">1. Ülke seçin <span className="italic">(isteğe bağlı)</span></p>
                  <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                        data-testid="button-country-select"
                      >
                        <span className={portCountry ? "text-foreground" : "text-muted-foreground"}>
                          {portCountry
                            ? (() => { try { return new Intl.DisplayNames(["tr"], { type: "region" }).of(portCountry) || portCountry; } catch { return portCountry; } })()
                            : "Tüm ülkeler"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Ülke ara..."
                          value={countrySearch}
                          onValueChange={setCountrySearch}
                          data-testid="input-country-search"
                        />
                        <CommandList>
                          <CommandItem
                            value=""
                            onSelect={() => {
                              setPortCountry("");
                              setCountrySearch("");
                              setSelectedPort("");
                              setPortSearch("");
                              setCountryOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", !portCountry ? "opacity-100" : "opacity-0")} />
                            <span className="text-muted-foreground italic">Tüm ülkeler</span>
                          </CommandItem>
                          <CommandGroup>
                            {portCountries
                              .filter(code => {
                                if (!countrySearch) return true;
                                const name = (() => { try { return new Intl.DisplayNames(["tr"], { type: "region" }).of(code) || code; } catch { return code; } })();
                                return name.toLowerCase().includes(countrySearch.toLowerCase()) || code.toLowerCase().includes(countrySearch.toLowerCase());
                              })
                              .map(code => {
                                const name = (() => { try { return new Intl.DisplayNames(["tr"], { type: "region" }).of(code) || code; } catch { return code; } })();
                                return (
                                  <CommandItem
                                    key={code}
                                    value={code}
                                    onSelect={() => {
                                      setPortCountry(code);
                                      setCountrySearch("");
                                      setSelectedPort("");
                                      setPortSearch("");
                                      setCountryOpen(false);
                                    }}
                                    data-testid={`item-country-${code}`}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", portCountry === code ? "opacity-100" : "opacity-0")} />
                                    <span className="font-medium">{name}</span>
                                    <span className="ml-2 text-xs text-muted-foreground">{code}</span>
                                  </CommandItem>
                                );
                              })
                            }
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Step 2 – Port / Terminal */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">2. Liman / terminal seçin</p>
                  <PortLookupInput
                    value={selectedPort}
                    onChange={(portId, portName, portCode) => {
                      setSelectedPort(portId);
                      setPortSearch(portName);
                      setSelectedPortObj({ id: parseInt(portId), name: portName, code: portCode || null } as any);
                    }}
                    placeholder={portCountry ? "Liman / terminal ara..." : "Search and select port / terminal..."}
                    countryFilter={portCountry || undefined}
                    data-testid="select-port-terminal"
                  />
                </div>

                {selectedPortData && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground px-3 py-2 rounded-lg bg-muted/30 border border-dashed" data-testid="text-port-summary">
                    <MapPin className="w-3 h-3 text-[hsl(var(--maritime-primary))]" />
                    <span className="font-medium text-foreground">{selectedPortData.name}</span>
                    {selectedPortData.code && (
                      <span className="font-mono text-muted-foreground px-1.5 py-0.5 bg-muted rounded text-[10px]">{selectedPortData.code}</span>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Call parameters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-sm font-medium">Purpose of Call</Label>
                  <Select value={purposeOfCall} onValueChange={setPurposeOfCall}>
                    <SelectTrigger className="h-10" data-testid="select-purpose"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {purposeOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Berth Stay (Days)</Label>
                  <Input
                    type="number"
                    value={berthStayDays}
                    onChange={(e) => setBerthStayDays(parseInt(e.target.value) || 1)}
                    min={1} max={365}
                    className="h-10"
                    data-testid="input-berth-stay"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1">
                    <Anchor className="w-3 h-3" /> Anchorage (Days)
                  </Label>
                  <Input
                    type="number"
                    value={anchorageDays}
                    onChange={(e) => setAnchorageDays(parseInt(e.target.value) || 0)}
                    min={0} max={90}
                    className="h-10"
                    data-testid="input-anchorage-days"
                  />
                </div>
              </div>

              <Separator />

              {/* Cargo */}
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-sm font-medium">Cargo Quantity</Label>
                    <Input
                      type="number"
                      value={cargoQuantity}
                      onChange={(e) => setCargoQuantity(e.target.value)}
                      placeholder="e.g. 5000"
                      className="h-10"
                      data-testid="input-cargo-quantity"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Unit</Label>
                    <Select value={cargoUnit} onValueChange={setCargoUnit}>
                      <SelectTrigger className="h-10" data-testid="select-cargo-unit"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {cargoUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Cargo Category</Label>
                  <Select
                    value={cargoCategory}
                    onValueChange={(v) => {
                      setCargoCategory(v);
                      const opt = CARGO_TYPE_OPTIONS.find(o => o.value === v);
                      if (opt) { setCargoUnit(opt.unit); setIsDangerousCargo(opt.isDangerous); }
                    }}
                  >
                    <SelectTrigger className="h-10" data-testid="select-cargo-category"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {CARGO_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {selectedCargoOption?.examples && (
                    <p className="text-[11px] text-muted-foreground pl-0.5">{selectedCargoOption.examples}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Cargo Description <span className="font-normal">(optional)</span>
                  </Label>
                  <Input
                    value={cargoType}
                    onChange={(e) => setCargoType(e.target.value)}
                    placeholder={selectedCargoOption?.examples ? `e.g. ${selectedCargoOption.examples.split(",")[0].trim()}` : "Add specific cargo name..."}
                    className="h-10"
                    data-testid="input-cargo-description"
                  />
                </div>

                {/* Dangerous cargo toggle */}
                <div className={`flex items-center gap-3 p-3.5 rounded-lg border transition-colors ${isDangerousCargo ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800" : "border-input bg-muted/20"}`}>
                  <AlertTriangle className={`w-4 h-4 shrink-0 ${isDangerousCargo ? "text-orange-500" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="dangerous-cargo" className={`text-sm cursor-pointer ${isDangerousCargo ? "text-orange-700 dark:text-orange-300 font-medium" : ""}`}>
                        Dangerous Cargo (IMDG)
                      </Label>
                      {selectedCargoOption?.isDangerous && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 font-semibold border border-orange-200 dark:border-orange-700">Auto-detected</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">+30% surcharge on Pilotage, Tugboat & Mooring</p>
                  </div>
                  <Switch
                    id="dangerous-cargo"
                    checked={isDangerousCargo}
                    onCheckedChange={setIsDangerousCargo}
                    data-testid="switch-dangerous-cargo"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* SECTION 2: Exchange Rates */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-[hsl(var(--maritime-primary)/0.04)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center">
                  <Waves className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                </div>
                <div>
                  <h2 className="font-serif font-semibold text-base leading-tight">Exchange Rates</h2>
                  {ratesUpdatedAt && (
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      TCMB · {fmtDateTime(ratesUpdatedAt)}
                    </p>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => liveRatesMutation.mutate()}
                disabled={liveRatesMutation.isPending}
                className="gap-1.5 text-xs h-8"
                data-testid="button-fetch-live-rates"
              >
                {liveRatesMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {liveRatesMutation.isPending ? "Loading..." : "Use Current Rate"}
              </Button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-sm font-medium">Currency</Label>
                  <Select 
                    value={rates?.targetCurrency || "USD"} 
                    onValueChange={(val) => {
                      // This is just a visual selector for now as the calculation 
                      // is primarily USD/EUR based in the current backend logic.
                      // But we show the expanded options as requested.
                    }}
                  >
                    <SelectTrigger className="h-10" data-testid="select-currency">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                      <SelectItem value="CNY">CNY - Chinese Yuan</SelectItem>
                      <SelectItem value="NOK">NOK - Norwegian Krone</SelectItem>
                      <SelectItem value="SGD">SGD - Singapore Dollar</SelectItem>
                      <SelectItem value="TRY">TRY - Turkish Lira</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-muted-foreground">USD / TRY</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={usdTryRate}
                    onChange={(e) => setUsdTryRate(parseFloat(e.target.value) || 43.86)}
                    className="h-10 font-mono"
                    data-testid="input-usd-try-rate"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-muted-foreground">EUR / TRY</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={eurTryRate}
                    onChange={(e) => setEurTryRate(parseFloat(e.target.value) || 51.73)}
                    className="h-10 font-mono"
                    data-testid="input-eur-try-rate"
                  />
                </div>
              </div>
              {rates && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="px-2 py-1 rounded bg-muted/50 border border-dashed flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">GBP/TRY</span>
                    <span className="text-xs font-mono">{rates.gbpTry?.toFixed(4)}</span>
                  </div>
                  <div className="px-2 py-1 rounded bg-muted/50 border border-dashed flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">JPY/TRY</span>
                    <span className="text-xs font-mono">{rates.jpyTry?.toFixed(4)}</span>
                  </div>
                  <div className="px-2 py-1 rounded bg-muted/50 border border-dashed flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">CNY/TRY</span>
                    <span className="text-xs font-mono">{rates.cnyTry?.toFixed(4)}</span>
                  </div>
                  <div className="px-2 py-1 rounded bg-muted/50 border border-dashed flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">NOK/TRY</span>
                    <span className="text-xs font-mono">{rates.nokTry?.toFixed(4)}</span>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                EUR/USD Parity: <strong className="text-foreground font-mono">{(eurTryRate / usdTryRate).toFixed(4)}</strong>
              </p>
            </div>
          </Card>

          {/* Calculate CTA */}
          <Button
            className="w-full gap-2 h-12 text-base font-semibold shadow-sm"
            onClick={triggerCalculation}
            disabled={calculateMutation.isPending || !vesselReady || !selectedPort}
            data-testid="button-calculate"
          >
            {calculateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" />}
            {calculateMutation.isPending ? "Calculating..." : "Calculate Proforma"}
          </Button>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full py-1"
            data-testid="button-toggle-advanced"
          >
            <Package className="w-4 h-4" />
            Additional Details (Company, Notes)
            {showAdvanced ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
          </button>

          {showAdvanced && (
            <Card className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">To (Company)</Label>
                  <Input value={toCompany} onChange={(e) => setToCompany(e.target.value)} placeholder="Company name" className="h-10" data-testid="input-to-company" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Country</Label>
                  <Input value={toCountry} onChange={(e) => setToCountry(e.target.value)} placeholder="e.g. TURKIYE" className="h-10" data-testid="input-to-country" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={3} data-testid="input-notes" />
              </div>

              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Landmark className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                    Bank Details for PDF
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 gap-1.5"
                    data-testid="button-load-bank-profile"
                    onClick={() => {
                      const cp = myCompanyProfile as any;
                      if (!cp) return;
                      if (cp.bankName) setBankName(cp.bankName);
                      if (cp.bankAccountName) setBeneficiary(cp.bankAccountName);
                      if (cp.bankIban) { setUsdIban(cp.bankIban); setEurIban(cp.bankIban); }
                      if (cp.bankSwift) setSwiftCode(cp.bankSwift);
                      if (cp.bankBranchName) setBankBranch(cp.bankBranchName);
                    }}
                  >
                    Load from Company Profile
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Bank Name</Label>
                    <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Ziraat Bank" className="h-9 text-sm" data-testid="input-bank-name-proforma" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Beneficiary</Label>
                    <Input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} placeholder="Account holder name" className="h-9 text-sm" data-testid="input-bank-beneficiary" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">USD IBAN</Label>
                    <Input value={usdIban} onChange={(e) => setUsdIban(e.target.value)} placeholder="IBAN for USD account" className="h-9 text-sm" data-testid="input-bank-usd-iban" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">EUR IBAN</Label>
                    <Input value={eurIban} onChange={(e) => setEurIban(e.target.value)} placeholder="IBAN for EUR account" className="h-9 text-sm" data-testid="input-bank-eur-iban" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">SWIFT / BIC</Label>
                    <Input value={swiftCode} onChange={(e) => setSwiftCode(e.target.value)} placeholder="e.g. TCZBTR2A" className="h-9 text-sm" data-testid="input-bank-swift-proforma" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Branch</Label>
                    <Input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} placeholder="Branch name (optional)" className="h-9 text-sm" data-testid="input-bank-branch-proforma" />
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* ── RIGHT COLUMN: Results ── */}
        <div className="space-y-4">

          {/* Quick cost preview */}
          {vesselReady && selectedPort && !calculatedItems && (
            <Card className="overflow-hidden border-blue-200 dark:border-blue-800 shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_4px_24px_rgba(59,130,246,0.08)]" data-testid="panel-quick-estimate">
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-blue-50/80 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900">
                <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-sm text-blue-800 dark:text-blue-300">Quick Cost Preview</h3>
                {quickEstimateLoading && <Loader2 className="w-3 h-3 animate-spin text-blue-500 ml-auto" data-testid="spinner-estimating" />}
                {quickEstimate && !quickEstimateLoading && (
                  <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 uppercase tracking-wide">
                    {quickEstimate.tariffSource === "database" ? "DB Tariff" : "Estimate"}
                  </span>
                )}
              </div>

              {quickEstimateLoading && !quickEstimate ? (
                /* Loading skeleton */
                <div className="p-4 space-y-2 animate-pulse">
                  {[80, 60, 90, 50, 70].map((w, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className={`h-2.5 bg-blue-100 dark:bg-blue-900/40 rounded`} style={{ width: `${w}%` }} />
                      <div className="h-2.5 bg-blue-100 dark:bg-blue-900/40 rounded w-16" />
                    </div>
                  ))}
                </div>
              ) : quickEstimate ? (
                <>
                  {/* Summary badges */}
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-blue-50 dark:border-blue-900/50 bg-gradient-to-r from-blue-50/40 to-transparent dark:from-blue-950/20">
                    <Ship className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300 truncate">{quickEstimate.vesselName}</span>
                    <span className="text-[11px] text-blue-300 dark:text-blue-700 mx-0.5">•</span>
                    <Anchor className="w-3 h-3 text-blue-400 shrink-0" />
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 truncate">{quickEstimate.portName}</span>
                    <span className="ml-auto text-sm font-bold text-blue-700 dark:text-blue-200 font-mono whitespace-nowrap" data-testid="text-estimate-total">
                      ~${quickEstimate.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  {/* Two-column body */}
                  {(() => {
                    const CATEGORY_COLORS: Record<string, { border: string; bg: string; bar: string; text: string; icon: typeof Navigation }> = {
                      "Port Navigation": { border: "border-sky-500", bg: "bg-sky-50 dark:bg-sky-950/30", bar: "bg-sky-500", text: "text-sky-700 dark:text-sky-300", icon: Navigation },
                      "Port Dues":       { border: "border-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", bar: "bg-blue-500", text: "text-blue-700 dark:text-blue-300", icon: Layers },
                      "Regulatory":      { border: "border-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30", bar: "bg-violet-500", text: "text-violet-700 dark:text-violet-300", icon: ShieldCheck },
                      "Chamber & Official": { border: "border-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/30", bar: "bg-indigo-500", text: "text-indigo-700 dark:text-indigo-300", icon: Building2 },
                      "Disbursement":    { border: "border-slate-500", bg: "bg-slate-50 dark:bg-slate-900/30", bar: "bg-slate-500", text: "text-slate-700 dark:text-slate-300", icon: Receipt },
                      "Agency":          { border: "border-teal-500", bg: "bg-teal-50 dark:bg-teal-950/30", bar: "bg-teal-500", text: "text-teal-700 dark:text-teal-300", icon: Award },
                      "Supervision":     { border: "border-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", icon: BarChart3 },
                    };
                    const DEFAULT_COLOR = { border: "border-gray-400", bg: "bg-gray-50 dark:bg-gray-900/30", bar: "bg-gray-400", text: "text-gray-700 dark:text-gray-300", icon: FileText };
                    const grouped = quickEstimate.groupedBreakdown ?? [];
                    return (
                      <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-blue-100 dark:divide-blue-900/40">

                        {/* LEFT — Line Items table */}
                        <div className="flex-1 min-w-0 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                            <List className="w-3 h-3" /> Line Items
                          </p>
                          <div className="space-y-1.5" data-testid="table-grouped-items">
                            {grouped.map((group, gi) => {
                              const color = CATEGORY_COLORS[group.category] ?? DEFAULT_COLOR;
                              return (
                                <div key={gi} className={`rounded-md overflow-hidden border-l-4 ${color.border}`}>
                                  {/* Category header */}
                                  <div className={`flex items-center justify-between px-2 py-1 ${color.bg}`}>
                                    <span className={`text-[10px] font-bold uppercase tracking-wide ${color.text}`}>{group.category}</span>
                                    <span className={`text-[10px] font-bold font-mono ${color.text}`}>${group.subtotalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                  </div>
                                  {/* Items */}
                                  {group.items.map((item, ii) => (
                                    <div key={ii} className="flex items-center justify-between px-2 py-0.5 hover:bg-blue-50/30 dark:hover:bg-blue-950/20">
                                      <span className="text-[10px] text-muted-foreground truncate pr-2" style={{ maxWidth: "58%" }}>{item.description}</span>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[10px] font-mono text-foreground">${item.amountUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                        <span className="text-[9px] font-mono text-muted-foreground">€{item.amountEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                            {/* Total footer */}
                            <div className="flex items-center justify-between px-2 py-1.5 mt-1 border-t border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 rounded-b-md">
                              <span className="text-[10px] font-bold text-blue-800 dark:text-blue-200 uppercase tracking-wide">Total Port Expenses</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold font-mono text-blue-700 dark:text-blue-300">${quickEstimate.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                <span className="text-[10px] font-mono text-muted-foreground">€{quickEstimate.totalEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT — Cost Breakdown progress bars */}
                        <div className="md:w-52 shrink-0 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                            <BarChart3 className="w-3 h-3" /> Cost Breakdown
                          </p>
                          <div className="space-y-2">
                            {grouped.map((group, gi) => {
                              const color = CATEGORY_COLORS[group.category] ?? DEFAULT_COLOR;
                              return (
                                <div key={gi} data-testid={`div-breakdown-category-${gi}`}>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[10px] text-muted-foreground truncate" style={{ maxWidth: "65%" }}>{group.category}</span>
                                    <span className="text-[10px] font-mono font-semibold text-foreground">{group.pct}%</span>
                                  </div>
                                  <div className="w-full h-2 bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
                                    <div
                                      data-testid={`progress-category-${gi}`}
                                      className={`h-full rounded-full transition-all duration-500 ${color.bar}`}
                                      style={{ width: `${group.pct}%` }}
                                    />
                                  </div>
                                  <p className="text-[9px] font-mono text-muted-foreground mt-0.5 text-right">${group.subtotalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                </div>
                              );
                            })}
                          </div>
                          {/* Totals */}
                          <div className="mt-3 pt-2 border-t border-blue-100 dark:border-blue-900/40 space-y-0.5">
                            <div className="flex justify-between items-baseline">
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</span>
                              <span className="text-sm font-bold font-mono text-blue-700 dark:text-blue-300">${quickEstimate.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="flex justify-between items-baseline">
                              <span className="text-[9px] text-muted-foreground">EUR</span>
                              <span className="text-[11px] font-mono text-muted-foreground">€{quickEstimate.totalEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground pt-1">TCMB: 1 USD = {quickEstimate.exchangeRates.usdTry} TRY</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Action buttons */}
                  <div className="flex gap-2 px-4 py-3 border-t border-blue-100 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/10">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-2 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      onClick={() => {
                        setCalculatedItems(quickEstimate.lineItems);
                        setTotalUsd(quickEstimate.totalUsd);
                        setTotalEur(quickEstimate.totalEur);
                        setEurUsdParity(quickEstimate.exchangeRates.eurUsd);
                        if (quickEstimate.groupedBreakdown) setCalculatedGroupedBreakdown(quickEstimate.groupedBreakdown);
                      }}
                      data-testid="button-load-estimate"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      Load as Proforma
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs text-blue-600 hover:bg-blue-100/50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                      onClick={() => {
                        import("@/lib/proforma-summary").then(({ generateProformaSummaryPdf }) => {
                          generateProformaSummaryPdf(quickEstimate as any);
                        });
                      }}
                      data-testid="button-export-summary"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export
                    </Button>
                  </div>

                  <div className="px-4 pb-2">
                    <p className="text-[9px] text-muted-foreground italic">Preliminary estimate — click Calculate for full breakdown.</p>
                  </div>
                </>
              ) : null}
            </Card>
          )}

          {/* Sticky results / awaiting */}
          <div className="sticky top-6 space-y-4">
            {!calculatedItems ? (
              <Card className="p-8 flex flex-col items-center justify-center text-center space-y-3 border-dashed" data-testid="panel-awaiting-calculation">
                <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--maritime-primary)/0.07)] flex items-center justify-center">
                  <Calculator className="w-6 h-6 text-[hsl(var(--maritime-primary)/0.4)]" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Awaiting Calculation</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto leading-relaxed">Fill in vessel, port and parameters, then click Calculate Proforma</p>
                </div>
              </Card>
            ) : (
              <Card className="overflow-hidden" data-testid="card-calculation-results">
                <div className="flex items-center gap-2 px-4 py-3 border-b bg-[hsl(var(--maritime-primary)/0.04)]">
                  <Calculator className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                  <h2 className="font-serif font-semibold text-sm">Proforma Disbursement Account</h2>
                </div>

                <div className="flex flex-wrap gap-1.5 px-4 pt-3">
                  {effectiveVesselName && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(var(--maritime-primary)/0.08)] text-[hsl(var(--maritime-primary))] text-xs">
                      <Ship className="w-2.5 h-2.5" /> {effectiveVesselName}
                    </span>
                  )}
                  {selectedPortData && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[hsl(var(--maritime-primary)/0.08)] text-[hsl(var(--maritime-primary))] text-xs">
                      <Anchor className="w-2.5 h-2.5" /> {selectedPortData.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
                    {purposeOfCall} · {berthStayDays}d{anchorageDays > 0 ? ` · ${anchorageDays}d anch.` : ""}{isDangerousCargo ? " · ⚠️ IMDG" : ""}
                  </span>
                </div>

                <div className="mx-4 mt-3 border rounded-md overflow-hidden">
                  {(() => {
                    const palette = ["border-blue-400","border-indigo-500","border-violet-500","border-sky-500","border-teal-500","border-cyan-500","border-blue-600","border-indigo-600","border-purple-500","border-blue-400"];
                    return (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-[hsl(var(--maritime-primary)/0.04)]">
                            <th className="text-left px-3 py-2 font-medium uppercase tracking-wider text-muted-foreground">Description</th>
                            <th className="text-right px-3 py-2 font-medium uppercase tracking-wider text-muted-foreground">USD</th>
                            <th className="text-right px-3 py-2 font-medium uppercase tracking-wider text-muted-foreground hidden sm:table-cell">EUR</th>
                            <th className="text-right px-3 py-2 font-medium uppercase tracking-wider text-muted-foreground">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calculatedItems.map((item, i) => {
                            const pct = totalUsd > 0 ? (item.amountUsd / totalUsd * 100) : 0;
                            return (
                              <tr key={i} className={`border-b last:border-0 hover:bg-muted/30 transition-colors border-l-4 ${palette[i % palette.length]}`} data-testid={`row-line-item-${i}`}>
                                <td className="px-3 py-2">
                                  <span className="font-medium">{item.description}</span>
                                  {item.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{item.notes}</p>}
                                </td>
                                <td className="px-3 py-2 text-right font-mono">{item.amountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td className="px-3 py-2 text-right font-mono hidden sm:table-cell">{item.amountEur?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "-"}</td>
                                <td className="px-3 py-2 text-right text-muted-foreground">{pct.toFixed(1)}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-[hsl(var(--maritime-primary)/0.08)] font-bold border-l-4 border-[hsl(var(--maritime-primary))]">
                            <td className="px-3 py-2.5">Total Port Expenses</td>
                            <td className="px-3 py-2.5 text-right font-mono text-[hsl(var(--maritime-primary))]" data-testid="text-total-usd">
                              ${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-[hsl(var(--maritime-primary))] hidden sm:table-cell" data-testid="text-total-eur">
                              €{totalEur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground">100%</td>
                          </tr>
                        </tfoot>
                      </table>
                    );
                  })()}
                </div>

                <p className="text-[10px] text-muted-foreground px-4 pt-2">
                  EUR/USD: {eurUsdParity.toFixed(4)} · $1 = €{(1 / eurUsdParity).toFixed(4)}
                </p>

                <div className="flex gap-2 px-4 pb-4 pt-2">
                  <Button
                    className="flex-1 gap-2"
                    onClick={handleSave}
                    disabled={createMutation.isPending}
                    data-testid="button-save-proforma"
                  >
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    Save Proforma
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCalculatedItems(null)}
                    title="Clear results"
                    data-testid="button-clear-results"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
