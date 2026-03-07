import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from "recharts";
import { 
  LayoutDashboard, Ship, Calculator, FileText, Plus, 
  AlertTriangle, CheckCircle, Info, Download, Filter, 
  ArrowUpRight, TrendingUp, DollarSign, Cloud
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import { 
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  insertCiiRecordSchema, insertEuEtsRecordSchema, insertDcsReportSchema,
  type CiiRecord, type EuEtsRecord, type DcsReport, type Vessel
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

const RATING_COLORS = {
  A: "#22c55e", // Green
  B: "#84cc16", // Lime
  C: "#eab308", // Yellow
  D: "#f97316", // Orange
  E: "#ef4444", // Red
};

export default function EnvironmentalPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: vessels } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
  });

  const { data: fleetSummary, isLoading: summaryLoading } = useQuery<{
    totalEtsLiability: number;
    avgCiiRating: string;
    totalCo2: number;
    pendingReports: number;
    vesselBreakdown: any[];
    monthlyEmissions: any[];
  }>({
    queryKey: ["/api/environmental/fleet-summary"],
  });

  const { data: ciiRecords, isLoading: ciiLoading } = useQuery<CiiRecord[]>({
    queryKey: ["/api/environmental/cii"],
  });

  const { data: etsRecords, isLoading: etsLoading } = useQuery<EuEtsRecord[]>({
    queryKey: ["/api/environmental/eu-ets"],
  });

  const { data: dcsReports, isLoading: dcsLoading } = useQuery<DcsReport[]>({
    queryKey: ["/api/environmental/dcs"],
  });

  if (summaryLoading) {
    return <div className="p-6 space-y-6"><Skeleton className="h-40 w-full" /><Skeleton className="h-[500px] w-full" /></div>;
  }

  return (
    <div className="p-6 space-y-6 bg-background text-foreground min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Environmental Compliance</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage CII, EU ETS, and IMO DCS regulatory requirements across your fleet.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-export-data" onClick={() => {
            const doc = new jsPDF();
            doc.setFontSize(20);
            doc.text("Environmental Compliance Report", 14, 22);
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, 14, 30);
            doc.text(`Fleet Average CII: ${fleetSummary?.avgCiiRating || "C"}`, 14, 35);
            doc.text(`Total ETS Liability: EUR ${fleetSummary?.totalEtsLiability?.toLocaleString() || 0}`, 14, 40);

            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text("CII Ratings by Vessel", 14, 55);
            autoTable(doc, {
              startY: 60,
              head: [['Vessel', 'Year', 'Attained', 'Required', 'Rating']],
              body: (ciiRecords || []).map(r => [
                vessels?.find(v => v.id === r.vesselId)?.name || `Vessel #${r.vesselId}`,
                r.reportingYear.toString(),
                (r.ciiAttained || 0).toFixed(2),
                (r.ciiRequired || 0).toFixed(2),
                r.ciiRating || 'N/A'
              ]),
            });

            let nextY = (doc as any).lastAutoTable.finalY + 15;
            doc.text("EU ETS Emissions Ledger", 14, nextY);
            autoTable(doc, {
              startY: nextY + 5,
              head: [['Vessel', 'Period', 'CO2 (mt)', 'Liable CO2', 'Cost (EUR)']],
              body: (etsRecords || []).map(r => [
                vessels?.find(v => v.id === r.vesselId)?.name || `Vessel #${r.vesselId}`,
                `${r.reportingPeriod || ''} ${r.reportingYear}`,
                (r.co2Emissions || 0).toLocaleString(),
                (r.etsLiableCo2 || 0).toLocaleString(),
                `EUR ${(r.totalCostEur || 0).toLocaleString()}`
              ]),
            });

            nextY = (doc as any).lastAutoTable.finalY + 15;
            doc.text("IMO DCS Reporting Summary", 14, nextY);
            autoTable(doc, {
              startY: nextY + 5,
              head: [['Vessel', 'Year', 'Fuel (mt)', 'Dist (nm)', 'Verifier', 'Status']],
              body: (dcsReports || []).map(r => [
                vessels?.find(v => v.id === r.vesselId)?.name || `Vessel #${r.vesselId}`,
                r.reportingYear.toString(),
                (r.totalFuel || 0).toLocaleString(),
                (r.distanceNm || 0).toLocaleString(),
                r.verifier || "N/A",
                r.status || ''
              ]),
            });

            doc.save("Environmental_Compliance_Report.pdf");
          }}>
            <Download className="mr-2 h-4 w-4" /> Export PDF
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button data-testid="button-add-record">
                <Plus className="mr-2 h-4 w-4" /> Add Compliance Data
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>New Environmental Record</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="cii">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="cii">CII Record</TabsTrigger>
                  <TabsTrigger value="ets">EU ETS</TabsTrigger>
                  <TabsTrigger value="dcs">IMO DCS</TabsTrigger>
                </TabsList>
                <TabsContent value="cii">
                  <CiiForm vessels={vessels || []} onSuccess={() => toast({ title: "CII record added" })} />
                </TabsContent>
                <TabsContent value="ets">
                  <EtsForm vessels={vessels || []} onSuccess={() => toast({ title: "ETS record added" })} />
                </TabsContent>
                <TabsContent value="dcs">
                  <DcsForm vessels={vessels || []} onSuccess={() => toast({ title: "DCS report added" })} />
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-sm font-medium">Fleet Avg CII Rating</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {fleetSummary?.avgCiiRating || "C"}
              <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30 border-none">
                Target: B
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Based on 2024 performance</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-sm font-medium">EU ETS Liability</CardTitle>
            <DollarSign className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              €{(fleetSummary?.totalEtsLiability || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Est. 1,450 allowances needed</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-sm font-medium">Total CO2 Emissions</CardTitle>
            <Cloud className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(fleetSummary?.totalCo2 || 0).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">mt</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">-4.2% from previous year</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-1">
            <CardTitle className="text-sm font-medium">Compliance Status</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94%</div>
            <p className="text-xs text-muted-foreground mt-1">2 reports pending review</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-card border p-1 rounded-md inline-flex">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="cii" className="flex items-center gap-2">
            <Ship className="h-4 w-4" /> CII Tracking
          </TabsTrigger>
          <TabsTrigger value="ets" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" /> EU ETS
          </TabsTrigger>
          <TabsTrigger value="dcs" className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> IMO DCS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Fleet CO2 Emissions Profile</CardTitle>
                <CardDescription>Monthly aggregated emissions for the current year</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fleetSummary?.monthlyEmissions || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                      itemStyle={{ color: "hsl(var(--primary))" }}
                    />
                    <Bar dataKey="co2" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>CII Rating Distribution</CardTitle>
                <CardDescription>Current fleet status by rating category</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fleetSummary?.vesselBreakdown || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {(fleetSummary?.vesselBreakdown || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={RATING_COLORS[entry.name as keyof typeof RATING_COLORS] || "hsl(var(--primary))"} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cii" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>CII Attained vs Required</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left">Vessel</th>
                      <th className="p-3 text-left">Year</th>
                      <th className="p-3 text-right">Attained</th>
                      <th className="p-3 text-right">Required</th>
                      <th className="p-3 text-center">Rating</th>
                      <th className="p-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ciiRecords?.map((record) => {
                      const vessel = vessels?.find(v => v.id === record.vesselId);
                      return (
                        <tr key={record.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium">{vessel?.name || `Vessel #${record.vesselId}`}</td>
                          <td className="p-3">{record.reportingYear}</td>
                          <td className="p-3 text-right">{record.ciiAttained?.toFixed(2)}</td>
                          <td className="p-3 text-right">{record.ciiRequired?.toFixed(2)}</td>
                          <td className="p-3 text-center">
                            <Badge className="font-bold" style={{ backgroundColor: RATING_COLORS[record.ciiRating as keyof typeof RATING_COLORS] }}>
                              {record.ciiRating}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline">{record.status}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ets" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-full">
                    <Cloud className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Liable CO2 (EU)</p>
                    <p className="text-xl font-bold">12,450 mt</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-full">
                    <Filter className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ETS Phase In (2024)</p>
                    <p className="text-xl font-bold">40%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-full">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Allowances Secured</p>
                    <p className="text-xl font-bold">8,500 <span className="text-sm font-normal text-muted-foreground">EUA</span></p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>EU ETS Emissions Ledger</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left">Vessel</th>
                      <th className="p-3 text-left">Period</th>
                      <th className="p-3 text-right">CO2 Emissions</th>
                      <th className="p-3 text-right">Liable CO2</th>
                      <th className="p-3 text-right">Total Cost (€)</th>
                      <th className="p-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etsRecords?.map((record) => {
                      const vessel = vessels?.find(v => v.id === record.vesselId);
                      return (
                        <tr key={record.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium">{vessel?.name || `Vessel #${record.vesselId}`}</td>
                          <td className="p-3">{record.reportingPeriod} {record.reportingYear}</td>
                          <td className="p-3 text-right">{record.co2Emissions?.toLocaleString()} mt</td>
                          <td className="p-3 text-right">{record.etsLiableCo2?.toLocaleString()} mt</td>
                          <td className="p-3 text-right text-destructive font-medium">
                            €{(record.totalCostEur || 0).toLocaleString()}
                          </td>
                          <td className="p-3">
                            <Badge variant="secondary">{record.status}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dcs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>IMO DCS Reports</CardTitle>
              <CardDescription>Annual fuel oil consumption data collection reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left">Vessel</th>
                      <th className="p-3 text-left">Year</th>
                      <th className="p-3 text-right">Total Fuel</th>
                      <th className="p-3 text-right">Distance</th>
                      <th className="p-3 text-left">Verifier</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dcsReports?.map((report) => {
                      const vessel = vessels?.find(v => v.id === report.vesselId);
                      return (
                        <tr key={report.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium">{vessel?.name || `Vessel #${report.vesselId}`}</td>
                          <td className="p-3">{report.reportingYear}</td>
                          <td className="p-3 text-right">{(report.totalFuel || 0).toLocaleString()} mt</td>
                          <td className="p-3 text-right">{(report.distanceNm || 0).toLocaleString()} nm</td>
                          <td className="p-3">{report.verifier || "N/A"}</td>
                          <td className="p-3">
                            <Badge variant={report.status === "verified" ? "default" : "secondary"}>
                              {report.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Button size="sm" variant="ghost" data-testid={`button-view-dcs-${report.id}`}>
                              <Download className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Sub-components for forms
function CiiForm({ vessels, onSuccess }: { vessels: Vessel[], onSuccess: () => void }) {
  const form = useForm({
    resolver: zodResolver(insertCiiRecordSchema),
    defaultValues: {
      vesselId: vessels[0]?.id || 0,
      reportingYear: new Date().getFullYear(),
      totalCo2Mt: 0,
      distanceNm: 0,
      ciiAttained: 0,
      ciiRating: "C",
      status: "draft",
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/environmental/cii", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/environmental/cii"] });
      queryClient.invalidateQueries({ queryKey: ["/api/environmental/fleet-summary"] });
      onSuccess();
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="vesselId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vessel</FormLabel>
                <Select onValueChange={(v) => field.onChange(parseInt(v))} defaultValue={field.value.toString()}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vessel" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {vessels.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="reportingYear"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Year</FormLabel>
                <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="totalCo2Mt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total CO2 (mt)</FormLabel>
                <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="distanceNm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Distance (nm)</FormLabel>
                <Input type="number" step="0.1" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="ciiAttained"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Attained CII</FormLabel>
                <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ciiRating"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rating</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Rating" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {["A", "B", "C", "D", "E"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Submitting..." : "Save CII Record"}
        </Button>
      </form>
    </Form>
  );
}

function EtsForm({ vessels, onSuccess }: { vessels: Vessel[], onSuccess: () => void }) {
  const form = useForm({
    resolver: zodResolver(insertEuEtsRecordSchema),
    defaultValues: {
      vesselId: vessels[0]?.id || 0,
      reportingYear: new Date().getFullYear(),
      reportingPeriod: "Q1",
      co2Emissions: 0,
      etsPercentage: 40,
      etsPriceEur: 80,
      status: "draft",
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/environmental/eu-ets", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/environmental/eu-ets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/environmental/fleet-summary"] });
      onSuccess();
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="vesselId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vessel</FormLabel>
                <Select onValueChange={(v) => field.onChange(parseInt(v))} defaultValue={field.value.toString()}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vessel" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {vessels.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="reportingPeriod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Period</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Period" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {["Q1", "Q2", "Q3", "Q4", "Annual"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="co2Emissions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CO2 Emissions in EU Scope (mt)</FormLabel>
              <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="etsPercentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Liability % (e.g. 40)</FormLabel>
                <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="etsPriceEur"
            render={({ field }) => (
              <FormItem>
                <FormLabel>EUA Price (€)</FormLabel>
                <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          Calculate & Save
        </Button>
      </form>
    </Form>
  );
}

function DcsForm({ vessels, onSuccess }: { vessels: Vessel[], onSuccess: () => void }) {
  const form = useForm({
    resolver: zodResolver(insertDcsReportSchema),
    defaultValues: {
      vesselId: vessels[0]?.id || 0,
      reportingYear: new Date().getFullYear() - 1,
      totalFuel: 0,
      distanceNm: 0,
      hoursUnderway: 0,
      transportWork: 0,
      verifier: "",
      status: "draft",
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/environmental/dcs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/environmental/dcs"] });
      onSuccess();
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="vesselId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vessel</FormLabel>
                <Select onValueChange={(v) => field.onChange(parseInt(v))} defaultValue={field.value.toString()}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vessel" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {vessels.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="reportingYear"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Year</FormLabel>
                <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="totalFuel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Fuel (mt)</FormLabel>
                <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="distanceNm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Distance (nm)</FormLabel>
                <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="verifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Verifier Organization</FormLabel>
              <Input placeholder="e.g. DNV, ABS, Lloyd's Register" {...field} />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          Generate Report
        </Button>
      </form>
    </Form>
  );
}
