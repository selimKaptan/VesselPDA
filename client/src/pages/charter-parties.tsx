import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  CharterParty, 
  InsertCharterParty, 
  HirePayment, 
  OffHireEvent,
  Vessel
} from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Plus, 
  ScrollText, 
  Calendar, 
  DollarSign, 
  Clock, 
  Ship,
  FileText,
  AlertTriangle,
  History,
  Download
} from "lucide-react";
import { format } from "date-fns";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCharterPartySchema, insertHirePaymentSchema, insertOffHireEventSchema } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function CharterParties() {
  const [selectedCpId, setSelectedCpId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: charterParties, isLoading: isLoadingCp } = useQuery<CharterParty[]>({
    queryKey: ["/api/charter-parties"],
  });

  const { data: vessels } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
  });

  const selectedCp = charterParties?.find(cp => cp.id === selectedCpId);

  const createCpMutation = useMutation({
    mutationFn: async (data: InsertCharterParty) => {
      const res = await apiRequest("POST", "/api/charter-parties", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/charter-parties"] });
      toast({ title: "Charter Party Created", description: "The charter party has been successfully recorded." });
    },
  });

  if (isLoadingCp) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Charter Party & Hire</h1>
          <p className="text-muted-foreground">Manage time charters, hire payments, and off-hire periods.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button data-testid="button-create-cp">
              <Plus className="mr-2 h-4 w-4" /> New Charter Party
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Charter Party</DialogTitle>
            </DialogHeader>
            <CharterPartyForm 
              vessels={vessels || []} 
              onSubmit={(data) => createCpMutation.mutateAsync(data)} 
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* CP List */}
        <div className="lg:col-span-4 space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            Active Contracts
          </h2>
          {charterParties?.length === 0 ? (
            <Card className="bg-muted/50 border-dashed">
              <CardContent className="pt-6 text-center text-muted-foreground">
                No active charter parties found.
              </CardContent>
            </Card>
          ) : (
            charterParties?.map((cp) => (
              <Card 
                key={cp.id} 
                className={`cursor-pointer transition-all hover-elevate ${selectedCpId === cp.id ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                onClick={() => setSelectedCpId(cp.id)}
                data-testid={`card-cp-${cp.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="bg-background">
                      {vessels?.find(v => v.id === cp.vesselId)?.name || "Unknown Vessel"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {cp.cpDate ? format(new Date(cp.cpDate), "dd MMM yyyy") : "No Date"}
                    </span>
                  </div>
                  <h3 className="font-bold truncate">{cp.chartererName}</h3>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{cp.charterType}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm font-medium text-primary">
                    <DollarSign className="h-3 w-3" />
                    <span>{Number(cp.hireRate).toLocaleString()} {cp.hireCurrency} / {cp.hireFrequency}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* CP Details */}
        <div className="lg:col-span-8">
          {selectedCp ? (
            <Tabs defaultValue="overview" className="space-y-6">
              <div className="flex justify-between items-center bg-card p-4 rounded-lg border">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="hire">Hire Payments</TabsTrigger>
                  <TabsTrigger value="off-hire">Off-Hire</TabsTrigger>
                </TabsList>
                <Badge variant="secondary" className="h-7 uppercase tracking-wider">
                  {selectedCp.status}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => {
                  const doc = new jsPDF();
                  doc.setFontSize(20);
                  doc.text("Charter Party Summary", 14, 22);
                  doc.setFontSize(11);
                  doc.setTextColor(100);
                  
                  const vesselName = vessels?.find(v => v.id === selectedCp.vesselId)?.name || "Unknown Vessel";
                  
                  doc.text(`Vessel: ${vesselName}`, 14, 30);
                  doc.text(`Charterer: ${selectedCp.chartererName}`, 14, 35);
                  doc.text(`CP Date: ${selectedCp.cpDate ? format(new Date(selectedCp.cpDate), "dd MMM yyyy") : "N/A"}`, 14, 40);
                  doc.text(`Type: ${selectedCp.charterType}`, 14, 45);
                  doc.text(`Rate: ${Number(selectedCp.hireRate).toLocaleString()} ${selectedCp.hireCurrency} / ${selectedCp.hireFrequency}`, 14, 50);

                  doc.setFontSize(14);
                  doc.setTextColor(0);
                  doc.text("Hire Statements", 14, 65);

                  const payments = queryClient.getQueryData<HirePayment[]>(["/api/charter-parties", selectedCp.id, "hire-payments"]) || [];
                  
                  autoTable(doc, {
                    startY: 70,
                    head: [['Statement #', 'Period', 'Gross Hire', 'Net Hire', 'Status']],
                    body: payments.map(p => [
                      p.id.toString(),
                      `${p.periodFrom ? format(new Date(p.periodFrom), "dd MMM") : 'N/A'} - ${p.periodTo ? format(new Date(p.periodTo), "dd MMM yyyy") : 'N/A'}`,
                      `${Number(p.grossHire).toLocaleString()}`,
                      `${Number(p.netHire).toLocaleString()}`,
                      (p.status || '').toUpperCase()
                    ]),
                  });

                  const finalY = (doc as any).lastAutoTable.finalY || 70;
                  doc.setFontSize(14);
                  doc.text("Off-Hire Events", 14, finalY + 15);

                  const events = queryClient.getQueryData<OffHireEvent[]>(["/api/charter-parties", selectedCp.id, "off-hire"]) || [];

                  autoTable(doc, {
                    startY: finalY + 20,
                    head: [['ID', 'Period', 'Duration (Days)', 'Reason']],
                    body: events.map(e => [
                      e.id.toString(),
                      `${e.startDatetime ? format(new Date(e.startDatetime), "dd MMM HH:mm") : 'N/A'} - ${e.endDatetime ? format(new Date(e.endDatetime), "dd MMM yyyy HH:mm") : 'N/A'}`,
                      (e.deductedDays || 0).toString(),
                      e.reason || ''
                    ]),
                  });

                  doc.save(`CP_Summary_${vesselName}_${selectedCp.chartererName}.pdf`);
                }}>
                  <Download className="mr-2 h-4 w-4" /> Export PDF
                </Button>
              </div>

              <TabsContent value="overview">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-2xl">{selectedCp.chartererName}</CardTitle>
                        <CardDescription>
                          Contract Date: {selectedCp.cpDate ? format(new Date(selectedCp.cpDate), "PPPP") : "Not set"}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          {Number(selectedCp.hireRate).toLocaleString()} {selectedCp.hireCurrency}
                        </div>
                        <div className="text-sm text-muted-foreground">Rate ({selectedCp.hireFrequency})</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Ship className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Vessel</div>
                            <div className="font-medium">{vessels?.find(v => v.id === selectedCp.vesselId)?.name}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Commencement</div>
                            <div className="font-medium">
                              {selectedCp.commencementDate ? format(new Date(selectedCp.commencementDate), "dd MMM yyyy") : "Pending"}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Charter Type</div>
                            <div className="font-medium">{selectedCp.charterType}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <History className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="text-sm text-muted-foreground">Redelivery</div>
                            <div className="font-medium">
                              {selectedCp.redeliveryDate ? format(new Date(selectedCp.redeliveryDate), "dd MMM yyyy") : "TBD"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-6 border-t">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Clauses & Special Terms
                      </h4>
                      <div className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap italic">
                        {selectedCp.cpTerms || "No special clauses specified in this contract."}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="hire">
                <HirePaymentSection charterParty={selectedCp} />
              </TabsContent>

              <TabsContent value="off-hire">
                <OffHireSection charterParty={selectedCp} />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-col items-center justify-center h-[500px] text-center border-2 border-dashed rounded-xl bg-muted/30">
              <ScrollText className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-medium">Select a Charter Party</h3>
              <p className="text-muted-foreground max-w-xs">
                Select a contract from the list on the left to view details, hire payments, and off-hire events.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CharterPartyForm({ vessels, onSubmit }: { vessels: Vessel[], onSubmit: (data: InsertCharterParty) => Promise<any> }) {
  const form = useForm<InsertCharterParty>({
    resolver: zodResolver(insertCharterPartySchema),
    defaultValues: {
      vesselId: vessels[0]?.id || 0,
      charterType: "Time Charter",
      chartererName: "",
      cpDate: new Date() as any,
      hireRate: 15000,
      hireCurrency: "USD",
      hireFrequency: "semi_monthly",
      status: "active",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(data => onSubmit(data))} className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="vesselId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vessel</FormLabel>
                <Select onValueChange={(val) => field.onChange(parseInt(val))} defaultValue={field.value?.toString()}>
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
            name="chartererName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Charterer Name</FormLabel>
                <FormControl><Input {...field} placeholder="e.g. Trafigura, Vitol" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="cpDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CP Date</FormLabel>
                <FormControl><Input type="date" {...field} value={field.value ? (typeof field.value === 'string' ? field.value : new Date(field.value).toISOString().split('T')[0]) : ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="charterType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Charter Type</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="hireRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hire Rate</FormLabel>
                <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="hireCurrency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="hireFrequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Frequency</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          Create Charter Party Record
        </Button>
      </form>
    </Form>
  );
}

function HirePaymentSection({ charterParty }: { charterParty: CharterParty }) {
  const { toast } = useToast();
  const { data: payments, isLoading } = useQuery<HirePayment[]>({
    queryKey: ["/api/charter-parties", charterParty.id, "hire-payments"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/charter-parties/${charterParty.id}/hire-payments`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/charter-parties", charterParty.id, "hire-payments"] });
      toast({ title: "Payment Recorded", description: "The hire payment has been successfully recorded." });
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          Hire Statements
        </h3>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" /> Add Statement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Hire Payment</DialogTitle></DialogHeader>
            <HirePaymentForm 
              charterParty={charterParty} 
              onSubmit={(data) => createMutation.mutateAsync(data)} 
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {payments?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
            No hire statements recorded yet.
          </div>
        ) : (
          payments?.map((payment) => (
            <Card key={payment.id} className="overflow-hidden">
              <div className="flex">
                <div className={`w-2 ${payment.status === 'paid' ? 'bg-green-500' : 'bg-amber-500'}`} />
                <CardContent className="p-4 flex-1">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold flex items-center gap-2">
                        Statement #{payment.id} 
                        <Badge variant={payment.status === 'paid' ? 'default' : 'secondary'} className="text-[10px] h-4">
                          {payment.status?.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Period: {format(new Date(payment.periodFrom), "dd MMM")} - {format(new Date(payment.periodTo), "dd MMM yyyy")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        ${Number(payment.netHire).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Due: {payment.dueDate ? format(new Date(payment.dueDate), "dd MMM") : "TBD"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function HirePaymentForm({ charterParty, onSubmit }: { charterParty: CharterParty, onSubmit: (data: any) => Promise<any> }) {
  const form = useForm({
    resolver: zodResolver(insertHirePaymentSchema.omit({ charterPartyId: true, userId: true })),
    defaultValues: {
      periodFrom: new Date().toISOString().split('T')[0] as any,
      periodTo: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] as any,
      hireDays: 15,
      grossHire: Number(charterParty.hireRate) * 15,
      netHire: Number(charterParty.hireRate) * 15,
      status: "pending",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(data => onSubmit(data))} className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="periodFrom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>From</FormLabel>
                <FormControl><Input type="date" {...field} value={field.value ? (typeof field.value === 'string' ? field.value : new Date(field.value).toISOString().split('T')[0]) : ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="periodTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>To</FormLabel>
                <FormControl><Input type="date" {...field} value={field.value ? (typeof field.value === 'string' ? field.value : new Date(field.value).toISOString().split('T')[0]) : ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="hireDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hire Days</FormLabel>
                <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="grossHire"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gross Hire ($)</FormLabel>
                <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="netHire"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Net Hire ($)</FormLabel>
              <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full">Record Statement</Button>
      </form>
    </Form>
  );
}

function OffHireSection({ charterParty }: { charterParty: CharterParty }) {
  const { toast } = useToast();
  const { data: events, isLoading } = useQuery<OffHireEvent[]>({
    queryKey: ["/api/charter-parties", charterParty.id, "off-hire"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/charter-parties/${charterParty.id}/off-hire`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/charter-parties", charterParty.id, "off-hire"] });
      toast({ title: "Off-Hire Recorded", description: "The off-hire period has been recorded." });
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-600">
          <AlertTriangle className="h-5 w-5" />
          Off-Hire Events
        </h3>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="border-amber-200 hover:bg-amber-50">
              <Plus className="mr-2 h-4 w-4" /> Log Off-Hire
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Off-Hire Period</DialogTitle></DialogHeader>
            <OffHireForm onSubmit={(data) => createMutation.mutateAsync(data)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {events?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
            No off-hire events recorded.
          </div>
        ) : (
          events?.map((event) => (
            <Card key={event.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div className="flex gap-4 items-center">
                    <div className="bg-amber-100 p-2 rounded-lg">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <div className="font-bold">{event.reason}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(event.startDatetime), "dd MMM yyyy HH:mm")} 
                        {event.endDatetime && ` → ${format(new Date(event.endDatetime), "dd MMM HH:mm")}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-amber-700">
                      -{event.deductedDays ? Number(event.deductedDays).toFixed(1) : "?"} days
                    </div>
                    <div className="text-[10px] text-muted-foreground">Deduction applied</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function OffHireForm({ onSubmit }: { onSubmit: (data: any) => Promise<any> }) {
  const form = useForm({
    resolver: zodResolver(insertOffHireEventSchema.omit({ charterPartyId: true, userId: true })),
    defaultValues: {
      reason: "",
      startDatetime: new Date().toISOString().slice(0, 16) as any,
      deductedDays: 1,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(data => onSubmit(data))} className="space-y-4 pt-4">
        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason for Off-Hire</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Engine Breakdown">Engine Breakdown</SelectItem>
                  <SelectItem value="Dry Docking">Dry Docking</SelectItem>
                  <SelectItem value="Crew Strike">Crew Strike</SelectItem>
                  <SelectItem value="Port Delay (Vessel Fault)">Port Delay (Vessel Fault)</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="startDatetime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start (Date & Time)</FormLabel>
              <FormControl><Input type="datetime-local" {...field} value={field.value ? (typeof field.value === 'string' ? field.value : new Date(field.value).toISOString().slice(0, 16)) : ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="deductedDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Deducted Days</FormLabel>
              <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700">Record Off-Hire</Button>
      </form>
    </Form>
  );
}
