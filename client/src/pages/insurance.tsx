import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { 
  ShieldCheck, 
  FileText, 
  AlertCircle, 
  Plus, 
  Calendar, 
  TrendingUp, 
  Search, 
  MoreVertical,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  DollarSign,
  Briefcase,
  Download
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertInsurancePolicySchema, insertInsuranceClaimSchema, type InsurancePolicy, type InsuranceClaim, type Vessel } from "@shared/schema";

export default function InsurancePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("policies");
  const [isPolicyDialogOpen, setIsPolicyDialogOpen] = useState(false);
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);

  const { data: vessels = [] } = useQuery<Vessel[]>({
    queryKey: ["/api/vessels"],
  });

  const { data: summary, isLoading: isLoadingSummary } = useQuery<{
    activePolicies: number;
    expiringSoon: number;
    openClaims: number;
    totalPremium: number;
    policies: InsurancePolicy[];
    claims: InsuranceClaim[];
  }>({
    queryKey: ["/api/insurance/summary"],
  });

  const policyForm = useForm({
    resolver: zodResolver(insertInsurancePolicySchema),
    defaultValues: {
      vesselId: vessels[0]?.id || 0,
      policyType: "P&I",
      insurer: "",
      policyNumber: "",
      club: "",
      insuredValue: 0,
      currency: "USD",
      premiumAmount: 0,
      premiumFrequency: "annual",
      deductible: 0,
      coverageFrom: new Date().toISOString(),
      coverageTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
      notes: "",
    },
  });

  const claimForm = useForm({
    resolver: zodResolver(insertInsuranceClaimSchema),
    defaultValues: {
      policyId: 0,
      vesselId: vessels[0]?.id || 0,
      incidentDate: new Date().toISOString(),
      incidentType: "machinery_damage",
      incidentLocation: "",
      description: "",
      estimatedClaim: 0,
      currency: "USD",
      status: "reported",
      notes: "",
    },
  });

  const createPolicy = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/insurance/policies", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/insurance/summary"] });
      setIsPolicyDialogOpen(false);
      policyForm.reset();
      toast({ title: "Policy added successfully" });
    },
  });

  const createClaim = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/insurance/policies/${data.policyId}/claims`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/insurance/summary"] });
      setIsClaimDialogOpen(false);
      claimForm.reset();
      toast({ title: "Claim reported successfully" });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'expiring': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'expired': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getClaimStatusColor = (status: string) => {
    switch (status) {
      case 'reported': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'investigating': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'settled': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const expiringPolicies = summary?.policies.filter(p => {
    const now = new Date();
    const coverageTo = new Date(p.coverageTo);
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return coverageTo <= thirtyDaysLater && coverageTo >= now && p.status === "active";
  }) || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageMeta title="Insurance Management | VPDA" />
      
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShieldCheck className="h-8 w-8 text-sky-500" />
              Insurance Management
            </h1>
            <p className="text-slate-400 mt-1">Manage P&I, H&M policies and insurance claims</p>
          </div>
          <Button variant="outline" size="sm" className="bg-slate-900 border-slate-800 text-white" onClick={() => {
            const doc = new jsPDF();
            doc.setFontSize(20);
            doc.text("Insurance Policy Schedule", 14, 22);
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, 14, 30);
            doc.text(`Active Policies: ${summary?.activePolicies || 0}`, 14, 35);
            doc.text(`Total Annual Premium: $${summary?.totalPremium?.toLocaleString() || 0}`, 14, 40);

            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text("Active Policies", 14, 55);
            autoTable(doc, {
              startY: 60,
              head: [['Vessel', 'Type', 'Insurer', 'Policy #', 'Value', 'Premium', 'Expiry']],
              body: (summary?.policies || []).map(p => [
                vessels.find(v => v.id === p.vesselId)?.name || "Unknown",
                p.policyType,
                p.insurer,
                p.policyNumber,
                `$${(p.insuredValue || 0).toLocaleString()}`,
                `$${(p.premiumAmount || 0).toLocaleString()}`,
                p.coverageTo ? format(new Date(p.coverageTo), "dd MMM yyyy") : "N/A"
              ]),
            });

            const nextY = (doc as any).lastAutoTable.finalY + 15;
            doc.text("Claims Summary", 14, nextY);
            autoTable(doc, {
              startY: nextY + 5,
              head: [['Date', 'Vessel', 'Incident', 'Est. Claim', 'Status']],
              body: (summary?.claims || []).map(c => [
                c.incidentDate ? format(new Date(c.incidentDate), "dd MMM yyyy") : "N/A",
                vessels.find(v => v.id === c.vesselId)?.name || "Unknown",
                c.incidentType,
                `$${(c.estimatedClaim || 0).toLocaleString()}`,
                c.status?.toUpperCase()
              ]),
            });

            doc.save("Insurance_Schedule_Report.pdf");
          }}>
            <Download className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        </div>

      {expiringPolicies.length > 0 && (
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="p-4 flex items-center gap-4">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                {expiringPolicies.length} policies are expiring within 30 days.
              </p>
            </div>
            <Button variant="outline" size="sm" className="border-destructive/20 text-destructive hover:bg-destructive/10">
              Review Renewals
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Active Policies</p>
                <h2 className="text-2xl font-bold text-white">{summary?.activePolicies || 0}</h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-sky-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-sky-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Expiring Soon</p>
                <h2 className="text-2xl font-bold text-orange-500">{summary?.expiringSoon || 0}</h2>
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
                <p className="text-sm font-medium text-slate-400">Open Claims</p>
                <h2 className="text-2xl font-bold text-destructive">{summary?.openClaims || 0}</h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Annual Premium</p>
                <h2 className="text-2xl font-bold text-emerald-500">
                  ${(summary?.totalPremium || 0).toLocaleString()}
                </h2>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-900 border-slate-800">
          <TabsTrigger value="policies" className="data-[state=active]:bg-slate-800">Insurance Policies</TabsTrigger>
          <TabsTrigger value="claims" className="data-[state=active]:bg-slate-800">Claims</TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input placeholder="Search policies..." className="pl-10 bg-slate-900 border-slate-800 text-white" />
            </div>
            
            <Dialog open={isPolicyDialogOpen} onOpenChange={setIsPolicyDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-sky-600 hover:bg-sky-700 text-white" data-testid="button-new-policy">
                  <Plus className="h-4 w-4 mr-2" /> New Policy
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Insurance Policy</DialogTitle>
                  <DialogDescription>Enter policy details for vessel coverage.</DialogDescription>
                </DialogHeader>
                <Form {...policyForm}>
                  <form onSubmit={policyForm.handleSubmit((data) => createPolicy.mutate(data))} className="grid grid-cols-2 gap-4 py-4">
                    <FormField
                      control={policyForm.control}
                      name="vesselId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vessel</FormLabel>
                          <Select onValueChange={(v) => field.onChange(parseInt(v))} defaultValue={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger className="bg-slate-800 border-slate-700">
                                <SelectValue placeholder="Select vessel" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-slate-800 border-slate-700 text-white">
                              {vessels.map(v => (
                                <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={policyForm.control}
                      name="policyType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Policy Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-slate-800 border-slate-700">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-slate-800 border-slate-700 text-white">
                              <SelectItem value="P&I">P&I (Protection & Indemnity)</SelectItem>
                              <SelectItem value="H&M">H&M (Hull & Machinery)</SelectItem>
                              <SelectItem value="FD&D">FD&D</SelectItem>
                              <SelectItem value="War">War Risks</SelectItem>
                              <SelectItem value="Strike">Strike</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={policyForm.control}
                      name="insurer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Insurer / Club</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-slate-800 border-slate-700" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={policyForm.control}
                      name="policyNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Policy Number</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-slate-800 border-slate-700" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={policyForm.control}
                      name="coverageFrom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Coverage From</FormLabel>
                          <FormControl>
                            <Input type="date" value={field.value?.split('T')[0]} onChange={(e) => field.onChange(new Date(e.target.value).toISOString())} className="bg-slate-800 border-slate-700" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={policyForm.control}
                      name="coverageTo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Coverage To</FormLabel>
                          <FormControl>
                            <Input type="date" value={field.value?.split('T')[0]} onChange={(e) => field.onChange(new Date(e.target.value).toISOString())} className="bg-slate-800 border-slate-700" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={policyForm.control}
                      name="insuredValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Insured Value</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} className="bg-slate-800 border-slate-700" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={policyForm.control}
                      name="premiumAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Premium Amount</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} className="bg-slate-800 border-slate-700" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={policyForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea {...field} className="bg-slate-800 border-slate-700" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter className="col-span-2">
                      <Button type="submit" disabled={createPolicy.isPending}>
                        {createPolicy.isPending ? "Adding..." : "Add Policy"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {summary?.policies.map((policy) => {
              const vessel = vessels.find(v => v.id === policy.vesselId);
              return (
                <Card key={policy.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors group">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center">
                        <Briefcase className="h-6 w-6 text-sky-500" />
                      </div>
                      <Badge className={getStatusColor(policy.status || 'active')}>
                        {(policy.status || 'active').toUpperCase()}
                      </Badge>
                    </div>
                    <CardTitle className="text-white mt-4 flex items-center justify-between">
                      {policy.policyType} - {vessel?.name}
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      {policy.insurer} • {policy.policyNumber}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-slate-500">Insured Value</p>
                        <p className="text-slate-200 font-medium">${(policy.insuredValue || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Premium</p>
                        <p className="text-slate-200 font-medium">${(policy.premiumAmount || 0).toLocaleString()}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-slate-500">Validity Period</p>
                        <p className="text-slate-200 font-medium">
                          {fmtDate(policy.coverageFrom)} - {fmtDate(policy.coverageTo)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                      <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-300 hover:text-white" onClick={() => {
                        claimForm.setValue("policyId", policy.id);
                        claimForm.setValue("vesselId", policy.vesselId);
                        setIsClaimDialogOpen(true);
                      }}>
                        Report Claim
                      </Button>
                      <Button variant="ghost" size="sm" className="text-sky-500 hover:text-sky-400 p-0 h-auto flex items-center gap-1">
                        View Details <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="claims" className="mt-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="bg-slate-900 border-slate-800 text-white">All Claims</Button>
              <Button variant="outline" size="sm" className="bg-slate-900 border-slate-800 text-slate-400">Open</Button>
              <Button variant="outline" size="sm" className="bg-slate-900 border-slate-800 text-slate-400">Settled</Button>
            </div>
            
            <Dialog open={isClaimDialogOpen} onOpenChange={setIsClaimDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-destructive hover:bg-destructive/90 text-white" data-testid="button-report-claim">
                  <AlertCircle className="h-4 w-4 mr-2" /> Report Claim
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Report Insurance Claim</DialogTitle>
                  <DialogDescription>Provide details about the incident for the insurance claim.</DialogDescription>
                </DialogHeader>
                <Form {...claimForm}>
                  <form onSubmit={claimForm.handleSubmit((data) => createClaim.mutate(data))} className="grid grid-cols-2 gap-4 py-4">
                    <FormField
                      control={claimForm.control}
                      name="policyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Insurance Policy</FormLabel>
                          <Select onValueChange={(v) => field.onChange(parseInt(v))} defaultValue={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger className="bg-slate-800 border-slate-700">
                                <SelectValue placeholder="Select policy" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-slate-800 border-slate-700 text-white">
                              {summary?.policies.map(p => (
                                <SelectItem key={p.id} value={p.id.toString()}>{p.policyType} - {p.policyNumber}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={claimForm.control}
                      name="incidentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Incident Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-slate-800 border-slate-700">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-slate-800 border-slate-700 text-white">
                              <SelectItem value="collision">Collision</SelectItem>
                              <SelectItem value="machinery_damage">Machinery Damage</SelectItem>
                              <SelectItem value="cargo_claim">Cargo Claim</SelectItem>
                              <SelectItem value="personal_injury">Personal Injury</SelectItem>
                              <SelectItem value="oil_pollution">Oil Pollution</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={claimForm.control}
                      name="incidentDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Incident Date</FormLabel>
                          <FormControl>
                            <Input type="date" value={field.value?.split('T')[0]} onChange={(e) => field.onChange(new Date(e.target.value).toISOString())} className="bg-slate-800 border-slate-700" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={claimForm.control}
                      name="incidentLocation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Incident Location</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. North Sea" className="bg-slate-800 border-slate-700" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={claimForm.control}
                      name="estimatedClaim"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estimated Claim Amount</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} className="bg-slate-800 border-slate-700" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={claimForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Incident Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} className="bg-slate-800 border-slate-700" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter className="col-span-2">
                      <Button type="submit" variant="destructive" disabled={createClaim.isPending}>
                        {createClaim.isPending ? "Reporting..." : "Submit Claim"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/50 text-slate-400 font-medium">
                  <tr>
                    <th className="px-4 py-3">Incident Date</th>
                    <th className="px-4 py-3">Vessel</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Estimated Claim</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {summary?.claims.map((claim) => {
                    const vessel = vessels.find(v => v.id === claim.vesselId);
                    return (
                      <tr key={claim.id} className="text-slate-300 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 font-medium text-white">
                            <Calendar className="h-4 w-4 text-slate-500" />
                            {fmtDate(claim.incidentDate)}
                          </div>
                        </td>
                        <td className="px-4 py-4">{vessel?.name}</td>
                        <td className="px-4 py-4">
                          <Badge variant="outline" className="bg-slate-800 border-slate-700 text-slate-300">
                            {claim.incidentType?.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-500" />
                            {claim.incidentLocation}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-medium text-white">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-emerald-500" />
                            {(claim.estimatedClaim || 0).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={getClaimStatusColor(claim.status || 'reported')}>
                            {(claim.status || 'reported').toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <Button variant="ghost" size="sm" className="text-sky-500 hover:text-sky-400 p-0 h-auto">
                            Manage
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {(!summary?.claims || summary.claims.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500 italic">
                        No insurance claims recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
