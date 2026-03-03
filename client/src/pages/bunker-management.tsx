import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Fuel, Plus, Pencil, Trash2, Ship, TrendingDown, DollarSign,
  BarChart3, ClipboardList, RefreshCw, ChevronDown, X, AlertCircle
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
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid
} from "recharts";

const FUEL_TYPES = ["IFO380", "VLSFO", "MGO", "LSMGO", "LNG"];
const FUEL_COLORS: Record<string, string> = {
  IFO380: "#3b82f6", VLSFO: "#8b5cf6", MGO: "#10b981", LSMGO: "#f59e0b", LNG: "#06b6d4",
};
const RECORD_TYPES = [
  { value: "bunkering",   label: "Bunkering (Fuel Intake)" },
  { value: "rob_report",  label: "ROB Report" },
  { value: "consumption", label: "Consumption Record" },
];
const CURRENCIES = ["USD", "EUR", "TRY", "GBP"];

const fmt = (n: number, dec = 1) => n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtCost = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default function BunkerManagement() {
  const { toast } = useToast();
  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [activeView, setActiveView] = useState<"records" | "consumption" | "costs">("records");
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [deletingRecord, setDeletingRecord] = useState<any>(null);
  const [filterFuelType, setFilterFuelType] = useState("");
  const [filterRecordType, setFilterRecordType] = useState("");

  const { data: vessels = [] } = useQuery<any[]>({ queryKey: ["/api/vessels"] });

  const vesselId = selectedVesselId ? parseInt(selectedVesselId) : null;

  const recordsQuery = useQuery<any[]>({
    queryKey: ["/api/vessels", vesselId, "bunker", filterFuelType, filterRecordType],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filterFuelType) params.set("fuelType", filterFuelType);
      if (filterRecordType) params.set("recordType", filterRecordType);
      return fetch(`/api/vessels/${vesselId}/bunker?${params}`, { credentials: "include" }).then(r => r.json());
    },
    enabled: !!vesselId,
  });

  const robQuery = useQuery<any>({
    queryKey: ["/api/vessels", vesselId, "bunker", "rob"],
    queryFn: () => fetch(`/api/vessels/${vesselId}/bunker/rob`, { credentials: "include" }).then(r => r.json()),
    enabled: !!vesselId,
  });

  const consumptionQuery = useQuery<any>({
    queryKey: ["/api/vessels", vesselId, "bunker", "consumption"],
    queryFn: () => fetch(`/api/vessels/${vesselId}/bunker/consumption`, { credentials: "include" }).then(r => r.json()),
    enabled: !!vesselId && activeView === "consumption",
  });

  const costQuery = useQuery<any[]>({
    queryKey: ["/api/vessels", vesselId, "bunker", "cost-analysis"],
    queryFn: () => fetch(`/api/vessels/${vesselId}/bunker/cost-analysis`, { credentials: "include" }).then(r => r.json()),
    enabled: !!vesselId && activeView === "costs",
  });

  const surveysQuery = useQuery<any[]>({
    queryKey: ["/api/vessels", vesselId, "bunker", "surveys"],
    queryFn: () => fetch(`/api/vessels/${vesselId}/bunker/surveys`, { credentials: "include" }).then(r => r.json()),
    enabled: !!vesselId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/vessels", vesselId, "bunker"] });
  };

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/vessels/${vesselId}/bunker`, data).then(r => r.json()),
    onSuccess: () => { invalidate(); setShowAddRecord(false); setEditingRecord(null); toast({ title: "Record added" }); },
    onError: () => toast({ title: "Failed to add record", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PATCH", `/api/vessels/${vesselId}/bunker/${id}`, data).then(r => r.json()),
    onSuccess: () => { invalidate(); setEditingRecord(null); toast({ title: "Record updated" }); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/vessels/${vesselId}/bunker/${id}`, {}),
    onSuccess: () => { invalidate(); setDeletingRecord(null); toast({ title: "Record deleted" }); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const surveyMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/vessels/${vesselId}/bunker/survey`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels", vesselId, "bunker"] });
      setShowSurvey(false);
      toast({ title: "ROB Survey saved" });
    },
    onError: () => toast({ title: "Failed to save survey", variant: "destructive" }),
  });

  const records: any[] = recordsQuery.data ?? [];
  const rob = robQuery.data;

  const bunkeringRecords = records.filter(r => r.record_type === "bunkering");
  const totalBunkeringCost = bunkeringRecords.reduce((s, r) => s + (parseFloat(r.total_cost) || 0), 0);
  const totalBunkered = bunkeringRecords.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);

  const consumptionData: any[] = [];
  if (consumptionQuery.data?.daily) {
    const daily = consumptionQuery.data.daily;
    const days = Object.keys(daily).sort();
    for (const day of days) {
      const entry: any = { day: day.slice(5) };
      for (const ft of FUEL_TYPES) {
        if (daily[day][ft]) entry[ft] = daily[day][ft];
      }
      consumptionData.push(entry);
    }
  }

  const costData: any[] = [];
  if (costQuery.data?.length) {
    const monthMap: Record<string, any> = {};
    for (const row of costQuery.data) {
      const month = new Date(row.month).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      if (!monthMap[month]) monthMap[month] = { month };
      monthMap[month][row.fuel_type] = parseFloat(row.total_cost) || 0;
    }
    costData.push(...Object.values(monthMap));
  }

  const robRobs = rob?.robs ?? {};
  const robFuelTypes = Object.keys(robRobs).filter(ft => robRobs[ft]?.rob !== undefined || typeof robRobs[ft] === "number");

  const selectedVessel = vessels.find((v: any) => v.id === vesselId);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)]">
            <Fuel className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-serif">Bunker Management</h1>
            <p className="text-sm text-muted-foreground">ROB tracking, fuel intake records & consumption analysis</p>
          </div>
        </div>
        {vesselId && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSurvey(true)} data-testid="button-rob-survey">
              <ClipboardList className="w-3.5 h-3.5 mr-1" /> ROB Survey
            </Button>
            <Button size="sm" onClick={() => { setEditingRecord(null); setShowAddRecord(true); }} data-testid="button-add-bunker">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Record
            </Button>
          </div>
        )}
      </div>

      {/* Vessel Selector */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Ship className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Label className="text-sm font-medium flex-shrink-0">Select Vessel</Label>
          <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
            <SelectTrigger className="max-w-xs" data-testid="select-vessel">
              <SelectValue placeholder="Choose a vessel…" />
            </SelectTrigger>
            <SelectContent>
              {(vessels as any[]).map((v: any) => (
                <SelectItem key={v.id} value={v.id.toString()}>
                  {v.name} {v.imoNumber ? `(IMO ${v.imoNumber})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedVessel && (
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{selectedVessel.vesselType || selectedVessel.vessel_type || "Vessel"}</Badge>
              {selectedVessel.flag && <span>{selectedVessel.flag}</span>}
            </div>
          )}
        </div>
      </Card>

      {!vesselId && (
        <Card className="p-12 text-center">
          <Fuel className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">Select a vessel to view bunker data.</p>
        </Card>
      )}

      {vesselId && (
        <>
          {/* ROB Summary */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold">Current ROB</h2>
              {rob?.source && (
                <Badge variant="outline" className="text-[10px]">
                  {rob.source === "survey" ? `Survey: ${fmtDate(rob.surveyDate)}` : "From Records"}
                </Badge>
              )}
              <button onClick={() => robQuery.refetch()} className="ml-auto text-muted-foreground hover:text-foreground">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {FUEL_TYPES.filter(ft => ft !== "LNG").map(ft => {
                const robVal = rob?.source === "survey"
                  ? (rob.robs[ft] ?? 0)
                  : (rob?.robs?.[ft]?.rob ?? null);
                return (
                  <Card key={ft} className="p-4" data-testid={`card-rob-${ft.toLowerCase()}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{ background: FUEL_COLORS[ft] }} />
                      <span className="text-xs font-semibold text-muted-foreground">{ft}</span>
                    </div>
                    <p className="text-2xl font-bold font-mono">
                      {robVal !== null ? fmt(robVal) : <span className="text-sm text-muted-foreground">N/A</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">MT</p>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <DollarSign className="w-3.5 h-3.5" /> Total Bunker Cost
              </div>
              <p className="text-xl font-bold font-mono">{fmtCost(totalBunkeringCost)}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Fuel className="w-3.5 h-3.5" /> Total Bunkered
              </div>
              <p className="text-xl font-bold font-mono">{fmt(totalBunkered, 1)} <span className="text-sm font-normal text-muted-foreground">MT</span></p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <ClipboardList className="w-3.5 h-3.5" /> Records
              </div>
              <p className="text-xl font-bold font-mono">{records.length}</p>
            </Card>
          </div>

          {/* View Toggle + Filters */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1 bg-muted/40 p-1 rounded-lg">
              {(["records", "consumption", "costs"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setActiveView(v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${activeView === v ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  data-testid={`tab-bunker-${v}`}
                >
                  {v === "records" ? "Records" : v === "consumption" ? "Consumption" : "Cost Analysis"}
                </button>
              ))}
            </div>
            {activeView === "records" && (
              <div className="flex gap-2">
                <Select value={filterFuelType} onValueChange={setFilterFuelType}>
                  <SelectTrigger className="h-8 text-xs w-28" data-testid="filter-fuel-type">
                    <SelectValue placeholder="Fuel type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All fuels</SelectItem>
                    {FUEL_TYPES.map(ft => <SelectItem key={ft} value={ft}>{ft}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterRecordType} onValueChange={setFilterRecordType}>
                  <SelectTrigger className="h-8 text-xs w-32" data-testid="filter-record-type">
                    <SelectValue placeholder="Record type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {RECORD_TYPES.map(rt => <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Records Table */}
          {activeView === "records" && (
            <Card className="overflow-hidden">
              {recordsQuery.isLoading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Loading records…</div>
              ) : records.length === 0 ? (
                <div className="p-12 text-center">
                  <Fuel className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm">No records yet. Add a bunkering or ROB report.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Fuel</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Qty (MT)</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">$/MT</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Total</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Port / Supplier</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">ROB After</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {records.map((r: any) => (
                        <tr key={r.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-bunker-${r.id}`}>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">{fmtDate(r.record_date)}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px]">
                              {RECORD_TYPES.find(t => t.value === r.record_type)?.label ?? r.record_type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full" style={{ background: FUEL_COLORS[r.fuel_type] ?? "#6b7280" }} />
                              <span className="text-xs font-medium">{r.fuel_type}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">{fmt(parseFloat(r.quantity))}</td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                            {r.price_per_ton ? `$${fmt(parseFloat(r.price_per_ton))}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-medium">
                            {r.total_cost ? fmtCost(parseFloat(r.total_cost)) : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <div>{r.port_name || "—"}</div>
                            {r.supplier && <div className="text-muted-foreground text-[10px]">{r.supplier}</div>}
                            {r.delivery_note && <div className="text-muted-foreground text-[10px]">BDN: {r.delivery_note}</div>}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {r.rob_after != null ? fmt(parseFloat(r.rob_after)) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => { setEditingRecord(r); setShowAddRecord(true); }}
                                className="p-1 text-muted-foreground hover:text-foreground"
                                data-testid={`button-edit-bunker-${r.id}`}
                              ><Pencil className="w-3 h-3" /></button>
                              <button
                                onClick={() => setDeletingRecord(r)}
                                className="p-1 text-muted-foreground hover:text-red-600"
                                data-testid={`button-delete-bunker-${r.id}`}
                              ><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* Consumption Chart */}
          {activeView === "consumption" && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4">Daily Consumption (last 30 days)</h3>
              {consumptionQuery.isLoading ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
              ) : consumptionData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                  <TrendingDown className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">No consumption records found for this period.</p>
                  <p className="text-xs mt-1">Add records with type "Consumption" to see data here.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={consumptionData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} label={{ value: "MT", angle: -90, position: "insideLeft", style: { fontSize: 10 } }} />
                    <Tooltip formatter={(v: number) => [`${fmt(v)} MT`]} />
                    <Legend />
                    {FUEL_TYPES.map(ft => (
                      <Line key={ft} type="monotone" dataKey={ft} stroke={FUEL_COLORS[ft]}
                        dot={false} strokeWidth={2} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>
          )}

          {/* Cost Analysis Chart */}
          {activeView === "costs" && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4">Monthly Bunker Cost by Fuel Type</h3>
              {costQuery.isLoading ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
              ) : costData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                  <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">No bunkering cost data available.</p>
                  <p className="text-xs mt-1">Add bunkering records with price/cost to see analysis.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={costData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => [fmtCost(v)]} />
                    <Legend />
                    {FUEL_TYPES.map(ft => (
                      <Bar key={ft} dataKey={ft} stackId="a" fill={FUEL_COLORS[ft]} radius={ft === "LNG" ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          )}

          {/* Survey History */}
          {activeView === "records" && (surveysQuery.data?.length ?? 0) > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> Recent ROB Surveys
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left pb-2 text-muted-foreground">Date</th>
                      <th className="text-right pb-2 text-muted-foreground">IFO380</th>
                      <th className="text-right pb-2 text-muted-foreground">VLSFO</th>
                      <th className="text-right pb-2 text-muted-foreground">MGO</th>
                      <th className="text-right pb-2 text-muted-foreground">LSMGO</th>
                      <th className="text-left pb-2 text-muted-foreground">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(surveysQuery.data ?? []).slice(0, 5).map((s: any) => (
                      <tr key={s.id} data-testid={`row-survey-${s.id}`}>
                        <td className="py-2">{fmtDate(s.survey_date)}</td>
                        <td className="py-2 text-right font-mono">{fmt(s.ifo380_rob)}</td>
                        <td className="py-2 text-right font-mono">{fmt(s.vlsfo_rob)}</td>
                        <td className="py-2 text-right font-mono">{fmt(s.mgo_rob)}</td>
                        <td className="py-2 text-right font-mono">{fmt(s.lsmgo_rob)}</td>
                        <td className="py-2 text-muted-foreground">{s.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Add/Edit Record Dialog */}
      {showAddRecord && (
        <BunkerRecordDialog
          record={editingRecord}
          vessels={vessels as any[]}
          defaultVesselId={vesselId}
          onClose={() => { setShowAddRecord(false); setEditingRecord(null); }}
          onSubmit={(data) => {
            if (editingRecord) editMutation.mutate({ id: editingRecord.id, data });
            else addMutation.mutate(data);
          }}
          isPending={addMutation.isPending || editMutation.isPending}
        />
      )}

      {/* ROB Survey Dialog */}
      {showSurvey && (
        <SurveyDialog
          onClose={() => setShowSurvey(false)}
          onSubmit={(data) => surveyMutation.mutate(data)}
          isPending={surveyMutation.isPending}
        />
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingRecord} onOpenChange={() => setDeletingRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this {deletingRecord?.fuel_type} {deletingRecord?.record_type} record? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMutation.mutate(deletingRecord.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BunkerRecordDialog({ record, vessels, defaultVesselId, onClose, onSubmit, isPending }: {
  record: any;
  vessels: any[];
  defaultVesselId: number | null;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    recordType: record?.record_type ?? "bunkering",
    recordDate: record?.record_date ? new Date(record.record_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    fuelType: record?.fuel_type ?? "VLSFO",
    quantity: record?.quantity?.toString() ?? "",
    pricePerTon: record?.price_per_ton?.toString() ?? "",
    totalCost: record?.total_cost?.toString() ?? "",
    currency: record?.currency ?? "USD",
    supplier: record?.supplier ?? "",
    deliveryNote: record?.delivery_note ?? "",
    robBefore: record?.rob_before?.toString() ?? "",
    robAfter: record?.rob_after?.toString() ?? "",
    portName: record?.port_name ?? "",
    notes: record?.notes ?? "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const robAfterAuto = () => {
    if (form.robBefore && form.quantity) {
      const before = parseFloat(form.robBefore);
      const qty = parseFloat(form.quantity);
      if (!isNaN(before) && !isNaN(qty)) {
        if (form.recordType === "bunkering") return (before + qty).toFixed(1);
        if (form.recordType === "consumption") return Math.max(0, before - qty).toFixed(1);
      }
    }
    return "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recordType || !form.recordDate || !form.fuelType || !form.quantity) return;
    const computedRobAfter = form.robAfter || robAfterAuto();
    onSubmit({
      recordType: form.recordType,
      recordDate: form.recordDate,
      fuelType: form.fuelType,
      quantity: parseFloat(form.quantity),
      pricePerTon: form.pricePerTon ? parseFloat(form.pricePerTon) : undefined,
      totalCost: form.totalCost ? parseFloat(form.totalCost) : undefined,
      currency: form.currency,
      supplier: form.supplier || undefined,
      deliveryNote: form.deliveryNote || undefined,
      robBefore: form.robBefore ? parseFloat(form.robBefore) : undefined,
      robAfter: computedRobAfter ? parseFloat(computedRobAfter) : undefined,
      portName: form.portName || undefined,
      notes: form.notes || undefined,
    });
  };

  const autoRob = robAfterAuto();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? "Edit Record" : "Add Bunker Record"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Record Type *</Label>
              <Select value={form.recordType} onValueChange={v => set("recordType", v)}>
                <SelectTrigger data-testid="select-record-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fuel Type *</Label>
              <Select value={form.fuelType} onValueChange={v => set("fuelType", v)}>
                <SelectTrigger data-testid="select-fuel-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUEL_TYPES.map(ft => <SelectItem key={ft} value={ft}>{ft}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date & Time *</Label>
              <Input type="datetime-local" value={form.recordDate} onChange={e => set("recordDate", e.target.value)} data-testid="input-record-date" />
            </div>
            <div className="space-y-1.5">
              <Label>Port Name</Label>
              <Input value={form.portName} onChange={e => set("portName", e.target.value)} placeholder="e.g. Iskenderun" data-testid="input-port-name" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Quantity (MT) *</Label>
              <Input type="number" step="0.001" min="0" value={form.quantity} onChange={e => set("quantity", e.target.value)} placeholder="0.000" data-testid="input-quantity" />
            </div>
            {form.recordType === "bunkering" && (
              <>
                <div className="space-y-1.5">
                  <Label>Price / MT</Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                    <Input type="number" step="0.01" min="0" value={form.pricePerTon} onChange={e => set("pricePerTon", e.target.value)} placeholder="0.00" className="pl-6" data-testid="input-price-per-ton" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Total Cost</Label>
                  <Input type="number" step="0.01" min="0" value={form.totalCost}
                    onChange={e => set("totalCost", e.target.value)}
                    placeholder={form.pricePerTon && form.quantity ? `≈ ${(parseFloat(form.pricePerTon||"0") * parseFloat(form.quantity||"0")).toFixed(0)}` : "auto"}
                    data-testid="input-total-cost" />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>ROB Before (MT)</Label>
              <Input type="number" step="0.1" min="0" value={form.robBefore} onChange={e => set("robBefore", e.target.value)} placeholder="0.0" data-testid="input-rob-before" />
            </div>
            <div className="space-y-1.5">
              <Label>ROB After (MT)</Label>
              <Input type="number" step="0.1" min="0" value={form.robAfter}
                onChange={e => set("robAfter", e.target.value)}
                placeholder={autoRob || "auto-calculated"}
                data-testid="input-rob-after" />
              {autoRob && !form.robAfter && (
                <p className="text-[10px] text-muted-foreground">Auto: {autoRob} MT</p>
              )}
            </div>
          </div>

          {form.recordType === "bunkering" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Supplier</Label>
                <Input value={form.supplier} onChange={e => set("supplier", e.target.value)} placeholder="Bunker supplier" data-testid="input-supplier" />
              </div>
              <div className="space-y-1.5">
                <Label>BDN No.</Label>
                <Input value={form.deliveryNote} onChange={e => set("deliveryNote", e.target.value)} placeholder="Bunker Delivery Note" data-testid="input-bdn" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Additional notes…" data-testid="input-bunker-notes" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending || !form.recordType || !form.fuelType || !form.quantity} data-testid="button-save-bunker">
              {isPending ? "Saving…" : record ? "Update" : "Add Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SurveyDialog({ onClose, onSubmit, isPending }: {
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    surveyDate: new Date().toISOString().slice(0, 16),
    ifo380Rob: "",
    vlsfoRob: "",
    mgoRob: "",
    lsmgoRob: "",
    notes: "",
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      surveyDate: form.surveyDate,
      ifo380Rob: parseFloat(form.ifo380Rob) || 0,
      vlsfoRob: parseFloat(form.vlsfoRob) || 0,
      mgoRob: parseFloat(form.mgoRob) || 0,
      lsmgoRob: parseFloat(form.lsmgoRob) || 0,
      notes: form.notes || undefined,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> ROB Survey
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Survey Date & Time *</Label>
            <Input type="datetime-local" value={form.surveyDate} onChange={e => set("surveyDate", e.target.value)} data-testid="input-survey-date" />
          </div>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Enter current ROB for each fuel type (in MT):</p>
            {[
              { key: "ifo380Rob", label: "IFO 380", color: FUEL_COLORS.IFO380 },
              { key: "vlsfoRob", label: "VLSFO",   color: FUEL_COLORS.VLSFO },
              { key: "mgoRob",   label: "MGO",     color: FUEL_COLORS.MGO },
              { key: "lsmgoRob", label: "LSMGO",   color: FUEL_COLORS.LSMGO },
            ].map(({ key, label, color }) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                <Label className="w-16 text-xs flex-shrink-0">{label}</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  className="h-8 text-sm"
                  value={(form as any)[key]}
                  onChange={e => set(key, e.target.value)}
                  placeholder="0.0 MT"
                  data-testid={`input-survey-${key}`}
                />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Survey notes…" data-testid="input-survey-notes" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending} data-testid="button-save-survey">
              {isPending ? "Saving…" : "Save Survey"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
