import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Plus, 
  Users, 
  Stethoscope, 
  Package, 
  DollarSign, 
  Truck, 
  Mail, 
  Search, 
  Filter,
  ArrowRight,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Ship,
  Printer,
  Settings2
} from "lucide-react";
import { generateAndPrintCrewDocs, type DocSelection } from "@/components/crew-change-docs";
import type { CrewDocConfig } from "@shared/schema";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertHusbandryOrderSchema, insertCrewChangeSchema, type HusbandryOrder, type CrewChange } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fmtDate } from "@/lib/formatDate";
import { Skeleton } from "@/components/ui/skeleton";

const SERVICE_TYPES = [
  { value: "crew_change", label: "Crew Change", icon: Users, color: "bg-blue-500" },
  { value: "medical", label: "Medical", icon: Stethoscope, color: "bg-red-500" },
  { value: "spare_parts", label: "Spare Parts", icon: Package, color: "bg-orange-500" },
  { value: "cash_to_master", label: "Cash to Master", icon: DollarSign, color: "bg-emerald-500" },
  { value: "provisions", label: "Provisions", icon: Truck, color: "bg-amber-500" },
  { value: "postal", label: "Postal/Courier", icon: Mail, color: "bg-indigo-500" },
  { value: "survey", label: "Survey", icon: Search, color: "bg-purple-500" },
  { value: "other", label: "Other", icon: MoreVertical, color: "bg-slate-500" },
];

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-slate-100 text-slate-700 border-slate-200",
  confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

export default function HusbandryPage() {
  const [activeTab, setActiveTab] = useState("orders");
  const { toast } = useToast();

  const { data: orders = [], isLoading: isLoadingOrders } = useQuery<HusbandryOrder[]>({
    queryKey: ["/api/husbandry"],
  });

  const { data: vessels = [] } = useQuery<any[]>({
    queryKey: ["/api/vessels"],
  });

  const stats = {
    active: orders.filter(o => ["requested", "confirmed", "in_progress"].includes(o.status)).length,
    completedThisMonth: orders.filter(o => o.status === "completed").length, // Simplified
    pendingInvoice: orders.filter(o => o.status === "completed" && !o.invoiceId).length,
    crewChanges: orders.filter(o => o.serviceType === "crew_change").length,
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-white">Husbandry Services</h1>
          <p className="text-slate-400">Manage crew changes, supplies, and technical services</p>
        </div>
        <div className="flex items-center gap-3">
          <NewOrderDialog vessels={vessels} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Orders" value={stats.active} icon={Clock} color="text-blue-500" />
        <StatCard title="Completed (Month)" value={stats.completedThisMonth} icon={CheckCircle2} color="text-emerald-500" />
        <StatCard title="Pending Invoice" value={stats.pendingInvoice} icon={FileText} color="text-amber-500" />
        <StatCard title="Crew Changes" value={stats.crewChanges} icon={Users} color="text-indigo-500" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800 p-1">
          <TabsTrigger value="orders" className="data-[state=active]:bg-slate-800">All Orders</TabsTrigger>
          <TabsTrigger value="crew" className="data-[state=active]:bg-slate-800">Crew Changes</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Service Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-left">
                      <th className="pb-3 font-medium px-2">Type</th>
                      <th className="pb-3 font-medium px-2">Vessel</th>
                      <th className="pb-3 font-medium px-2">Description</th>
                      <th className="pb-3 font-medium px-2">Requested</th>
                      <th className="pb-3 font-medium px-2">Status</th>
                      <th className="pb-3 font-medium px-2 text-right">Cost</th>
                      <th className="pb-3 font-medium px-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {isLoadingOrders ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}><td colSpan={7} className="py-4"><Skeleton className="h-10 w-full" /></td></tr>
                      ))
                    ) : orders.length === 0 ? (
                      <tr><td colSpan={7} className="py-12 text-center text-slate-500">No husbandry orders found</td></tr>
                    ) : orders.map(order => (
                      <OrderRow key={order.id} order={order} vessels={vessels} />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crew" className="mt-6">
           <CrewChangeView orders={orders} vessels={vessels} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-xl bg-slate-800/50 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderRow({ order, vessels }: { order: HusbandryOrder, vessels: any[] }) {
  const vessel = vessels.find(v => v.id === order.vesselId);
  const type = SERVICE_TYPES.find(t => t.value === order.serviceType) || SERVICE_TYPES[7];
  const Icon = type.icon;

  return (
    <tr className="hover:bg-slate-800/30 transition-colors group">
      <td className="py-4 px-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${type.color} bg-opacity-10`}>
            <Icon className={`w-4 h-4 ${type.color.replace('bg-', 'text-')}`} />
          </div>
          <span className="font-medium text-white">{type.label}</span>
        </div>
      </td>
      <td className="py-4 px-2 text-slate-300 font-medium">
        <div className="flex items-center gap-2">
          <Ship className="w-3.5 h-3.5 text-slate-500" />
          {vessel?.name || "Unknown"}
        </div>
      </td>
      <td className="py-4 px-2 text-slate-400 max-w-xs truncate">{order.description}</td>
      <td className="py-4 px-2 text-slate-400">{fmtDate(order.requestedDate)}</td>
      <td className="py-4 px-2">
        <Badge variant="outline" className={`capitalize ${STATUS_COLORS[order.status]}`}>
          {order.status.replace('_', ' ')}
        </Badge>
      </td>
      <td className="py-4 px-2 text-right font-mono text-white">
        {order.cost ? `${order.cost.toLocaleString()} ${order.currency}` : "—"}
      </td>
      <td className="py-4 px-2 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-white">
             <ArrowRight className="w-4 h-4" />
           </Button>
        </div>
      </td>
    </tr>
  );
}

function NewOrderDialog({ vessels }: { vessels: any[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const form = useForm({
    resolver: zodResolver(insertHusbandryOrderSchema),
    defaultValues: {
      vesselId: 0,
      serviceType: "crew_change",
      description: "",
      requestedDate: new Date().toISOString().split('T')[0],
      status: "requested",
      currency: "USD",
      cost: 0,
    }
  });

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await apiRequest("POST", "/api/husbandry", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/husbandry"] });
      toast({ title: "Husbandry order created" });
      setOpen(false);
      form.reset();
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-sky-600 hover:bg-sky-500 text-white border-0">
          <Plus className="w-4 h-4" /> New Order
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Create Husbandry Order</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4 pt-4">
            <FormField
              name="vesselId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vessel</FormLabel>
                  <Select onValueChange={v => field.onChange(parseInt(v))}>
                    <FormControl>
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Select vessel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                      {vessels.map(v => (
                        <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                name="serviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-slate-800 border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        {SERVICE_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="requestedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="bg-slate-800 border-slate-700" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Details of the request..." className="bg-slate-800 border-slate-700" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Cost</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={e => field.onChange(parseFloat(e.target.value))}
                        className="bg-slate-800 border-slate-700" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-slate-800 border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="TRY">TRY</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" className="w-full bg-sky-600 hover:bg-sky-500" disabled={mutation.isPending}>
                Create Order
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function CrewChangeView({ orders, vessels }: { orders: HusbandryOrder[], vessels: any[] }) {
  const crewOrders = orders.filter(o => o.serviceType === "crew_change");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">Crew Sign-on / Sign-off</h2>
        <AddCrewChangeDialog crewOrders={crewOrders} vessels={vessels} />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {crewOrders.length === 0 ? (
          <Card className="bg-slate-900/50 border-slate-800 border-dashed py-12">
            <CardContent className="flex flex-col items-center justify-center text-slate-500">
               <Users className="w-12 h-12 mb-4 opacity-20" />
               <p>No active crew change orders. Create a Husbandry Order first.</p>
            </CardContent>
          </Card>
        ) : crewOrders.map(order => (
          <CrewChangeGroup key={order.id} order={order} vessel={vessels.find(v => v.id === order.vesselId)} />
        ))}
      </div>
    </div>
  );
}

function DocGeneratorDialog({ changes, vessel }: { changes: CrewChange[]; vessel: any }) {
  const [open, setOpen] = useState(false);
  const [docDate, setDocDate] = useState(new Date().toISOString().split("T")[0]);
  const [sel, setSel] = useState<DocSelection>({
    gumruk: true,
    polisYurttan: true,
    polisYurda: true,
    vize: true,
    acente: true,
    ekimTur: true,
  });

  const { data: config } = useQuery<CrewDocConfig | null>({
    queryKey: ["/api/crew-doc-config"],
    enabled: open,
  });

  const signOnCount = changes.filter(c => c.changeType === "sign_on").length;
  const signOffCount = changes.filter(c => c.changeType === "sign_off").length;
  const visaCount = changes.filter(c => c.visaRequired).length;

  const handleGenerate = () => {
    const formattedDate = docDate
      ? new Date(docDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "";
    generateAndPrintCrewDocs(
      {
        crewChanges: changes,
        vessel: {
          name: vessel?.name || "",
          flag: vessel?.flag || "",
          imoNumber: vessel?.imoNumber || "",
        },
        config: config || null,
      },
      sel,
      formattedDate
    );
  };

  const DOC_OPTIONS = [
    { key: "gumruk", label: "Gümrük – Personel Değişikliği", desc: `${signOnCount} katılım, ${signOffCount} ayrılış` },
    { key: "polisYurttan", label: "Polis – Yurttan Çıkış", desc: `${signOnCount} kişi (gemiye katılan)`, disabled: signOnCount === 0 },
    { key: "polisYurda", label: "Polis – Yurda Giriş", desc: `${signOffCount} kişi (gemiden ayrılan)`, disabled: signOffCount === 0 },
    { key: "vize", label: "Vize Talep Formu", desc: `${visaCount} kişi için`, disabled: visaCount === 0 },
    { key: "acente", label: "Acente Personeli Giriş İzni", desc: "Selim Denizcilik çalışanları" },
    { key: "ekimTur", label: "Ekim Tur Giriş İzni", desc: "Transfer şirketi personeli" },
  ];

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={changes.length === 0}
        data-testid="button-generate-docs"
        className="gap-1.5 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
      >
        <Printer className="w-3.5 h-3.5" /> Belgeler Oluştur
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-blue-400" />
              Resmi Belgeler Oluştur
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Belge Tarihi</label>
              <input
                type="date"
                value={docDate}
                onChange={e => setDocDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white"
                data-testid="input-doc-date"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Üretilecek Belgeler</p>
              {DOC_OPTIONS.map(opt => (
                <label
                  key={opt.key}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    sel[opt.key as keyof DocSelection]
                      ? "border-blue-500/40 bg-blue-500/5"
                      : "border-slate-700/50 bg-slate-800/30"
                  } ${opt.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={sel[opt.key as keyof DocSelection]}
                    onChange={e => setSel(s => ({ ...s, [opt.key]: e.target.checked }))}
                    disabled={opt.disabled}
                    className="mt-0.5 w-3.5 h-3.5 flex-shrink-0"
                  />
                  <div>
                    <p className="text-xs font-medium text-white">{opt.label}</p>
                    <p className="text-[11px] text-slate-500">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {!config?.portName && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400">
                <strong>İpucu:</strong> Belge yapılandırmasını doldurun — liman adı, gümrük birimi, acente personeli ve Ekim Tur bilgileri.{" "}
                <a href="/crew-doc-settings" className="underline text-amber-300">Ayarları Düzenle →</a>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 text-xs h-8">
                İptal
              </Button>
              <Button
                onClick={handleGenerate}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs h-8"
                data-testid="button-print-docs"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" /> Belgeleri Aç / Yazdır
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CrewChangeGroup({ order, vessel }: { order: HusbandryOrder, vessel: any }) {
  const { data: changes = [], isLoading } = useQuery<CrewChange[]>({
    queryKey: ["/api/husbandry", order.id, "crew-changes"],
  });

  return (
    <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
      <CardHeader className="bg-slate-800/50 border-b border-slate-800 py-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge className={STATUS_COLORS[order.status]}>{order.status}</Badge>
          <span className="text-white font-medium">{vessel?.name || "Unknown"}</span>
          <span className="text-slate-500 text-xs">— {fmtDate(order.requestedDate)}</span>
        </div>
        <div className="flex items-center gap-2">
          <DocGeneratorDialog changes={changes} vessel={vessel} />
          <span className="text-xs text-slate-400">{changes.length} Personel</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-xs">
           <thead>
             <tr className="text-slate-500 border-b border-slate-800 text-left">
               <th className="p-3 font-medium uppercase tracking-wider">Type</th>
               <th className="p-3 font-medium uppercase tracking-wider">Name</th>
               <th className="p-3 font-medium uppercase tracking-wider">Rank</th>
               <th className="p-3 font-medium uppercase tracking-wider">Nationality</th>
               <th className="p-3 font-medium uppercase tracking-wider">Visa Status</th>
               <th className="p-3 font-medium uppercase tracking-wider">Flight/Hotel</th>
               <th className="p-3 font-medium uppercase tracking-wider text-right">Date</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={7} className="p-4"><Skeleton className="h-20 w-full" /></td></tr>
              ) : changes.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">No persons added to this crew change</td></tr>
              ) : changes.map(person => (
                <tr key={person.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="p-3">
                    <Badge variant="outline" className={person.changeType === 'sign_on' ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5' : 'border-amber-500/30 text-amber-500 bg-amber-500/5'}>
                      {person.changeType === 'sign_on' ? 'Sign On' : 'Sign Off'}
                    </Badge>
                  </td>
                  <td className="p-3 text-white font-medium">{person.seafarerName}</td>
                  <td className="p-3 text-slate-400">{person.rank}</td>
                  <td className="p-3 text-slate-400">{person.nationality}</td>
                  <td className="p-3">
                     {person.visaRequired ? (
                       <Badge variant="outline" className="border-red-500/30 text-red-500 bg-red-500/5 gap-1">
                         <AlertCircle className="w-3 h-3" /> {person.visaStatus || 'Required'}
                       </Badge>
                     ) : (
                       <span className="text-slate-500">Not Req.</span>
                     )}
                  </td>
                  <td className="p-3">
                     <div className="flex flex-col gap-1">
                        {person.flightDetails && <span className="text-slate-300 truncate max-w-[120px]"><Truck className="w-3 h-3 inline mr-1" />{person.flightDetails}</span>}
                        {person.hotelRequired && <span className="text-slate-500 truncate max-w-[120px] italic">{person.hotelName || 'Hotel Req.'}</span>}
                     </div>
                  </td>
                  <td className="p-3 text-right text-slate-300">{fmtDate(person.changeDate)}</td>
                </tr>
              ))}
           </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function AddCrewChangeDialog({ crewOrders, vessels }: { crewOrders: HusbandryOrder[], vessels: any[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const form = useForm({
    resolver: zodResolver(insertCrewChangeSchema),
    defaultValues: {
      husbandryOrderId: 0,
      vesselId: 0,
      changeType: "sign_on",
      seafarerName: "",
      rank: "",
      nationality: "",
      passportNumber: "",
      passportIssueDate: "",
      passportExpiry: "",
      seamanBookNumber: "",
      seamanBookIssueDate: "",
      seamanBookExpiry: "",
      dateOfBirth: "",
      birthPlace: "",
      departureDate: "",
      arrivalDate: "",
      visaRequired: false,
      visaStatus: "Pending",
      flightDetails: "",
      hotelRequired: false,
      hotelName: "",
      port: "",
      changeDate: new Date().toISOString().split('T')[0],
      notes: ""
    }
  });

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await apiRequest("POST", `/api/husbandry/${values.husbandryOrderId}/crew-changes`, values);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/husbandry", variables.husbandryOrderId, "crew-changes"] });
      toast({ title: "Personel eklendi" });
      setOpen(false);
      form.reset();
    }
  });

  const inp = "bg-slate-800 border-slate-700 text-white text-xs h-8";
  const lbl = "text-xs text-slate-400";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white border-0" disabled={crewOrders.length === 0} data-testid="button-add-crew-person">
          <Plus className="w-4 h-4" /> Personel Ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personel Değişikliğine Kişi Ekle</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-3 pt-2">

            {/* Order & Type */}
            <div className="grid grid-cols-2 gap-3">
              <FormField name="husbandryOrderId" render={({ field }) => (
                <FormItem>
                  <FormLabel className={lbl}>Husbandry Emri</FormLabel>
                  <Select onValueChange={v => {
                    const id = parseInt(v);
                    field.onChange(id);
                    const order = crewOrders.find(o => o.id === id);
                    if (order) form.setValue("vesselId", order.vesselId);
                  }}>
                    <FormControl>
                      <SelectTrigger className={inp}><SelectValue placeholder="Seç" /></SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                      {crewOrders.map(o => {
                        const v = vessels.find(vessel => vessel.id === o.vesselId);
                        return <SelectItem key={o.id} value={String(o.id)}>{v?.name} — {fmtDate(o.requestedDate)}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="changeType" render={({ field }) => (
                <FormItem>
                  <FormLabel className={lbl}>İşlem Türü</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className={inp}><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                      <SelectItem value="sign_on">Gemiye Katılım (Sign On)</SelectItem>
                      <SelectItem value="sign_off">Gemiden Ayrılış (Sign Off)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Name & Rank */}
            <div className="grid grid-cols-2 gap-3">
              <FormField name="seafarerName" render={({ field }) => (
                <FormItem>
                  <FormLabel className={lbl}>Ad Soyad *</FormLabel>
                  <FormControl><Input {...field} className={inp} data-testid="input-seafarer-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="rank" render={({ field }) => (
                <FormItem>
                  <FormLabel className={lbl}>Rütbe / Görevi</FormLabel>
                  <FormControl><Input {...field} placeholder="Kaptan, Makinist..." className={inp} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Nationality, DOB, Birth Place */}
            <div className="grid grid-cols-3 gap-3">
              <FormField name="nationality" render={({ field }) => (
                <FormItem>
                  <FormLabel className={lbl}>Uyruğu</FormLabel>
                  <FormControl><Input {...field} placeholder="HİNDİSTAN" className={inp} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="dateOfBirth" render={({ field }) => (
                <FormItem>
                  <FormLabel className={lbl}>Doğum Tarihi</FormLabel>
                  <FormControl><Input type="date" {...field} className={inp} data-testid="input-dob" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="birthPlace" render={({ field }) => (
                <FormItem>
                  <FormLabel className={lbl}>Doğum Yeri</FormLabel>
                  <FormControl><Input {...field} placeholder="Şehir / Ülke" className={inp} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Passport section */}
            <div className="border border-slate-700/50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pasaport</p>
              <div className="grid grid-cols-3 gap-3">
                <FormField name="passportNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className={lbl}>Pasaport No</FormLabel>
                    <FormControl><Input {...field} className={inp} data-testid="input-passport-no" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="passportIssueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className={lbl}>Veriliş Tarihi</FormLabel>
                    <FormControl><Input type="date" {...field} className={inp} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="passportExpiry" render={({ field }) => (
                  <FormItem>
                    <FormLabel className={lbl}>Geçerlilik Tarihi</FormLabel>
                    <FormControl><Input type="date" {...field} className={inp} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Seaman book section */}
            <div className="border border-slate-700/50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Denizci Cüzdanı</p>
              <div className="grid grid-cols-3 gap-3">
                <FormField name="seamanBookNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className={lbl}>Cüzdan No</FormLabel>
                    <FormControl><Input {...field} className={inp} data-testid="input-seaman-book" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="seamanBookIssueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className={lbl}>Veriliş Tarihi</FormLabel>
                    <FormControl><Input type="date" {...field} className={inp} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField name="seamanBookExpiry" render={({ field }) => (
                  <FormItem>
                    <FormLabel className={lbl}>Geçerlilik Tarihi</FormLabel>
                    <FormControl><Input type="date" {...field} className={inp} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Port & Dates */}
            <div className="grid grid-cols-3 gap-3">
              <FormField name="port" render={({ field }) => (
                <FormItem>
                  <FormLabel className={lbl}>Liman</FormLabel>
                  <FormControl><Input {...field} placeholder="STAR RAFİNERİ / ALİAĞA" className={inp} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="departureDate" render={({ field }) => (
                <FormItem>
                  <FormLabel className={lbl}>Gemiden Ayrılış</FormLabel>
                  <FormControl><Input type="date" {...field} className={inp} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField name="arrivalDate" render={({ field }) => (
                <FormItem>
                  <FormLabel className={lbl}>Gemiye Katılış</FormLabel>
                  <FormControl><Input type="date" {...field} className={inp} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Visa required toggle */}
            <div className="grid grid-cols-2 gap-3">
              <FormField name="visaRequired" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0 pt-2">
                  <FormControl>
                    <input type="checkbox" checked={!!field.value} onChange={e => field.onChange(e.target.checked)} className="w-4 h-4" />
                  </FormControl>
                  <FormLabel className={lbl}>Vize Gerekiyor</FormLabel>
                </FormItem>
              )} />
              <FormField name="flightDetails" render={({ field }) => (
                <FormItem>
                  <FormLabel className={lbl}>Uçuş Bilgileri</FormLabel>
                  <FormControl><Input {...field} placeholder="TK2309 ADB→IST 07:55..." className={inp} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <DialogFooter className="pt-2">
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 h-9" disabled={mutation.isPending} data-testid="button-save-crew-person">
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
