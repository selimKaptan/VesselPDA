import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { 
  Fuel, Plus, Search, Trash2, Edit2, Calendar, 
  ArrowUpRight, BarChart3, TrendingUp, History, 
  Ship, MapPin, BadgeDollarSign, Info, CheckCircle2, Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBunkerOrderSchema, insertBunkerRobSchema, type BunkerOrder, type BunkerRob, type Vessel, type Voyage } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fmtDate } from "@/lib/formatDate";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const FUEL_TYPES = [
  { value: "HFO", label: "HFO (High Fuel Oil)" },
  { value: "MGO", label: "MGO (Marine Gas Oil)" },
  { value: "LSFO", label: "LSFO (Low Sulphur Fuel Oil)" },
  { value: "VLSFO", label: "VLSFO (Very Low Sulphur Fuel Oil)" },
  { value: "LNG", label: "LNG (Liquefied Natural Gas)" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ordered: { label: "Ordered", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  delivered: { label: "Delivered", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  invoiced: { label: "Invoiced", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  paid: { label: "Paid", color: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
};

export default function BunkerManagement() {
  const { toast } = useToast();
  const [selectedVesselId, setSelectedVesselId] = useState<number | null>(null);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isRobDialogOpen, setIsRobDialogOpen] = useState(false);

  const { data: vessels } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
  });

  // Set default vessel
  if (!selectedVesselId && vessels && vessels.length > 0) {
    setSelectedVesselId(vessels[0].id);
  }

  const { data: orders, isLoading: isLoadingOrders } = useQuery<BunkerOrder[]>({
    queryKey: [`/api/bunker/vessels/${selectedVesselId}/bunker-orders`],
    enabled: !!selectedVesselId,
  });

  const { data: robs, isLoading: isLoadingRobs } = useQuery<BunkerRob[]>({
    queryKey: [`/api/bunker/vessels/${selectedVesselId}/bunker-robs`],
    enabled: !!selectedVesselId,
  });

  const { data: stats } = useQuery<any>({
    queryKey: [`/api/bunker/vessels/${selectedVesselId}/bunker-stats`],
    enabled: !!selectedVesselId,
  });

  const { data: voyages } = useQuery<Voyage[]>({
    queryKey: ["/api/voyages"],
  });

  const orderForm = useForm({
    resolver: zodResolver(insertBunkerOrderSchema),
    defaultValues: {
      fuelType: "VLSFO",
      quantityOrdered: 0,
      pricePerMt: 0,
      currency: "USD",
      port: "",
      supplier: "",
      status: "ordered",
      orderDate: new Date().toISOString().split('T')[0],
    },
  });

  const robForm = useForm({
    resolver: zodResolver(insertBunkerRobSchema),
    defaultValues: {
      reportDate: new Date().toISOString().split('T')[0],
      hfoRob: 0,
      mgoRob: 0,
      vlsfoRob: 0,
      lsfoRob: 0,
      hfoConsumed: 0,
      mgoConsumed: 0,
      vlsfoConsumed: 0,
      lsfoConsumed: 0,
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/bunker/vessels/${selectedVesselId}/bunker-orders`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bunker/vessels/${selectedVesselId}/bunker-orders`] });
      queryClient.invalidateQueries({ queryKey: [`/api/bunker/vessels/${selectedVesselId}/bunker-stats`] });
      setIsOrderDialogOpen(false);
      toast({ title: "Success", description: "Bunker order created" });
    },
  });

  const createRobMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/bunker/vessels/${selectedVesselId}/bunker-robs`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bunker/vessels/${selectedVesselId}/bunker-robs`] });
      queryClient.invalidateQueries({ queryKey: [`/api/bunker/vessels/${selectedVesselId}/bunker-stats`] });
      setIsRobDialogOpen(false);
      toast({ title: "Success", description: "ROB report recorded" });
    },
  });

  const deliverOrderMutation = useMutation({
    mutationFn: async ({ id, quantityDelivered, bdnNumber }: { id: number; quantityDelivered: number; bdnNumber: string }) => {
      const res = await apiRequest("PATCH", `/api/bunker/bunker-orders/${id}`, { 
        quantityDelivered, 
        bdnNumber, 
        status: "delivered",
        deliveryDate: new Date().toISOString()
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bunker/vessels/${selectedVesselId}/bunker-orders`] });
      queryClient.invalidateQueries({ queryKey: [`/api/bunker/vessels/${selectedVesselId}/bunker-stats`] });
      toast({ title: "Delivered", description: "Bunker delivery confirmed" });
    },
  });

  const chartData = [...(robs || [])].reverse().map(r => ({
    date: fmtDate(r.reportDate),
    HFO: r.hfoRob,
    MGO: r.mgoRob,
    VLSFO: r.vlsfoRob,
    Total: (r.hfoRob || 0) + (r.mgoRob || 0) + (r.vlsfoRob || 0) + (r.lsfoRob || 0)
  }));

  if (!selectedVesselId) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
        <Ship className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
        <h2 className="text-xl font-semibold">No vessels found</h2>
        <p className="text-muted-foreground mt-2">Please add a vessel to start managing bunkers.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Fuel className="w-8 h-8 text-sky-500" />
            Bunker Management
          </h1>
          <p className="text-muted-foreground mt-1">Monitor fuel inventory, track orders, and manage consumption.</p>
        </div>

        <div className="flex items-center gap-3">
          <Select 
            value={selectedVesselId.toString()} 
            onValueChange={(val) => setSelectedVesselId(parseInt(val))}
          >
            <SelectTrigger className="w-[200px] bg-background/50 border-sidebar-border/40">
              <SelectValue placeholder="Select Vessel" />
            </SelectTrigger>
            <SelectContent>
              {vessels?.map(v => (
                <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur border-sidebar-border/40 overflow-hidden relative group hover:border-sky-500/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Current VLSFO ROB</p>
                <h2 className="text-3xl font-bold font-mono">{stats?.latestRob?.vlsfoRob || 0} MT</h2>
              </div>
              <div className="p-2 bg-sky-500/10 rounded-lg group-hover:bg-sky-500/20 transition-colors">
                <Fuel className="w-5 h-5 text-sky-500" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Last report: {stats?.lastReportDate ? fmtDate(stats.lastReportDate) : 'Never'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-sidebar-border/40 overflow-hidden relative group hover:border-emerald-500/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Current MGO ROB</p>
                <h2 className="text-3xl font-bold font-mono text-emerald-500">{stats?.latestRob?.mgoRob || 0} MT</h2>
              </div>
              <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                <Fuel className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Marine Gas Oil levels</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-sidebar-border/40 overflow-hidden relative group hover:border-amber-500/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Fuel Cost</p>
                <h2 className="text-3xl font-bold font-mono text-amber-500">${stats?.totalCost?.toLocaleString() || 0}</h2>
              </div>
              <div className="p-2 bg-amber-500/10 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                <BadgeDollarSign className="w-5 h-5 text-amber-500" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Cumulative order value</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-sidebar-border/40 overflow-hidden relative group hover:border-purple-500/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Delivered</p>
                <h2 className="text-3xl font-bold font-mono text-purple-500">{stats?.totalDelivered?.toLocaleString() || 0} MT</h2>
              </div>
              <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">{stats?.orderCount || 0} delivery operations</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="orders" className="space-y-6">
        <div className="flex justify-between items-center">
          <TabsList className="bg-card/50 backdrop-blur border-sidebar-border/40">
            <TabsTrigger value="orders" className="gap-2">
              <History className="w-4 h-4" /> Bunker Orders
            </TabsTrigger>
            <TabsTrigger value="robs" className="gap-2">
              <BarChart3 className="w-4 h-4" /> ROB & Consumption
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-sky-600 hover:bg-sky-500 gap-2">
                  <Plus className="w-4 h-4" /> New Order
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg bg-card/95 backdrop-blur-xl border-sidebar-border/40">
                <DialogHeader>
                  <DialogTitle>Create Bunker Order</DialogTitle>
                  <DialogDescription>Place a new fuel order for {vessels?.find(v => v.id === selectedVesselId)?.name}</DialogDescription>
                </DialogHeader>
                <Form {...orderForm}>
                  <form onSubmit={orderForm.handleSubmit((data) => createOrderMutation.mutate(data))} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={orderForm.control}
                        name="fuelType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fuel Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select fuel type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {FUEL_TYPES.map(f => (
                                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={orderForm.control}
                        name="quantityOrdered"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity (MT)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={orderForm.control}
                        name="pricePerMt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Price per MT</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={orderForm.control}
                        name="currency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Currency</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="USD" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={orderForm.control}
                        name="port"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delivery Port</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Istanbul" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={orderForm.control}
                        name="orderDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Order Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} value={typeof field.value === 'string' ? field.value.split('T')[0] : ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={orderForm.control}
                      name="supplier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Supplier</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Bunker One" {...field} value={field.value || ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button type="submit" disabled={createOrderMutation.isPending} className="w-full bg-sky-600 hover:bg-sky-500">
                        {createOrderMutation.isPending ? "Creating..." : "Create Order"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={isRobDialogOpen} onOpenChange={setIsRobDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2 border-sidebar-border/40">
                  <Plus className="w-4 h-4" /> Add ROB Report
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg bg-card/95 backdrop-blur-xl border-sidebar-border/40">
                <DialogHeader>
                  <DialogTitle>New ROB Report</DialogTitle>
                  <DialogDescription>Record current tank levels and consumption for {vessels?.find(v => v.id === selectedVesselId)?.name}</DialogDescription>
                </DialogHeader>
                <Form {...robForm}>
                  <form onSubmit={robForm.handleSubmit((data) => createRobMutation.mutate(data))} className="space-y-6 py-4">
                    <FormField
                      control={robForm.control}
                      name="reportDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Report Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={typeof field.value === 'string' ? field.value.split('T')[0] : ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <Fuel className="w-4 h-4" /> Remaining (ROB)
                        </h3>
                        <FormField
                          control={robForm.control}
                          name="vlsfoRob"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">VLSFO (MT)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.1" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={robForm.control}
                          name="mgoRob"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">MGO (MT)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.1" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" /> Consumption
                        </h3>
                        <FormField
                          control={robForm.control}
                          name="vlsfoConsumed"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">VLSFO Cons. (MT)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.1" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={robForm.control}
                          name="mgoConsumed"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">MGO Cons. (MT)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.1" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button type="submit" disabled={createRobMutation.isPending} className="w-full">
                        {createRobMutation.isPending ? "Recording..." : "Record Report"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <TabsContent value="orders" className="mt-0">
          <Card className="border-sidebar-border/40 bg-card/30 backdrop-blur-sm">
            <CardHeader className="pb-0 pt-6 px-6 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Order History</CardTitle>
                <CardDescription>Fuel orders and delivery status</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search orders..." className="pl-9 bg-background/50 border-sidebar-border/40 h-9" />
              </div>
            </CardHeader>
            <CardContent className="p-0 mt-6">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[100px]">Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingOrders ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={9}><Skeleton className="h-8 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : orders?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-48 text-center text-muted-foreground">
                        No bunker orders found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders?.map((order) => (
                      <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-xs">
                          {order.orderDate ? fmtDate(order.orderDate) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-background">
                            {order.fuelType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            {order.port || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{order.supplier || "-"}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{order.quantityOrdered} MT</TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-500 font-bold">
                          {order.quantityDelivered ? `${order.quantityDelivered} MT` : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {order.currency} {order.pricePerMt?.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${STATUS_CONFIG[order.status || 'ordered'].color}`}>
                            {STATUS_CONFIG[order.status || 'ordered'].label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {order.status === 'ordered' && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 px-2 text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                onClick={() => {
                                  const qty = prompt("Delivered quantity (MT):", order.quantityOrdered.toString());
                                  const bdn = prompt("BDN Number:");
                                  if (qty && bdn) {
                                    deliverOrderMutation.mutate({ id: order.id, quantityDelivered: parseFloat(qty), bdnNumber: bdn });
                                  }
                                }}
                              >
                                Deliver
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="robs" className="mt-0 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-sidebar-border/40 bg-card/30 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-sky-500" />
                  Inventory Trend (ROB)
                </CardTitle>
                <CardDescription>Historical fuel levels remaining on board</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}MT`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }}
                        itemStyle={{ color: '#f8fafc' }}
                      />
                      <Area type="monotone" dataKey="Total" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-sidebar-border/40 bg-card/30 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="w-4 h-4 text-sky-500" />
                  Latest ROB Status
                </CardTitle>
                <CardDescription>Breakdown by fuel type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "VLSFO", value: stats?.latestRob?.vlsfoRob || 0, color: "bg-sky-500", icon: Fuel },
                  { label: "MGO", value: stats?.latestRob?.mgoRob || 0, color: "bg-emerald-500", icon: Fuel },
                  { label: "HFO", value: stats?.latestRob?.hfoRob || 0, color: "bg-amber-500", icon: Fuel },
                  { label: "LSFO", value: stats?.latestRob?.lsfoRob || 0, color: "bg-slate-400", icon: Fuel },
                ].map((fuel, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${fuel.color}`} />
                        {fuel.label}
                      </span>
                      <span className="font-mono">{fuel.value} MT</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${fuel.color} rounded-full transition-all duration-500`} 
                        style={{ width: `${Math.min(100, (fuel.value / 1000) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}

                <div className="pt-4 border-t border-sidebar-border/40">
                  <div className="flex justify-between items-center bg-sky-500/10 p-3 rounded-lg border border-sky-500/20">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-sky-500 tracking-wider">Total Inventory</p>
                      <p className="text-xl font-bold font-mono">
                        {((stats?.latestRob?.vlsfoRob || 0) + (stats?.latestRob?.mgoRob || 0) + (stats?.latestRob?.hfoRob || 0) + (stats?.latestRob?.lsfoRob || 0)).toFixed(1)} MT
                      </p>
                    </div>
                    <TrendingUp className="w-6 h-6 text-sky-500 opacity-50" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-sidebar-border/40 bg-card/30 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">ROB Reports History</CardTitle>
                <CardDescription>Daily/Weekly fuel status reports</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">VLSFO ROB</TableHead>
                    <TableHead className="text-right">MGO ROB</TableHead>
                    <TableHead className="text-right">HFO ROB</TableHead>
                    <TableHead className="text-right">VLSFO Cons.</TableHead>
                    <TableHead className="text-right">MGO Cons.</TableHead>
                    <TableHead className="text-right">Total Cons.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingRobs ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : robs?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        No ROB reports found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    robs?.map((rob) => (
                      <TableRow key={rob.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-xs font-mono">{fmtDate(rob.reportDate)}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{rob.vlsfoRob} MT</TableCell>
                        <TableCell className="text-right text-xs font-mono">{rob.mgoRob} MT</TableCell>
                        <TableCell className="text-right text-xs font-mono">{rob.hfoRob} MT</TableCell>
                        <TableCell className="text-right text-xs font-mono text-amber-500">{rob.vlsfoConsumed} MT</TableCell>
                        <TableCell className="text-right text-xs font-mono text-amber-500">{rob.mgoConsumed} MT</TableCell>
                        <TableCell className="text-right text-xs font-mono font-bold">
                          {((rob.vlsfoConsumed || 0) + (rob.mgoConsumed || 0) + (rob.hfoConsumed || 0) + (rob.lsfoConsumed || 0)).toFixed(1)} MT
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
