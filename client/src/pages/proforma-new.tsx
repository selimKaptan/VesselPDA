import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Ship, Globe, ArrowLeft, Calculator, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [calculatedItems, setCalculatedItems] = useState<ProformaLineItem[] | null>(null);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState(false);

  const { data: vessels, isLoading: vesselsLoading } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
  const { data: ports, isLoading: portsLoading } = useQuery<Port[]>({ queryKey: ["/api/ports"] });

  const calculateMutation = useMutation({
    mutationFn: async (params: { vesselId: number; portId: number; berthStayDays: number; cargoQuantity?: number; purposeOfCall: string }) => {
      const res = await apiRequest("POST", "/api/proformas/calculate", params);
      return res.json();
    },
    onSuccess: (data: { lineItems: ProformaLineItem[]; totalUsd: number }) => {
      setCalculatedItems(data.lineItems);
      setTotalUsd(data.totalUsd);
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

  const handleCalculate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (!selectedVessel || !selectedPort) {
      toast({ title: "Please select a vessel and port", variant: "destructive" });
      return;
    }
    calculateMutation.mutate({
      vesselId: parseInt(selectedVessel),
      portId: parseInt(selectedPort),
      berthStayDays: parseInt(formData.get("berthStayDays") as string) || 5,
      cargoQuantity: formData.get("cargoQuantity") ? parseFloat(formData.get("cargoQuantity") as string) : undefined,
      purposeOfCall: formData.get("purposeOfCall") as string || "Loading",
    });
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!calculatedItems) return;
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      vesselId: parseInt(selectedVessel),
      portId: parseInt(selectedPort),
      toCompany: formData.get("toCompany") || null,
      toCountry: formData.get("toCountry") || null,
      purposeOfCall: formData.get("purposeOfCall") || "Loading",
      cargoType: formData.get("cargoType") || null,
      cargoQuantity: formData.get("cargoQuantity") ? parseFloat(formData.get("cargoQuantity") as string) : null,
      cargoUnit: formData.get("cargoUnit") || "MT",
      berthStayDays: parseInt(formData.get("berthStayDays") as string) || 5,
      exchangeRate: formData.get("exchangeRate") ? parseFloat(formData.get("exchangeRate") as string) : 1,
      lineItems: calculatedItems,
      totalUsd: totalUsd,
      totalEur: formData.get("exchangeRate") ? totalUsd / parseFloat(formData.get("exchangeRate") as string) : null,
      notes: formData.get("notes") || null,
      status: "draft",
    });
  };

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
          <p className="text-muted-foreground text-sm">Generate a new proforma disbursement account.</p>
        </div>
      </div>

      <form onSubmit={calculatedItems ? handleSave : handleCalculate} id="proforma-form">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 space-y-4">
              <h2 className="font-serif font-semibold text-lg flex items-center gap-2">
                <Ship className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
                Vessel & Port Selection
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vessel *</Label>
                  {vesselsLoading ? <Skeleton className="h-9" /> : (
                    <Select value={selectedVessel} onValueChange={setSelectedVessel} name="vesselId" required>
                      <SelectTrigger data-testid="select-vessel"><SelectValue placeholder="Select vessel" /></SelectTrigger>
                      <SelectContent>
                        {vessels?.map((v) => (
                          <SelectItem key={v.id} value={v.id.toString()}>{v.name} ({v.flag})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Destination Port *</Label>
                  {portsLoading ? <Skeleton className="h-9" /> : (
                    <Select value={selectedPort} onValueChange={setSelectedPort} name="portId" required>
                      <SelectTrigger data-testid="select-port"><SelectValue placeholder="Select port" /></SelectTrigger>
                      <SelectContent>
                        {ports?.map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name} ({p.country})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h2 className="font-serif font-semibold text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-[hsl(var(--maritime-secondary))]" />
                Call Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>To (Company)</Label>
                  <Input name="toCompany" placeholder="Company name" data-testid="input-to-company" />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input name="toCountry" placeholder="U.A.E" data-testid="input-to-country" />
                </div>
                <div className="space-y-2">
                  <Label>Purpose of Call *</Label>
                  <Select name="purposeOfCall" defaultValue="Loading">
                    <SelectTrigger data-testid="select-purpose"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {purposeOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Est. Berth Stay (Days)</Label>
                  <Input name="berthStayDays" type="number" defaultValue="5" min="1" max="90" data-testid="input-berth-days" />
                </div>
                <div className="space-y-2">
                  <Label>Cargo Type</Label>
                  <Input name="cargoType" placeholder="SFS, Bulk, Container..." data-testid="input-cargo-type" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Cargo Quantity</Label>
                    <Input name="cargoQuantity" type="number" step="0.01" placeholder="4000" data-testid="input-cargo-qty" />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select name="cargoUnit" defaultValue="MT">
                      <SelectTrigger data-testid="select-cargo-unit"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {cargoUnits.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Exchange Rate (USD to EUR)</Label>
                  <Input name="exchangeRate" type="number" step="0.0001" defaultValue="1.1593" data-testid="input-exchange-rate" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea name="notes" placeholder="Additional notes..." rows={3} data-testid="input-notes" />
              </div>
            </Card>

            {calculatedItems && (
              <Card className="p-6 space-y-4" data-testid="card-calculation-results">
                <h2 className="font-serif font-semibold text-lg flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-[hsl(var(--maritime-success))]" />
                  Calculated Port Expenses
                </h2>
                <div className="border rounded-md">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Description</th>
                        <th className="text-right p-3 font-medium">USD</th>
                        <th className="text-right p-3 font-medium hidden sm:table-cell">EUR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculatedItems.map((item, i) => (
                        <tr key={i} className="border-b last:border-0" data-testid={`row-line-item-${i}`}>
                          <td className="p-3">
                            <span>{item.description}</span>
                            {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
                          </td>
                          <td className="p-3 text-right font-mono">{item.amountUsd.toLocaleString()}</td>
                          <td className="p-3 text-right font-mono hidden sm:table-cell">{item.amountEur?.toLocaleString() || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[hsl(var(--maritime-primary)/0.05)] font-semibold">
                        <td className="p-3">Total Port Expenses</td>
                        <td className="p-3 text-right font-mono">${totalUsd.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono hidden sm:table-cell">
                          {calculatedItems[0]?.amountEur !== undefined ? `€${Math.round(totalUsd / 1.1593).toLocaleString()}` : "-"}
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
              <h3 className="font-serif font-semibold">Actions</h3>
              {!calculatedItems ? (
                <Button type="submit" className="w-full gap-2" disabled={calculateMutation.isPending || !selectedVessel || !selectedPort} data-testid="button-calculate">
                  {calculateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                  Calculate Expenses
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 rounded-md bg-[hsl(var(--maritime-primary)/0.05)] border">
                    <p className="text-sm text-muted-foreground">Total Estimated</p>
                    <p className="text-2xl font-bold font-serif text-[hsl(var(--maritime-primary))]" data-testid="text-total-usd">
                      ${totalUsd.toLocaleString()}
                    </p>
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={createMutation.isPending} data-testid="button-save-proforma">
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    Save Proforma
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => { setCalculatedItems(null); setTotalUsd(0); }}
                    data-testid="button-recalculate"
                  >
                    Recalculate
                  </Button>
                </div>
              )}

              {selectedVessel && vessels && (
                <div className="pt-4 border-t space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Selected Vessel</p>
                  {(() => {
                    const v = vessels.find((x) => x.id.toString() === selectedVessel);
                    if (!v) return null;
                    return (
                      <div className="text-sm space-y-1">
                        <p className="font-medium">{v.name}</p>
                        <p className="text-muted-foreground">Flag: {v.flag}</p>
                        <p className="text-muted-foreground">GRT: {v.grt?.toLocaleString()} / NRT: {v.nrt?.toLocaleString()}</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
