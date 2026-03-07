import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Ship, Calendar, MapPin, Navigation, Wind, Waves, Fuel, Clock, Plus,
  Search, Filter, ChevronRight, ChevronDown, Activity, Info, TrendingUp, BarChart2,
  Trash2, Edit2, Loader2, Thermometer, Droplets
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export default function NoonReportsPage() {
  const { toast } = useToast();
  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [selectedVoyageId, setSelectedVoyageId] = useState<string>("all");
  const [isNewReportOpen, setIsNewReportOpen] = useState(false);

  // Fetch vessels
  const { data: vessels } = useQuery<any[]>({
    queryKey: ["/api/vessels"],
  });

  // Set default vessel
  useMemo(() => {
    if (vessels && vessels.length > 0 && !selectedVesselId) {
      setSelectedVesselId(vessels[0].id.toString());
    }
  }, [vessels, selectedVesselId]);

  // Fetch voyages for selected vessel
  const { data: voyages } = useQuery<any[]>({
    queryKey: ["/api/voyages", { vesselId: selectedVesselId }],
    enabled: !!selectedVesselId,
    queryFn: async () => {
        const res = await fetch(`/api/voyages?vesselId=${selectedVesselId}`);
        if (!res.ok) throw new Error("Failed to fetch voyages");
        return res.json();
    }
  });

  // Fetch noon reports
  const { data: reports, isLoading: reportsLoading } = useQuery<any[]>({
    queryKey: ["/api/noon-reports", selectedVesselId, selectedVoyageId],
    enabled: !!selectedVesselId,
    queryFn: async () => {
      let url = `/api/noon-reports/vessels/${selectedVesselId}/noon-reports`;
      const params = new URLSearchParams();
      if (selectedVoyageId !== "all") params.append("voyageId", selectedVoyageId);
      if (params.toString()) url += `?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    }
  });

  // Fetch performance stats
  const { data: stats } = useQuery<any>({
    queryKey: ["/api/performance-stats", selectedVesselId],
    enabled: !!selectedVesselId,
    queryFn: async () => {
      const res = await fetch(`/api/noon-reports/vessels/${selectedVesselId}/performance-stats`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    }
  });

  // Create report mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/noon-reports/vessels/${selectedVesselId}/noon-reports`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/noon-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/performance-stats"] });
      setIsNewReportOpen(false);
      toast({ title: "Report created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create report", description: error.message, variant: "destructive" });
    }
  });

  const chartData = useMemo(() => {
    if (!reports) return [];
    return [...reports].reverse().map(r => ({
      date: format(new Date(r.reportDate), "MMM dd"),
      speed: r.speedOverGround || 0,
      consumption: (r.hfoConsumed || 0) + (r.mgoConsumed || 0) + (r.lsfoConsumed || 0),
      rpm: r.rpm || 0
    }));
  }, [reports]);

  return (
    <div className="min-h-screen bg-background p-6">
      <PageMeta title="Performance & Noon Reports | VesselPDA" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vessel Performance</h1>
          <p className="text-muted-foreground">Monitor noon reports and technical performance</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
            <SelectTrigger className="w-[180px]">
              <Ship className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Select Vessel" />
            </SelectTrigger>
            <SelectContent>
              {vessels?.map(v => (
                <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={isNewReportOpen} onOpenChange={setIsNewReportOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Noon Report
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Noon Report</DialogTitle>
              </DialogHeader>
              <NoonReportForm 
                vesselId={parseInt(selectedVesselId)} 
                voyages={voyages || []}
                lastReport={reports?.[0]}
                onSubmit={(data) => createMutation.mutate(data)}
                isPending={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard icon={Navigation} label="Avg Speed" value={`${stats?.avgSpeed || 0} kts`} />
        <StatsCard icon={Fuel} label="Avg Consumption" value={`${stats?.avgDailyConsumption || 0} MT/day`} />
        <StatsCard icon={Activity} label="Total Distance" value={`${stats?.totalDistance || 0} NM`} />
        <StatsCard icon={Calendar} label="Reported Days" value={`${stats?.reportDays || 0} Days`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-lg">Recent Reports</h3>
            <Select value={selectedVoyageId} onValueChange={setSelectedVoyageId}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <Filter className="w-3 h-3 mr-2" />
                <SelectValue placeholder="All Voyages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Voyages</SelectItem>
                {voyages?.map(v => (
                  <SelectItem key={v.id} value={v.id.toString()}>Voyage #{v.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2">
            {reportsLoading ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
            ) : reports?.length === 0 ? (
              <div className="text-center py-12 bg-muted/20 rounded-xl border-2 border-dashed">
                <Info className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground font-medium">No reports found</p>
              </div>
            ) : (
              reports?.map(report => (
                <ReportCard key={report.id} report={report} />
              ))
            )}
          </div>
        </div>

        {/* Charts & Analytics */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Speed & RPM Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line yAxisId="left" type="monotone" dataKey="speed" name="Speed (kts)" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                    <Line yAxisId="right" type="monotone" dataKey="rpm" name="RPM" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Fuel className="w-4 h-4 text-primary" /> Daily Fuel Consumption (MT)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="consumption" name="Total Consumption" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <Card className="hover-elevate transition-all">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportCard({ report }: { report: any }) {
  return (
    <Card className="group hover-elevate transition-all border-l-4 border-l-primary">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-bold text-sm">{format(new Date(report.reportDate), "MMM dd, yyyy")} @ {report.reportTime}</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <MapPin className="w-3 h-3" />
              <span>{report.positionDescription || `${report.latitude?.toFixed(2)}, ${report.longitude?.toFixed(2)}`}</span>
            </div>
          </div>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
            {report.speedOverGround || 0} kts
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 py-2 border-y border-border/50 my-3">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase">RPM</p>
            <p className="text-xs font-bold">{report.rpm || "—"}</p>
          </div>
          <div className="text-center border-x border-border/50">
            <p className="text-[10px] text-muted-foreground uppercase">Fuel Cons.</p>
            <p className="text-xs font-bold">{(report.hfoConsumed + report.mgoConsumed + report.lsfoConsumed).toFixed(1)} MT</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Distance</p>
            <p className="text-xs font-bold">{report.distanceLastNoon || "—"} NM</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Waves className="w-3 h-3 text-blue-500" />
              <span>State: {report.seaState ?? "—"}</span>
            </div>
            <div className="flex items-center gap-1">
              <Wind className="w-3 h-3 text-sky-500" />
              <span>Force: {report.windForce ?? "—"}</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
            Details <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NoonReportForm({ vesselId, voyages, lastReport, onSubmit, isPending }: { 
  vesselId: number, 
  voyages: any[], 
  lastReport?: any,
  onSubmit: (data: any) => void,
  isPending: boolean 
}) {
  const [formData, setFormData] = useState({
    reportDate: format(new Date(), "yyyy-MM-dd"),
    reportTime: "12:00",
    voyageId: lastReport?.voyageId?.toString() || (voyages?.[0]?.id?.toString() || ""),
    latitude: "",
    longitude: "",
    positionDescription: "",
    speedOverGround: "",
    speedThroughWater: "",
    rpm: "",
    distanceLastNoon: "",
    distanceToGo: "",
    eta: "",
    seaState: "0",
    windForce: "0",
    windDirection: "N",
    swellHeight: "",
    hfoRob: lastReport?.hfoRob?.toString() || "",
    mgoRob: lastReport?.mgoRob?.toString() || "",
    lsfoRob: lastReport?.lsfoRob?.toString() || "",
    hfoConsumed: "",
    mgoConsumed: "",
    lsfoConsumed: "",
    mainEngineHours: "",
    auxEngineHours: "",
    remarks: ""
  });

  const handleRobChange = (type: 'hfo' | 'mgo' | 'lsfo', currentRobStr: string) => {
    const currentRob = parseFloat(currentRobStr);
    const prevRob = lastReport ? parseFloat(lastReport[`${type}Rob`]) : NaN;
    
    let consumed = "";
    if (!isNaN(currentRob) && !isNaN(prevRob)) {
      consumed = Math.max(0, prevRob - currentRob).toFixed(2);
    }

    setFormData(prev => ({
      ...prev,
      [`${type}Rob`]: currentRobStr,
      [`${type}Consumed`]: consumed
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      vesselId,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      speedOverGround: formData.speedOverGround ? parseFloat(formData.speedOverGround) : null,
      speedThroughWater: formData.speedThroughWater ? parseFloat(formData.speedThroughWater) : null,
      rpm: formData.rpm ? parseInt(formData.rpm) : null,
      distanceLastNoon: formData.distanceLastNoon ? parseFloat(formData.distanceLastNoon) : null,
      distanceToGo: formData.distanceToGo ? parseFloat(formData.distanceToGo) : null,
      seaState: parseInt(formData.seaState),
      windForce: parseInt(formData.windForce),
      swellHeight: formData.swellHeight ? parseFloat(formData.swellHeight) : null,
      hfoRob: formData.hfoRob ? parseFloat(formData.hfoRob) : null,
      mgoRob: formData.mgoRob ? parseFloat(formData.mgoRob) : null,
      lsfoRob: formData.lsfoRob ? parseFloat(formData.lsfoRob) : null,
      hfoConsumed: formData.hfoConsumed ? parseFloat(formData.hfoConsumed) : 0,
      mgoConsumed: formData.mgoConsumed ? parseFloat(formData.mgoConsumed) : 0,
      lsfoConsumed: formData.lsfoConsumed ? parseFloat(formData.lsfoConsumed) : 0,
      mainEngineHours: formData.mainEngineHours ? parseFloat(formData.mainEngineHours) : null,
      auxEngineHours: formData.auxEngineHours ? parseFloat(formData.auxEngineHours) : null,
      voyageId: formData.voyageId ? parseInt(formData.voyageId) : null,
      eta: formData.eta || null,
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Report Date</Label>
          <Input type="date" value={formData.reportDate} onChange={e => setFormData(p => ({ ...p, reportDate: e.target.value }))} required />
        </div>
        <div className="space-y-2">
          <Label>Report Time</Label>
          <Input type="time" value={formData.reportTime} onChange={e => setFormData(p => ({ ...p, reportTime: e.target.value }))} required />
        </div>
        <div className="space-y-2">
          <Label>Voyage</Label>
          <Select value={formData.voyageId} onValueChange={v => setFormData(p => ({ ...p, voyageId: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select Voyage" />
            </SelectTrigger>
            <SelectContent>
              {voyages.map(v => (
                <SelectItem key={v.id} value={v.id.toString()}>Voyage #{v.id} - {v.vesselName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Position Description</Label>
          <Input placeholder="e.g. 20 NM SW of Cape Town" value={formData.positionDescription} onChange={e => setFormData(p => ({ ...p, positionDescription: e.target.value }))} />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-sm border-b pb-2">Technical Data</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>SOG (knots)</Label>
            <Input type="number" step="0.1" value={formData.speedOverGround} onChange={e => setFormData(p => ({ ...p, speedOverGround: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>RPM</Label>
            <Input type="number" value={formData.rpm} onChange={e => setFormData(p => ({ ...p, rpm: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Dist. Last Noon</Label>
            <Input type="number" step="0.1" value={formData.distanceLastNoon} onChange={e => setFormData(p => ({ ...p, distanceLastNoon: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-sm border-b pb-2">Fuel (ROB & Consumption)</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>HFO ROB</Label>
            <Input type="number" step="0.01" value={formData.hfoRob} onChange={e => handleRobChange('hfo', e.target.value)} />
            {formData.hfoConsumed && <p className="text-[10px] text-emerald-600 font-medium">Cons: {formData.hfoConsumed} MT</p>}
          </div>
          <div className="space-y-2">
            <Label>MGO ROB</Label>
            <Input type="number" step="0.01" value={formData.mgoRob} onChange={e => handleRobChange('mgo', e.target.value)} />
            {formData.mgoConsumed && <p className="text-[10px] text-emerald-600 font-medium">Cons: {formData.mgoConsumed} MT</p>}
          </div>
          <div className="space-y-2">
            <Label>LSFO ROB</Label>
            <Input type="number" step="0.01" value={formData.lsfoRob} onChange={e => handleRobChange('lsfo', e.target.value)} />
            {formData.lsfoConsumed && <p className="text-[10px] text-emerald-600 font-medium">Cons: {formData.lsfoConsumed} MT</p>}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold text-sm border-b pb-2">Weather & Environment</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Sea State (0-9)</Label>
            <Input type="number" min="0" max="9" value={formData.seaState} onChange={e => setFormData(p => ({ ...p, seaState: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Wind Force (Bft)</Label>
            <Input type="number" min="0" max="12" value={formData.windForce} onChange={e => setFormData(p => ({ ...p, windForce: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Wind Direction</Label>
            <Select value={formData.windDirection} onValueChange={v => setFormData(p => ({ ...p, windDirection: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map(d => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Remarks</Label>
        <Textarea value={formData.remarks} onChange={e => setFormData(p => ({ ...p, remarks: e.target.value }))} placeholder="Any observations or events..." />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Submit Noon Report
        </Button>
      </DialogFooter>
    </form>
  );
}
