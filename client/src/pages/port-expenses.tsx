import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { 
  Plus, Receipt, Filter, DollarSign, CheckCircle2, Clock, 
  Search, Trash2, Edit2, Wallet, Calendar, User, Tag, 
  FileText, ArrowUpRight, BarChart3, TrendingUp, Calculator
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPortExpenseSchema, type PortExpense, type Voyage } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fmtDate } from "@/lib/formatDate";
import { Skeleton } from "@/components/ui/skeleton";

const EXPENSE_CATEGORIES = [
  { value: "port_dues", label: "Port Dues" },
  { value: "pilotage", label: "Pilotage" },
  { value: "towage", label: "Towage" },
  { value: "agency_fee", label: "Agency Fee" },
  { value: "mooring", label: "Mooring" },
  { value: "anchorage", label: "Anchorage" },
  { value: "launch_hire", label: "Launch Hire" },
  { value: "garbage", label: "Garbage" },
  { value: "fresh_water", label: "Fresh Water" },
  { value: "bunker", label: "Bunker" },
  { value: "survey", label: "Survey" },
  { value: "customs", label: "Customs" },
  { value: "other", label: "Other" },
];

export default function PortExpenses() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPaid, setFilterPaid] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: expenses, isLoading } = useQuery<PortExpense[]>({
    queryKey: ["/api/port-expenses"],
  });

  const { data: voyages } = useQuery<Voyage[]>({
    queryKey: ["/api/voyages"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/port-expenses", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/port-expenses"] });
      setIsAddDialogOpen(false);
      toast({ title: "Success", description: "Expense added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const togglePaidMutation = useMutation({
    mutationFn: async ({ id, isPaid }: { id: number; isPaid: boolean }) => {
      const res = await apiRequest("PATCH", `/api/port-expenses/${id}`, { isPaid });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/port-expenses"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/port-expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/port-expenses"] });
      toast({ title: "Deleted", description: "Expense removed from ledger" });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertPortExpenseSchema),
    defaultValues: {
      category: "other",
      description: "",
      amount: 0,
      currency: "USD",
      vendor: "",
      receiptNumber: "",
      expenseDate: new Date().toISOString().split('T')[0],
      notes: "",
      voyageId: undefined,
      isPaid: false,
    },
  });

  const filteredExpenses = expenses?.filter(e => {
    const matchesCategory = filterCategory === "all" || e.category === filterCategory;
    const matchesPaid = filterPaid === "all" || (filterPaid === "paid" ? e.isPaid : !e.isPaid);
    const matchesSearch = !searchQuery || 
      e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.vendor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.receiptNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesPaid && matchesSearch;
  });

  const totalExpenses = expenses?.reduce((acc, e) => acc + (e.amount || 0), 0) || 0;
  const paidCount = expenses?.filter(e => e.isPaid).length || 0;
  const unpaidCount = expenses?.filter(e => !e.isPaid).length || 0;

  const categoryTotals = EXPENSE_CATEGORIES.map(cat => ({
    label: cat.label,
    value: expenses?.filter(e => e.category === cat.value).reduce((acc, e) => acc + (e.amount || 0), 0) || 0
  })).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="w-8 h-8 text-[hsl(var(--maritime-primary))]" />
            Port Expense Ledger
          </h1>
          <p className="text-muted-foreground mt-1">Track and manage all vessel related port expenses and disbursements.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-expense" className="bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary))/0.9]">
              <Plus className="w-4 h-4 mr-2" /> Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Port Expense</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
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
                            <SelectItem value="TRY">TRY</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="vendor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor / Provider</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Pilotage Assoc, Port Authority" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expenseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="voyageId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voyage (Optional)</FormLabel>
                      <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select voyage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {voyages?.map(v => (
                            <SelectItem key={v.id} value={v.id.toString()}>{v.vesselName} - {v.status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} className="w-full">
                    {createMutation.isPending ? "Adding..." : "Save Expense"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur border-sidebar-border/40 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <DollarSign className="w-12 h-12" />
          </div>
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Expenses</p>
            <h2 className="text-3xl font-bold font-mono">${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" /> Across all categories
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-sidebar-border/40 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Paid Items</p>
            <h2 className="text-3xl font-bold text-emerald-500 font-mono">{paidCount}</h2>
            <p className="text-[10px] text-muted-foreground mt-2">Fully settled expenses</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-sidebar-border/40 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-amber-500">
            <Clock className="w-12 h-12" />
          </div>
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Outstanding</p>
            <h2 className="text-3xl font-bold text-amber-500 font-mono">{unpaidCount}</h2>
            <p className="text-[10px] text-muted-foreground mt-2">Awaiting payment / confirmation</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-sidebar-border/40 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Tag className="w-12 h-12" />
          </div>
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Top Category</p>
            <h2 className="text-xl font-bold truncate">{categoryTotals[0]?.label || "N/A"}</h2>
            <p className="text-[10px] text-muted-foreground mt-2">${categoryTotals[0]?.value.toLocaleString() || 0} total spent</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-sidebar-border/40 bg-card/30 backdrop-blur-sm">
        <CardHeader className="pb-0 pt-6 px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex flex-1 items-center gap-2 max-w-sm">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search description, vendor..." 
                  className="pl-9 bg-background/50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[150px] bg-background/50 h-9">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {EXPENSE_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Select value={filterPaid} onValueChange={setFilterPaid}>
                <SelectTrigger className="w-[130px] bg-background/50 h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center text-muted-foreground">
                      No expenses found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExpenses?.map((expense) => (
                    <TableRow key={expense.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-xs">
                        {expense.expenseDate ? fmtDate(expense.expenseDate) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-background">
                          {EXPENSE_CATEGORIES.find(c => c.value === expense.category)?.label || expense.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{expense.vendor || "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {expense.description || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {expense.currency} {expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <button 
                          onClick={() => togglePaidMutation.mutate({ id: expense.id, isPaid: !expense.isPaid })}
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                            expense.isPaid 
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                              : "bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20"
                          }`}
                        >
                          {expense.isPaid ? "Paid" : "Unpaid"}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this expense?")) {
                                deleteMutation.mutate(expense.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 border-sidebar-border/40 bg-card/30 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              Expenses by Category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryTotals.map((cat, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span>{cat.label}</span>
                  <span className="font-mono">${cat.value.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[hsl(var(--maritime-primary))] rounded-full transition-all duration-1000"
                    style={{ width: `${(cat.value / totalExpenses) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2 border-sidebar-border/40 bg-card/30 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              Quick Actions & Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button variant="outline" className="justify-start h-16 gap-3 bg-background/50 hover:bg-muted border-sidebar-border/60">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <FileText className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-wider">Export Ledger</p>
                <p className="text-[10px] text-muted-foreground">Download as CSV or Excel</p>
              </div>
              <ArrowUpRight className="ml-auto w-4 h-4 opacity-30" />
            </Button>
            
            <Button variant="outline" className="justify-start h-16 gap-3 bg-background/50 hover:bg-muted border-sidebar-border/60">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-wider">Audit Log</p>
                <p className="text-[10px] text-muted-foreground">View change history</p>
              </div>
              <ArrowUpRight className="ml-auto w-4 h-4 opacity-30" />
            </Button>

            <Button variant="outline" className="justify-start h-16 gap-3 bg-background/50 hover:bg-muted border-sidebar-border/60">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                <Tag className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-wider">Manage Vendors</p>
                <p className="text-[10px] text-muted-foreground">View and edit vendor list</p>
              </div>
              <ArrowUpRight className="ml-auto w-4 h-4 opacity-30" />
            </Button>

            <Button variant="outline" className="justify-start h-16 gap-3 bg-background/50 hover:bg-muted border-sidebar-border/60">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Calculator className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-wider">FDA Link</p>
                <p className="text-[10px] text-muted-foreground">Link to Disbursement Accounts</p>
              </div>
              <ArrowUpRight className="ml-auto w-4 h-4 opacity-30" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
