import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { 
  Anchor, Plus, Clock, CheckCircle2, PlayCircle, AlertCircle, 
  Search, Filter, MoreVertical, Calendar, Ship, MapPin, 
  User, ClipboardCheck, ArrowUpRight, CheckCircle, ListChecks,
  Trash2, ExternalLink
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogFooter, DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage 
} from "@/components/ui/form";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPortCallSchema, type PortCall, type PortCallChecklist, type Vessel, type Voyage } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fmtDate } from "@/lib/formatDate";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { Checkbox } from "@/components/ui/checkbox";

const STATUS_COLORS: Record<string, string> = {
  expected: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  arrived: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  in_port: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  operations: "bg-green-500/10 text-green-500 border-green-500/20",
  departed: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  closed: "bg-slate-800/50 text-slate-400 border-slate-700/50",
};

export default function PortCalls() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [checklistPortCallId, setChecklistPortCallId] = useState<number | null>(null);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("arrival");

  const { data: portCalls, isLoading } = useQuery<PortCall[]>({
    queryKey: ["/api/port-calls"],
  });

  const { data: vessels } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
  });

  const { data: voyages } = useQuery<Voyage[]>({
    queryKey: ["/api/voyages"],
  });

  const { data: stats } = useQuery<{ active: number; expected: number; thisMonth: number; total: number }>({
    queryKey: ["/api/port-calls/stats"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/port-calls", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/port-calls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/port-calls/stats"] });
      setIsAddDialogOpen(false);
      toast({ title: "Success", description: "Port call created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const { data: checklistItems } = useQuery<PortCallChecklist[]>({
    queryKey: ["/api/port-call-checklists", checklistPortCallId],
    queryFn: async () => {
      if (!checklistPortCallId) return [];
      const res = await apiRequest("GET", `/api/port-call-checklists/${checklistPortCallId}`);
      return res.json();
    },
    enabled: !!checklistPortCallId,
  });

  const initChecklistMutation = useMutation({
    mutationFn: (portCallId: number) => apiRequest("POST", `/api/port-call-checklists/${portCallId}/init`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/port-call-checklists", checklistPortCallId] }),
  });

  const toggleChecklistMutation = useMutation({
    mutationFn: ({ id, isCompleted }: { id: number; isCompleted: boolean }) =>
      apiRequest("PATCH", `/api/port-call-checklists/item/${id}`, { isCompleted }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/port-call-checklists", checklistPortCallId] }),
  });

  const addChecklistItemMutation = useMutation({
    mutationFn: ({ portCallId, item, category }: { portCallId: number; item: string; category: string }) =>
      apiRequest("POST", `/api/port-call-checklists/${portCallId}/item`, { item, category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/port-call-checklists", checklistPortCallId] });
      setNewItem("");
    },
  });

  const deleteChecklistItemMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/port-call-checklists/item/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/port-call-checklists", checklistPortCallId] }),
  });

  const openChecklist = (portCallId: number) => {
    setChecklistPortCallId(portCallId);
    setIsChecklistOpen(true);
    setTimeout(() => initChecklistMutation.mutate(portCallId), 100);
  };

  const arrivalItems = (checklistItems || []).filter(i => i.category === "arrival").sort((a, b) => a.sortOrder - b.sortOrder);
  const departureItems = (checklistItems || []).filter(i => i.category === "departure").sort((a, b) => a.sortOrder - b.sortOrder);
  const totalItems = (checklistItems || []).length;
  const completedItems = (checklistItems || []).filter(i => i.isCompleted).length;
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const form = useForm({
    resolver: zodResolver(insertPortCallSchema),
    defaultValues: {
      portName: "",
      vesselId: 0,
      voyageId: undefined,
      status: "expected",
      eta: undefined,
      cargoType: "",
      cargoQuantity: 0,
      cargoUnit: "MT",
      pilotArranged: false,
      tugArranged: false,
      customsCleared: false,
      notes: "",
    },
  });

  const filteredCalls = portCalls?.filter(pc => {
    const matchesStatus = statusFilter === "all" || pc.status === statusFilter;
    const matchesSearch = !searchQuery || 
      pc.portName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vessels?.find(v => v.id === pc.vesselId)?.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Anchor className="w-8 h-8 text-sky-500" />
            Port Call Management
          </h1>
          <p className="text-muted-foreground mt-1">Manage vessel arrivals, berthing, and cargo operations.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-sky-600 hover:bg-sky-500 text-white">
              <Plus className="w-4 h-4 mr-2" /> New Port Call
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Register New Port Call</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="vesselId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vessel</FormLabel>
                        <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value ? field.value.toString() : ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select vessel" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {vessels?.map(v => (
                              <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="portName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Port Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Aliaga, Tuzla" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="eta"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ETA</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
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
                        <FormLabel>Link Voyage (Optional)</FormLabel>
                        <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value ? String(field.value) : ""}>
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
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <FormField
                    control={form.control}
                    name="pilotArranged"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">Pilot Arranged</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tugArranged"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">Tug Arranged</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} className="w-full bg-sky-600 hover:bg-sky-500">
                    {createMutation.isPending ? "Creating..." : "Save Port Call"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-sidebar-border/40">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Active Calls</p>
            <h2 className="text-3xl font-bold text-sky-500 font-mono">{stats?.active || 0}</h2>
            <p className="text-[10px] text-muted-foreground mt-2">Vessels currently in port</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-sidebar-border/40">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Expected Arrivals</p>
            <h2 className="text-3xl font-bold text-blue-400 font-mono">{stats?.expected || 0}</h2>
            <p className="text-[10px] text-muted-foreground mt-2">Scheduled for arrival</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-sidebar-border/40">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">This Month</p>
            <h2 className="text-3xl font-bold text-emerald-500 font-mono">{stats?.thisMonth || 0}</h2>
            <p className="text-[10px] text-muted-foreground mt-2">Port calls recorded this month</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-sidebar-border/40">
          <CardContent className="p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Pending Tasks</p>
            <h2 className="text-3xl font-bold text-amber-500 font-mono">
              {filteredCalls?.filter(pc => !pc.pilotArranged || !pc.customsCleared).length || 0}
            </h2>
            <p className="text-[10px] text-muted-foreground mt-2">Operational actions required</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search vessel or port..." 
            className="pl-9 bg-card/30"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-card/30">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="expected">Expected</SelectItem>
            <SelectItem value="arrived">Arrived</SelectItem>
            <SelectItem value="in_port">In Port</SelectItem>
            <SelectItem value="operations">Operations</SelectItem>
            <SelectItem value="departed">Departed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCalls?.map((call) => {
          const vessel = vessels?.find(v => v.id === call.vesselId);
          return (
            <Card key={call.id} className="hover-elevate bg-card/30 border-sidebar-border/40 group overflow-hidden">
              <div className={`h-1.5 w-full ${STATUS_COLORS[call.status || "expected"] || "bg-slate-500"}`} />
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Ship className="w-4 h-4 text-sky-400" />
                      {vessel?.name || "Unknown Vessel"}
                    </CardTitle>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />
                      {call.portName}
                    </div>
                  </div>
                  <Badge className={`text-[10px] font-bold uppercase tracking-widest ${STATUS_COLORS[call.status || "expected"]}`}>
                    {call.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                <div className="grid grid-cols-2 gap-4 py-3 border-y border-sidebar-border/20">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">ETA / Arrival</p>
                    <p className="text-xs font-mono">{call.actualArrival ? fmtDate(call.actualArrival) : call.eta ? fmtDate(call.eta) : "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Berth</p>
                    <p className="text-xs truncate">{call.berth || "Not assigned"}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant={call.pilotArranged ? "default" : "outline"} className={`text-[9px] gap-1 ${call.pilotArranged ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "opacity-40"}`}>
                    <ClipboardCheck className="w-2.5 h-2.5" /> Pilot
                  </Badge>
                  <Badge variant={call.tugArranged ? "default" : "outline"} className={`text-[9px] gap-1 ${call.tugArranged ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "opacity-40"}`}>
                    <ClipboardCheck className="w-2.5 h-2.5" /> Tug
                  </Badge>
                  <Badge variant={call.customsCleared ? "default" : "outline"} className={`text-[9px] gap-1 ${call.customsCleared ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "opacity-40"}`}>
                    <ClipboardCheck className="w-2.5 h-2.5" /> Customs
                  </Badge>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Link href={`/port-calls/${call.id}`}>
                    <Button
                      data-testid={`btn-detail-${call.id}`}
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-sky-400 hover:text-sky-300 gap-1 px-2"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Detay
                    </Button>
                  </Link>
                  <Button
                    data-testid={`btn-checklist-${call.id}`}
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-emerald-400 hover:text-emerald-300 gap-1 px-2"
                    onClick={() => openChecklist(call.id)}
                  >
                    <ListChecks className="w-3 h-3" />
                    Checklist
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {/* Checklist Dialog */}
      <Dialog open={isChecklistOpen} onOpenChange={open => { setIsChecklistOpen(open); if (!open) { setChecklistPortCallId(null); setNewItem(""); } }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-emerald-400" />
              Port Call Checklist
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>{completedItems} / {totalItems} tamamlandı</span>
              <span className="font-medium text-emerald-400">%{progress}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {[
            { key: "arrival", label: "Varış Kontrol Listesi", items: arrivalItems },
            { key: "departure", label: "Kalkış Kontrol Listesi", items: departureItems },
          ].map(section => (
            <div key={section.key} className="space-y-2 mb-6">
              <h3 className="font-semibold text-sky-400 text-sm uppercase tracking-wide">{section.label}</h3>
              {section.items.length === 0 ? (
                <p className="text-slate-500 text-sm py-2">Yükleniyor...</p>
              ) : (
                <div className="space-y-1.5">
                  {section.items.map(item => (
                    <div
                      key={item.id}
                      data-testid={`checklist-item-${item.id}`}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 group"
                    >
                      <Checkbox
                        id={`cl-${item.id}`}
                        checked={item.isCompleted}
                        onCheckedChange={checked => toggleChecklistMutation.mutate({ id: item.id, isCompleted: !!checked })}
                        className="border-slate-500 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                      />
                      <label
                        htmlFor={`cl-${item.id}`}
                        className={`flex-1 text-sm cursor-pointer ${item.isCompleted ? "line-through text-slate-500" : "text-slate-200"}`}
                      >
                        {item.item}
                      </label>
                      {item.isCompleted && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400"
                        onClick={() => deleteChecklistItemMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="border-t border-slate-700 pt-4 space-y-2">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Özel Madde Ekle</p>
            <div className="flex gap-2">
              <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                <SelectTrigger className="w-36 bg-slate-800 border-slate-600 text-slate-300 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="arrival">Varış</SelectItem>
                  <SelectItem value="departure">Kalkış</SelectItem>
                </SelectContent>
              </Select>
              <Input
                data-testid="input-new-checklist-item"
                placeholder="Yeni madde..."
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && newItem.trim() && checklistPortCallId) {
                    addChecklistItemMutation.mutate({ portCallId: checklistPortCallId, item: newItem.trim(), category: newItemCategory });
                  }
                }}
                className="bg-slate-800 border-slate-600 text-white flex-1"
              />
              <Button
                data-testid="btn-add-checklist-item"
                size="sm"
                className="bg-sky-600 hover:bg-sky-500"
                disabled={!newItem.trim() || !checklistPortCallId}
                onClick={() => {
                  if (newItem.trim() && checklistPortCallId) {
                    addChecklistItemMutation.mutate({ portCallId: checklistPortCallId, item: newItem.trim(), category: newItemCategory });
                  }
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
