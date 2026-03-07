import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Plus,
  Calendar,
  User,
  MoreVertical,
  Shield,
  FileText,
  MapPin,
  ClipboardList
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { fmtDate } from "@/lib/formatDate";
import type { Vessel, VesselDefect, PscInspection, PscDeficiency } from "@shared/schema";

export default function DefectTracker() {
  const { toast } = useToast();
  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("defects");

  const { data: vessels = [] } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
  });

  useEffect(() => {
    if (vessels.length > 0 && !selectedVesselId) {
      setSelectedVesselId(vessels[0].id.toString());
    }
  }, [vessels, selectedVesselId]);

  const { data: defects = [], isLoading: loadingDefects } = useQuery<VesselDefect[]>({
    queryKey: [`/api/defects/vessels/${selectedVesselId}`],
    enabled: !!selectedVesselId,
  });

  const { data: inspections = [], isLoading: loadingInspections } = useQuery<PscInspection[]>({
    queryKey: [`/api/psc/vessels/${selectedVesselId}/inspections`],
    enabled: !!selectedVesselId,
  });

  const { data: summary } = useQuery({
    queryKey: ["/api/defects/summary"],
    enabled: !!selectedVesselId,
  });

  const createDefect = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/defects/vessels/${selectedVesselId}`, {
        ...data,
        reportedDate: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/defects/vessels/${selectedVesselId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/defects/summary"] });
      toast({ title: "Defect reported successfully" });
    },
  });

  const updateDefect = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const res = await apiRequest("PATCH", `/api/defects/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/defects/vessels/${selectedVesselId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/defects/summary"] });
      toast({ title: "Defect updated" });
    },
  });

  const createInspection = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/psc/vessels/${selectedVesselId}/inspections`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/psc/vessels/${selectedVesselId}/inspections`] });
      toast({ title: "Inspection recorded" });
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-destructive text-destructive-foreground';
      case 'major': return 'bg-orange-600 text-white';
      case 'minor': return 'bg-yellow-500 text-black';
      case 'routine': return 'bg-slate-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'in_progress': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'pending_parts': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'closed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'pass': return 'bg-emerald-500 text-white';
      case 'deficiencies': return 'bg-orange-500 text-white';
      case 'detention': return 'bg-red-600 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageMeta title="Defect Tracker & PSC | VPDA" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Defect Tracker</h1>
          <p className="text-slate-400 mt-1">Monitor vessel defects, non-conformities and PSC inspections</p>
        </div>
        
        <div className="w-full md:w-64">
          <Label htmlFor="vessel-select" className="text-slate-400 mb-2 block">Active Vessel</Label>
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
                <p className="text-sm font-medium text-slate-400">Open Defects</p>
                <h2 className="text-2xl font-bold text-white">{summary?.open || 0}</h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Critical</p>
                <h2 className="text-2xl font-bold text-red-500">{summary?.critical || 0}</h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Monthly Closed</p>
                <h2 className="text-2xl font-bold text-emerald-500">0</h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">PSC Detention History</p>
                <h2 className="text-2xl font-bold text-white">
                  {inspections.filter(i => i.detention).length}
                </h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-900 border-slate-800">
          <TabsTrigger value="defects" className="data-[state=active]:bg-slate-800">Defect Log</TabsTrigger>
          <TabsTrigger value="psc" className="data-[state=active]:bg-slate-800">PSC Inspections</TabsTrigger>
        </TabsList>

        <TabsContent value="defects" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input placeholder="Search defects..." className="pl-10 bg-slate-900 border-slate-800 text-white" />
            </div>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-sky-600 hover:bg-sky-700 text-white">
                  <Plus className="h-4 w-4 mr-2" /> Report New Defect
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Report New Defect</DialogTitle>
                </DialogHeader>
                <form className="grid grid-cols-2 gap-4 py-4" onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  createDefect.mutate(Object.fromEntries(formData));
                }}>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="title">Defect Title</Label>
                    <Input id="title" name="title" required className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Select name="location">
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="main_engine">Main Engine</SelectItem>
                        <SelectItem value="bridge">Bridge</SelectItem>
                        <SelectItem value="hull">Hull</SelectItem>
                        <SelectItem value="deck">Deck</SelectItem>
                        <SelectItem value="accommodation">Accommodation</SelectItem>
                        <SelectItem value="cargo_hold">Cargo Hold</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defectType">Type</Label>
                    <Select name="defectType" defaultValue="defect">
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="defect">Defect</SelectItem>
                        <SelectItem value="non_conformity">Non-Conformity</SelectItem>
                        <SelectItem value="near_miss">Near Miss</SelectItem>
                        <SelectItem value="observation">Observation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select name="priority" defaultValue="routine">
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="major">Major</SelectItem>
                        <SelectItem value="minor">Minor</SelectItem>
                        <SelectItem value="routine">Routine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignedTo">Assigned To</Label>
                    <Input id="assignedTo" name="assignedTo" className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" className="bg-slate-800 border-slate-700" />
                  </div>
                  <DialogFooter className="col-span-2">
                    <Button type="submit" disabled={createDefect.isPending}>
                      {createDefect.isPending ? "Reporting..." : "Report Defect"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/50 text-slate-400 font-medium">
                  <tr>
                    <th className="px-4 py-3">Title / No</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Reported</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assigned To</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {defects.map((defect) => (
                    <tr key={defect.id} className="text-slate-300 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-medium text-white">{defect.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{defect.defectNumber || 'DEF-PENDING'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className="bg-slate-800 border-slate-700 text-slate-400 capitalize">
                          {defect.location?.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                          {fmtDate(defect.reportedDate)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge className={`${getPriorityColor(defect.priority)} border-none text-[10px]`}>
                          {defect.priority.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className={`${getStatusColor(defect.status)} border capitalize`}>
                          {defect.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-slate-500" />
                          {defect.assignedTo || 'Unassigned'}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {defects.length === 0 && !loadingDefects && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500 italic">
                        No defects reported for this vessel.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="psc" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input placeholder="Search inspections..." className="pl-10 bg-slate-900 border-slate-800 text-white" />
            </div>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-sky-600 hover:bg-sky-700 text-white">
                  <Plus className="h-4 w-4 mr-2" /> Record PSC Inspection
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Record PSC Inspection</DialogTitle>
                </DialogHeader>
                <form className="grid grid-cols-2 gap-4 py-4" onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  createInspection.mutate(Object.fromEntries(formData));
                }}>
                  <div className="space-y-2">
                    <Label htmlFor="inspectionDate">Inspection Date</Label>
                    <Input id="inspectionDate" name="inspectionDate" type="date" required className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input id="port" name="port" required className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pscAuthority">PSC Authority (MOU)</Label>
                    <Select name="pscAuthority">
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Select Authority" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="Paris MOU">Paris MOU</SelectItem>
                        <SelectItem value="Tokyo MOU">Tokyo MOU</SelectItem>
                        <SelectItem value="USCG">USCG</SelectItem>
                        <SelectItem value="Black Sea MOU">Black Sea MOU</SelectItem>
                        <SelectItem value="Mediterranean MOU">Mediterranean MOU</SelectItem>
                        <SelectItem value="Vina del Mar">Vina del Mar</SelectItem>
                        <SelectItem value="Abuja MOU">Abuja MOU</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="result">Overall Result</Label>
                    <Select name="result" defaultValue="pass">
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Select result" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="pass">Clean Inspection (Pass)</SelectItem>
                        <SelectItem value="deficiencies">Deficiencies Found</SelectItem>
                        <SelectItem value="detention">Vessel Detained</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deficiencyCount">Deficiency Count</Label>
                    <Input id="deficiencyCount" name="deficiencyCount" type="number" defaultValue="0" className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2 flex items-center pt-8">
                    <input type="checkbox" id="detention" name="detention" className="mr-2" />
                    <Label htmlFor="detention">Vessel Detained?</Label>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="notes">Inspection Notes</Label>
                    <Textarea id="notes" name="notes" className="bg-slate-800 border-slate-700" />
                  </div>
                  <DialogFooter className="col-span-2">
                    <Button type="submit" disabled={createInspection.isPending}>
                      {createInspection.isPending ? "Recording..." : "Record Inspection"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {inspections.map((inspection) => (
                <Card key={inspection.id} className="bg-slate-900 border-slate-800 overflow-hidden">
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/20">
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${getResultColor(inspection.result)}`}>
                        <Shield className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-white font-bold">{inspection.port}</h3>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          {fmtDate(inspection.inspectionDate)}
                          <span className="mx-1">•</span>
                          {inspection.pscAuthority}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={`${getResultColor(inspection.result)} border-none text-[10px] mb-1`}>
                        {inspection.result?.toUpperCase()}
                      </Badge>
                      <div className="text-xs text-slate-400">
                        {inspection.deficiencyCount} Deficiencies
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    {inspection.detention && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3 mb-4 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-red-500">Vessel was Detained</p>
                          <p className="text-xs text-red-400/80 mt-1">{inspection.detentionReason || "Reason not specified in record."}</p>
                        </div>
                      </div>
                    )}
                    <div className="text-sm text-slate-300">
                      {inspection.notes || "No additional notes for this inspection."}
                    </div>
                    <div className="mt-4 flex justify-between items-center">
                      <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-300 hover:text-white">
                        <FileText className="h-4 w-4 mr-2" /> View Deficiencies
                      </Button>
                      <Button variant="ghost" size="sm" className="text-sky-500 hover:text-sky-400">
                        Edit Record
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {inspections.length === 0 && !loadingInspections && (
                <div className="text-center py-12 bg-slate-900/50 border border-dashed border-slate-800 rounded-lg">
                  <Shield className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500">No inspection history found for this vessel.</p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Open PSC Deficiencies
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-8 text-slate-500 text-sm">
                    No open PSC deficiencies.
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-sky-500" />
                    Recent PSC Result Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 flex items-center justify-center text-slate-500 text-xs italic">
                    Chart visualization placeholder
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
