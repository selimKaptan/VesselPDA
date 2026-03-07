import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  Calendar, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  MoreVertical,
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  Download,
  Building2,
  Anchor
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { format } from "date-fns";
import type { Vessel, DrydockProject, DrydockJob } from "@shared/schema";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { exportToCsv } from "@/lib/export-csv";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function DrydockPage() {
  const { toast } = useToast();
  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: vessels = [] } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
  });

  useEffect(() => {
    if (vessels.length > 0 && !selectedVesselId) {
      setSelectedVesselId(vessels[0].id.toString());
    }
  }, [vessels, selectedVesselId]);

  const { data: projects = [], isLoading: loadingProjects } = useQuery<DrydockProject[]>({
    queryKey: [`/api/drydock/vessels/${selectedVesselId}`],
    enabled: !!selectedVesselId,
  });

  const { data: upcomingProjects = [] } = useQuery<DrydockProject[]>({
    queryKey: ["/api/drydock/upcoming"],
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  useEffect(() => {
    if (selectedProject && !selectedProjectId) {
      setSelectedProjectId(selectedProject.id);
    }
  }, [selectedProject, selectedProjectId]);

  const { data: jobs = [], isLoading: loadingJobs } = useQuery<DrydockJob[]>({
    queryKey: [`/api/drydock/${selectedProjectId}/jobs`],
    enabled: !!selectedProjectId,
  });

  const createProject = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/drydock", {
        ...data,
        vesselId: parseInt(selectedVesselId),
        plannedBudget: data.plannedBudget ? parseFloat(data.plannedBudget) : 0,
        plannedStart: data.plannedStart ? new Date(data.plannedStart).toISOString() : null,
        plannedEnd: data.plannedEnd ? new Date(data.plannedEnd).toISOString() : null,
      });
      return res.json();
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: [`/api/drydock/vessels/${selectedVesselId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/drydock/upcoming"] });
      setSelectedProjectId(newProject.id);
      toast({ title: "Drydock project created" });
    },
  });

  const createJob = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/drydock/${selectedProjectId}/jobs`, {
        ...data,
        estimatedCost: data.estimatedCost ? parseFloat(data.estimatedCost) : 0,
        plannedDays: data.plannedDays ? parseFloat(data.plannedDays) : 0,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/drydock/${selectedProjectId}/jobs`] });
      toast({ title: "Job added to specification" });
    },
  });

  const updateJob = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const res = await apiRequest("PATCH", `/api/drydock/jobs/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/drydock/${selectedProjectId}/jobs`] });
      toast({ title: "Job updated" });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'in_progress': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'completed': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'cancelled': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-destructive';
      case 'high': return 'text-orange-500';
      case 'normal': return 'text-blue-500';
      case 'optional': return 'text-slate-400';
      default: return 'text-slate-400';
    }
  };

  const totalBudget = selectedProject?.plannedBudget || 0;
  const totalActual = jobs.reduce((acc, job) => acc + (job.actualCost || 0), 0);
  const progress = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

  const costByCategory = jobs.reduce((acc: any[], job) => {
    const category = job.category || 'Other';
    const existing = acc.find(c => c.name === category);
    if (existing) {
      existing.actual += job.actualCost || 0;
      existing.estimated += job.estimatedCost || 0;
    } else {
      acc.push({ name: category, actual: job.actualCost || 0, estimated: job.estimatedCost || 0 });
    }
    return acc;
  }, []);

  const handleExportJobs = () => {
    if (!jobs.length) return;
    const exportData = jobs.map(j => ({
      'Job No': j.jobNumber || '',
      'Category': j.category || '',
      'Description': j.description,
      'Priority': j.priority || '',
      'Status': j.status || '',
      'Est Cost': j.estimatedCost || 0,
      'Act Cost': j.actualCost || 0,
      'Contractor': j.contractor || '',
      'Notes': j.notes || ''
    }));
    exportToCsv(`drydock_spec_${selectedProject?.projectName || 'project'}.csv`, exportData);
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageMeta title="Drydock Management | Barbaros" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Drydock Management</h1>
          <p className="text-slate-400 mt-1">Plan and track shipyard maintenance projects</p>
        </div>
        
        <div className="flex gap-4 items-end">
          <div className="w-64">
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
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-sky-600 hover:bg-sky-700 text-white">
                <Plus className="h-4 w-4 mr-2" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl">
              <DialogHeader>
                <DialogTitle>New Drydock Project</DialogTitle>
              </DialogHeader>
              <form className="grid grid-cols-2 gap-4 py-4" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createProject.mutate(Object.fromEntries(formData));
              }}>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input id="projectName" name="projectName" required className="bg-slate-800 border-slate-700" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dockType">Type</Label>
                  <Select name="dockType" defaultValue="special_survey">
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                      <SelectItem value="special_survey">Special Survey</SelectItem>
                      <SelectItem value="intermediate_survey">Intermediate Survey</SelectItem>
                      <SelectItem value="repair">Repair</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipyard">Shipyard</Label>
                  <Input id="shipyard" name="shipyard" className="bg-slate-800 border-slate-700" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plannedStart">Planned Start</Label>
                  <Input id="plannedStart" name="plannedStart" type="date" className="bg-slate-800 border-slate-700" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plannedEnd">Planned End</Label>
                  <Input id="plannedEnd" name="plannedEnd" type="date" className="bg-slate-800 border-slate-700" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plannedBudget">Budget (USD)</Label>
                  <Input id="plannedBudget" name="plannedBudget" type="number" className="bg-slate-800 border-slate-700" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="superintendent">Superintendent</Label>
                  <Input id="superintendent" name="superintendent" className="bg-slate-800 border-slate-700" />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" className="bg-slate-800 border-slate-700" />
                </div>
                <DialogFooter className="col-span-2">
                  <Button type="submit" disabled={createProject.isPending}>
                    {createProject.isPending ? "Creating..." : "Create Project"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Active Projects</p>
                <h2 className="text-2xl font-bold text-white">
                  {projects.filter(p => p.status === 'in_progress').length}
                </h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Anchor className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Planned (6m)</p>
                <h2 className="text-2xl font-bold text-sky-500">{upcomingProjects.length}</h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-sky-500/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-sky-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">YTD Expenditure</p>
                <h2 className="text-2xl font-bold text-emerald-500">
                  ${projects.filter(p => p.status === 'completed' || p.status === 'in_progress').reduce((acc, p) => acc + (p.actualCost || 0), 0).toLocaleString()}
                </h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Total Projects</p>
                <h2 className="text-2xl font-bold text-white">{projects.length}</h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-slate-500/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-slate-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
            <Building2 className="h-5 w-5 text-sky-500" />
            Project List
          </h2>
          {loadingProjects ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-900/50 animate-pulse rounded-lg border border-slate-800" />)}
            </div>
          ) : projects.length === 0 ? (
            <Card className="bg-slate-900/50 border-dashed border-slate-800">
              <CardContent className="pt-6 text-center text-slate-500">
                No drydock projects found for this vessel.
              </CardContent>
            </Card>
          ) : (
            projects.map((project) => (
              <Card 
                key={project.id} 
                className={`cursor-pointer transition-all hover:border-sky-500/50 ${selectedProjectId === project.id ? 'ring-2 ring-sky-500 bg-sky-500/5 border-sky-500/50' : 'bg-slate-900 border-slate-800'}`}
                onClick={() => setSelectedProjectId(project.id)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className={getStatusColor(project.status || '')}>
                      {project.status?.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {project.plannedStart ? format(new Date(project.plannedStart), "dd MMM yyyy") : "No Date"}
                    </span>
                  </div>
                  <h3 className="font-bold text-white truncate">{project.projectName}</h3>
                  <div className="flex items-center gap-2 mt-2 text-sm text-slate-400">
                    <Building2 className="h-3 w-3" />
                    <span>{project.shipyard || 'Location Pending'}</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-medium">Budget Progress</span>
                      <span className="text-white font-bold">
                        {project.plannedBudget ? Math.round((project.actualCost || 0) / project.plannedBudget * 100) : 0}%
                      </span>
                    </div>
                    <Progress value={project.plannedBudget ? ((project.actualCost || 0) / project.plannedBudget * 100) : 0} className="h-1.5 bg-slate-800" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="lg:col-span-8">
          {selectedProject ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <div className="flex justify-between items-center bg-slate-900 p-2 rounded-lg border border-slate-800">
                <TabsList className="bg-transparent">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-slate-800">
                    <LayoutDashboard className="h-4 w-4 mr-2" /> Overview
                  </TabsTrigger>
                  <TabsTrigger value="jobs" className="data-[state=active]:bg-slate-800">
                    <ClipboardList className="h-4 w-4 mr-2" /> Job Specification
                  </TabsTrigger>
                  <TabsTrigger value="costs" className="data-[state=active]:bg-slate-800">
                    <BarChart3 className="h-4 w-4 mr-2" /> Cost Summary
                  </TabsTrigger>
                </TabsList>
                <div className="flex gap-2 mr-2">
                   <Button variant="outline" size="sm" onClick={() => {
                     if (!selectedProject) return;
                     const doc = new jsPDF();
                     const vesselName = vessels.find(v => v.id.toString() === selectedVesselId)?.name || "Unknown Vessel";
                     
                     doc.setFontSize(20);
                     doc.text("Drydock Specification", 14, 22);
                     doc.setFontSize(11);
                     doc.setTextColor(100);
                     doc.text(`Vessel: ${vesselName}`, 14, 30);
                     doc.text(`Project: ${selectedProject.projectName}`, 14, 35);
                     doc.text(`Shipyard: ${selectedProject.shipyard || 'N/A'}`, 14, 40);
                     doc.text(`Status: ${selectedProject.status?.toUpperCase()}`, 14, 45);
                     
                     doc.setFontSize(14);
                     doc.setTextColor(0);
                     doc.text("Job Specification", 14, 60);

                     const groupedJobs = jobs.reduce((acc: any, job) => {
                       const cat = job.category || 'Other';
                       if (!acc[cat]) acc[cat] = [];
                       acc[cat].push(job);
                       return acc;
                     }, {});

                     let currentY = 65;
                     Object.keys(groupedJobs).forEach(cat => {
                       doc.setFontSize(12);
                       doc.setFont("helvetica", "bold");
                       doc.text(cat, 14, currentY + 5);
                       
                       autoTable(doc, {
                         startY: currentY + 8,
                         head: [['No', 'Description', 'Priority', 'Est Cost', 'Status']],
                         body: groupedJobs[cat].map((j: any) => [
                           j.jobNumber || '-',
                           j.description,
                           j.priority?.toUpperCase(),
                           `$${(j.estimatedCost || 0).toLocaleString()}`,
                           j.status?.toUpperCase()
                         ]),
                       });
                       currentY = (doc as any).lastAutoTable.finalY + 10;
                     });

                     if (currentY > 250) {
                       doc.addPage();
                       currentY = 20;
                     }

                     doc.setFontSize(14);
                     doc.text("Budget vs Actual Summary", 14, currentY + 5);
                     autoTable(doc, {
                       startY: currentY + 10,
                       head: [['Metric', 'Amount']],
                       body: [
                         ['Planned Budget', `$${(selectedProject.plannedBudget || 0).toLocaleString()}`],
                         ['Actual Cost', `$${totalActual.toLocaleString()}`],
                         ['Progress', `${Math.round(progress)}%`]
                       ],
                     });

                     doc.save(`Drydock_Spec_${vesselName}_${selectedProject.projectName}.pdf`);
                   }} className="bg-sky-600 hover:bg-sky-700 text-white h-8 border-none">
                     <Download className="h-3.5 w-3.5 mr-2" /> Export PDF
                   </Button>
                   <Button variant="outline" size="sm" onClick={handleExportJobs} className="bg-slate-800 border-slate-700 h-8">
                     <Download className="h-3.5 w-3.5 mr-2" /> Export CSV
                   </Button>
                </div>
              </div>

              <TabsContent value="overview" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-lg">Project Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-500 font-medium uppercase">Dock Type</p>
                          <p className="text-white capitalize">{selectedProject.dockType?.replace('_', ' ')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium uppercase">Superintendent</p>
                          <p className="text-white">{selectedProject.superintendent || 'Not Assigned'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium uppercase">Start Date</p>
                          <p className="text-white">
                            {selectedProject.actualStart ? format(new Date(selectedProject.actualStart), "dd MMM yyyy") : 
                             selectedProject.plannedStart ? `${format(new Date(selectedProject.plannedStart), "dd MMM yyyy")} (Planned)` : 'Pending'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium uppercase">End Date</p>
                          <p className="text-white">
                            {selectedProject.actualEnd ? format(new Date(selectedProject.actualEnd), "dd MMM yyyy") : 
                             selectedProject.plannedEnd ? `${format(new Date(selectedProject.plannedEnd), "dd MMM yyyy")} (Planned)` : 'Pending'}
                          </p>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-slate-800">
                        <p className="text-xs text-slate-500 font-medium uppercase mb-2">Shipyard Location</p>
                        <div className="flex items-center gap-2 text-white">
                          <Anchor className="h-4 w-4 text-sky-500" />
                          <span>{selectedProject.shipyard} {selectedProject.shipyardLocation ? `- ${selectedProject.shipyardLocation}` : ''}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-lg">Budget vs Actual</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Actual', value: totalActual },
                              { name: 'Remaining', value: Math.max(0, totalBudget - totalActual) }
                            ]}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#3b82f6" />
                            <Cell fill="#1e293b" />
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="text-center -mt-24 mb-16">
                         <p className="text-2xl font-bold text-white">${totalActual.toLocaleString()}</p>
                         <p className="text-xs text-slate-500 font-medium">of ${totalBudget.toLocaleString()}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="jobs" className="mt-0">
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Job Specification</CardTitle>
                      <CardDescription>Detailed list of repair and maintenance items</CardDescription>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-sky-600 hover:bg-sky-700 h-8">
                          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Job
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Add Job to Specification</DialogTitle>
                        </DialogHeader>
                        <form className="grid grid-cols-2 gap-4 py-4" onSubmit={(e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          createJob.mutate(Object.fromEntries(formData));
                        }}>
                          <div className="space-y-2">
                            <Label htmlFor="jobNumber">Job No</Label>
                            <Input id="jobNumber" name="jobNumber" placeholder="e.g. 101" className="bg-slate-800 border-slate-700" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Select name="category" defaultValue="hull_cleaning">
                              <SelectTrigger className="bg-slate-800 border-slate-700">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                <SelectItem value="hull_cleaning">Hull Cleaning & Paint</SelectItem>
                                <SelectItem value="propeller">Propeller & Shaft</SelectItem>
                                <SelectItem value="engine">Main/Aux Engine</SelectItem>
                                <SelectItem value="piping">Piping & Valves</SelectItem>
                                <SelectItem value="electrical">Electrical</SelectItem>
                                <SelectItem value="safety">Safety Equipment</SelectItem>
                                <SelectItem value="class_item">Class Item</SelectItem>
                                <SelectItem value="owner_item">Owner Item</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 col-span-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" name="description" required className="bg-slate-800 border-slate-700" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="priority">Priority</Label>
                            <Select name="priority" defaultValue="normal">
                              <SelectTrigger className="bg-slate-800 border-slate-700">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="optional">Optional</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="estimatedCost">Estimated Cost (USD)</Label>
                            <Input id="estimatedCost" name="estimatedCost" type="number" className="bg-slate-800 border-slate-700" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="contractor">Contractor</Label>
                            <Input id="contractor" name="contractor" className="bg-slate-800 border-slate-700" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="plannedDays">Planned Days</Label>
                            <Input id="plannedDays" name="plannedDays" type="number" step="0.5" className="bg-slate-800 border-slate-700" />
                          </div>
                          <DialogFooter className="col-span-2">
                            <Button type="submit" disabled={createJob.isPending}>
                              {createJob.isPending ? "Adding..." : "Add to Spec"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {loadingJobs ? (
                        <div className="space-y-4">
                          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-800/50 animate-pulse rounded border border-slate-800" />)}
                        </div>
                      ) : jobs.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-800 rounded-lg">
                          No jobs added to specification yet.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="text-slate-500 font-medium border-b border-slate-800">
                              <tr>
                                <th className="pb-3 pr-4">No</th>
                                <th className="pb-3 px-4">Description</th>
                                <th className="pb-3 px-4">Priority</th>
                                <th className="pb-3 px-4">Cost (Est/Act)</th>
                                <th className="pb-3 px-4">Status</th>
                                <th className="pb-3 pl-4">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                              {jobs.map((job) => (
                                <tr key={job.id} className="text-slate-300 hover:bg-slate-800/30 transition-colors">
                                  <td className="py-4 pr-4 font-bold text-white">{job.jobNumber}</td>
                                  <td className="py-4 px-4 max-w-xs">
                                    <div className="font-medium text-slate-200">{job.description}</div>
                                    <div className="text-xs text-slate-500 mt-1 capitalize">{job.category?.replace('_', ' ')}</div>
                                  </td>
                                  <td className="py-4 px-4">
                                    <span className={`text-xs font-bold uppercase ${getPriorityColor(job.priority || '')}`}>
                                      {job.priority}
                                    </span>
                                  </td>
                                  <td className="py-4 px-4">
                                    <div className="text-slate-200 font-medium">${(job.estimatedCost || 0).toLocaleString()}</div>
                                    <div className="text-xs text-emerald-500">${(job.actualCost || 0).toLocaleString()}</div>
                                  </td>
                                  <td className="py-4 px-4">
                                    <Badge variant="outline" className={`text-[10px] ${getStatusColor(job.status || '')}`}>
                                      {job.status?.toUpperCase()}
                                    </Badge>
                                  </td>
                                  <td className="py-4 pl-4">
                                    <div className="flex gap-2">
                                      {job.status !== 'completed' && (
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-8 w-8 text-emerald-500 hover:text-emerald-400"
                                          onClick={() => updateJob.mutate({ id: job.id, data: { status: 'completed', actualCost: job.estimatedCost } })}
                                        >
                                          <CheckCircle2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="costs" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-lg">Category Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={costByCategory}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                          />
                          <Bar dataKey="estimated" name="Estimated" fill="#1e293b" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="actual" name="Actual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-lg">Budget Analysis</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                       <div className="flex justify-between items-center">
                         <span className="text-slate-400 font-medium">Planned Budget</span>
                         <span className="text-white font-bold text-lg">${totalBudget.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between items-center">
                         <span className="text-slate-400 font-medium">Actual Expenditure</span>
                         <span className="text-emerald-500 font-bold text-lg">${totalActual.toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between items-center border-t border-slate-800 pt-4">
                         <span className="text-slate-400 font-medium">Remaining Funds</span>
                         <span className={`font-bold text-lg ${totalBudget - totalActual < 0 ? 'text-destructive' : 'text-sky-500'}`}>
                           ${(totalBudget - totalActual).toLocaleString()}
                         </span>
                       </div>
                       <div className="space-y-2">
                         <div className="flex justify-between text-xs font-medium uppercase tracking-wider">
                           <span className="text-slate-500">Utilization</span>
                           <span className="text-white">{Math.round(progress)}%</span>
                         </div>
                         <Progress value={progress} className="h-2 bg-slate-800" />
                       </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-col items-center justify-center h-[500px] text-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/30">
              <Anchor className="h-16 w-16 text-slate-800 mb-4" />
              <h3 className="text-xl font-medium text-white">Select a Drydock Project</h3>
              <p className="text-slate-500 max-w-xs mt-2">
                Choose a project from the left to view the specification, track jobs, and monitor costs.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
