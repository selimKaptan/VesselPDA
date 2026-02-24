import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { FileText, Ship, Globe, ArrowLeft, Calculator, Loader2, ChevronDown, ChevronUp, Anchor, Settings2, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { Link, useLocation } from "wouter";
import type { Vessel, Port, ProformaLineItem } from "@shared/schema";

const purposeOptions = ["Loading", "Discharging", "Loading/Discharging", "Transit", "Bunkering", "Repair", "Survey"];
const cargoUnits = ["MT", "CBM", "TEU", "Units"];

export default function ProformaNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [selectedVessel, setSelectedVessel] = useState<string>("");
  const [selectedPort, setSelectedPort] = useState<string>("");
  const [berthStayDays, setBerthStayDays] = useState<number>(5);
  const [purposeOfCall, setPurposeOfCall] = useState<string>("Loading");
  const [cargoQuantity, setCargoQuantity] = useState<string>("");
  const [cargoType, setCargoType] = useState<string>("");
  const [cargoUnit, setCargoUnit] = useState<string>("MT");
  const [exchangeRate, setExchangeRate] = useState<number>(1.1593);
  const [toCompany, setToCompany] = useState<string>("");
  const [toCountry, setToCountry] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [calculatedItems, setCalculatedItems] = useState<ProformaLineItem[] | null>(null);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  const [totalEur, setTotalEur] = useState<number>(0);

  const { data: vessels, isLoading: vesselsLoading } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
  const { data: ports, isLoading: portsLoading } = useQuery<Port[]>({ queryKey: ["/api/ports"] });

  const calculateMutation = useMutation({
    mutationFn: async (params: { vesselId: number; portId: number; berthStayDays: number; cargoQuantity?: number; purposeOfCall: string; exchangeRate: number }) => {
      const res = await apiRequest("POST", "/api/proformas/calculate", params);
      return res.json();
    },
    onSuccess: (data: { lineItems: ProformaLineItem[]; totalUsd: number; totalEur: number }) => {
      setCalculatedItems(data.lineItems);
      setTotalUsd(data.totalUsd);
      setTotalEur(data.totalEur);
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
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Failed to create proforma", description: error.message, variant: "destructive" });
    },
  });

  const triggerCalculation = useCallback(() => {
    if (!selectedVessel || !selectedPort) return;
    calculateMutation.mutate({
      vesselId: parseInt(selectedVessel),
      portId: parseInt(selectedPort),
      berthStayDays,
      cargoQuantity: cargoQuantity ? parseFloat(cargoQuantity) : undefined,
      purposeOfCall,
      exchangeRate,
    });
  }, [selectedVessel, selectedPort, berthStayDays, cargoQuantity, purposeOfCall, exchangeRate]);

  useEffect(() => {
    if (selectedVessel && selectedPort) {
      const timer = setTimeout(() => {
        triggerCalculation();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setCalculatedItems(null);
      setTotalUsd(0);
      setTotalEur(0);
    }
  }, [selectedVessel, selectedPort, berthStayDays, cargoQuantity, purposeOfCall, exchangeRate]);

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
      exchangeRate,
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
          <p className="text-muted-foreground text-sm">Select vessel and port - expenses are calculated automatically.</p>
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
                  <Select value={selectedVessel} onValueChange={setSelectedVessel}>
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
                <Label>Destination Port *</Label>
                {portsLoading ? <Skeleton className="h-10" /> : (
                  <Select value={selectedPort} onValueChange={setSelectedPort}>
                    <SelectTrigger data-testid="select-port"><SelectValue placeholder="Select port" /></SelectTrigger>
                    <SelectContent>
                      {ports?.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()} data-testid={`option-port-${p.id}`}>
                          {p.name} ({p.country})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {selectedVesselData && (
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground bg-muted/30 rounded-md p-3" data-testid="text-vessel-summary">
                <span><strong>Type:</strong> {selectedVesselData.vesselType}</span>
                <span><strong>GRT:</strong> {selectedVesselData.grt?.toLocaleString()}</span>
                <span><strong>NRT:</strong> {selectedVesselData.nrt?.toLocaleString()}</span>
                {selectedVesselData.dwt && <span><strong>DWT:</strong> {selectedVesselData.dwt?.toLocaleString()}</span>}
                {selectedVesselData.loa && <span><strong>LOA:</strong> {selectedVesselData.loa}m</span>}
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
                  onChange={(e) => setBerthStayDays(parseInt(e.target.value) || 5)}
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
            </div>
          </Card>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
            data-testid="button-toggle-advanced"
          >
            <Settings2 className="w-4 h-4" />
            Additional Details (Optional)
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
                  <Input value={toCountry} onChange={(e) => setToCountry(e.target.value)} placeholder="e.g. U.A.E" data-testid="input-to-country" />
                </div>
                <div className="space-y-2">
                  <Label>Cargo Type</Label>
                  <Input value={cargoType} onChange={(e) => setCargoType(e.target.value)} placeholder="e.g. SFS, Bulk, Container..." data-testid="input-cargo-type" />
                </div>
                <div className="space-y-2">
                  <Label>Exchange Rate (USD/EUR)</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1.1593)}
                    data-testid="input-exchange-rate"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." rows={3} data-testid="input-notes" />
              </div>
            </Card>
          )}

          {calculateMutation.isPending && (
            <Card className="p-8">
              <div className="flex items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Calculating port expenses...</span>
              </div>
            </Card>
          )}

          {calculatedItems && !calculateMutation.isPending && (
            <Card className="p-6 space-y-4" data-testid="card-calculation-results">
              <div className="flex items-center justify-between">
                <h2 className="font-serif font-semibold text-lg flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
                  Proforma Disbursement Account
                </h2>
                <div className="text-xs text-muted-foreground">
                  Rate: $1 = €{(1 / exchangeRate).toFixed(4)}
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
                </div>
              </div>

              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-[hsl(var(--maritime-primary)/0.04)]">
                      <th className="text-left p-3 font-medium text-xs uppercase tracking-wider">#</th>
                      <th className="text-left p-3 font-medium text-xs uppercase tracking-wider">Description</th>
                      <th className="text-right p-3 font-medium text-xs uppercase tracking-wider">USD</th>
                      <th className="text-right p-3 font-medium text-xs uppercase tracking-wider hidden sm:table-cell">EUR</th>
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
                        <td className="p-3 text-right font-mono">{item.amountUsd.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono hidden sm:table-cell">{item.amountEur?.toLocaleString() || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[hsl(var(--maritime-primary)/0.06)] font-bold">
                      <td className="p-3" colSpan={2}>Total Port Expenses</td>
                      <td className="p-3 text-right font-mono text-[hsl(var(--maritime-primary))]" data-testid="text-total-usd">${totalUsd.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono text-[hsl(var(--maritime-primary))] hidden sm:table-cell" data-testid="text-total-eur">€{totalEur.toLocaleString()}</td>
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
                    ${totalUsd.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground font-mono">€{totalEur.toLocaleString()}</p>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>{calculatedItems.length} expense items</p>
                  <p>{berthStayDays} day(s) berth stay</p>
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
            ) : calculateMutation.isPending ? (
              <div className="text-sm text-muted-foreground p-4 rounded-md bg-muted/30 text-center">
                <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                Calculating...
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
