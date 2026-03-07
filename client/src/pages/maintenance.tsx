import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Settings, 
  Wrench, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  MoreVertical,
  Calendar,
  User,
  History,
  Info
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
import { fmtDate } from "@/lib/formatDate";
import type { Vessel, VesselEquipment, MaintenanceJob } from "@shared/schema";

export default function MaintenancePage() {
  const { toast } = useToast();
  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("equipment");

  const { data: vessels = [] } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
  });

  useEffect(() => {
    if (vessels.length > 0 && !selectedVesselId) {
      setSelectedVesselId(vessels[0].id.toString());
    }
  }, [vessels, selectedVesselId]);

  const { data: equipment = [], isLoading: loadingEquip } = useQuery<VesselEquipment[]>({
    queryKey: [`/api/maintenance/vessels/${selectedVesselId}/equipment`],
    enabled: !!selectedVesselId,
  });

  const { data: jobs = [], isLoading: loadingJobs } = useQuery<MaintenanceJob[]>({
    queryKey: [`/api/maintenance/vessels/${selectedVesselId}/maintenance-jobs`],
    enabled: !!selectedVesselId,
  });

  const { data: summary } = useQuery({
    queryKey: [`/api/maintenance/vessels/${selectedVesselId}/maintenance-summary`],
    enabled: !!selectedVesselId,
  });

  const createEquipment = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/maintenance/vessels/${selectedVesselId}/equipment`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/maintenance/vessels/${selectedVesselId}/equipment`] });
      toast({ title: "Equipment added successfully" });
    },
  });

  const createJob = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/maintenance/vessels/${selectedVesselId}/maintenance-jobs`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/maintenance/vessels/${selectedVesselId}/maintenance-jobs`] });
      queryClient.invalidateQueries({ queryKey: [`/api/maintenance/vessels/${selectedVesselId}/maintenance-summary`] });
      toast({ title: "Maintenance job created" });
    },
  });

  const updateJob = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const res = await apiRequest("PATCH", `/api/maintenance/maintenance-jobs/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/maintenance/vessels/${selectedVesselId}/maintenance-jobs`] });
      queryClient.invalidateQueries({ queryKey: [`/api/maintenance/vessels/${selectedVesselId}/maintenance-summary`] });
      toast({ title: "Job updated" });
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-destructive text-destructive-foreground';
      case 'urgent': return 'bg-orange-500 text-white';
      case 'routine': return 'bg-blue-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  const getStatusColor = (status: string, nextDueDate: string | null) => {
    if (status === 'completed') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    if (status === 'overdue' || (nextDueDate && new Date(nextDueDate) < new Date())) return 'bg-destructive/10 text-destructive border-destructive/20';
    if (nextDueDate && new Date(nextDueDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageMeta title="Planned Maintenance System | VPDA" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Planned Maintenance</h1>
          <p className="text-slate-400 mt-1">Manage vessel equipment and maintenance schedules</p>
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
                <p className="text-sm font-medium text-slate-400">Total Jobs</p>
                <h2 className="text-2xl font-bold text-white">{summary?.total || 0}</h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Wrench className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Overdue</p>
                <h2 className="text-2xl font-bold text-destructive">{summary?.overdue || 0}</h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Next 30 Days</p>
                <h2 className="text-2xl font-bold text-orange-500">{summary?.upcoming || 0}</h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Completed</p>
                <h2 className="text-2xl font-bold text-emerald-500">{summary?.completed || 0}</h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-900 border-slate-800">
          <TabsTrigger value="equipment" className="data-[state=active]:bg-slate-800">Equipment</TabsTrigger>
          <TabsTrigger value="jobs" className="data-[state=active]:bg-slate-800">Job Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="equipment" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input placeholder="Search equipment..." className="pl-10 bg-slate-900 border-slate-800 text-white" />
            </div>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-sky-600 hover:bg-sky-700 text-white">
                  <Plus className="h-4 w-4 mr-2" /> Add Equipment
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Equipment</DialogTitle>
                </DialogHeader>
                <form className="grid grid-cols-2 gap-4 py-4" onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  createEquipment.mutate(Object.fromEntries(formData));
                }}>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="name">Equipment Name</Label>
                    <Input id="name" name="name" required className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="equipmentType">Type</Label>
                    <Select name="equipmentType">
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="main_engine">Main Engine</SelectItem>
                        <SelectItem value="aux_engine">Auxiliary Engine</SelectItem>
                        <SelectItem value="pump">Pump</SelectItem>
                        <SelectItem value="boiler">Boiler</SelectItem>
                        <SelectItem value="navigation">Navigation</SelectItem>
                        <SelectItem value="safety">Safety</SelectItem>
                        <SelectItem value="deck">Deck Equipment</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Select name="location">
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="engine_room">Engine Room</SelectItem>
                        <SelectItem value="bridge">Bridge</SelectItem>
                        <SelectItem value="deck">Deck</SelectItem>
                        <SelectItem value="accommodation">Accommodation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manufacturer">Manufacturer</Label>
                    <Input id="manufacturer" name="manufacturer" className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input id="model" name="model" className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="serialNumber">Serial Number</Label>
                    <Input id="serialNumber" name="serialNumber" className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="installDate">Install Date</Label>
                    <Input id="installDate" name="installDate" type="date" className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" name="notes" className="bg-slate-800 border-slate-700" />
                  </div>
                  <DialogFooter className="col-span-2">
                    <Button type="submit" disabled={createEquipment.isPending}>
                      {createEquipment.isPending ? "Adding..." : "Add Equipment"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {equipment.map((item) => (
              <Card key={item.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center">
                      <Settings className="h-6 w-6 text-sky-500" />
                    </div>
                    <Badge variant="outline" className="bg-slate-800 border-slate-700 text-slate-300">
                      {item.equipmentType?.replace('_', ' ')}
                    </Badge>
                  </div>
                  <CardTitle className="text-white mt-4">{item.name}</CardTitle>
                  <CardDescription className="text-slate-400">
                    {item.manufacturer} {item.model}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-slate-500">Location:</div>
                    <div className="text-slate-300">{item.location?.replace('_', ' ')}</div>
                    <div className="text-slate-500">Serial:</div>
                    <div className="text-slate-300">{item.serialNumber || '—'}</div>
                  </div>
                  
                  <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                    <span className="text-xs text-slate-500">
                      Open Jobs: <span className="text-sky-500 font-bold">{jobs.filter(j => j.equipmentId === item.id && j.status !== 'completed').length}</span>
                    </span>
                    <Button variant="ghost" size="sm" className="text-sky-500 hover:text-sky-400 p-0 h-auto">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="mt-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
             <div className="flex gap-2">
               <Button variant="outline" size="sm" className="bg-slate-900 border-slate-800 text-white">All Jobs</Button>
               <Button variant="outline" size="sm" className="bg-slate-900 border-slate-800 text-slate-400 hover:text-white">Overdue</Button>
               <Button variant="outline" size="sm" className="bg-slate-900 border-slate-800 text-slate-400 hover:text-white">Pending</Button>
               <Button variant="outline" size="sm" className="bg-slate-900 border-slate-800 text-slate-400 hover:text-white">Completed</Button>
             </div>

             <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-sky-600 hover:bg-sky-700 text-white">
                  <Plus className="h-4 w-4 mr-2" /> New Job Order
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Maintenance Job</DialogTitle>
                </DialogHeader>
                <form className="grid grid-cols-2 gap-4 py-4" onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const data = Object.fromEntries(formData);
                  
                  // Calculate next due date if last done date and interval exist
                  if (data.lastDoneDate && data.intervalValue && data.intervalType === 'days') {
                    const next = new Date(data.lastDoneDate as string);
                    next.setDate(next.getDate() + parseInt(data.intervalValue as string));
                    data.nextDueDate = next.toISOString();
                  }
                  
                  createJob.mutate(data);
                }}>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="equipmentId">Equipment</Label>
                    <Select name="equipmentId" required>
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Select equipment" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        {equipment.map(e => (
                          <SelectItem key={e.id} value={e.id.toString()}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="jobName">Job Name</Label>
                    <Input id="jobName" name="jobName" required className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select name="priority" defaultValue="routine">
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="routine">Routine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignedTo">Assigned To</Label>
                    <Input id="assignedTo" name="assignedTo" placeholder="Chief Engineer" className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="intervalValue">Interval Value</Label>
                    <Input id="intervalValue" name="intervalValue" type="number" className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="intervalType">Interval Type</Label>
                    <Select name="intervalType" defaultValue="days">
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Select interval type" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="days">Days</SelectItem>
                        <SelectItem value="hours">Running Hours</SelectItem>
                        <SelectItem value="miles">Nautical Miles</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastDoneDate">Last Done Date</Label>
                    <Input id="lastDoneDate" name="lastDoneDate" type="date" className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimatedHours">Estimated Hours</Label>
                    <Input id="estimatedHours" name="estimatedHours" type="number" step="0.5" className="bg-slate-800 border-slate-700" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="jobDescription">Description</Label>
                    <Textarea id="jobDescription" name="jobDescription" className="bg-slate-800 border-slate-700" />
                  </div>
                  <DialogFooter className="col-span-2">
                    <Button type="submit" disabled={createJob.isPending}>
                      {createJob.isPending ? "Creating..." : "Create Job"}
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
                    <th className="px-4 py-3">Job Name</th>
                    <th className="px-4 py-3">Equipment</th>
                    <th className="px-4 py-3">Next Due</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assigned</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {jobs.map((job) => {
                    const equip = equipment.find(e => e.id === job.equipmentId);
                    return (
                      <tr key={job.id} className="text-slate-300 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-4">
                          <div className="font-medium text-white">{job.jobName}</div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{job.jobDescription}</div>
                        </td>
                        <td className="px-4 py-4 text-slate-400">{equip?.name || 'Unknown'}</td>
                        <td className="px-4 py-4">
                          {job.nextDueDate ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              {fmtDate(job.nextDueDate)}
                            </div>
                          ) : 'Not scheduled'}
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={`${getPriorityColor(job.priority)} border-none text-[10px]`}>
                            {job.priority.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant="outline" className={`${getStatusColor(job.status, job.nextDueDate)} border`}>
                            {job.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center">
                            <User className="h-3 w-3 text-slate-400" />
                          </div>
                          {job.assignedTo || 'Unassigned'}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            {job.status !== 'completed' && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="h-8 border-slate-700 hover:bg-slate-800">
                                    Complete
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-slate-900 border-slate-800 text-white">
                                  <DialogHeader>
                                    <DialogTitle>Complete Maintenance Job</DialogTitle>
                                  </DialogHeader>
                                  <form className="space-y-4 py-4" onSubmit={(e) => {
                                    e.preventDefault();
                                    const formData = new FormData(e.currentTarget);
                                    const updateData = {
                                      ...Object.fromEntries(formData),
                                      status: 'completed',
                                      completedAt: new Date().toISOString()
                                    };
                                    updateJob.mutate({ id: job.id, data: updateData });
                                  }}>
                                    <div className="space-y-2">
                                      <Label htmlFor="actualHours">Actual Hours</Label>
                                      <Input id="actualHours" name="actualHours" type="number" step="0.5" className="bg-slate-800 border-slate-700" />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="partsUsed">Parts Used</Label>
                                      <Textarea id="partsUsed" name="partsUsed" placeholder="O-rings, filters, etc." className="bg-slate-800 border-slate-700" />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="completionNotes">Notes</Label>
                                      <Textarea id="completionNotes" name="completionNotes" className="bg-slate-800 border-slate-700" />
                                    </div>
                                    <DialogFooter>
                                      <Button type="submit" disabled={updateJob.isPending}>
                                        {updateJob.isPending ? "Updating..." : "Confirm Completion"}
                                      </Button>
                                    </DialogFooter>
                                  </form>
                                </DialogContent>
                              </Dialog>
                            )}
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {jobs.length === 0 && !loadingJobs && (
              <div className="py-20 text-center">
                <History className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white">No maintenance jobs found</h3>
                <p className="text-slate-400">Create your first job order to start tracking maintenance</p>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
