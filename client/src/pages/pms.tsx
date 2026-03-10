import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Settings, 
  Wrench, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Calendar,
  User,
  History,
  Info,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  Box,
  ClipboardList,
  Timer,
  FileSearch,
  Activity,
  Filter,
  ArrowUpRight,
  MoreVertical,
  Check
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import type { 
  Vessel, 
  EquipmentCategory, 
  EquipmentItem, 
  PmsJob, 
  WorkOrder, 
  RunningHoursEntry, 
  ClassSurvey, 
  ConditionReport 
} from "@shared/schema";

export default function PMSPage() {
  const { toast } = useToast();
  const [selectedVesselId, setSelectedVesselId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null);

  // Queries
  const { data: vessels = [] } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
  });

  useMemo(() => {
    if (vessels.length > 0 && !selectedVesselId) {
      setSelectedVesselId(vessels[0].id.toString());
    }
  }, [vessels, selectedVesselId]);

  const { data: treeData, isLoading: loadingTree } = useQuery<{
    tree: any[];
    flatCategories: EquipmentCategory[];
    flatEquipment: EquipmentItem[];
    stats: any;
  }>({
    queryKey: [`/api/v1/pms/vessels/${selectedVesselId}/equipment-tree`],
    enabled: !!selectedVesselId,
  });

  const { data: jobsData, isLoading: loadingJobs } = useQuery<{
    jobs: (PmsJob & { equipmentName?: string; equipmentCode?: string; categoryName?: string })[];
    summary: any;
  }>({
    queryKey: [`/api/v1/pms/vessels/${selectedVesselId}/jobs`],
    enabled: !!selectedVesselId,
  });

  const { data: woData, isLoading: loadingWOs } = useQuery<{
    workOrders: (WorkOrder & { equipmentName?: string; jobTitle?: string })[];
    summary: any;
  }>({
    queryKey: [`/api/v1/pms/vessels/${selectedVesselId}/work-orders`],
    enabled: !!selectedVesselId,
  });

  const { data: surveyData, isLoading: loadingSurveys } = useQuery<{
    surveys: ClassSurvey[];
    summary: any;
  }>({
    queryKey: [`/api/v1/pms/vessels/${selectedVesselId}/surveys`],
    enabled: !!selectedVesselId,
  });

  const { data: conditionData, isLoading: loadingConditions } = useQuery<ConditionReport[]>({
    queryKey: [`/api/v1/pms/vessels/${selectedVesselId}/condition-reports`],
    enabled: !!selectedVesselId,
  });

  // Mutations
  const createJob = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/v1/pms/vessels/${selectedVesselId}/jobs`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/v1/pms/vessels/${selectedVesselId}/jobs`] });
      toast({ title: "Maintenance job created" });
    },
  });

  const updateRunningHours = useMutation({
    mutationFn: async ({ id, hours }: { id: number; hours: number }) => {
      const res = await apiRequest("POST", `/api/v1/pms/equipment/${id}/running-hours`, { runningHours: hours, recordDate: new Date() });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/v1/pms/vessels/${selectedVesselId}/equipment-tree`] });
      toast({ title: "Running hours updated" });
    },
  });

  const approveWO = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/v1/pms/work-orders/${id}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/v1/pms/vessels/${selectedVesselId}/work-orders`] });
      toast({ title: "Work order approved" });
    },
  });

  // Helper functions
  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive" className="no-default-active-elevate">High</Badge>;
      case 'medium': return <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 border-orange-500/20 no-default-active-elevate">Medium</Badge>;
      case 'low': return <Badge variant="outline" className="no-default-active-elevate">Low</Badge>;
      default: return <Badge variant="secondary" className="no-default-active-elevate">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed': return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 no-default-active-elevate">Completed</Badge>;
      case 'open': return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 no-default-active-elevate">Open</Badge>;
      case 'overdue': return <Badge variant="destructive" className="no-default-active-elevate">Overdue</Badge>;
      case 'awaiting_approval': return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 no-default-active-elevate">Pending Approval</Badge>;
      default: return <Badge variant="outline" className="no-default-active-elevate">{status}</Badge>;
    }
  };

  const selectedEquipment = useMemo(() => {
    return treeData?.flatEquipment.find(e => e.id === selectedEquipmentId);
  }, [treeData, selectedEquipmentId]);

  const equipmentJobs = useMemo(() => {
    return jobsData?.jobs.filter(j => j.equipmentId === selectedEquipmentId) || [];
  }, [jobsData, selectedEquipmentId]);

  if (!selectedVesselId && vessels.length > 0) return null;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen">
      <PageMeta title="Planned Maintenance System (PMS) | VPDA" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planned Maintenance System</h1>
          <p className="text-muted-foreground mt-1">Equipment Registry & Maintenance Management (ISM/SOLAS Compliant)</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="w-64">
            <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
              <SelectTrigger data-testid="select-vessel">
                <SelectValue placeholder="Select vessel" />
              </SelectTrigger>
              <SelectContent>
                {vessels.map(v => (
                  <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="hover-elevate active-elevate-2">
            <Plus className="h-4 w-4 mr-2" />
            New Work Order
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-7 w-full max-w-4xl">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="equipment" data-testid="tab-equipment"><Box className="h-4 w-4 mr-2" />Equipment</TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs"><ClipboardList className="h-4 w-4 mr-2" />Jobs</TabsTrigger>
          <TabsTrigger value="work-orders" data-testid="tab-work-orders"><Wrench className="h-4 w-4 mr-2" />Work Orders</TabsTrigger>
          <TabsTrigger value="running-hours" data-testid="tab-running-hours"><Timer className="h-4 w-4 mr-2" />Hours</TabsTrigger>
          <TabsTrigger value="surveys" data-testid="tab-surveys"><FileSearch className="h-4 w-4 mr-2" />Surveys</TabsTrigger>
          <TabsTrigger value="condition" data-testid="tab-condition"><Activity className="h-4 w-4 mr-2" />Condition</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="hover-elevate border-l-4 border-l-destructive">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Overdue Jobs</p>
                    <h2 className="text-3xl font-bold text-destructive">{jobsData?.summary.overdue || 0}</h2>
                  </div>
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate border-l-4 border-l-orange-500">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Due Next 30 Days</p>
                    <h2 className="text-3xl font-bold text-orange-500">{jobsData?.summary.dueSoon || 0}</h2>
                  </div>
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate border-l-4 border-l-blue-500">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Open Work Orders</p>
                    <h2 className="text-3xl font-bold text-blue-500">{woData?.summary.open || 0}</h2>
                  </div>
                  <Wrench className="h-5 w-5 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate border-l-4 border-l-purple-500">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending Approval</p>
                    <h2 className="text-3xl font-bold text-purple-500">{woData?.summary.awaitingApproval || 0}</h2>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate border-l-4 border-l-emerald-500">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Class Surveys Due</p>
                    <h2 className="text-3xl font-bold text-emerald-500">{surveyData?.summary.upcoming || 0}</h2>
                  </div>
                  <FileSearch className="h-5 w-5 text-emerald-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Overdue Jobs</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("jobs")}>View All <ChevronRight className="ml-1 h-4 w-4" /></Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {jobsData?.jobs.filter(j => j.isOverdue).slice(0, 5).map(job => (
                    <div key={job.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-destructive/20">
                      <div>
                        <p className="font-medium">{job.title}</p>
                        <p className="text-xs text-muted-foreground">{job.equipmentName} • {job.jobCode}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="destructive">{job.overdueDays} Days Late</Badge>
                        <p className="text-xs text-muted-foreground mt-1">Due: {fmtDate(job.nextDueDate!)}</p>
                      </div>
                    </div>
                  ))}
                  {(!jobsData?.jobs.filter(j => j.isOverdue).length) && (
                    <div className="text-center py-8 text-muted-foreground italic">No overdue jobs currently</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pending Work Orders</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("work-orders")}>View All <ChevronRight className="ml-1 h-4 w-4" /></Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {woData?.workOrders.filter(wo => wo.status === "awaiting_approval").slice(0, 5).map(wo => (
                    <div key={wo.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{wo.title}</p>
                        <p className="text-xs text-muted-foreground">WO#{wo.workOrderNumber} • {wo.equipmentName}</p>
                      </div>
                      <Button size="sm" variant="outline" className="hover-elevate active-elevate-2" onClick={() => approveWO.mutate(wo.id)}>
                        Approve
                      </Button>
                    </div>
                  ))}
                  {(!woData?.workOrders.filter(wo => wo.status === "awaiting_approval").length) && (
                    <div className="text-center py-8 text-muted-foreground italic">No work orders pending approval</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="equipment" className="mt-6">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-4 space-y-4">
              <Card className="h-[calc(100vh-250px)] overflow-hidden flex flex-col">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle>Equipment Tree</CardTitle>
                    <Button variant="ghost" size="icon"><Plus className="h-4 w-4" /></Button>
                  </div>
                  <div className="relative mt-2">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search tree..." className="pl-8" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  </div>
                </CardHeader>
                <div className="flex-1 overflow-y-auto p-4">
                  {loadingTree ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-5/6 ml-4" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : (
                    <Accordion type="multiple" className="w-full">
                      {treeData?.tree.map((cat: any) => (
                        <AccordionItem key={cat.id} value={`cat-${cat.id}`} className="border-none">
                          <AccordionTrigger className="hover:no-underline py-2 px-2 hover:bg-muted/50 rounded-md">
                            <div className="flex items-center gap-2">
                              <Box className="h-4 w-4 text-sky-500" />
                              <span className="text-sm font-semibold">{cat.name}</span>
                              <Badge variant="outline" className="text-[10px] h-4 px-1">{cat.equipment.length}</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-1 pb-2 pl-4">
                            <div className="space-y-1">
                              {cat.equipment.map((item: EquipmentItem) => (
                                <div 
                                  key={item.id} 
                                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-sm transition-colors ${selectedEquipmentId === item.id ? 'bg-sky-500/10 text-sky-500' : 'hover:bg-muted'}`}
                                  onClick={() => setSelectedEquipmentId(item.id)}
                                >
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <Settings className={`h-3.5 w-3.5 ${selectedEquipmentId === item.id ? 'text-sky-500' : 'text-muted-foreground'}`} />
                                    <span className="truncate">{item.name}</span>
                                  </div>
                                  {item.criticalityLevel === 'high' && <div className="h-1.5 w-1.5 rounded-full bg-destructive flex-shrink-0" />}
                                </div>
                              ))}
                              {cat.children && cat.children.length > 0 && (
                                <div className="pt-1">
                                  {/* Sub-categories could be rendered recursively here */}
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </div>
              </Card>
            </div>

            <div className="col-span-12 lg:col-span-8 space-y-6">
              {selectedEquipment ? (
                <>
                  <Card className="hover-elevate">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge className="mb-2 bg-sky-500/10 text-sky-500 border-sky-500/20 no-default-active-elevate">
                            {selectedEquipment.code}
                          </Badge>
                          <CardTitle className="text-2xl">{selectedEquipment.name}</CardTitle>
                          <CardDescription>{selectedEquipment.manufacturer} • {selectedEquipment.model}</CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">Edit</Button>
                          <Button variant="outline" size="sm">Manual</Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 rounded-lg bg-muted/30">
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Status</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className={`h-2 w-2 rounded-full ${selectedEquipment.status === 'operational' ? 'bg-emerald-500' : 'bg-destructive'}`} />
                            <span className="font-medium capitalize">{selectedEquipment.status}</span>
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30">
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Running Hours</p>
                          <p className="text-lg font-bold mt-1">{selectedEquipment.currentRunningHours?.toLocaleString() || 0} hrs</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30">
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Criticality</p>
                          <div className="mt-1">
                            {getPriorityBadge(selectedEquipment.criticalityLevel)}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30">
                          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Location</p>
                          <p className="font-medium mt-1 truncate">{selectedEquipment.location || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="mt-6 pt-6 border-t">
                        <h4 className="font-semibold mb-4 flex items-center gap-2">
                          <ClipboardList className="h-4 w-4" />
                          Maintenance Jobs
                        </h4>
                        <div className="space-y-3">
                          {equipmentJobs.length > 0 ? equipmentJobs.map(job => (
                            <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${job.isOverdue ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                  {job.isOverdue ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{job.title}</p>
                                  <p className="text-xs text-muted-foreground">Every {job.calendarIntervalDays || job.calendarIntervalMonths || job.runningHoursInterval} {job.intervalType}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-medium">Next Due</p>
                                <p className={`text-xs ${job.isOverdue ? 'text-destructive font-bold' : ''}`}>{job.nextDueDate ? fmtDate(job.nextDueDate) : 'N/A'}</p>
                              </div>
                            </div>
                          )) : (
                            <div className="text-center py-6 text-muted-foreground text-sm italic">No maintenance jobs assigned to this equipment</div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed p-12">
                  <Box className="h-12 w-12 mb-4 opacity-20" />
                  <h3 className="text-lg font-medium">No Equipment Selected</h3>
                  <p className="text-sm">Select an item from the equipment tree to view its details and maintenance history</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Maintenance Job Registry</CardTitle>
                <CardDescription>Scheduled tasks for all equipment onboard</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="hover-elevate active-elevate-2"><Filter className="h-4 w-4 mr-2" /> Filter</Button>
                <Button size="sm" className="hover-elevate active-elevate-2"><Plus className="h-4 w-4 mr-2" /> Add Job</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search jobs by title, code or equipment..." className="pl-8" />
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 text-muted-foreground font-bold">
                    <tr>
                      <th className="px-4 py-3">Code / Title</th>
                      <th className="px-4 py-3">Equipment</th>
                      <th className="px-4 py-3">Interval</th>
                      <th className="px-4 py-3">Next Due</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loadingJobs ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}><td colSpan={7} className="px-4 py-4"><Skeleton className="h-10 w-full" /></td></tr>
                      ))
                    ) : (
                      jobsData?.jobs.map(job => (
                        <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-4">
                            <div className="font-medium">{job.title}</div>
                            <div className="text-xs text-muted-foreground font-mono">{job.jobCode}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm">{job.equipmentName}</div>
                            <div className="text-xs text-muted-foreground">{job.categoryName}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-xs">
                              {job.intervalType === 'calendar' ? 
                                `Every ${job.calendarIntervalMonths ? `${job.calendarIntervalMonths} mo` : `${job.calendarIntervalDays} days`}` :
                                `Every ${job.runningHoursInterval} hrs`}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className={`text-xs font-semibold ${job.isOverdue ? 'text-destructive' : ''}`}>
                              {job.nextDueDate ? fmtDate(job.nextDueDate) : 'N/A'}
                            </div>
                            {job.nextDueRunningHours && (
                              <div className="text-[10px] text-muted-foreground italic">@ {job.nextDueRunningHours} hrs</div>
                            )}
                          </td>
                          <td className="px-4 py-4">{getPriorityBadge(job.priority)}</td>
                          <td className="px-4 py-4">{job.isOverdue ? getStatusBadge('overdue') : getStatusBadge(job.status)}</td>
                          <td className="px-4 py-4 text-right">
                            <Button variant="ghost" size="icon" className="hover-elevate"><MoreVertical className="h-4 w-4" /></Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="work-orders" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Work Orders</CardTitle>
                <CardDescription>Active and historical maintenance executions</CardDescription>
              </div>
              <Button size="sm" className="hover-elevate active-elevate-2"><Plus className="h-4 w-4 mr-2" /> New Work Order</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loadingWOs ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  woData?.workOrders.map(wo => (
                    <Card key={wo.id} className="hover-elevate border-l-4 border-l-blue-500">
                      <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-full ${wo.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                            <Wrench className="h-6 w-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-muted-foreground">#{wo.workOrderNumber}</span>
                              <h4 className="font-bold">{wo.title}</h4>
                            </div>
                            <p className="text-sm text-muted-foreground">{wo.equipmentName} • {wo.workType?.toUpperCase()}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Due: {wo.plannedEndDate ? fmtDate(wo.plannedEndDate) : 'N/A'}</span>
                              <span className="text-xs flex items-center gap-1"><User className="h-3 w-3" /> {wo.assignedTo || 'Unassigned'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                          <div className="text-right mr-4 hidden md:block">
                            <p className="text-[10px] uppercase text-muted-foreground font-bold">Priority</p>
                            {getPriorityBadge(wo.priority)}
                          </div>
                          <div className="text-right mr-4">
                            <p className="text-[10px] uppercase text-muted-foreground font-bold">Status</p>
                            {getStatusBadge(wo.status)}
                          </div>
                          {wo.status === 'awaiting_approval' && (
                             <Button size="sm" onClick={() => approveWO.mutate(wo.id)} className="hover-elevate active-elevate-2 bg-purple-600 hover:bg-purple-700">Approve</Button>
                          )}
                          <Button variant="ghost" size="icon" className="hover-elevate"><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
                {(!woData?.workOrders.length) && (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-10" />
                    <p className="text-muted-foreground">No work orders found for this vessel</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="running-hours" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Equipment Running Hours</CardTitle>
              <CardDescription>Track and update operating hours for machineries</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 text-muted-foreground font-bold">
                    <tr>
                      <th className="px-4 py-3">Equipment</th>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Last Update</th>
                      <th className="px-4 py-3">Daily Avg</th>
                      <th className="px-4 py-3">Current Hours</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {treeData?.flatEquipment.filter(e => e.hasRunningHours).map(item => (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="px-4 py-4 font-medium">{item.name}</td>
                        <td className="px-4 py-4 text-xs font-mono">{item.code}</td>
                        <td className="px-4 py-4 text-xs">{item.lastRunningHoursUpdate ? fmtDate(item.lastRunningHoursUpdate) : 'Never'}</td>
                        <td className="px-4 py-4">{item.dailyAvgRunningHours || 0} hrs/day</td>
                        <td className="px-4 py-4">
                           <div className="flex items-center gap-2">
                             <Timer className="h-3.5 w-3.5 text-sky-500" />
                             <span className="font-bold text-lg">{item.currentRunningHours?.toLocaleString()}</span>
                             <span className="text-[10px] text-muted-foreground">HRS</span>
                           </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="hover-elevate active-elevate-2">Update</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>Update Running Hours</DialogTitle>
                                <DialogDescription>{item.name} ({item.code})</DialogDescription>
                              </DialogHeader>
                              <div className="py-4 space-y-4">
                                <div className="space-y-2">
                                  <Label>Current Value</Label>
                                  <div className="text-2xl font-bold bg-muted p-3 rounded-lg flex items-center justify-between">
                                    <span>{item.currentRunningHours?.toLocaleString()}</span>
                                    <span className="text-sm font-normal text-muted-foreground">HRS</span>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="new-hours">New Value (must be higher)</Label>
                                  <Input 
                                    id="new-hours" 
                                    type="number" 
                                    defaultValue={item.currentRunningHours || 0} 
                                    className="text-lg font-bold h-12"
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button onClick={() => {
                                  const val = (document.getElementById("new-hours") as HTMLInputElement).value;
                                  updateRunningHours.mutate({ id: item.id, hours: parseFloat(val) });
                                }}>Save Reading</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" size="icon" className="ml-1 hover-elevate"><History className="h-4 w-4" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
               </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="surveys" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
               <div>
                <CardTitle>Class Surveys & Certificates</CardTitle>
                <CardDescription>Track classification society surveys and window dates</CardDescription>
              </div>
              <Button size="sm" className="hover-elevate active-elevate-2"><Plus className="h-4 w-4 mr-2" /> New Survey</Button>
            </CardHeader>
            <CardContent>
               <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 text-muted-foreground font-bold">
                    <tr>
                      <th className="px-4 py-3">Survey Type</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3">Window</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Society</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loadingSurveys ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center"><Skeleton className="h-10 w-full" /></td></tr>
                    ) : (
                      surveyData?.surveys.map(survey => (
                        <tr key={survey.id} className="hover:bg-muted/30">
                          <td className="px-4 py-4 font-medium">{survey.surveyType}</td>
                          <td className="px-4 py-4">
                            <div className={`font-semibold ${new Date(survey.dueDate!) < new Date() ? 'text-destructive' : ''}`}>
                              {survey.dueDate ? fmtDate(survey.dueDate) : 'N/A'}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs">
                             {survey.windowStartDate ? fmtDate(survey.windowStartDate) : '?'} — {survey.windowEndDate ? fmtDate(survey.windowEndDate) : '?'}
                          </td>
                          <td className="px-4 py-4">
                             {new Date(survey.dueDate!) < new Date() ? getStatusBadge('overdue') : getStatusBadge(survey.status)}
                          </td>
                          <td className="px-4 py-4 text-xs">{survey.classificationSociety || 'N/A'}</td>
                          <td className="px-4 py-4 text-right">
                             <Button variant="ghost" size="icon" className="hover-elevate"><ArrowUpRight className="h-4 w-4" /></Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
               </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="condition" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
               <div>
                <CardTitle>Condition Reports</CardTitle>
                <CardDescription>Machinery condition assessments and inspection reports</CardDescription>
              </div>
              <Button size="sm" className="hover-elevate active-elevate-2"><Plus className="h-4 w-4 mr-2" /> New Report</Button>
            </CardHeader>
            <CardContent>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {loadingConditions ? (
                   <Skeleton className="h-48 w-full" />
                 ) : (
                   conditionData?.map(report => (
                     <Card key={report.id} className="hover-elevate">
                       <CardHeader className="pb-3">
                         <div className="flex justify-between items-start">
                            <Badge variant="outline" className="text-[10px] uppercase">{report.reportType}</Badge>
                            <Badge className={report.condition === 'satisfactory' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}>
                              {report.condition?.toUpperCase()}
                            </Badge>
                         </div>
                         <CardTitle className="text-lg mt-2">{report.title}</CardTitle>
                         <CardDescription className="line-clamp-2">{report.description}</CardDescription>
                       </CardHeader>
                       <CardContent>
                         <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t">
                           <div className="flex items-center gap-1">
                             <Calendar className="h-3 w-3" />
                             {report.reportedDate ? fmtDate(report.reportedDate) : 'N/A'}
                           </div>
                           {report.actionRequired && <Badge variant="destructive" className="h-5 px-1.5 text-[9px]">ACTION REQ</Badge>}
                         </div>
                       </CardContent>
                     </Card>
                   ))
                 )}
                 {(!conditionData?.length) && (
                   <div className="col-span-full text-center py-12 border-2 border-dashed rounded-lg">
                      <Activity className="h-12 w-12 mx-auto mb-3 opacity-10" />
                      <p className="text-muted-foreground">No condition reports available</p>
                   </div>
                 )}
               </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
