import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useCallback, useMemo } from "react";
import { FileText, Ship, Globe, ArrowLeft, Calculator, Loader2, ChevronDown, ChevronUp, Anchor, Settings2, Package, AlertTriangle, Crown, ChevronsUpDown, Check, MapPin } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { Link, useLocation } from "wouter";
import type { Vessel, Port, ProformaLineItem } from "@shared/schema";

const purposeOptions = ["Loading", "Discharging", "Loading/Discharging", "Transit", "Bunkering", "Repair", "Survey"];
const cargoUnits = ["MT", "CBM", "TEU", "Units"];

const CITY_CODE_NAMES: Record<string, string> = {
  ALA: "Alanya", ALI: "Aliağa", AMA: "Amasra", AMB: "Ambarlı (İstanbul)",
  ANA: "Anamur", AYT: "Antalya", AYV: "Ayvalık", BDM: "Bodrum",
  BTN: "Bartın", BXN: "Bandırma", BZC: "Bartın (Çaycuma)", CES: "Çeşme",
  CKZ: "Çanakkale", DAT: "Datça", DIK: "Dikili", EDO: "Erdek",
  ENE: "Enez", ERE: "Ereğli (Zonguldak)", ERK: "Erdemli", FAS: "Fasa",
  FET: "Fethiye", FIN: "Fındıklı", FOC: "Foça", GCA: "Geyikli",
  GCK: "Gebze (Kocaeli)", GEL: "Gelibolu", GEM: "Gemlik", GIR: "Giresun",
  GOR: "Görele", GUL: "Güllük", HOP: "Hopa", IGN: "İğneada",
  INE: "İnebolu", ISK: "İskenderun", IST: "İstanbul", IZM: "İzmit",
  IZT: "İzmit (Tersaneler)", KAS: "Kaş", KMR: "Karamürsel", KRB: "Karabiga",
  KRT: "Karataş (Adana)", KUS: "Kuşadası", MER: "Mersin", MRA: "Marmara Adası",
  MRM: "Marmaris", MUD: "Mudanya", ORD: "Ordu", RIZ: "Rize",
  SIC: "Sinop", SIL: "Silopi", SSX: "Samsun", SUR: "Sürmene",
  TAS: "Taşucu", TEK: "Tekirdağ", TIR: "Tire (İzmir)", TZX: "Trabzon",
  UNY: "Ünye", YAL: "Yalova", ZON: "Zonguldak",
  "092": "Tuzla (Tersaneler Bölgesi)", "01M": "Ceyhan (Adana)",
  "039": "Karasu (Sakarya)", "027": "Cide", "002": "Kefken", "003": "Seyhan",
};

function getPortCityCode(code: string): string {
  if (!code) return "OTHER";
  const withoutTr = code.startsWith("TR") ? code.substring(2) : code;
  const dashIdx = withoutTr.indexOf("-");
  return dashIdx !== -1 ? withoutTr.substring(0, dashIdx) : withoutTr;
}

function getCityName(cityCode: string): string {
  return CITY_CODE_NAMES[cityCode] ?? cityCode;
}

export default function ProformaNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [selectedVessel, setSelectedVessel] = useState<string>("");
  const [selectedPort, setSelectedPort] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [berthStayDays, setBerthStayDays] = useState<number>(4);
  const [anchorageDays, setAnchorageDays] = useState<number>(0);
  const [purposeOfCall, setPurposeOfCall] = useState<string>("Discharging");
  const [cargoQuantity, setCargoQuantity] = useState<string>("3001");
  const [cargoType, setCargoType] = useState<string>("");
  const [cargoUnit, setCargoUnit] = useState<string>("MT");
  const [isDangerousCargo, setIsDangerousCargo] = useState<boolean>(false);
  const [customsType, setCustomsType] = useState<string>("import");
  const [flagCategory, setFlagCategory] = useState<string>("turkish");
  const [dtoCategory, setDtoCategory] = useState<string>("turkish");
  const [lighthouseCategory, setLighthouseCategory] = useState<string>("turkish");
  const [vtsCategory, setVtsCategory] = useState<string>("turkish");
  const [wharfageCategory, setWharfageCategory] = useState<string>("foreign");

  const isTurkishFlag = (flag: string): boolean => {
    const f = flag.toLowerCase().trim();
    return f === "turkey" || f === "turkish" || f === "türk" || f === "türkiye" || f === "tr" || f === "turk";
  };

  const handleVesselChange = (vesselId: string) => {
    setSelectedVessel(vesselId);
    const vessel = vessels?.find(v => v.id.toString() === vesselId);
    if (vessel) {
      const turkish = isTurkishFlag(vessel.flag);
      setFlagCategory(turkish ? "turkish" : "foreign");
      setDtoCategory(turkish ? "turkish" : "foreign");
      setLighthouseCategory(turkish ? "turkish" : "foreign");
      setVtsCategory(turkish ? "turkish" : "foreign");
      setWharfageCategory(turkish ? "cabotage" : "foreign");
    }
  };
  const [usdTryRate, setUsdTryRate] = useState<number>(43.86);
  const [eurTryRate, setEurTryRate] = useState<number>(51.73);
  const [toCompany, setToCompany] = useState<string>("");
  const [toCountry, setToCountry] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [portOpen, setPortOpen] = useState(false);

  const [calculatedItems, setCalculatedItems] = useState<ProformaLineItem[] | null>(null);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  const [totalEur, setTotalEur] = useState<number>(0);
  const [eurUsdParity, setEurUsdParity] = useState<number>(1.178);

  const { data: vessels, isLoading: vesselsLoading } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
  const { data: ports, isLoading: portsLoading } = useQuery<Port[]>({ queryKey: ["/api/ports"] });

  const citiesWithCounts = useMemo(() => {
    if (!ports) return [];
    const counts: Record<string, number> = {};
    for (const p of ports) {
      const code = getPortCityCode(p.code || "");
      counts[code] = (counts[code] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([code, count]) => ({ code, name: getCityName(code), count }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [ports]);

  const portsForCity = useMemo(() => {
    if (!ports || !selectedCity) return [];
    return ports.filter((p) => getPortCityCode(p.code || "") === selectedCity);
  }, [ports, selectedCity]);

  const calculateMutation = useMutation({
    mutationFn: async (params: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/proformas/calculate", params);
      return res.json();
    },
    onSuccess: (data: { lineItems: ProformaLineItem[]; totalUsd: number; totalEur: number; eurUsdParity: number }) => {
      setCalculatedItems(data.lineItems);
      setTotalUsd(data.totalUsd);
      setTotalEur(data.totalEur);
      if (data.eurUsdParity) setEurUsdParity(data.eurUsdParity);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
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
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      if (error.message?.includes("limit reached") || error.message?.includes("LIMIT_REACHED") || error.message?.includes("upgrade")) {
        toast({
          title: "Proforma Limit Reached",
          description: "You've used all proformas in your plan. Upgrade to continue.",
          variant: "destructive",
        });
        setTimeout(() => { setLocation("/pricing"); }, 1500);
        return;
      }
      toast({ title: "Failed to create proforma", description: error.message, variant: "destructive" });
    },
  });

  const triggerCalculation = useCallback(() => {
    if (!selectedVessel || !selectedPort) {
      toast({ title: "Please select a vessel and port first", variant: "destructive" });
      return;
    }
    calculateMutation.mutate({
      vesselId: parseInt(selectedVessel),
      portId: parseInt(selectedPort),
      berthStayDays,
      anchorageDays,
      cargoQuantity: cargoQuantity ? parseFloat(cargoQuantity) : undefined,
      purposeOfCall,
      isDangerousCargo,
      customsType,
      flagCategory,
      dtoCategory,
      lighthouseCategory,
      vtsCategory,
      wharfageCategory,
      usdTryRate,
      eurTryRate,
    });
  }, [selectedVessel, selectedPort, berthStayDays, anchorageDays, cargoQuantity, purposeOfCall, isDangerousCargo, customsType, flagCategory, dtoCategory, lighthouseCategory, vtsCategory, wharfageCategory, usdTryRate, eurTryRate]);

  const handleSave = () => {
    if (!calculatedItems || !selectedVessel || !selectedPort) return;
    createMutation.mutate({
      vesselId: parseInt(selectedVessel),
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
    });
  };

  const selectedVesselData = vessels?.find((v) => v.id.toString() === selectedVessel);
  const selectedPortData = ports?.find((p) => p.id.toString() === selectedPort);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/proformas">
          <Button variant="ghost" size="icon" data-testid="button-back-proformas">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-new-proforma-title">New Proforma</h1>
          <p className="text-muted-foreground text-sm">Select vessel and port, set parameters, then click "Calculate Proforma".</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 space-y-5">
            <h2 className="font-serif font-semibold text-lg flex items-center gap-2">
              <Ship className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
              Vessel & Port
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vessel *</Label>
                {vesselsLoading ? <Skeleton className="h-10" /> : vessels && vessels.length > 0 ? (
                  <Select value={selectedVessel} onValueChange={handleVesselChange}>
                    <SelectTrigger data-testid="select-vessel"><SelectValue placeholder="Select vessel" /></SelectTrigger>
                    <SelectContent>
                      {vessels.map((v) => (
                        <SelectItem key={v.id} value={v.id.toString()} data-testid={`option-vessel-${v.id}`}>
                          {v.name} ({v.flag})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/30">
                    No vessels yet.{" "}
                    <Link href="/vessels" className="text-[hsl(var(--maritime-primary))] underline">Add a vessel first</Link>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
                  City / Region *
                </Label>
                {portsLoading ? <Skeleton className="h-10" /> : (
                  <Select
                    value={selectedCity}
                    onValueChange={(v) => { setSelectedCity(v); setSelectedPort(""); setPortOpen(false); }}
                    data-testid="select-port-city"
                  >
                    <SelectTrigger data-testid="select-port-city-trigger">
                      <SelectValue placeholder="Select city or region..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {citiesWithCounts.map((c) => (
                        <SelectItem key={c.code} value={c.code} data-testid={`option-city-${c.code}`}>
                          {c.name}
                          <span className="ml-1.5 text-xs text-muted-foreground">({c.count})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Terminal / Port *
                {selectedCity && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    — {getCityName(selectedCity)} ({portsForCity.length} terminals)
                  </span>
                )}
              </Label>
              {portsLoading ? <Skeleton className="h-10" /> : (
                <Popover open={portOpen} onOpenChange={setPortOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={portOpen}
                      disabled={!selectedCity}
                      className="w-full justify-between font-normal disabled:opacity-60"
                      data-testid="select-port-terminal"
                    >
                      {!selectedCity
                        ? "Select a city / region first..."
                        : selectedPort
                          ? (() => { const p = ports?.find(p => p.id.toString() === selectedPort); return p ? p.name : "Select terminal"; })()
                          : "Search and select terminal..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full max-w-xl p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search terminals..." data-testid="input-search-port" />
                      <CommandList>
                        <CommandEmpty>No terminal found.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-y-auto">
                          {portsForCity.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={`${p.name} ${p.code || ""}`}
                              onSelect={() => { setSelectedPort(p.id.toString()); setPortOpen(false); }}
                              data-testid={`option-port-${p.id}`}
                            >
                              <Check className={`mr-2 h-4 w-4 shrink-0 ${selectedPort === p.id.toString() ? "opacity-100" : "opacity-0"}`} />
                              <span className="flex-1">{p.name}</span>
                              {p.code && <span className="ml-2 text-xs text-muted-foreground font-mono">{p.code}</span>}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {selectedVesselData && (
              <div className="flex flex-wrap gap-4 items-center text-xs text-muted-foreground bg-muted/30 rounded-md p-3" data-testid="text-vessel-summary">
                <span><strong>Flag:</strong> {selectedVesselData.flag}</span>
                <span><strong>Type:</strong> {selectedVesselData.vesselType}</span>
                <span><strong>GRT:</strong> {selectedVesselData.grt?.toLocaleString()}</span>
                <span><strong>NRT:</strong> {selectedVesselData.nrt?.toLocaleString()}</span>
                {selectedVesselData.dwt && <span><strong>DWT:</strong> {selectedVesselData.dwt?.toLocaleString()}</span>}
                <Badge variant={isTurkishFlag(selectedVesselData.flag) ? "default" : "secondary"} className="text-[10px] ml-auto" data-testid="badge-flag-category">
                  {isTurkishFlag(selectedVesselData.flag) ? "🇹🇷 Turkish Flag" : "🏳️ Foreign Flag"} — Tariffs auto-adjusted
                </Badge>
              </div>
            )}
            {selectedPortData && (
              <div className="flex flex-wrap gap-3 items-center text-xs text-muted-foreground bg-muted/20 rounded-md p-3 border border-dashed" data-testid="text-port-summary">
                <MapPin className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
                <span><strong>City:</strong> {getCityName(selectedCity)}</span>
                <span className="text-muted-foreground/50">·</span>
                <span><strong>Terminal:</strong> {selectedPortData.name}</span>
                {selectedPortData.code && (
                  <>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="font-mono"><strong>Code:</strong> {selectedPortData.code}</span>
                  </>
                )}
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Purpose of Call</Label>
                <Select value={purposeOfCall} onValueChange={setPurposeOfCall}>
                  <SelectTrigger data-testid="select-purpose"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {purposeOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Est. Berth Stay (Days)</Label>
                <Input
                  type="number"
                  value={berthStayDays}
                  onChange={(e) => setBerthStayDays(parseInt(e.target.value) || 1)}
                  min={1}
                  max={90}
                  data-testid="input-berth-days"
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo Quantity</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={cargoQuantity}
                    onChange={(e) => setCargoQuantity(e.target.value)}
                    placeholder="e.g. 4000"
                    className="flex-1"
                    data-testid="input-cargo-qty"
                  />
                  <Select value={cargoUnit} onValueChange={setCargoUnit}>
                    <SelectTrigger className="w-20" data-testid="select-cargo-unit"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {cargoUnits.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                <Label>Cargo Description</Label>
                <Input
                  value={cargoType}
                  onChange={(e) => setCargoType(e.target.value)}
                  placeholder="e.g. Wheat, SFS OIL, Coal, Container, Bulk Cement..."
                  data-testid="input-cargo-type"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-md border bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
              <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
              <Label htmlFor="dangerous-cargo" className="text-sm cursor-pointer flex-1">Dangerous Cargo (IMDG)</Label>
              <Switch
                id="dangerous-cargo"
                checked={isDangerousCargo}
                onCheckedChange={setIsDangerousCargo}
                data-testid="switch-dangerous-cargo"
              />
            </div>
          </Card>

          <Card className="p-6 space-y-5">
            <h2 className="font-serif font-semibold text-lg flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
              Tariff Parameters
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Customs Type</Label>
                <Select value={customsType} onValueChange={setCustomsType}>
                  <SelectTrigger data-testid="select-customs-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="import">Import</SelectItem>
                    <SelectItem value="export">Export</SelectItem>
                    <SelectItem value="transit">Transit</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>DTO (Chamber of Shipping)</Label>
                <Select value={dtoCategory} onValueChange={setDtoCategory}>
                  <SelectTrigger data-testid="select-dto"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="turkish">Turkish</SelectItem>
                    <SelectItem value="foreign">Foreign</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Wharfage / Berth Type</Label>
                <Select value={wharfageCategory} onValueChange={setWharfageCategory}>
                  <SelectTrigger data-testid="select-wharfage"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="foreign">Foreign</SelectItem>
                    <SelectItem value="turkish">Turkish</SelectItem>
                    <SelectItem value="cabotage">Cabotage</SelectItem>
                    <SelectItem value="izmir_tcdd">Izmir/TCDD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lighthouse</Label>
                <Select value={lighthouseCategory} onValueChange={setLighthouseCategory}>
                  <SelectTrigger data-testid="select-lighthouse"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="turkish">Turkish</SelectItem>
                    <SelectItem value="foreign">Foreign</SelectItem>
                    <SelectItem value="cabotage">Cabotage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>VTS</Label>
                <Select value={vtsCategory} onValueChange={setVtsCategory}>
                  <SelectTrigger data-testid="select-vts"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="turkish">Turkish</SelectItem>
                    <SelectItem value="foreign">Foreign</SelectItem>
                    <SelectItem value="cabotage">Cabotage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Anchorage Days</Label>
                <Input
                  type="number"
                  value={anchorageDays}
                  onChange={(e) => setAnchorageDays(parseInt(e.target.value) || 0)}
                  min={0}
                  max={90}
                  data-testid="input-anchorage-days"
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>USD/TRY Exchange Rate</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={usdTryRate}
                  onChange={(e) => setUsdTryRate(parseFloat(e.target.value) || 43.86)}
                  data-testid="input-usd-try-rate"
                />
              </div>
              <div className="space-y-2">
                <Label>EUR/TRY Exchange Rate</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={eurTryRate}
                  onChange={(e) => setEurTryRate(parseFloat(e.target.value) || 51.73)}
                  data-testid="input-eur-try-rate"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              EUR/USD Parity: <strong>{(eurTryRate / usdTryRate).toFixed(6)}</strong>
            </p>
          </Card>

          <Button
            className="w-full gap-2 h-12 text-base font-semibold"
            onClick={triggerCalculation}
            disabled={calculateMutation.isPending || !selectedVessel || !selectedPort}
            data-testid="button-calculate"
          >
            {calculateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" />}
            {calculateMutation.isPending ? "Calculating..." : "Calculate Proforma"}
          </Button>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
            data-testid="button-toggle-advanced"
          >
            <Package className="w-4 h-4" />
            Additional Details (Company, Notes)
            {showAdvanced ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
          </button>

          {showAdvanced && (
            <Card className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>To (Company)</Label>
                  <Input value={toCompany} onChange={(e) => setToCompany(e.target.value)} placeholder="Company name" data-testid="input-to-company" />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={toCountry} onChange={(e) => setToCountry(e.target.value)} placeholder="e.g. TURKIYE" data-testid="input-to-country" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={3} data-testid="input-notes" />
              </div>
            </Card>
          )}

          {calculatedItems && (
            <Card className="p-6 space-y-4" data-testid="card-calculation-results">
              <div className="flex items-center justify-between">
                <h2 className="font-serif font-semibold text-lg flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
                  Proforma Disbursement Account
                </h2>
                <div className="text-xs text-muted-foreground">
                  $1 = €{(1 / eurUsdParity).toFixed(4)} | EUR/USD: {eurUsdParity.toFixed(6)}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs">
                {selectedVesselData && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--maritime-primary)/0.08)] text-[hsl(var(--maritime-primary))]">
                    <Ship className="w-3 h-3" />
                    {selectedVesselData.name} ({selectedVesselData.flag})
                  </div>
                )}
                {selectedPortData && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--maritime-primary)/0.08)] text-[hsl(var(--maritime-primary))]">
                    <Anchor className="w-3 h-3" />
                    {selectedPortData.name}
                  </div>
                )}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground">
                  <Package className="w-3 h-3" />
                  {purposeOfCall} | {berthStayDays} day(s)
                  {isDangerousCargo && " | ⚠️ IMDG"}
                </div>
              </div>

              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-[hsl(var(--maritime-primary)/0.04)]">
                      <th className="text-left p-3 font-medium text-xs uppercase tracking-wider">#</th>
                      <th className="text-left p-3 font-medium text-xs uppercase tracking-wider">Description</th>
                      <th className="text-right p-3 font-medium text-xs uppercase tracking-wider">USD ($)</th>
                      <th className="text-right p-3 font-medium text-xs uppercase tracking-wider hidden sm:table-cell">EUR (€)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculatedItems.map((item, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-line-item-${i}`}>
                        <td className="p-3 text-muted-foreground text-xs">{i + 1}</td>
                        <td className="p-3">
                          <span className="font-medium">{item.description}</span>
                          {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
                        </td>
                        <td className="p-3 text-right font-mono">{item.amountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-mono hidden sm:table-cell">{item.amountEur?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[hsl(var(--maritime-primary)/0.06)] font-bold">
                      <td className="p-3" colSpan={2}>Total Port Expenses</td>
                      <td className="p-3 text-right font-mono text-[hsl(var(--maritime-primary))]" data-testid="text-total-usd">
                        ${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono text-[hsl(var(--maritime-primary))] hidden sm:table-cell" data-testid="text-total-eur">
                        €{totalEur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-6 space-y-4 sticky top-6">
            <h3 className="font-serif font-semibold flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Summary
            </h3>

            {!selectedVessel || !selectedPort ? (
              <div className="text-sm text-muted-foreground p-4 rounded-md bg-muted/30 text-center">
                Select a <strong>vessel</strong> and <strong>port</strong> to see the calculated expenses.
              </div>
            ) : calculatedItems ? (
              <div className="space-y-4">
                <div className="p-4 rounded-md bg-[hsl(var(--maritime-primary)/0.05)] border border-[hsl(var(--maritime-primary)/0.1)]">
                  <p className="text-xs text-muted-foreground mb-1">Total Estimated</p>
                  <p className="text-2xl font-bold font-serif text-[hsl(var(--maritime-primary))]" data-testid="text-sidebar-total-usd">
                    ${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-muted-foreground font-mono">
                    €{totalEur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>{calculatedItems.length} expense items</p>
                  <p>{berthStayDays} day(s) berth stay</p>
                  {isDangerousCargo && <p className="text-orange-500 font-medium">⚠️ Dangerous cargo surcharge applied</p>}
                </div>
                <Button
                  className="w-full gap-2"
                  onClick={handleSave}
                  disabled={createMutation.isPending}
                  data-testid="button-save-proforma"
                >
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Save Proforma
                </Button>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
