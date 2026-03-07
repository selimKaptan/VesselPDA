import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Package, 
  Plus, 
  Trash2, 
  Loader2, 
  ArrowRight, 
  Calendar, 
  Anchor, 
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreVertical,
  History,
  Link as LinkIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { EmptyState } from "@/components/empty-state";
import { fmtDate } from "@/lib/formatDate";
import { CargoOrder, VesselOpening } from "@shared/schema";

const STATUS_OPTIONS = [
  { value: "open", label: "Open", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "negotiating", label: "Negotiating", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  { value: "fixed", label: "Fixed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  { value: "failed", label: "Failed", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  { value: "cancelled", label: "Cancelled", color: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300" },
];

const UNIT_OPTIONS = ["MT", "CBM", "TEU", "Units", "BBL", "Lot"];
const BASIS_OPTIONS = ["PWWD", "PMPR", "Lump Sum", "per day"];

export default function OrderBookPage() {
  const { toast } = useToast();
  const [cargoDialogOpen, setCargoDialogOpen] = useState(false);
  const [vesselDialogOpen, setVesselDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("cargo");

  const { data: summary } = useQuery<{ openCargoOrders: number; openVesselPositions: number; fixedThisWeek: number; failedOrders: number }>({
    queryKey: ["/api/order-book/summary"],
  });

  const { data: cargoOrders = [], isLoading: isLoadingCargo } = useQuery<CargoOrder[]>({
    queryKey: ["/api/order-book/cargo-orders"],
  });

  const { data: vesselOpenings = [], isLoading: isLoadingVessels } = useQuery<VesselOpening[]>({
    queryKey: ["/api/order-book/vessel-openings"],
  });

  const { data: vessels = [] } = useQuery<any[]>({
    queryKey: ["/api/vessels"],
  });

  const cargoMutation = useMutation({
    mutationFn: async (values: any) => apiRequest("POST", "/api/order-book/cargo-orders", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/order-book/cargo-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-book/summary"] });
      setCargoDialogOpen(false);
      toast({ title: "Cargo order created" });
    },
  });

  const vesselMutation = useMutation({
    mutationFn: async (values: any) => apiRequest("POST", "/api/order-book/vessel-openings", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/order-book/vessel-openings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-book/summary"] });
      setVesselDialogOpen(false);
      toast({ title: "Vessel position created" });
    },
  });

  const updateCargoStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => 
      apiRequest("PATCH", `/api/order-book/cargo-orders/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/order-book/cargo-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-book/summary"] });
      toast({ title: "Status updated" });
    },
  });

  const updateVesselStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => 
      apiRequest("PATCH", `/api/order-book/vessel-openings/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/order-book/vessel-openings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/order-book/summary"] });
      toast({ title: "Status updated" });
    },
  });

  const getStatusBadge = (status: string) => {
    const opt = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];
    return <Badge className={opt.color}>{opt.label}</Badge>;
  };

  const calculateRemainingDays = (date: string | Date | null) => {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  const getDayBadge = (days: number | null) => {
    if (days === null) return null;
    if (days < 0) return <Badge variant="outline" className="text-red-500 border-red-200">Expired</Badge>;
    if (days <= 3) return <Badge variant="outline" className="text-amber-500 border-amber-200">{days}d left</Badge>;
    return <Badge variant="outline" className="text-blue-500 border-blue-200">{days}d left</Badge>;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <PageMeta title="Order Book | VesselPDA" description="Manage cargo orders and vessel positions" />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Package className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-serif">Order Book</h1>
            <p className="text-sm text-muted-foreground">Private Cargo Orders & Vessel Positions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setCargoDialogOpen(true)} data-testid="button-new-cargo-order">
            <Plus className="w-4 h-4 mr-2" /> New Cargo Order
          </Button>
          <Button variant="outline" onClick={() => setVesselDialogOpen(true)} data-testid="button-new-vessel-position">
            <Plus className="w-4 h-4 mr-2" /> New Position
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-elevate">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Open Cargo Orders</p>
                <h3 className="text-2xl font-bold">{summary?.openCargoOrders ?? 0}</h3>
              </div>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Open Positions</p>
                <h3 className="text-2xl font-bold">{summary?.openVesselPositions ?? 0}</h3>
              </div>
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <Anchor className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Fixed This Week</p>
                <h3 className="text-2xl font-bold">{summary?.fixedThisWeek ?? 0}</h3>
              </div>
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Failed/Cancelled</p>
                <h3 className="text-2xl font-bold">{summary?.failedOrders ?? 0}</h3>
              </div>
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="cargo" className="w-full" onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="cargo" className="flex items-center gap-2">
              <Package className="w-4 h-4" /> Cargo Orders
            </TabsTrigger>
            <TabsTrigger value="vessel" className="flex items-center gap-2">
              <Anchor className="w-4 h-4" /> Vessel Positions
            </TabsTrigger>
            <TabsTrigger value="match" className="flex items-center gap-2">
              <History className="w-4 h-4" /> Match Board
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="cargo" className="mt-0">
          {isLoadingCargo ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : cargoOrders.length === 0 ? (
            <EmptyState 
              icon="📦" 
              title="No Cargo Orders" 
              description="Start by adding your first private cargo order inquiry." 
              onAction={() => setCargoDialogOpen(true)}
              actionLabel="Add Cargo Order"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cargoOrders.map((order) => (
                <Card key={order.id} className="hover-elevate group overflow-visible" data-testid={`order-card-${order.id}`}>
                  <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">{order.orderRef || `ORD-${order.id}`}</Badge>
                        {getStatusBadge(order.status || "open")}
                      </div>
                      <CardTitle className="text-base line-clamp-1">{order.cargoType}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <span className="font-semibold text-foreground">{order.quantity?.toLocaleString()} {order.quantityUnit}</span>
                        <span>•</span>
                        <span>{order.charterer || "Direct Charterer"}</span>
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => updateCargoStatus.mutate({ id: order.id, status: "negotiating" })}>
                          Move to Negotiating
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateCargoStatus.mutate({ id: order.id, status: "fixed" })}>
                          Mark as Fixed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateCargoStatus.mutate({ id: order.id, status: "failed" })} className="text-red-600">
                          Mark as Failed
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex-1 flex items-center gap-1.5 p-2 bg-muted/30 rounded-md">
                        <span className="font-medium truncate">{order.loadPort || "TBN"}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{order.dischargePort || "TBN"}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Laycan
                        </p>
                        <p className="font-medium flex items-center gap-2">
                          {fmtDate(order.laycanFrom)}
                          {getDayBadge(calculateRemainingDays(order.laycanFrom))}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Freight Idea</p>
                        <p className="font-medium">
                          {order.freightIdea ? `${order.freightIdea.toLocaleString()} ${order.freightCurrency}` : "N/A"}
                          <span className="text-[10px] text-muted-foreground ml-1">{order.freightBasis}</span>
                        </p>
                      </div>
                    </div>
                    {order.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2 border-t pt-2">{order.notes}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="vessel" className="mt-0">
          {isLoadingVessels ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : vesselOpenings.length === 0 ? (
            <EmptyState 
              icon="⚓" 
              title="No Vessel Positions" 
              description="Add vessel availability and opening ports to your order book." 
              onAction={() => setVesselDialogOpen(true)}
              actionLabel="Add Position"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vesselOpenings.map((opening) => (
                <Card key={opening.id} className="hover-elevate overflow-visible" data-testid={`vessel-card-${opening.id}`}>
                  <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">{opening.openingRef || `POS-${opening.id}`}</Badge>
                        {getStatusBadge(opening.status || "open")}
                      </div>
                      <CardTitle className="text-base line-clamp-1">{opening.vesselName}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <span className="font-semibold text-foreground">{opening.dwt?.toLocaleString()} DWT</span>
                        <span>•</span>
                        <span>{opening.vesselType}</span>
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => updateVesselStatus.mutate({ id: opening.id, status: "negotiating" })}>
                          Move to Negotiating
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateVesselStatus.mutate({ id: opening.id, status: "fixed" })}>
                          Mark as Fixed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateVesselStatus.mutate({ id: opening.id, status: "withdrawn" })} className="text-red-600">
                          Withdraw Position
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-3">
                    <div className="p-2 bg-muted/30 rounded-md">
                      <div className="flex items-center gap-2 text-sm mb-1">
                        <Anchor className="w-3.5 h-3.5 text-primary" />
                        <span className="font-medium">{opening.openPort || "TBN"}</span>
                        <span className="text-muted-foreground text-xs">({opening.openArea})</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>Opening: {fmtDate(opening.openDate)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Hire Idea</p>
                        <p className="font-medium">
                          {opening.hireIdea ? `${opening.hireIdea.toLocaleString()} ${opening.hireCurrency}` : "N/A"}
                          <span className="text-[10px] text-muted-foreground ml-1">{opening.hireBasis}</span>
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-muted-foreground">Owner</p>
                        <p className="font-medium truncate">{opening.owner || "Private"}</p>
                      </div>
                    </div>
                    {opening.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2 border-t pt-2">{opening.notes}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="match" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-500" /> Open Cargo
                </h3>
                <Badge variant="outline">{cargoOrders.filter(o => o.status === "open").length} Open</Badge>
              </div>
              <div className="space-y-3">
                {cargoOrders.filter(o => o.status === "open").map(order => (
                  <Card key={order.id} className="p-3 border-l-4 border-l-blue-500 hover-elevate cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-sm">{order.cargoType}</h4>
                      <span className="text-[10px] font-mono">{order.orderRef}</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1.5">
                        <ArrowRight className="w-3 h-3" /> {order.loadPort} → {order.dischargePort}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> {fmtDate(order.laycanFrom)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Filter className="w-3 h-3" /> {order.quantity?.toLocaleString()} {order.quantityUnit}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Anchor className="w-5 h-5 text-amber-500" /> Open Positions
                </h3>
                <Badge variant="outline">{vesselOpenings.filter(o => o.status === "open").length} Open</Badge>
              </div>
              <div className="space-y-3">
                {vesselOpenings.filter(o => o.status === "open").map(pos => (
                  <Card key={pos.id} className="p-3 border-l-4 border-l-amber-500 hover-elevate cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-sm">{pos.vesselName}</h4>
                      <span className="text-[10px] font-mono">{pos.openingRef}</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {pos.openPort} ({pos.openArea})
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" /> {fmtDate(pos.openDate)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Filter className="w-3 h-3" /> {pos.dwt?.toLocaleString()} DWT • {pos.vesselType}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-8 flex flex-col items-center justify-center p-12 bg-muted/20 border-2 border-dashed rounded-xl">
             <AlertCircle className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
             <h3 className="text-lg font-medium">Smart Match Discovery</h3>
             <p className="text-sm text-muted-foreground text-center max-w-md mt-2">
               Select an order and a position to check compatibility score. Our system will analyze DWT capacity, distance from open port to load port, and laycan timing.
             </p>
             <Button variant="outline" className="mt-6" disabled>
               Run Match Analysis
             </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Cargo Order Dialog */}
      <Dialog open={cargoDialogOpen} onOpenChange={setCargoDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Cargo Order Enquiry</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const values = Object.fromEntries(formData.entries());
            cargoMutation.mutate({
              ...values,
              quantity: values.quantity ? parseFloat(values.quantity as string) : null,
              freightIdea: values.freightIdea ? parseFloat(values.freightIdea as string) : null,
              dwtMin: values.dwtMin ? parseFloat(values.dwtMin as string) : null,
              dwtMax: values.dwtMax ? parseFloat(values.dwtMax as string) : null,
              laycanFrom: values.laycanFrom ? new Date(values.laycanFrom as string).toISOString() : null,
              laycanTo: values.laycanTo ? new Date(values.laycanTo as string).toISOString() : null,
            });
          }}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="orderRef">Reference Number</Label>
                <Input id="orderRef" name="orderRef" placeholder="e.g. C-2026-001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cargoType">Cargo Type *</Label>
                <Input id="cargoType" name="cargoType" required placeholder="e.g. Iron Ore, Wheat" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" name="quantity" type="number" step="any" placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantityUnit">Unit</Label>
                <Select name="quantityUnit" defaultValue="MT">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="loadPort">Load Port</Label>
                <Input id="loadPort" name="loadPort" placeholder="City or Port Name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dischargePort">Discharge Port</Label>
                <Input id="dischargePort" name="dischargePort" placeholder="City or Port Name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="laycanFrom">Laycan From</Label>
                <Input id="laycanFrom" name="laycanFrom" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="laycanTo">Laycan To</Label>
                <Input id="laycanTo" name="laycanTo" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="freightIdea">Freight Idea</Label>
                <Input id="freightIdea" name="freightIdea" type="number" step="any" placeholder="Rate" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="freightBasis">Basis</Label>
                <Select name="freightBasis" defaultValue="PWWD">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BASIS_OPTIONS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="charterer">Charterer Name</Label>
                <Input id="charterer" name="charterer" placeholder="Company Name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chartererContact">Charterer Contact</Label>
                <Input id="chartererContact" name="chartererContact" placeholder="Name, Email or Phone" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="notes">Special Requirements / Notes</Label>
                <Textarea id="notes" name="notes" placeholder="Additional details, restrictions, etc." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCargoDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={cargoMutation.isPending}>
                {cargoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Create Cargo Order"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vessel Position Dialog */}
      <Dialog open={vesselDialogOpen} onOpenChange={setVesselDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Vessel Opening / Position</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const values = Object.fromEntries(formData.entries());
            vesselMutation.mutate({
              ...values,
              vesselId: values.vesselId ? parseInt(values.vesselId as string) : null,
              dwt: values.dwt ? parseFloat(values.dwt as string) : null,
              builtYear: values.builtYear ? parseInt(values.builtYear as string) : null,
              hireIdea: values.hireIdea ? parseFloat(values.hireIdea as string) : null,
              openDate: values.openDate ? new Date(values.openDate as string).toISOString() : null,
            });
          }}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="vesselId">Select from Fleet (Optional)</Label>
                <Select name="vesselId">
                  <SelectTrigger><SelectValue placeholder="Search your fleet..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Manual Entry</SelectItem>
                    {vessels.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vesselName">Vessel Name *</Label>
                <Input id="vesselName" name="vesselName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vesselType">Vessel Type</Label>
                <Input id="vesselType" name="vesselType" placeholder="Bulk, Tanker, etc." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dwt">DWT</Label>
                <Input id="dwt" name="dwt" type="number" step="any" placeholder="Capacity" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="builtYear">Year Built</Label>
                <Input id="builtYear" name="builtYear" type="number" placeholder="YYYY" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="openPort">Opening Port *</Label>
                <Input id="openPort" name="openPort" required placeholder="Where will it be free?" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="openArea">Opening Area</Label>
                <Input id="openArea" name="openArea" placeholder="e.g. USG, MED, FE" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="openDate">Opening Date</Label>
                <Input id="openDate" name="openDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hireIdea">Hire Idea</Label>
                <Input id="hireIdea" name="hireIdea" type="number" step="any" placeholder="Rate" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner">Owner / Disponent Owner</Label>
                <Input id="owner" name="owner" placeholder="Company Name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerContact">Owner Contact</Label>
                <Input id="ownerContact" name="ownerContact" placeholder="Name/Email" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="notes">Additional Position Details</Label>
                <Textarea id="notes" name="notes" placeholder="Restrictions, speed/cons, etc." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVesselDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={vesselMutation.isPending}>
                {vesselMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Post Position"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
