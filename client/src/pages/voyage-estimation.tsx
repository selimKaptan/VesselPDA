import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Calculator, Plus, Trash2, Save, FileText, Loader2, 
  ArrowRight, Info, TrendingUp, TrendingDown, 
  Anchor, Ship, Scale, Fuel, Timer, DollarSign,
  ChevronRight, ChevronDown, BarChart2, Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  Tooltip as RechartsTooltip, Legend 
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { EmptyState } from "@/components/empty-state";
import { fmtDate } from "@/lib/formatDate";
import { VoyageEstimation } from "@shared/schema";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function VoyageEstimationPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("calculator");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    estimationName: "New Voyage Estimate",
    vesselId: "",
    vesselName: "",
    vesselType: "Bulk Carrier",
    dwt: 35000,
    speedLaden: 12,
    speedBallast: 13,
    consumptionLaden: 28,
    consumptionBallast: 25,
    consumptionPort: 3,
    fuelType: "VLSFO",
    fuelPrice: 600,
    // Cargo
    cargoType: "",
    cargoQuantity: 30000,
    freightRate: 25.5,
    freightCurrency: "USD",
    freightBasis: "PWWD",
    // Ports
    loadPort: "",
    dischargePort: "",
    distanceLaden: 2500,
    distanceBallast: 500,
    portDaysLoad: 3,
    portDaysDischarge: 3,
    // Costs
    portCostLoad: 25000,
    portCostDischarge: 30000,
    canalCost: 0,
    miscCosts: 5000,
    // Commission
    addressCommission: 1.25,
    brokerCommissionPct: 1.25,
    notes: ""
  });

  const { data: vessels = [] } = useQuery<any[]>({
    queryKey: ["/api/vessels"]
  });

  const { data: estimations = [], isLoading: isLoadingEstimations } = useQuery<VoyageEstimation[]>({
    queryKey: ["/api/voyage-estimations"]
  });

  const handleVesselChange = (vesselId: string) => {
    const vessel = vessels.find(v => v.id.toString() === vesselId);
    if (vessel) {
      setForm(prev => ({
        ...prev,
        vesselId: vesselId,
        vesselName: vessel.name,
        vesselType: vessel.vesselType,
        dwt: vessel.dwt || 35000
      }));
    }
  };

  const results = useMemo(() => {
    // Basic Calculations
    const grossFreight = (form.cargoQuantity || 0) * (form.freightRate || 0);
    
    // Time calculations
    const seaDaysLaden = (form.distanceLaden || 0) / (form.speedLaden * 24);
    const seaDaysBallast = (form.distanceBallast || 0) / (form.speedBallast * 24);
    const portDays = (form.portDaysLoad || 0) + (form.portDaysDischarge || 0);
    const totalDays = seaDaysLaden + seaDaysBallast + portDays;

    // Fuel calculations
    const fuelConsSea = (seaDaysLaden * form.consumptionLaden) + (seaDaysBallast * form.consumptionBallast);
    const fuelConsPort = portDays * form.consumptionPort;
    const totalFuelCons = fuelConsSea + fuelConsPort;
    const bunkerCost = totalFuelCons * form.fuelPrice;

    // Commissions
    const addrCommAmt = grossFreight * (form.addressCommission / 100);
    const brokCommAmt = grossFreight * (form.brokerCommissionPct / 100);
    const totalCommission = addrCommAmt + brokCommAmt;

    // Total Costs
    const totalVoyageCosts = bunkerCost + (form.portCostLoad || 0) + (form.portCostDischarge || 0) + (form.canalCost || 0) + (form.miscCosts || 0) + totalCommission;
    
    const netProfit = grossFreight - totalVoyageCosts;
    const tce = totalDays > 0 ? netProfit / totalDays : 0;
    
    // Breakeven freight rate
    const breakevenFreight = form.cargoQuantity > 0 ? totalVoyageCosts / form.cargoQuantity : 0;

    return {
      grossFreight,
      seaDaysLaden,
      seaDaysBallast,
      portDays,
      totalDays,
      totalFuelCons,
      bunkerCost,
      totalCommission,
      totalVoyageCosts,
      netProfit,
      tce,
      breakevenFreight,
      costBreakdown: [
        { name: 'Bunkers', value: bunkerCost },
        { name: 'Port Costs', value: (form.portCostLoad || 0) + (form.portCostDischarge || 0) },
        { name: 'Commissions', value: totalCommission },
        { name: 'Other (Canal/Misc)', value: (form.canalCost || 0) + (form.miscCosts || 0) }
      ]
    };
  }, [form]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        vesselId: form.vesselId ? parseInt(form.vesselId) : null,
        grossFreight: results.grossFreight,
        totalVoyageCosts: results.totalVoyageCosts,
        netProfit: results.netProfit,
        voyageDays: results.totalDays,
        tce: results.tce,
        breakevenFreight: results.breakevenFreight,
        status: "saved"
      };

      if (editingId) {
        return apiRequest("PATCH", `/api/voyage-estimations/${editingId}`, payload);
      }
      return apiRequest("POST", "/api/voyage-estimations", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyage-estimations"] });
      toast({ title: "Estimate saved successfully" });
      setActiveTab("history");
      setEditingId(null);
    },
    onError: (error) => {
      toast({ title: "Error saving estimate", description: String(error), variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/voyage-estimations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyage-estimations"] });
      toast({ title: "Estimate deleted" });
    }
  });

  const loadEstimate = (est: VoyageEstimation) => {
    setForm({
      estimationName: est.estimationName,
      vesselId: est.vesselId?.toString() || "",
      vesselName: est.vesselName || "",
      vesselType: est.vesselType || "",
      dwt: est.dwt || 0,
      speedLaden: est.speedLaden || 0,
      speedBallast: est.speedBallast || 0,
      consumptionLaden: est.consumptionLaden || 0,
      consumptionBallast: est.consumptionBallast || 0,
      consumptionPort: est.consumptionPort || 0,
      fuelType: est.fuelType || "VLSFO",
      fuelPrice: est.fuelPrice || 0,
      cargoType: est.cargoType || "",
      cargoQuantity: est.cargoQuantity || 0,
      freightRate: est.freightRate || 0,
      freightCurrency: est.freightCurrency || "USD",
      freightBasis: est.freightBasis || "PWWD",
      loadPort: est.loadPort || "",
      dischargePort: est.dischargePort || "",
      distanceLaden: est.distanceLaden || 0,
      distanceBallast: est.distanceBallast || 0,
      portDaysLoad: est.portDaysLoad || 0,
      portDaysDischarge: est.portDaysDischarge || 0,
      portCostLoad: est.portCostLoad || 0,
      portCostDischarge: est.portCostDischarge || 0,
      canalCost: est.canalCost || 0,
      miscCosts: est.miscCosts || 0,
      addressCommission: est.addressCommission || 0,
      brokerCommissionPct: est.brokerCommissionPct || 0,
      notes: est.notes || ""
    });
    setEditingId(est.id);
    setActiveTab("calculator");
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      <PageMeta title="Voyage Estimation | Freight Suite" />
      
      <header className="px-6 py-4 border-b flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Voyage Estimation</h1>
          <p className="text-sm text-muted-foreground">Calculate Freight P&L and TCE for your potential fixtures</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={activeTab === "calculator" ? "default" : "outline"} 
            onClick={() => setActiveTab("calculator")}
            className="gap-2"
          >
            <Calculator className="w-4 h-4" /> Calculator
          </Button>
          <Button 
            variant={activeTab === "history" ? "default" : "outline"} 
            onClick={() => setActiveTab("history")}
            className="gap-2"
          >
            <Layers className="w-4 h-4" /> History
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <Card className="hover-elevate">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Estimates</p>
                  <p className="text-2xl font-bold">{estimations.length}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-full">
                  <Calculator className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg. TCE</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(estimations.length > 0 ? estimations.reduce((acc, curr) => acc + (curr.tce || 0), 0) / estimations.length : 0)}/day
                  </p>
                </div>
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                  <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg. Net Profit</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(estimations.length > 0 ? estimations.reduce((acc, curr) => acc + (curr.netProfit || 0), 0) / estimations.length : 0)}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">This Month</p>
                  <p className="text-2xl font-bold">
                    {estimations.filter(e => {
                      const d = new Date(e.createdAt || "");
                      const now = new Date();
                      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    }).length}
                  </p>
                </div>
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                  <Timer className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {activeTab === "calculator" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input Form */}
            <div className="lg:col-span-7 space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle>Estimation Inputs</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      setForm(prev => ({...prev, estimationName: "New Voyage Estimate"}));
                      setEditingId(null);
                    }}>New</Button>
                    <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Estimate
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <Label htmlFor="estimationName">Estimation Name</Label>
                    <Input 
                      id="estimationName" 
                      value={form.estimationName} 
                      onChange={e => setForm(f => ({...f, estimationName: e.target.value}))}
                      placeholder="e.g. MV Galaxy - Wheat Load Nov 2024"
                    />
                  </div>

                  <Accordion type="single" collapsible defaultValue="vessel" className="w-full">
                    <AccordionItem value="vessel">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Ship className="w-4 h-4 text-primary" />
                          <span>Vessel & Performance</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Select Vessel (Optional)</Label>
                            <Select value={form.vesselId} onValueChange={handleVesselChange}>
                              <SelectTrigger><SelectValue placeholder="Manual entry or select..." /></SelectTrigger>
                              <SelectContent>
                                {vessels.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Vessel Name</Label>
                            <Input value={form.vesselName} onChange={e => setForm(f => ({...f, vesselName: e.target.value}))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Vessel Type</Label>
                            <Input value={form.vesselType} onChange={e => setForm(f => ({...f, vesselType: e.target.value}))} />
                          </div>
                          <div className="space-y-2">
                            <Label>DWT</Label>
                            <Input type="number" value={form.dwt} onChange={e => setForm(f => ({...f, dwt: parseFloat(e.target.value)}))} />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 border-t pt-4">
                          <div className="space-y-2">
                            <Label>Speed (Laden/Ballast)</Label>
                            <div className="flex gap-2">
                              <Input type="number" value={form.speedLaden} onChange={e => setForm(f => ({...f, speedLaden: parseFloat(e.target.value)}))} placeholder="L" />
                              <Input type="number" value={form.speedBallast} onChange={e => setForm(f => ({...f, speedBallast: parseFloat(e.target.value)}))} placeholder="B" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Cons (L/B/P)</Label>
                            <div className="flex gap-2">
                              <Input type="number" value={form.consumptionLaden} onChange={e => setForm(f => ({...f, consumptionLaden: parseFloat(e.target.value)}))} />
                              <Input type="number" value={form.consumptionBallast} onChange={e => setForm(f => ({...f, consumptionBallast: parseFloat(e.target.value)}))} />
                              <Input type="number" value={form.consumptionPort} onChange={e => setForm(f => ({...f, consumptionPort: parseFloat(e.target.value)}))} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Fuel Price ($/MT)</Label>
                            <Input type="number" value={form.fuelPrice} onChange={e => setForm(f => ({...f, fuelPrice: parseFloat(e.target.value)}))} />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="cargo">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-primary" />
                          <span>Cargo & Freight</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Cargo Type</Label>
                            <Input value={form.cargoType} onChange={e => setForm(f => ({...f, cargoType: e.target.value}))} placeholder="e.g. Wheat, Steel Billets" />
                          </div>
                          <div className="space-y-2">
                            <Label>Quantity (MT)</Label>
                            <Input type="number" value={form.cargoQuantity} onChange={e => setForm(f => ({...f, cargoQuantity: parseFloat(e.target.value)}))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Freight Rate</Label>
                            <Input type="number" value={form.freightRate} onChange={e => setForm(f => ({...f, freightRate: parseFloat(e.target.value)}))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Basis</Label>
                            <Select value={form.freightBasis} onValueChange={v => setForm(f => ({...f, freightBasis: v}))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PWWD">Per MT (PWWD)</SelectItem>
                                <SelectItem value="LUMP SUM">Lump Sum</SelectItem>
                                <SelectItem value="FIO">FIO</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="ports">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Anchor className="w-4 h-4 text-primary" />
                          <span>Ports & Distances</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Load Port</Label>
                            <Input value={form.loadPort} onChange={e => setForm(f => ({...f, loadPort: e.target.value}))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Discharge Port</Label>
                            <Input value={form.dischargePort} onChange={e => setForm(f => ({...f, dischargePort: e.target.value}))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Dist (Laden/Ballast) NM</Label>
                            <div className="flex gap-2">
                              <Input type="number" value={form.distanceLaden} onChange={e => setForm(f => ({...f, distanceLaden: parseFloat(e.target.value)}))} placeholder="L" />
                              <Input type="number" value={form.distanceBallast} onChange={e => setForm(f => ({...f, distanceBallast: parseFloat(e.target.value)}))} placeholder="B" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Port Days (Load/Disc)</Label>
                            <div className="flex gap-2">
                              <Input type="number" value={form.portDaysLoad} onChange={e => setForm(f => ({...f, portDaysLoad: parseFloat(e.target.value)}))} />
                              <Input type="number" value={form.portDaysDischarge} onChange={e => setForm(f => ({...f, portDaysDischarge: parseFloat(e.target.value)}))} />
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="costs">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-primary" />
                          <span>Costs & Commissions</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Port Costs (Load)</Label>
                            <Input type="number" value={form.portCostLoad} onChange={e => setForm(f => ({...f, portCostLoad: parseFloat(e.target.value)}))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Port Costs (Disc)</Label>
                            <Input type="number" value={form.portCostDischarge} onChange={e => setForm(f => ({...f, portCostDischarge: parseFloat(e.target.value)}))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Canal Cost</Label>
                            <Input type="number" value={form.canalCost} onChange={e => setForm(f => ({...f, canalCost: parseFloat(e.target.value)}))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Misc Costs</Label>
                            <Input type="number" value={form.miscCosts} onChange={e => setForm(f => ({...f, miscCosts: parseFloat(e.target.value)}))} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t pt-4">
                          <div className="space-y-2">
                            <Label>Address Commission (%)</Label>
                            <Input type="number" value={form.addressCommission} onChange={e => setForm(f => ({...f, addressCommission: parseFloat(e.target.value)}))} step="0.01" />
                          </div>
                          <div className="space-y-2">
                            <Label>Broker Commission (%)</Label>
                            <Input type="number" value={form.brokerCommissionPct} onChange={e => setForm(f => ({...f, brokerCommissionPct: parseFloat(e.target.value)}))} step="0.01" />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  
                  <div className="mt-6">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea 
                      id="notes" 
                      value={form.notes} 
                      onChange={e => setForm(f => ({...f, notes: e.target.value}))} 
                      placeholder="Voyage specific notes..."
                      className="h-20"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Results Panel */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="bg-primary/5 border-primary/20 sticky top-6">
                <CardHeader>
                  <CardTitle>Voyage Results</CardTitle>
                  <CardDescription>Key Performance Indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-background rounded-lg border shadow-sm">
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Net Profit</p>
                      <p className={`text-2xl font-bold ${results.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(results.netProfit)}
                      </p>
                    </div>
                    <div className="p-4 bg-background rounded-lg border shadow-sm">
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">TCE / Day</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency(results.tce)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Gross Freight:</span>
                      <span className="font-semibold">{formatCurrency(results.grossFreight)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-red-600">
                      <span className="text-muted-foreground">Total Voyage Costs:</span>
                      <span className="font-semibold">({formatCurrency(results.totalVoyageCosts)})</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Voyage Days:</span>
                      <span className="font-semibold">{results.totalDays.toFixed(1)} days</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Breakeven Freight:</span>
                      <span className="font-semibold">{results.breakevenFreight.toFixed(2)} USD/MT</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm font-semibold mb-4">Cost Distribution</p>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={results.costBreakdown}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {results.costBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
                <CardDescription>View and compare your saved voyage estimations</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingEstimations ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : estimations.length === 0 ? (
                  <EmptyState 
                    title="No estimations found" 
                    description="You haven't saved any voyage estimations yet."
                    icon="📊"
                    actionLabel="Create First Estimate"
                    onAction={() => setActiveTab("calculator")}
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estimate Name</TableHead>
                        <TableHead>Vessel</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Net Profit</TableHead>
                        <TableHead>TCE / Day</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {estimations.map((est) => (
                        <TableRow key={est.id}>
                          <TableCell className="font-medium">{est.estimationName}</TableCell>
                          <TableCell>{est.vesselName}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {est.loadPort} <ArrowRight className="w-3 h-3 text-muted-foreground" /> {est.dischargePort}
                            </div>
                          </TableCell>
                          <TableCell>{est.cargoQuantity} MT {est.cargoType}</TableCell>
                          <TableCell className={est.netProfit && est.netProfit >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {formatCurrency(est.netProfit || 0)}
                          </TableCell>
                          <TableCell className="font-bold text-primary">
                            {formatCurrency(est.tce || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => loadEstimate(est)}>
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(est.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
