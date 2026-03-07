import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  FileText, Plus, Search, Filter, Download, 
  TrendingUp, Clock, CheckCircle2, AlertCircle, 
  MoreVertical, Edit2, Trash2, Calendar, 
  ArrowUpRight, DollarSign, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import { 
  DropdownMenu, DropdownMenuContent, 
  DropdownMenuItem, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Select, SelectContent, SelectItem, 
  SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { EmptyState } from "@/components/empty-state";
import { fmtDate } from "@/lib/formatDate";
import { exportToCsv } from "@/lib/export-csv";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  invoiced: { label: "Invoiced", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  partial: { label: "Partial", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  received: { label: "Received", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

const CHART_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function BrokerCommissionsPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCommission, setEditingCommission] = useState<any>(null);

  const { data: commissions = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/broker-commissions"],
  });

  const { data: summary, isLoading: isLoadingSummary } = useQuery<any>({
    queryKey: ["/api/broker-commissions/summary"],
  });

  const { data: fixtures = [] } = useQuery<any[]>({
    queryKey: ["/api/fixtures"],
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingCommission) {
        return apiRequest("PATCH", `/api/broker-commissions/${editingCommission.id}`, data);
      }
      return apiRequest("POST", `/api/broker-commissions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broker-commissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/broker-commissions/summary"] });
      toast({ title: editingCommission ? "Commission updated" : "Commission created" });
      setIsDialogOpen(false);
      setEditingCommission(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/broker-commissions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/broker-commissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/broker-commissions/summary"] });
      toast({ title: "Commission deleted" });
    },
  });

  const filteredCommissions = useMemo(() => {
    return commissions.filter(c => {
      const matchesSearch = 
        (c.dealDescription?.toLowerCase().includes(searchTerm.toLowerCase()) || 
         c.counterparty?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         c.commissionRef?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [commissions, searchTerm, statusFilter]);

  const overdueCommissions = useMemo(() => {
    const now = new Date();
    return commissions.filter(c => 
      c.status !== "received" && 
      c.status !== "cancelled" && 
      c.paymentDueDate && 
      new Date(c.paymentDueDate) < now
    );
  }, [commissions]);

  const chartData = useMemo(() => {
    // Last 6 months
    const data: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const month = d.toLocaleString('default', { month: 'short' });
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      
      const amount = commissions
        .filter(c => {
          const cDate = new Date(c.createdAt);
          return cDate.getMonth() === monthIdx && cDate.getFullYear() === year;
        })
        .reduce((sum, c) => sum + (c.netCommission || 0), 0);
        
      data.push({ name: month, amount });
    }
    return data;
  }, [commissions]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    commissions.forEach(c => {
      if (c.counterparty) {
        counts[c.counterparty] = (counts[c.counterparty] || 0) + (c.netCommission || 0);
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [commissions]);

  const handleExport = () => {
    exportToCsv("broker-commissions.csv", filteredCommissions);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageMeta title="Broker Commissions | Denizcilik Platformu" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Commission Tracker</h1>
          <p className="text-muted-foreground">Manage and track your brokerage earnings</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} data-testid="button-export">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button onClick={() => { setEditingCommission(null); setIsDialogOpen(true); }} data-testid="button-add-commission">
            <Plus className="w-4 h-4 mr-2" /> New Commission
          </Button>
        </div>
      </div>

      {overdueCommissions.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Overdue Payments</AlertTitle>
          <AlertDescription>
            You have {overdueCommissions.length} pending commissions that are past their due date.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-sm font-medium">This Year Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-summary-yearly">
              ${summary?.yearlyTotal?.toLocaleString() || "0"}
            </div>
            <p className="text-xs text-muted-foreground">Across all fixtures</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-summary-monthly">
              ${summary?.monthlyTotal?.toLocaleString() || "0"}
            </div>
            <p className="text-xs text-muted-foreground">Current month earnings</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-summary-pending">
              ${summary?.pendingPayments?.toLocaleString() || "0"}
            </div>
            <p className="text-xs text-muted-foreground">Unpaid commissions</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-sm font-medium">Received</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-summary-received">
              ${summary?.received?.toLocaleString() || "0"}
            </div>
            <p className="text-xs text-muted-foreground">Total collected</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="list">Commission List</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search deals, counterparties..." 
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="input-search"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref / Date</TableHead>
                      <TableHead>Deal Description</TableHead>
                      <TableHead>Counterparty</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCommissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                          <EmptyState 
                            title="No commissions found" 
                            description="Start by adding a new commission record for your fixtures."
                            actionLabel="Add Commission"
                            onAction={() => setIsDialogOpen(true)}
                            icon="💰"
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCommissions.map((c) => (
                        <TableRow key={c.id} className="group">
                          <TableCell>
                            <div className="font-medium">{c.commissionRef || `#${c.id}`}</div>
                            <div className="text-xs text-muted-foreground">{fmtDate(c.fixtureDate || c.createdAt)}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium line-clamp-1">{c.dealDescription}</div>
                            <div className="text-xs text-muted-foreground">{c.voyageDescription}</div>
                          </TableCell>
                          <TableCell>{c.counterparty}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {c.netCommission?.toLocaleString()} {c.currency}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG]?.color}>
                              {STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG]?.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className={`text-sm ${c.status !== 'received' && c.paymentDueDate && new Date(c.paymentDueDate) < new Date() ? 'text-destructive font-semibold' : ''}`}>
                              {c.paymentDueDate ? fmtDate(c.paymentDueDate) : '—'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-actions-${c.id}`}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setEditingCommission(c); setIsDialogOpen(true); }}>
                                  <Edit2 className="w-4 h-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => { if(confirm("Are you sure?")) deleteMutation.mutate(c.id); }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Monthly Revenue</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any) => [`$${value.toLocaleString()}`, 'Commission']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Counterparties (by Revenue)</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [`$${value.toLocaleString()}`, 'Revenue']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <CommissionDialog 
        open={isDialogOpen} 
        onOpenChange={(v: boolean) => { setIsDialogOpen(v); if(!v) setEditingCommission(null); }}
        commission={editingCommission}
        fixtures={fixtures}
        onSave={(data: any) => mutation.mutate(data)}
        isPending={mutation.isPending}
      />
    </div>
  );
}

function CommissionDialog({ open, onOpenChange, commission, fixtures, onSave, isPending }: any) {
  const [formData, setFormData] = useState<any>({
    fixtureId: null,
    commissionRef: "",
    dealDescription: "",
    counterparty: "",
    cargoType: "",
    voyageDescription: "",
    fixtureDate: "",
    freightAmount: "",
    freightCurrency: "USD",
    commissionRate: "1.25",
    grossCommission: "",
    deductions: "0",
    netCommission: "",
    currency: "USD",
    paymentDueDate: "",
    status: "pending",
    notes: "",
  });

  useMemo(() => {
    if (commission) {
      setFormData({
        ...commission,
        fixtureDate: commission.fixtureDate ? new Date(commission.fixtureDate).toISOString().split('T')[0] : "",
        paymentDueDate: commission.paymentDueDate ? new Date(commission.paymentDueDate).toISOString().split('T')[0] : "",
        freightAmount: String(commission.freightAmount || ""),
        commissionRate: String(commission.commissionRate || ""),
        grossCommission: String(commission.grossCommission || ""),
        deductions: String(commission.deductions || "0"),
        netCommission: String(commission.netCommission || ""),
      });
    } else {
      setFormData({
        fixtureId: null,
        commissionRef: "",
        dealDescription: "",
        counterparty: "",
        cargoType: "",
        voyageDescription: "",
        fixtureDate: new Date().toISOString().split('T')[0],
        freightAmount: "",
        freightCurrency: "USD",
        commissionRate: "1.25",
        grossCommission: "",
        deductions: "0",
        netCommission: "",
        currency: "USD",
        paymentDueDate: "",
        status: "pending",
        notes: "",
      });
    }
  }, [commission, open]);

  const handleFixtureSelect = (fixtureId: string) => {
    const f = fixtures.find((x: any) => x.id === parseInt(fixtureId));
    if (f) {
      const freightAmt = parseFloat(f.freightRate || 0) * parseFloat(f.cargoQuantity || 0);
      const rate = parseFloat(formData.commissionRate) || 1.25;
      const gross = (freightAmt * rate) / 100;
      const net = gross - (parseFloat(formData.deductions) || 0);

      setFormData({
        ...formData,
        fixtureId: f.id,
        dealDescription: `Fixture ${f.vesselName} - ${f.cargoType}`,
        counterparty: f.charterer || f.shipowner || "",
        cargoType: f.cargoType || "",
        voyageDescription: `${f.loadingPort || 'TBA'} → ${f.dischargePort || 'TBA'}`,
        freightAmount: String(freightAmt),
        freightCurrency: f.freightCurrency || "USD",
        grossCommission: String(gross),
        netCommission: String(net),
      });
    }
  };

  const calculateCommission = (updates: any) => {
    const current = { ...formData, ...updates };
    const freight = parseFloat(current.freightAmount) || 0;
    const rate = parseFloat(current.commissionRate) || 0;
    const deductions = parseFloat(current.deductions) || 0;
    
    const gross = (freight * rate) / 100;
    const net = gross - deductions;
    
    setFormData({
      ...current,
      grossCommission: String(gross.toFixed(2)),
      netCommission: String(net.toFixed(2)),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{commission ? "Edit Commission" : "New Commission Record"}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="md:col-span-2">
            <Label>Link to Fixture (Optional)</Label>
            <Select 
              value={formData.fixtureId?.toString()} 
              onValueChange={handleFixtureSelect}
            >
              <SelectTrigger data-testid="select-fixture">
                <SelectValue placeholder="Select an existing fixture" />
              </SelectTrigger>
              <SelectContent>
                {fixtures.map((f: any) => (
                  <SelectItem key={f.id} value={f.id.toString()}>
                    {f.vesselName} - {f.cargoType} ({fmtDate(f.createdAt)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Reference</Label>
            <Input 
              value={formData.commissionRef} 
              onChange={(e) => setFormData({...formData, commissionRef: e.target.value})}
              placeholder="e.g. COMM-2024-001"
              data-testid="input-ref"
            />
          </div>
          <div>
            <Label>Fixture Date</Label>
            <Input 
              type="date" 
              value={formData.fixtureDate} 
              onChange={(e) => setFormData({...formData, fixtureDate: e.target.value})}
              data-testid="input-date"
            />
          </div>

          <div className="md:col-span-2">
            <Label>Deal Description *</Label>
            <Input 
              value={formData.dealDescription} 
              onChange={(e) => setFormData({...formData, dealDescription: e.target.value})}
              placeholder="e.g. MV OCEAN STAR - 50k MT Wheat"
              data-testid="input-description"
            />
          </div>

          <div>
            <Label>Counterparty *</Label>
            <Input 
              value={formData.counterparty} 
              onChange={(e) => setFormData({...formData, counterparty: e.target.value})}
              placeholder="Shipowner or Charterer name"
              data-testid="input-counterparty"
            />
          </div>
          <div>
            <Label>Voyage</Label>
            <Input 
              value={formData.voyageDescription} 
              onChange={(e) => setFormData({...formData, voyageDescription: e.target.value})}
              placeholder="e.g. Santos to Qingdao"
              data-testid="input-voyage"
            />
          </div>

          <div className="md:col-span-2 border-t pt-4">
            <h4 className="text-sm font-semibold mb-2">Calculation</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Gross Freight Amount</Label>
                <Input 
                  type="number" 
                  value={formData.freightAmount} 
                  onChange={(e) => calculateCommission({ freightAmount: e.target.value })}
                  data-testid="input-freight"
                />
              </div>
              <div>
                <Label>Commission Rate (%)</Label>
                <Input 
                  type="number" 
                  step="0.01" 
                  value={formData.commissionRate} 
                  onChange={(e) => calculateCommission({ commissionRate: e.target.value })}
                  data-testid="input-rate"
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={formData.currency} onValueChange={(v) => setFormData({...formData, currency: v, freightCurrency: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="TRY">TRY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:col-span-2 bg-muted/50 p-4 rounded-lg">
            <div>
              <Label>Gross Commission</Label>
              <div className="text-lg font-bold">${formData.grossCommission || "0.00"}</div>
            </div>
            <div>
              <Label>Deductions / Address Comm</Label>
              <Input 
                type="number" 
                value={formData.deductions} 
                onChange={(e) => calculateCommission({ deductions: e.target.value })}
                data-testid="input-deductions"
              />
            </div>
            <div className="col-span-2 border-t mt-2 pt-2">
              <Label className="text-primary">Net Commission Payable</Label>
              <div className="text-2xl font-bold text-primary">${formData.netCommission || "0.00"}</div>
            </div>
          </div>

          <div className="md:col-span-2 border-t pt-4 grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Due Date</Label>
              <Input 
                type="date" 
                value={formData.paymentDueDate} 
                onChange={(e) => setFormData({...formData, paymentDueDate: e.target.value})}
                data-testid="input-due-date"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea 
              value={formData.notes} 
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Additional details, bank info, payment notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={() => onSave({
              ...formData,
              freightAmount: parseFloat(formData.freightAmount) || 0,
              commissionRate: parseFloat(formData.commissionRate) || 0,
              grossCommission: parseFloat(formData.grossCommission) || 0,
              deductions: parseFloat(formData.deductions) || 0,
              netCommission: parseFloat(formData.netCommission) || 0,
              fixtureDate: formData.fixtureDate ? new Date(formData.fixtureDate).toISOString() : null,
              paymentDueDate: formData.paymentDueDate ? new Date(formData.paymentDueDate).toISOString() : null,
            })} 
            disabled={isPending || !formData.dealDescription || !formData.counterparty}
            data-testid="button-save"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {commission ? "Update Commission" : "Save Commission"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
