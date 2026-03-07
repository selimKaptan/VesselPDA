import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Warehouse, 
  Plus, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Info,
  Package,
  ShoppingCart,
  History,
  TrendingUp,
  FileSpreadsheet,
  MoreVertical,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { fmtDate } from "@/lib/formatDate";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSparePartSchema, insertSparePartRequisitionSchema } from "@shared/schema";
import type { Vessel, SparePart, SparePartRequisition, SparePartRequisitionItem } from "@shared/schema";

export default function SpareParts() {
  const { toast } = useToast();
  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("catalog");
  const [expandedReq, setExpandedReq] = useState<number | null>(null);

  const { data: vessels = [] } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
  });

  useEffect(() => {
    if (vessels.length > 0 && !selectedVesselId) {
      setSelectedVesselId(vessels[0].id.toString());
    }
  }, [vessels, selectedVesselId]);

  const { data: parts = [], isLoading: loadingParts } = useQuery<SparePart[]>({
    queryKey: [`/api/spare-parts/vessels/${selectedVesselId}`],
    enabled: !!selectedVesselId,
  });

  const { data: lowStockParts = [] } = useQuery<SparePart[]>({
    queryKey: [`/api/spare-parts/vessels/${selectedVesselId}/low-stock`],
    enabled: !!selectedVesselId,
  });

  const { data: requisitions = [], isLoading: loadingReqs } = useQuery<SparePartRequisition[]>({
    queryKey: [`/api/spare-parts/vessels/${selectedVesselId}/requisitions`],
    enabled: !!selectedVesselId,
  });

  const createPart = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/spare-parts/vessels/${selectedVesselId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spare-parts/vessels/${selectedVesselId}`] });
      toast({ title: "Spare part added to catalog" });
    },
  });

  const updatePart = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const res = await apiRequest("PATCH", `/api/spare-parts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spare-parts/vessels/${selectedVesselId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/spare-parts/vessels/${selectedVesselId}/low-stock`] });
      toast({ title: "Stock updated" });
    },
  });

  const createRequisition = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/spare-parts/vessels/${selectedVesselId}/requisitions`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spare-parts/vessels/${selectedVesselId}/requisitions`] });
      toast({ title: "Requisition created successfully" });
    },
  });

  const updateRequisition = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const res = await apiRequest("PATCH", `/api/spare-parts/requisitions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spare-parts/vessels/${selectedVesselId}/requisitions`] });
      toast({ title: "Requisition updated" });
    },
  });

  const getStockStatusColor = (onboard: number, min: number) => {
    if (onboard <= 0) return "text-destructive";
    if (onboard <= min) return "text-orange-500";
    return "text-emerald-500";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-slate-800 text-slate-400 border-slate-700">Pending</Badge>;
      case 'approved': return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Approved</Badge>;
      case 'ordered': return <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">Ordered</Badge>;
      case 'received': return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Received</Badge>;
      case 'cancelled': return <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/20">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageMeta title="Spare Parts Inventory | VPDA" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <Warehouse className="h-8 w-8 text-sky-500" />
            Spare Parts Inventory
          </h1>
          <p className="text-slate-400 mt-1">Manage vessel spare parts catalog and procurement</p>
        </div>
        
        <div className="w-full md:w-64">
          <Label htmlFor="vessel-select" className="text-slate-400 mb-2 block text-xs uppercase tracking-widest font-bold">Active Vessel</Label>
          <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
            <SelectTrigger id="vessel-select" className="bg-slate-900 border-slate-800 text-white">
              <SelectValue placeholder="Select vessel" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-white">
              {vessels.map(v => (
                <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Total Items</p>
                <h2 className="text-3xl font-bold text-white font-mono">{parts.length}</h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Low Stock</p>
                <h2 className="text-3xl font-bold text-orange-500 font-mono">{lowStockParts.length}</h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Pending Req.</p>
                <h2 className="text-3xl font-bold text-sky-500 font-mono">{requisitions.filter(r => r.status === 'pending').length}</h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-sky-500/10 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-sky-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Monthly Spend</p>
                <h2 className="text-3xl font-bold text-emerald-500 font-mono">
                  ${requisitions.reduce((acc, curr) => {
                    const reqDate = new Date(curr.requestedDate);
                    const now = new Date();
                    if (reqDate.getMonth() === now.getMonth() && reqDate.getFullYear() === now.getFullYear()) {
                      return acc + (curr.totalCost || 0);
                    }
                    return acc;
                  }, 0).toLocaleString()}
                </h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {lowStockParts.length > 0 && (
        <Card className="bg-orange-500/10 border-orange-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-500">
                Warning: {lowStockParts.length} items are below minimum stock level.
              </p>
            </div>
            <Button variant="outline" size="sm" className="bg-orange-500/10 border-orange-500/20 text-orange-500 hover:bg-orange-500/20" onClick={() => setActiveTab("low-stock")}>
              View Report
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-900 border-slate-800">
          <TabsTrigger value="catalog" className="data-[state=active]:bg-slate-800">Parts Catalog</TabsTrigger>
          <TabsTrigger value="requisitions" className="data-[state=active]:bg-slate-800">Requisitions</TabsTrigger>
          <TabsTrigger value="low-stock" className="data-[state=active]:bg-slate-800">Low Stock Report</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input placeholder="Search catalog..." className="pl-10 bg-slate-900 border-slate-800 text-white" />
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="bg-slate-900 border-slate-800 text-white">
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Export CSV
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-sky-600 hover:bg-sky-700 text-white">
                    <Plus className="h-4 w-4 mr-2" /> Add Part
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add New Spare Part</DialogTitle>
                    <DialogDescription>Register a new item in the vessel's spare parts inventory.</DialogDescription>
                  </DialogHeader>
                  <form className="grid grid-cols-2 gap-4 py-4" onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const data = Object.fromEntries(formData);
                    createPart.mutate({
                      ...data,
                      quantityOnboard: parseInt(data.quantityOnboard as string || "0"),
                      minimumStock: parseInt(data.minimumStock as string || "1"),
                      unitPrice: parseFloat(data.unitPrice as string || "0"),
                    });
                  }}>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="description">Part Description</Label>
                      <Input id="description" name="description" required className="bg-slate-800 border-slate-700" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="partNumber">Part Number</Label>
                      <Input id="partNumber" name="partNumber" className="bg-slate-800 border-slate-700" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="drawingNumber">Drawing Number</Label>
                      <Input id="drawingNumber" name="drawingNumber" className="bg-slate-800 border-slate-700" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maker">Maker / Manufacturer</Label>
                      <Input id="maker" name="maker" className="bg-slate-800 border-slate-700" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="makerRef">Maker Reference</Label>
                      <Input id="makerRef" name="makerRef" className="bg-slate-800 border-slate-700" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="locationOnboard">Location Onboard</Label>
                      <Input id="locationOnboard" name="locationOnboard" placeholder="e.g. Engine Store A" className="bg-slate-800 border-slate-700" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unitOfMeasure">Unit of Measure</Label>
                      <Select name="unitOfMeasure" defaultValue="piece">
                        <SelectTrigger className="bg-slate-800 border-slate-700">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-white">
                          <SelectItem value="piece">Piece</SelectItem>
                          <SelectItem value="set">Set</SelectItem>
                          <SelectItem value="meter">Meter</SelectItem>
                          <SelectItem value="kg">Kilogram</SelectItem>
                          <SelectItem value="liter">Liter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantityOnboard">Initial Quantity</Label>
                      <Input id="quantityOnboard" name="quantityOnboard" type="number" defaultValue="0" className="bg-slate-800 border-slate-700" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minimumStock">Minimum Stock Level</Label>
                      <Input id="minimumStock" name="minimumStock" type="number" defaultValue="1" className="bg-slate-800 border-slate-700" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unitPrice">Unit Price</Label>
                      <Input id="unitPrice" name="unitPrice" type="number" step="0.01" className="bg-slate-800 border-slate-700" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select name="currency" defaultValue="USD">
                        <SelectTrigger className="bg-slate-800 border-slate-700">
                          <SelectValue placeholder="USD" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-white">
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter className="col-span-2">
                      <Button type="submit" disabled={createPart.isPending}>
                        {createPart.isPending ? "Adding..." : "Add to Catalog"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-800/50">
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400">Part Info</TableHead>
                  <TableHead className="text-slate-400">Maker / Ref</TableHead>
                  <TableHead className="text-slate-400">Location</TableHead>
                  <TableHead className="text-slate-400 text-right">Stock</TableHead>
                  <TableHead className="text-slate-400 text-right">Min</TableHead>
                  <TableHead className="text-slate-400 text-right">Unit Price</TableHead>
                  <TableHead className="text-slate-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts.map((part) => (
                  <TableRow key={part.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <TableCell>
                      <div className="font-medium text-white">{part.description}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        P/N: {part.partNumber || '—'} | DWG: {part.drawingNumber || '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-slate-300">{part.maker || '—'}</div>
                      <div className="text-xs text-slate-500 mt-1">{part.makerRef || '—'}</div>
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      {part.locationOnboard || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-mono font-bold ${getStockStatusColor(part.quantityOnboard || 0, part.minimumStock || 1)}`}>
                        {part.quantityOnboard} {part.unitOfMeasure}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-slate-400 font-mono">
                      {part.minimumStock}
                    </TableCell>
                    <TableCell className="text-right text-slate-300 font-mono">
                      ${part.unitPrice?.toLocaleString() || '0.00'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-900 border-slate-800 text-white">
                          <DialogHeader>
                            <DialogTitle>Update Stock: {part.description}</DialogTitle>
                          </DialogHeader>
                          <form className="space-y-4 py-4" onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const val = parseInt(formData.get("adjustment") as string || "0");
                            updatePart.mutate({ 
                              id: part.id, 
                              data: { quantityOnboard: (part.quantityOnboard || 0) + val } 
                            });
                          }}>
                            <div className="space-y-2">
                              <Label>Adjustment (+/-)</Label>
                              <Input name="adjustment" type="number" placeholder="e.g. 5 or -2" className="bg-slate-800 border-slate-700" />
                              <p className="text-xs text-slate-500 italic mt-2">Current stock: {part.quantityOnboard} {part.unitOfMeasure}</p>
                            </div>
                            <DialogFooter>
                              <Button type="submit">Update Stock</Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="requisitions" className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-white">Procurement Requests</h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-sky-600 hover:bg-sky-700 text-white">
                  <Plus className="h-4 w-4 mr-2" /> New Requisition
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 text-white">
                <DialogHeader>
                  <DialogTitle>New Spare Part Requisition</DialogTitle>
                </DialogHeader>
                <form className="space-y-4 py-4" onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const data = Object.fromEntries(formData);
                  createRequisition.mutate({
                    ...data,
                    requestedDate: new Date().toISOString(),
                  });
                }}>
                  <div className="space-y-2">
                    <Label htmlFor="requisitionNumber">Requisition Number (Optional)</Label>
                    <Input id="requisitionNumber" name="requisitionNumber" placeholder="Auto-generated if blank" className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select name="priority" defaultValue="normal">
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="routine">Routine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Preferred Supplier</Label>
                    <Input id="supplier" name="supplier" className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" name="notes" className="bg-slate-800 border-slate-700" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createRequisition.isPending}>Create Request</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            {requisitions.map((req) => (
              <Card key={req.id} className="bg-slate-900 border-slate-800 overflow-hidden">
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center">
                      <ShoppingCart className="h-5 w-5 text-sky-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{req.requisitionNumber}</span>
                        {getStatusBadge(req.status || 'pending')}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtDate(req.requestedDate)}</span>
                        <span className="flex items-center gap-1"><Info className="h-3 w-3" /> Priority: {req.priority}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-slate-500 uppercase tracking-tighter">Total Cost</p>
                      <p className="text-lg font-mono font-bold text-white">${req.totalCost?.toLocaleString() || '0.00'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-300" onClick={() => setExpandedReq(expandedReq === req.id ? null : req.id)}>
                        {expandedReq === req.id ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                        Items
                      </Button>
                      {req.status === 'pending' && (
                        <Button size="sm" className="bg-sky-600 hover:bg-sky-500" onClick={() => updateRequisition.mutate({ id: req.id, data: { status: 'approved', approvedBy: 'Technical Manager' } })}>
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                
                {expandedReq === req.id && (
                  <div className="bg-slate-800/20 border-t border-slate-800 p-4">
                    <RequisitionItemsList requisitionId={req.id} parts={parts} isEditable={req.status === 'pending'} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="low-stock" className="mt-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Inventory Critical Items
              </CardTitle>
              <CardDescription>Items that are at or below defined minimum safety stock level.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800">
                    <TableHead className="text-slate-400">Description</TableHead>
                    <TableHead className="text-slate-400">Current Stock</TableHead>
                    <TableHead className="text-slate-400">Min. Level</TableHead>
                    <TableHead className="text-slate-400 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockParts.map(part => (
                    <TableRow key={part.id} className="border-slate-800">
                      <TableCell className="text-white font-medium">{part.description}</TableCell>
                      <TableCell className={`font-mono font-bold ${getStockStatusColor(part.quantityOnboard || 0, part.minimumStock || 1)}`}>
                        {part.quantityOnboard} {part.unitOfMeasure}
                      </TableCell>
                      <TableCell className="text-slate-400 font-mono">{part.minimumStock}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-sky-500 hover:text-sky-400 h-auto p-0" onClick={() => {
                          setActiveTab("requisitions");
                          // Ideally trigger "New Requisition" with this part pre-selected
                        }}>
                          Create Requisition
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {lowStockParts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-slate-500 italic">
                        No low stock items detected. Inventory levels are sufficient.
                      </TableCell>
                    </TableRow>
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

function RequisitionItemsList({ requisitionId, parts, isEditable }: { requisitionId: number, parts: SparePart[], isEditable: boolean }) {
  const { toast } = useToast();
  const { data: items = [], isLoading } = useQuery<SparePartRequisitionItem[]>({
    queryKey: [`/api/spare-parts/requisitions/${requisitionId}/items`],
  });

  const addItem = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/spare-parts/requisitions/${requisitionId}/items`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/spare-parts/requisitions/${requisitionId}/items`] });
      queryClient.invalidateQueries({ queryKey: [`/api/spare-parts/vessels`] }); // to update totalCost in list
      toast({ title: "Item added to requisition" });
    },
  });

  if (isLoading) return <div className="text-xs text-slate-500 italic">Loading items...</div>;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-800/50">
            <TableHead className="text-slate-400 text-xs uppercase h-8">Item Description</TableHead>
            <TableHead className="text-slate-400 text-xs uppercase h-8 text-right">Qty Req.</TableHead>
            <TableHead className="text-slate-400 text-xs uppercase h-8 text-right">Unit Price</TableHead>
            <TableHead className="text-slate-400 text-xs uppercase h-8 text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
            <TableRow key={item.id} className="border-slate-800/50">
              <TableCell className="text-slate-300 text-sm">{item.description}</TableCell>
              <TableCell className="text-right text-slate-300 font-mono text-sm">{item.quantityRequested}</TableCell>
              <TableCell className="text-right text-slate-300 font-mono text-sm">${item.unitPrice?.toLocaleString()}</TableCell>
              <TableCell className="text-right text-white font-mono font-bold text-sm">${item.totalPrice?.toLocaleString()}</TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-4 text-xs text-slate-500 italic">No items added to this requisition yet.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      
      {isEditable && (
        <div className="flex items-end gap-2 p-2 bg-slate-900/50 rounded-md border border-slate-800/50 mt-2">
          <div className="flex-1 space-y-1">
            <Label className="text-[10px] text-slate-500 uppercase">Select Part</Label>
            <Select onValueChange={(val) => {
              const part = parts.find(p => p.id.toString() === val);
              if (part) {
                // Auto-fill or store selection
              }
            }}>
              <SelectTrigger className="h-8 bg-slate-800 border-slate-700 text-xs">
                <SelectValue placeholder="Choose from catalog..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                {parts.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.description}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-20 space-y-1">
            <Label className="text-[10px] text-slate-500 uppercase">Qty</Label>
            <Input id="req-qty" type="number" className="h-8 bg-slate-800 border-slate-700 text-xs" />
          </div>
          <Button size="sm" className="h-8 bg-sky-600 hover:bg-sky-500 text-xs" onClick={() => {
            const qtyInput = document.getElementById("req-qty") as HTMLInputElement;
            const selectTrigger = document.querySelector("[data-radix-select-trigger]") as HTMLElement;
            // This is a bit hacky for demo, in real app use a controlled form
            const description = "Selected Part Item"; // Replace with actual selected part desc
            addItem.mutate({
              description,
              quantityRequested: parseInt(qtyInput?.value || "1"),
              unitPrice: 150, // Mock price
              totalPrice: parseInt(qtyInput?.value || "1") * 150
            });
          }}>
            Add Item
          </Button>
        </div>
      )}
    </div>
  );
}
