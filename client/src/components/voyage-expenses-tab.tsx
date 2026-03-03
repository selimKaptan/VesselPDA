import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus, ChevronDown, ChevronRight, Pencil, Trash2, DollarSign,
  TrendingUp, TrendingDown, Wallet, CheckCircle2, Clock, AlertCircle,
  Target, BarChart3, X, Receipt
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";

const CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: "port_charges",  label: "Port Charges",     color: "#3b82f6" },
  { value: "agency_fee",    label: "Agency Fee",       color: "#8b5cf6" },
  { value: "pilotage",      label: "Pilotage",         color: "#06b6d4" },
  { value: "tugboat",       label: "Tugboat",          color: "#f59e0b" },
  { value: "mooring",       label: "Mooring",          color: "#10b981" },
  { value: "bunker",        label: "Bunker",           color: "#ef4444" },
  { value: "provisions",    label: "Provisions",       color: "#f97316" },
  { value: "crew",          label: "Crew",             color: "#ec4899" },
  { value: "repairs",       label: "Repairs",          color: "#84cc16" },
  { value: "insurance",     label: "Insurance",        color: "#14b8a6" },
  { value: "communication", label: "Communication",    color: "#6366f1" },
  { value: "misc",          label: "Miscellaneous",    color: "#9ca3af" },
];

const CURRENCIES = ["USD", "EUR", "TRY", "GBP", "JPY"];

const catLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label ?? v;
const catColor = (v: string) => CATEGORIES.find(c => c.value === v)?.color ?? "#6b7280";
const fmt = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtSign = (n: number) => (n >= 0 ? "+" : "") + fmt(n);

interface Props {
  voyageId: number;
  portCalls?: any[];
}

export function VoyageExpensesTab({ voyageId, portCalls = [] }: Props) {
  const { toast } = useToast();
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showBudgetEditor, setShowBudgetEditor] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [deletingExpense, setDeletingExpense] = useState<any>(null);
  const [activeView, setActiveView] = useState<"table" | "chart">("table");

  const { data: expenses = [], isLoading: expLoading } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "expenses"],
    queryFn: () => fetch(`/api/voyages/${voyageId}/expenses`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: summary, isLoading: sumLoading } = useQuery<any>({
    queryKey: ["/api/voyages", voyageId, "expenses", "summary"],
    queryFn: () => fetch(`/api/voyages/${voyageId}/expenses/summary`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: budgets = [] } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "budgets"],
    queryFn: () => fetch(`/api/voyages/${voyageId}/budgets`, { credentials: "include" }).then(r => r.json()),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "expenses"] });
    queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "expenses", "summary"] });
  };

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/voyages/${voyageId}/expenses`, data).then(r => r.json()),
    onSuccess: () => { invalidate(); setShowAddExpense(false); setEditingExpense(null); toast({ title: "Expense added" }); },
    onError: () => toast({ title: "Failed to add expense", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PATCH", `/api/voyages/${voyageId}/expenses/${id}`, data).then(r => r.json()),
    onSuccess: () => { invalidate(); setEditingExpense(null); toast({ title: "Expense updated" }); },
    onError: () => toast({ title: "Failed to update expense", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/voyages/${voyageId}/expenses/${id}`, {}),
    onSuccess: () => { invalidate(); setDeletingExpense(null); toast({ title: "Expense deleted" }); },
    onError: () => toast({ title: "Failed to delete expense", variant: "destructive" }),
  });

  const budgetMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/voyages/${voyageId}/budgets`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "budgets"] });
      invalidate();
      toast({ title: "Budget saved" });
    },
    onError: () => toast({ title: "Failed to save budget", variant: "destructive" }),
  });

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const expensesByCategory = expenses.reduce((acc: Record<string, any[]>, e) => {
    if (!acc[e.category]) acc[e.category] = [];
    acc[e.category].push(e);
    return acc;
  }, {});

  const summaryCategories: any[] = summary?.categories ?? [];
  const totalBudget = summary?.totalBudget ?? 0;
  const totalActual = summary?.totalActual ?? 0;
  const totalPaid = summary?.totalPaid ?? 0;
  const totalVariance = summary?.totalVariance ?? 0;

  const chartData = summaryCategories
    .filter(c => c.budget > 0 || c.actual > 0)
    .map(c => ({ name: catLabel(c.category), Budget: c.budget, Actual: c.actual, color: catColor(c.category) }));

  const budgetMap: Record<string, number> = {};
  for (const b of budgets) budgetMap[b.category] = parseFloat(b.budget_amount) || 0;

  const payStatusBadge = (status: string) => {
    if (status === "paid") return <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">Paid</Badge>;
    if (status === "partially_paid") return <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Partial</Badge>;
    return <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">Unpaid</Badge>;
  };

  return (
    <div className="space-y-5">
      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Target className="w-3.5 h-3.5" /> Total Budget
          </div>
          <p className="text-xl font-bold font-mono" data-testid="text-total-budget">{fmt(totalBudget)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <DollarSign className="w-3.5 h-3.5" /> Total Spent
          </div>
          <p className="text-xl font-bold font-mono" data-testid="text-total-actual">{fmt(totalActual)}</p>
        </Card>
        <Card className={`p-4 ${totalVariance > 0 ? "border-red-200 dark:border-red-800" : "border-emerald-200 dark:border-emerald-800"}`}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            {totalVariance > 0 ? <TrendingUp className="w-3.5 h-3.5 text-red-500" /> : <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />}
            {totalVariance > 0 ? "Over Budget" : "Under Budget"}
          </div>
          <p className={`text-xl font-bold font-mono ${totalVariance > 0 ? "text-red-600" : "text-emerald-600"}`} data-testid="text-variance">
            {totalVariance > 0 ? `+${fmt(Math.abs(totalVariance))}` : `-${fmt(Math.abs(totalVariance))}`}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Paid
          </div>
          <p className="text-xl font-bold font-mono text-emerald-600" data-testid="text-paid">{fmt(totalPaid)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Unpaid: {fmt(totalActual - totalPaid)}</p>
        </Card>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 bg-muted/40 p-1 rounded-lg">
          <button
            onClick={() => setActiveView("table")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeView === "table" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="tab-expenses-table"
          >Category Table</button>
          <button
            onClick={() => setActiveView("chart")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeView === "chart" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="tab-expenses-chart"
          ><BarChart3 className="w-3.5 h-3.5 inline mr-1" />Chart</button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBudgetEditor(true)} data-testid="button-edit-budgets">
            <Target className="w-3.5 h-3.5 mr-1" /> Set Budgets
          </Button>
          <Button size="sm" onClick={() => { setEditingExpense(null); setShowAddExpense(true); }} data-testid="button-add-expense">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Expense
          </Button>
        </div>
      </div>

      {/* ── Table View ── */}
      {activeView === "table" && (
        <div className="space-y-2">
          {summaryCategories.filter(c => c.budget > 0 || c.actual > 0).length === 0 && expenses.length === 0 ? (
            <Card className="p-12 text-center">
              <Receipt className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">No expenses recorded yet.</p>
              <p className="text-muted-foreground text-xs mt-1">Click "Add Expense" to start tracking costs.</p>
            </Card>
          ) : (
            <>
              {/* Header row */}
              <div className="grid grid-cols-5 gap-2 px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span className="col-span-2">Category</span>
                <span className="text-right">Budget</span>
                <span className="text-right">Actual</span>
                <span className="text-right">Variance</span>
              </div>
              {CATEGORIES.map(cat => {
                const row = summaryCategories.find(c => c.category === cat.value);
                const catExpenses = expensesByCategory[cat.value] || [];
                if (!row && catExpenses.length === 0) return null;
                const budget = row?.budget ?? 0;
                const actual = row?.actual ?? 0;
                const variance = actual - budget;
                const isExpanded = expandedCats.has(cat.value);

                return (
                  <Card key={cat.value} className="overflow-hidden">
                    <button
                      className="w-full grid grid-cols-5 gap-2 px-3 py-3 hover:bg-muted/30 transition-colors text-left"
                      onClick={() => catExpenses.length > 0 && toggleCat(cat.value)}
                      data-testid={`row-category-${cat.value}`}
                    >
                      <div className="col-span-2 flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                        <span className="text-sm font-medium">{cat.label}</span>
                        {catExpenses.length > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{catExpenses.length}</Badge>
                        )}
                        {catExpenses.length > 0 && (
                          isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
                        )}
                      </div>
                      <span className="text-sm text-right font-mono text-muted-foreground">
                        {budget > 0 ? fmt(budget) : <span className="text-xs text-muted-foreground/50">—</span>}
                      </span>
                      <span className="text-sm text-right font-mono font-medium">
                        {actual > 0 ? fmt(actual) : <span className="text-xs text-muted-foreground/50">—</span>}
                      </span>
                      <span className={`text-sm text-right font-mono font-medium ${
                        budget === 0 ? "text-muted-foreground" : variance > 0 ? "text-red-600" : "text-emerald-600"
                      }`}>
                        {budget === 0 ? "—" : fmtSign(variance)}
                        {budget > 0 && variance > 0 && <AlertCircle className="w-3 h-3 inline ml-1 text-red-500" />}
                        {budget > 0 && variance <= 0 && <CheckCircle2 className="w-3 h-3 inline ml-1 text-emerald-500" />}
                      </span>
                    </button>

                    {/* Expanded expense rows */}
                    {isExpanded && catExpenses.length > 0 && (
                      <div className="border-t bg-muted/10">
                        {catExpenses.map((exp: any) => (
                          <div key={exp.id} className="grid grid-cols-5 gap-2 px-3 py-2.5 border-b last:border-0 hover:bg-muted/20 transition-colors" data-testid={`row-expense-${exp.id}`}>
                            <div className="col-span-2 pl-5">
                              <p className="text-xs font-medium">{exp.description}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {exp.vendor && <span className="text-[10px] text-muted-foreground">{exp.vendor}</span>}
                                {exp.invoice_number && <span className="text-[10px] text-muted-foreground">#{exp.invoice_number}</span>}
                                {exp.port_name && <span className="text-[10px] text-blue-500">{exp.port_name}</span>}
                                {payStatusBadge(exp.payment_status)}
                              </div>
                            </div>
                            <span className="text-xs text-right font-mono text-muted-foreground self-center">
                              {exp.budget_amount ? fmt(exp.budget_amount) : "—"}
                            </span>
                            <span className="text-xs text-right font-mono font-medium self-center">
                              {fmt(exp.amount_usd ?? exp.actual_amount)}
                              {exp.currency !== "USD" && <span className="text-[10px] text-muted-foreground ml-1">({exp.currency})</span>}
                            </span>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingExpense(exp); setShowAddExpense(true); }}
                                className="p-1 text-muted-foreground hover:text-foreground"
                                data-testid={`button-edit-expense-${exp.id}`}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeletingExpense(exp); }}
                                className="p-1 text-muted-foreground hover:text-red-600"
                                data-testid={`button-delete-expense-${exp.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}

              {/* Total row */}
              {(totalBudget > 0 || totalActual > 0) && (
                <Card className="p-3 bg-muted/20">
                  <div className="grid grid-cols-5 gap-2">
                    <div className="col-span-2 text-sm font-bold">Total</div>
                    <span className="text-sm text-right font-mono font-bold">{fmt(totalBudget)}</span>
                    <span className="text-sm text-right font-mono font-bold">{fmt(totalActual)}</span>
                    <span className={`text-sm text-right font-mono font-bold ${totalVariance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {fmtSign(totalVariance)}
                    </span>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Chart View ── */}
      {activeView === "chart" && (
        <Card className="p-5">
          {chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              No budget or expense data to display.
            </div>
          ) : (
            <>
              <h3 className="text-sm font-semibold mb-4">Budget vs Actual by Category</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 60 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend verticalAlign="top" />
                  <Bar dataKey="Budget" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Actual" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </Card>
      )}

      {/* ── Port-call grouping (multi-port) ── */}
      {portCalls.length > 1 && expenses.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Expenses by Port
          </h3>
          <div className="space-y-3">
            {portCalls.map((pc: any) => {
              const pcExpenses = expenses.filter(e => e.port_call_id === pc.id);
              if (pcExpenses.length === 0) return null;
              const total = pcExpenses.reduce((s, e) => s + (parseFloat(e.amount_usd) || parseFloat(e.actual_amount)), 0);
              return (
                <div key={pc.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <span className="text-sm font-medium">{pc.port_name || `Port Call #${pc.port_call_order}`}</span>
                    <span className="text-xs text-muted-foreground ml-2">{pcExpenses.length} item{pcExpenses.length !== 1 ? "s" : ""}</span>
                  </div>
                  <span className="text-sm font-mono font-bold">{fmt(total)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Add/Edit Expense Dialog ── */}
      {showAddExpense && (
        <ExpenseDialog
          expense={editingExpense}
          portCalls={portCalls}
          onClose={() => { setShowAddExpense(false); setEditingExpense(null); }}
          onSubmit={(data) => {
            if (editingExpense) editMutation.mutate({ id: editingExpense.id, data });
            else addMutation.mutate(data);
          }}
          isPending={addMutation.isPending || editMutation.isPending}
        />
      )}

      {/* ── Budget Editor Dialog ── */}
      <BudgetEditorDialog
        open={showBudgetEditor}
        budgetMap={budgetMap}
        onClose={() => setShowBudgetEditor(false)}
        onSave={(cat, amt) => budgetMutation.mutate({ category: cat, budgetAmount: amt })}
        isPending={budgetMutation.isPending}
      />

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deletingExpense} onOpenChange={() => setDeletingExpense(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{deletingExpense?.description}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMutation.mutate(deletingExpense.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ExpenseDialog({ expense, portCalls, onClose, onSubmit, isPending }: {
  expense: any;
  portCalls: any[];
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    category: expense?.category ?? "",
    description: expense?.description ?? "",
    actualAmount: expense?.actual_amount?.toString() ?? "",
    budgetAmount: expense?.budget_amount?.toString() ?? "",
    currency: expense?.currency ?? "USD",
    exchangeRate: expense?.exchange_rate?.toString() ?? "1",
    vendor: expense?.vendor ?? "",
    invoiceNumber: expense?.invoice_number ?? "",
    paymentStatus: expense?.payment_status ?? "unpaid",
    portCallId: expense?.port_call_id?.toString() ?? "",
    notes: expense?.notes ?? "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category || !form.description || !form.actualAmount) return;
    onSubmit({
      category: form.category,
      description: form.description,
      actualAmount: parseFloat(form.actualAmount),
      budgetAmount: form.budgetAmount ? parseFloat(form.budgetAmount) : undefined,
      currency: form.currency,
      exchangeRate: parseFloat(form.exchangeRate) || 1,
      vendor: form.vendor || undefined,
      invoiceNumber: form.invoiceNumber || undefined,
      paymentStatus: form.paymentStatus,
      portCallId: form.portCallId ? parseInt(form.portCallId) : undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={v => set("category", v)}>
                <SelectTrigger data-testid="select-expense-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {portCalls.length > 0 && (
              <div className="space-y-1.5">
                <Label>Port Call</Label>
                <Select value={form.portCallId} onValueChange={v => set("portCallId", v)}>
                  <SelectTrigger data-testid="select-expense-portcall">
                    <SelectValue placeholder="All ports" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All ports / General</SelectItem>
                    {portCalls.map((pc: any) => (
                      <SelectItem key={pc.id} value={pc.id.toString()}>
                        {pc.port_name || pc.portName || `Port #${pc.port_call_order}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Input
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="e.g. Pilot boarding fee"
              data-testid="input-expense-description"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={v => set("currency", v)}>
                <SelectTrigger data-testid="select-expense-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-1">
              <Label>Actual Amount *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.actualAmount}
                onChange={e => set("actualAmount", e.target.value)}
                placeholder="0.00"
                data-testid="input-expense-amount"
              />
            </div>
            <div className="space-y-1.5 col-span-1">
              <Label>Exchange Rate</Label>
              <Input
                type="number"
                step="0.0001"
                min="0"
                value={form.exchangeRate}
                onChange={e => set("exchangeRate", e.target.value)}
                placeholder="1.00"
                data-testid="input-expense-rate"
              />
            </div>
          </div>

          {form.currency !== "USD" && form.actualAmount && (
            <p className="text-xs text-muted-foreground -mt-2">
              ≈ USD {(parseFloat(form.actualAmount) * (parseFloat(form.exchangeRate) || 1)).toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </p>
          )}

          <div className="space-y-1.5">
            <Label>Budget Amount (optional)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.budgetAmount}
              onChange={e => set("budgetAmount", e.target.value)}
              placeholder="Planned / estimated cost"
              data-testid="input-expense-budget"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vendor / Supplier</Label>
              <Input value={form.vendor} onChange={e => set("vendor", e.target.value)} placeholder="Company name" data-testid="input-expense-vendor" />
            </div>
            <div className="space-y-1.5">
              <Label>Invoice No.</Label>
              <Input value={form.invoiceNumber} onChange={e => set("invoiceNumber", e.target.value)} placeholder="INV-001" data-testid="input-expense-invoice" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Payment Status</Label>
            <Select value={form.paymentStatus} onValueChange={v => set("paymentStatus", v)}>
              <SelectTrigger data-testid="select-expense-payment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Additional notes..." data-testid="input-expense-notes" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending || !form.category || !form.description || !form.actualAmount} data-testid="button-save-expense">
              {isPending ? "Saving…" : expense ? "Update" : "Add Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BudgetEditorDialog({ open, budgetMap, onClose, onSave, isPending }: {
  open: boolean;
  budgetMap: Record<string, number>;
  onClose: () => void;
  onSave: (category: string, amount: number) => void;
  isPending: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of CATEGORIES) init[c.value] = budgetMap[c.value]?.toString() ?? "";
    return init;
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Target className="w-4 h-4" /> Set Budgets</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <p className="text-xs text-muted-foreground">Enter budget amounts in USD for each category. Leave blank to clear.</p>
          {CATEGORIES.map(cat => (
            <div key={cat.value} className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
              <Label className="w-32 text-xs flex-shrink-0">{cat.label}</Label>
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  className="pl-6 h-8 text-sm"
                  value={values[cat.value]}
                  onChange={e => setValues(v => ({ ...v, [cat.value]: e.target.value }))}
                  data-testid={`input-budget-${cat.value}`}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2 text-xs"
                disabled={isPending}
                onClick={() => {
                  const amt = parseFloat(values[cat.value]);
                  if (!isNaN(amt) && amt >= 0) onSave(cat.value, amt);
                }}
                data-testid={`button-save-budget-${cat.value}`}
              >
                Save
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
