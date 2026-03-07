import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users2, Search, FileText, CreditCard, Award, Plus, Calendar as CalendarIcon, Trash2, Edit2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDate } from "@/lib/formatDate";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertVesselCrewSchema, insertCrewStcwCertificateSchema, insertCrewPayrollSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function ExpCell({ dt }: { dt: string | null }) {
  if (!dt) return <span className="text-muted-foreground/40">—</span>;
  const now = new Date();
  const d = new Date(dt);
  const days = Math.round((d.getTime() - now.getTime()) / 86400000);
  const dateStr = fmtDate(dt) ?? "—";
  if (days < 0) return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-red-600 dark:text-red-400 font-medium cursor-default">
          {dateStr}<span className="ml-1 text-[10px]">✕</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>Expired {Math.abs(days)} days ago</TooltipContent>
    </Tooltip>
  );
  if (days <= 30) return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-amber-600 dark:text-amber-400 font-medium cursor-default">
          {dateStr}<span className="ml-1 text-[10px]">⚠</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>Expires in {days} days</TooltipContent>
    </Tooltip>
  );
  return <span className="text-foreground">{dateStr}</span>;
}

type StatusFilter = "all" | "on_board" | "on_leave";

export default function CrewRoster() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedVesselId, setSelectedVesselId] = useState<string>("all");
  const { toast } = useToast();

  const { data: vessels = [] } = useQuery<any[]>({
    queryKey: ["/api/vessels"],
  });

  const { data: roster = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/vessels/crew-roster"],
  });

  const { data: summary } = useQuery<any>({
    queryKey: ["/api/crew/vessels", selectedVesselId, "crew-summary"],
    enabled: selectedVesselId !== "all",
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/crew/vessels/${selectedVesselId}/crew-summary`);
      return res.json();
    }
  });

  const filtered = roster.filter((m) => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (selectedVesselId !== "all" && String(m.vesselId) !== selectedVesselId) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
        (m.rank ?? "").toLowerCase().includes(q) ||
        (m.vesselName ?? "").toLowerCase().includes(q) ||
        (m.nationality ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusFilters: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "all" },
    { label: "On Board", value: "on_board" },
    { label: "On Leave", value: "on_leave" },
  ];

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
        <div className="rounded-2xl border bg-card/60 backdrop-blur-sm shadow-sm p-6 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Users2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold">Crew Management</h1>
              <p className="text-sm text-muted-foreground">Manage personnel, certificates, and payroll</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Vessels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vessels</SelectItem>
                {vessels.map(v => (
                  <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AddCrewDialog vessels={vessels} />
          </div>
        </div>

        {selectedVesselId !== "all" && summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary">
                    <Users2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Crew</p>
                    <p className="text-2xl font-bold">{summary.totalCrew}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/5 border-amber-500/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expiring Docs</p>
                    <p className="text-2xl font-bold">{summary.expiringCertificates}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-500/5 border-emerald-500/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-2xl font-bold text-emerald-600">Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="roster" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="roster" className="gap-2">
              <Users2 className="w-4 h-4" /> Roster
            </TabsTrigger>
            <TabsTrigger value="stcw" className="gap-2">
              <Award className="w-4 h-4" /> STCW & Certificates
            </TabsTrigger>
            <TabsTrigger value="payroll" className="gap-2">
              <CreditCard className="w-4 h-4" /> Payroll
            </TabsTrigger>
          </TabsList>

          <TabsContent value="roster">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, rank, vessel..."
                    className="pl-9"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    data-testid="input-crew-roster-search"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {statusFilters.map((f) => (
                    <Button
                      key={f.value}
                      size="sm"
                      variant={statusFilter === f.value ? "default" : "outline"}
                      onClick={() => setStatusFilter(f.value)}
                      data-testid={`filter-status-${f.value}`}
                    >
                      {f.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border overflow-x-auto bg-card/40">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      {["#", "Name", "Rank", "Vessel", "Status", "Contract", "Passport", "Book", "Visa", "Actions"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="border-b last:border-0">
                          {Array.from({ length: 10 }).map((_, j) => (
                            <td key={j} className="px-3 py-2.5"><Skeleton className="h-4 w-full max-w-[80px]" /></td>
                          ))}
                        </tr>
                      ))
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-16 text-muted-foreground">
                          <Users2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                          <p className="font-medium">No crew members found</p>
                        </td>
                      </tr>
                    ) : filtered.map((member: any, idx: number) => (
                      <tr key={member.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2.5 text-muted-foreground/60 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{member.firstName} {member.lastName}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="secondary" className="text-[10px]">{member.rank || "—"}</Badge>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-primary/80">{member.vesselName}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className={member.status === "on_leave" ? "border-amber-300 text-amber-700 bg-amber-50" : "border-green-300 text-green-700 bg-green-50"}>
                            {member.status === "on_leave" ? "On Leave" : "On Board"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap"><ExpCell dt={member.contractEndDate} /></td>
                        <td className="px-3 py-2.5 whitespace-nowrap"><ExpCell dt={member.passportExpiry} /></td>
                        <td className="px-3 py-2.5 whitespace-nowrap"><ExpCell dt={member.seamanBookExpiry} /></td>
                        <td className="px-3 py-2.5 whitespace-nowrap"><ExpCell dt={member.visaExpiry} /></td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7"><Edit2 className="w-3.5 h-3.5" /></Button>
                            <DeleteCrewButton id={member.id} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="stcw">
            <StcwTab selectedVesselId={selectedVesselId} filteredCrew={filtered} />
          </TabsContent>

          <TabsContent value="payroll">
            <PayrollTab selectedVesselId={selectedVesselId} filteredCrew={filtered} />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

function AddCrewDialog({ vessels }: { vessels: any[] }) {
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(insertVesselCrewSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      vesselId: 0,
      rank: "",
      nationality: "",
      status: "on_board",
      salaryCurrency: "USD",
    }
  });

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await apiRequest("POST", `/api/crew/vessels/${values.vesselId}/crew`, values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels/crew-roster"] });
      toast({ title: "Crew member added successfully" });
    }
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="w-4 h-4" /> Add Crew</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Crew Member</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="grid grid-cols-2 gap-4">
            <FormField name="firstName" render={({ field }) => (
              <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField name="lastName" render={({ field }) => (
              <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField name="vesselId" render={({ field }) => (
              <FormItem>
                <FormLabel>Vessel</FormLabel>
                <Select onValueChange={(v) => field.onChange(parseInt(v))}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select vessel" /></SelectTrigger></FormControl>
                  <SelectContent>{vessels.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField name="rank" render={({ field }) => (
              <FormItem><FormLabel>Rank</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField name="nationality" render={({ field }) => (
              <FormItem><FormLabel>Nationality</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField name="monthlySalary" render={({ field }) => (
              <FormItem><FormLabel>Monthly Salary</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
            )} />
            <div className="col-span-2 grid grid-cols-2 gap-4 border-t pt-4 mt-2">
              <FormField name="contractEndDate" render={({ field }) => (
                <FormItem><FormLabel>Contract End Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
              )} />
              <FormField name="passportExpiry" render={({ field }) => (
                <FormItem><FormLabel>Passport Expiry</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
              )} />
            </div>
            <DialogFooter className="col-span-2">
              <Button type="submit" disabled={mutation.isPending}>Add Crew Member</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function StcwTab({ selectedVesselId, filteredCrew }: { selectedVesselId: string, filteredCrew: any[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Certificates & Training</h2>
        <AddCertDialog crewMembers={filteredCrew} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCrew.map(member => (
          <CrewCertCard key={member.id} member={member} />
        ))}
      </div>
    </div>
  );
}

function CrewCertCard({ member }: { member: any }) {
  const { data: certs = [] } = useQuery<any[]>({
    queryKey: ["/api/crew", member.id, "stcw-certs"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/crew/crew/${member.id}/stcw-certs`);
      return res.json();
    }
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-sm font-bold">{member.firstName} {member.lastName}</CardTitle>
          <Badge variant="outline" className="text-[10px]">{member.rank}</Badge>
        </div>
        <CardDescription className="text-[10px]">{member.vesselName}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {certs.length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic">No certificates recorded</p>
          ) : certs.map(cert => (
            <div key={cert.id} className="flex justify-between items-center text-[11px] p-1.5 rounded bg-muted/30">
              <span className="font-medium truncate mr-2">{cert.certName}</span>
              <ExpCell dt={cert.expiryDate} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AddCertDialog({ crewMembers }: { crewMembers: any[] }) {
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(insertCrewStcwCertificateSchema),
    defaultValues: { certName: "", certNumber: "", crewId: 0, expiryDate: "", certType: "stcw" }
  });

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const member = crewMembers.find(m => m.id === values.crewId);
      const res = await apiRequest("POST", `/api/crew/crew/${values.crewId}/stcw-certs`, { ...values, vesselId: member.vesselId });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew", variables.crewId, "stcw-certs"] });
      toast({ title: "Certificate added" });
    }
  });

  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-2"><Plus className="w-4 h-4" /> Add Certificate</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Certificate</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField name="crewId" render={({ field }) => (
              <FormItem>
                <FormLabel>Crew Member</FormLabel>
                <Select onValueChange={(v) => field.onChange(parseInt(v))}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger></FormControl>
                  <SelectContent>{crewMembers.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.firstName} {m.lastName} ({m.rank})</SelectItem>)}</SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField name="certName" render={({ field }) => (
              <FormItem><FormLabel>Certificate Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField name="certNumber" render={({ field }) => (
              <FormItem><FormLabel>Certificate Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField name="expiryDate" render={({ field }) => (
              <FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={mutation.isPending}>Add Certificate</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PayrollTab({ selectedVesselId, filteredCrew }: { selectedVesselId: string, filteredCrew: any[] }) {
  const { data: payroll = [] } = useQuery<any[]>({
    queryKey: ["/api/crew/vessels", selectedVesselId, "crew-payroll"],
    enabled: selectedVesselId !== "all",
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/crew/vessels/${selectedVesselId}/crew-payroll`);
      return res.json();
    }
  });

  if (selectedVesselId === "all") {
    return <div className="text-center py-12 text-muted-foreground">Please select a vessel to view payroll.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Monthly Payroll</h2>
        <AddPayrollDialog vesselId={parseInt(selectedVesselId)} crewMembers={filteredCrew} />
      </div>
      <div className="rounded-xl border bg-card/40 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40 border-b">
              {["Period", "Crew Member", "Base Salary", "Overtime", "Bonus", "Deductions", "Net Pay", "Status", "Paid Date"].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payroll.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">No payroll records found</td></tr>
            ) : payroll.map(p => {
              const member = filteredCrew.find(m => m.id === p.crewId);
              return (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-3 py-2.5 font-medium">{p.periodMonth}/{p.periodYear}</td>
                  <td className="px-3 py-2.5">{member ? `${member.firstName} ${member.lastName}` : "Unknown"}</td>
                  <td className="px-3 py-2.5 font-mono">{p.basicSalary} {p.currency}</td>
                  <td className="px-3 py-2.5 text-emerald-600 font-mono">+{p.overtimeHours * p.overtimeRate}</td>
                  <td className="px-3 py-2.5 text-emerald-600 font-mono">+{p.bonus}</td>
                  <td className="px-3 py-2.5 text-red-600 font-mono">-{p.deductions}</td>
                  <td className="px-3 py-2.5 font-bold font-mono">{p.netPay} {p.currency}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={p.status === "paid" ? "default" : "outline"}>{p.status}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{p.paidDate ? fmtDate(p.paidDate) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddPayrollDialog({ vesselId, crewMembers }: { vesselId: number, crewMembers: any[] }) {
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(insertCrewPayrollSchema),
    defaultValues: { crewId: 0, basicSalary: 0, overtimeHours: 0, overtimeRate: 0, bonus: 0, deductions: 0, periodMonth: new Date().getMonth() + 1, periodYear: new Date().getFullYear(), status: "pending", currency: "USD" }
  });

  const selectedCrewId = form.watch("crewId");
  useState(() => {
    if (selectedCrewId) {
      const member = crewMembers.find(m => m.id === selectedCrewId);
      if (member?.monthlySalary) form.setValue("basicSalary", member.monthlySalary);
    }
  });

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const netPay = values.basicSalary + (values.overtimeHours * values.overtimeRate) + values.bonus - values.deductions;
      const res = await apiRequest("POST", `/api/crew/vessels/${vesselId}/crew-payroll`, { ...values, netPay });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew/vessels", String(vesselId), "crew-payroll"] });
      toast({ title: "Payroll record created" });
    }
  });

  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Process Payroll</Button></DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Process Payroll</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="grid grid-cols-2 gap-4">
            <FormField name="crewId" render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Crew Member</FormLabel>
                <Select onValueChange={(v) => {
                  const id = parseInt(v);
                  field.onChange(id);
                  const m = crewMembers.find(x => x.id === id);
                  if (m?.monthlySalary) form.setValue("basicSalary", m.monthlySalary);
                }}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger></FormControl>
                  <SelectContent>{crewMembers.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.firstName} {m.lastName}</SelectItem>)}</SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField name="periodMonth" render={({ field }) => (
              <FormItem><FormLabel>Month</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl></FormItem>
            )} />
            <FormField name="periodYear" render={({ field }) => (
              <FormItem><FormLabel>Year</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl></FormItem>
            )} />
            <FormField name="basicSalary" render={({ field }) => (
              <FormItem><FormLabel>Basic Salary</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
            )} />
            <FormField name="overtimeHours" render={({ field }) => (
              <FormItem><FormLabel>Overtime Hours</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
            )} />
            <FormField name="overtimeRate" render={({ field }) => (
              <FormItem><FormLabel>Overtime Rate</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
            )} />
            <FormField name="bonus" render={({ field }) => (
              <FormItem><FormLabel>Bonus</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
            )} />
            <FormField name="deductions" render={({ field }) => (
              <FormItem><FormLabel>Deductions</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl></FormItem>
            )} />
            <Button type="submit" className="col-span-2" disabled={mutation.isPending}>Create Record</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCrewButton({ id }: { id: number }) {
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/crew/crew/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels/crew-roster"] });
      toast({ title: "Crew member removed" });
    }
  });

  return (
    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      <Trash2 className="w-3.5 h-3.5" />
    </Button>
  );
}
