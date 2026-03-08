import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Anchor, Ship, MapPin, Calendar, Clock, ChevronRight,
  Plus, Trash2, CheckCircle2, AlertCircle, FileText, ClipboardList,
  Users, DollarSign, Package, ArrowLeft, Edit2, Save, X,
  UserPlus, Mail, Phone, Building2, Send, TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fmtDate } from "@/lib/formatDate";
import type { PortCall, Vessel, Nor, Sof, SofLineItem, PortExpense, PortCallParticipant } from "@shared/schema";

type SofWithEvents = Sof & { events: SofLineItem[] };

const STATUS_STEPS = ["expected", "arrived", "in_port", "operations", "departed", "closed"] as const;
type PortCallStatus = typeof STATUS_STEPS[number];

const STATUS_LABELS: Record<string, string> = {
  expected: "Bekleniyor",
  arrived: "Demir'de",
  in_port: "Limanda",
  operations: "Operasyonda",
  departed: "Ayrıldı",
  closed: "Kapatıldı",
};

const STATUS_COLORS: Record<string, string> = {
  expected: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  arrived: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  in_port: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  operations: "bg-green-500/20 text-green-400 border-green-500/30",
  departed: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  closed: "bg-slate-800/50 text-slate-500 border-slate-700/30",
};

const EXPENSE_CATEGORIES = [
  "port_dues", "pilotage", "towage", "agency_fee", "mooring",
  "anchorage", "launch_hire", "garbage", "fresh_water", "bunker",
  "survey", "customs", "other"
];

const PARTICIPANT_ROLES = [
  { value: "shipowner", label: "Armatör" },
  { value: "seller", label: "Satıcı" },
  { value: "receiver", label: "Alıcı" },
  { value: "broker", label: "Broker" },
  { value: "surveyor", label: "Surveyor" },
  { value: "other", label: "Diğer" },
];

const ROLE_COLORS: Record<string, string> = {
  shipowner: "text-sky-400 border-sky-500/30 bg-sky-500/10",
  seller: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  receiver: "text-violet-400 border-violet-500/30 bg-violet-500/10",
  broker: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  surveyor: "text-rose-400 border-rose-500/30 bg-rose-500/10",
  other: "text-slate-400 border-slate-500/30 bg-slate-500/10",
};

const NOR_STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-500/20 text-slate-400",
  tendered: "bg-blue-500/20 text-blue-400",
  accepted: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
  signed: "bg-emerald-500/20 text-emerald-400",
};

const addExpenseSchema = z.object({
  category: z.string().min(1, "Kategori zorunlu"),
  description: z.string().optional(),
  amount: z.coerce.number().min(0.01, "Tutar 0'dan büyük olmalı"),
  currency: z.string().min(1),
  vendor: z.string().optional(),
});

const addParticipantSchema = z.object({
  name: z.string().min(1, "Ad zorunlu"),
  email: z.string().email("Geçerli email giriniz").optional().or(z.literal("")),
  role: z.string().min(1, "Rol zorunlu"),
  company: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

const addSofEventSchema = z.object({
  eventName: z.string().min(1, "Olay adı zorunlu"),
  eventDate: z.string().min(1, "Tarih zorunlu"),
  eventType: z.string().default("operation"),
  remarks: z.string().optional(),
  isDeductible: z.boolean().default(false),
});

const createNorSchema = z.object({
  vesselName: z.string().optional(),
  portName: z.string().optional(),
  masterName: z.string().optional(),
  agentName: z.string().optional(),
  cargoType: z.string().optional(),
  operation: z.string().optional(),
  norTenderedAt: z.string().optional(),
});

const createSofSchema = z.object({
  vesselName: z.string().optional(),
  portName: z.string().optional(),
  operation: z.string().optional(),
  masterName: z.string().optional(),
  agentName: z.string().optional(),
});

const addCargoOpSchema = z.object({
  cargoName: z.string().min(1, "Kargo adı zorunlu"),
  operation: z.string().default("loading"),
  quantity: z.coerce.number().optional(),
  unit: z.string().default("MT"),
  blNumber: z.string().optional(),
  status: z.string().default("planned"),
});

function StatusTimeline({ status, onUpdate }: { status: string; onUpdate: (s: string) => void }) {
  const currentIdx = STATUS_STEPS.indexOf(status as PortCallStatus);
  const nextStatus = currentIdx < STATUS_STEPS.length - 1 ? STATUS_STEPS[currentIdx + 1] : null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STATUS_STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
              i < currentIdx ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
              i === currentIdx ? STATUS_COLORS[step] + " ring-1 ring-current/30" :
              "bg-transparent text-slate-600 border-slate-700/50"
            }`}>
              {i < currentIdx && <CheckCircle2 className="w-3 h-3" />}
              {STATUS_LABELS[step]}
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${i < currentIdx ? "text-emerald-500/50" : "text-slate-700"}`} />
            )}
          </div>
        ))}
      </div>
      {nextStatus && status !== "closed" && (
        <Button
          size="sm"
          className="h-8 text-xs bg-sky-600 hover:bg-sky-500 gap-1.5"
          onClick={() => onUpdate(nextStatus)}
          data-testid="btn-advance-status"
        >
          <ChevronRight className="w-3.5 h-3.5" />
          {STATUS_LABELS[nextStatus]} olarak İlerle
        </Button>
      )}
    </div>
  );
}

export default function PortCallDetail() {
  const { id } = useParams<{ id: string }>();
  const pcId = parseInt(id || "0");
  const { toast } = useToast();

  const [norDialogOpen, setNorDialogOpen] = useState(false);
  const [sofDialogOpen, setSofDialogOpen] = useState(false);
  const [sofEventDialogOpen, setSofEventDialogOpen] = useState(false);
  const [activeSofId, setActiveSofId] = useState<number | null>(null);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [participantDialogOpen, setParticipantDialogOpen] = useState(false);
  const [cargoOpDialogOpen, setCargoOpDialogOpen] = useState(false);

  const { data: portCall, isLoading: pcLoading } = useQuery<PortCall>({
    queryKey: ["/api/port-calls", pcId],
    queryFn: async () => {
      const res = await fetch(`/api/port-calls/${pcId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Port call yüklenemedi");
      return res.json();
    },
    enabled: !!pcId,
  });

  const { data: vessels } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
  const { data: nors } = useQuery<Nor[]>({
    queryKey: ["/api/nor", { portCallId: pcId }],
    queryFn: async () => {
      const res = await fetch(`/api/nor?portCallId=${pcId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!pcId,
  });
  const { data: sofs } = useQuery<Sof[]>({
    queryKey: ["/api/sof", { portCallId: pcId }],
    queryFn: async () => {
      const res = await fetch(`/api/sof?portCallId=${pcId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!pcId,
  });
  const { data: sofDetail } = useQuery<SofWithEvents>({
    queryKey: ["/api/sof", activeSofId],
    queryFn: async () => {
      const res = await fetch(`/api/sof/${activeSofId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!activeSofId,
  });
  const { data: expenses } = useQuery<PortExpense[]>({
    queryKey: ["/api/port-expenses", { portCallId: pcId }],
    queryFn: async () => {
      const res = await fetch(`/api/port-expenses?portCallId=${pcId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!pcId,
  });
  const { data: cargoOps } = useQuery<any[]>({
    queryKey: ["/api/cargo-operations", { portCallId: pcId }],
    queryFn: async () => {
      const res = await fetch(`/api/cargo-operations?portCallId=${pcId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!pcId,
  });
  const { data: participants } = useQuery<PortCallParticipant[]>({
    queryKey: ["/api/port-call-participants", { portCallId: pcId }],
    queryFn: async () => {
      const res = await fetch(`/api/port-call-participants?portCallId=${pcId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!pcId,
  });

  const vessel = vessels?.find(v => v.id === portCall?.vesselId);

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/port-calls/${pcId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/port-calls", pcId] });
      queryClient.invalidateQueries({ queryKey: ["/api/port-calls"] });
      toast({ title: "Durum güncellendi" });
    },
  });

  const createNorMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/nor", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nor", { portCallId: pcId }] });
      setNorDialogOpen(false);
      toast({ title: "NOR oluşturuldu" });
    },
  });

  const norActionMutation = useMutation({
    mutationFn: ({ norId, action }: { norId: number; action: string }) =>
      apiRequest("POST", `/api/nor/${norId}/${action}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nor", { portCallId: pcId }] });
      toast({ title: "NOR güncellendi" });
    },
  });

  const createSofMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/sof", data),
    onSuccess: (sof: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sof", { portCallId: pcId }] });
      setActiveSofId(sof.id);
      setSofDialogOpen(false);
      toast({ title: "SOF oluşturuldu" });
    },
  });

  const addSofEventMutation = useMutation({
    mutationFn: ({ sofId, data }: { sofId: number; data: any }) =>
      apiRequest("POST", `/api/sof/${sofId}/events`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sof", activeSofId] });
      setSofEventDialogOpen(false);
      toast({ title: "Olay eklendi" });
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/port-expenses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/port-expenses", { portCallId: pcId }] });
      setExpenseDialogOpen(false);
      toast({ title: "Masraf eklendi" });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/port-expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/port-expenses", { portCallId: pcId }] });
      toast({ title: "Masraf silindi" });
    },
  });

  const createCargoOpMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/cargo-operations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargo-operations", { portCallId: pcId }] });
      setCargoOpDialogOpen(false);
      toast({ title: "Kargo operasyonu eklendi" });
    },
  });

  const deleteCargoOpMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/cargo-operations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargo-operations", { portCallId: pcId }] });
    },
  });

  const addParticipantMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/port-call-participants", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/port-call-participants", { portCallId: pcId }] });
      setParticipantDialogOpen(false);
      toast({ title: "Katılımcı eklendi" });
    },
  });

  const deleteParticipantMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/port-call-participants/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/port-call-participants", { portCallId: pcId }] });
    },
  });

  // Forms
  const norForm = useForm<z.infer<typeof createNorSchema>>({
    resolver: zodResolver(createNorSchema),
    defaultValues: { operation: "loading" },
  });

  const sofForm = useForm<z.infer<typeof createSofSchema>>({
    resolver: zodResolver(createSofSchema),
    defaultValues: {},
  });

  const sofEventForm = useForm<z.infer<typeof addSofEventSchema>>({
    resolver: zodResolver(addSofEventSchema),
    defaultValues: { eventType: "operation", isDeductible: false },
  });

  const expenseForm = useForm<z.infer<typeof addExpenseSchema>>({
    resolver: zodResolver(addExpenseSchema),
    defaultValues: { currency: "USD" },
  });

  const participantForm = useForm<z.infer<typeof addParticipantSchema>>({
    resolver: zodResolver(addParticipantSchema),
    defaultValues: {},
  });

  const cargoOpForm = useForm<z.infer<typeof addCargoOpSchema>>({
    resolver: zodResolver(addCargoOpSchema),
    defaultValues: { operation: "loading", unit: "MT", status: "planned" },
  });

  const handleCreateNor = (values: z.infer<typeof createNorSchema>) => {
    createNorMutation.mutate({
      portCallId: pcId,
      vesselId: portCall?.vesselId,
      voyageId: portCall?.voyageId,
      vesselName: values.vesselName || vessel?.name || portCall?.portName,
      portName: values.portName || portCall?.portName,
      masterName: values.masterName,
      agentName: values.agentName || portCall?.agentName,
      cargoType: values.cargoType || portCall?.cargoType,
      operation: values.operation,
      norTenderedAt: values.norTenderedAt ? new Date(values.norTenderedAt) : undefined,
    });
  };

  const handleCreateSof = (values: z.infer<typeof createSofSchema>) => {
    createSofMutation.mutate({
      portCallId: pcId,
      vesselId: portCall?.vesselId,
      voyageId: portCall?.voyageId,
      vesselName: values.vesselName || vessel?.name,
      portName: values.portName || portCall?.portName,
      operation: values.operation,
      masterName: values.masterName,
      agentName: values.agentName || portCall?.agentName,
    });
  };

  const handleAddSofEvent = (values: z.infer<typeof addSofEventSchema>) => {
    const targetSofId = activeSofId || sofs?.[0]?.id;
    if (!targetSofId) return;
    addSofEventMutation.mutate({
      sofId: targetSofId,
      data: {
        eventName: values.eventName,
        eventDate: new Date(values.eventDate),
        eventType: values.eventType,
        remarks: values.remarks,
        isDeductible: values.isDeductible,
      },
    });
  };

  const handleCreateExpense = (values: z.infer<typeof addExpenseSchema>) => {
    createExpenseMutation.mutate({
      portCallId: pcId,
      voyageId: portCall?.voyageId,
      ...values,
      amount: Number(values.amount),
    });
  };

  const handleAddParticipant = (values: z.infer<typeof addParticipantSchema>) => {
    addParticipantMutation.mutate({ portCallId: pcId, ...values });
  };

  const handleCreateCargoOp = (values: z.infer<typeof addCargoOpSchema>) => {
    createCargoOpMutation.mutate({
      portCallId: pcId,
      vesselId: portCall?.vesselId,
      voyageId: portCall?.voyageId,
      ...values,
    });
  };

  const totalExpensesUsd = expenses?.reduce((sum, e) => sum + (e.amountUsd || e.amount || 0), 0) || 0;

  if (pcLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!portCall) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-600" />
        <p>Port call bulunamadı.</p>
        <Link href="/port-calls">
          <Button variant="outline" className="mt-4 gap-2">
            <ArrowLeft className="w-4 h-4" /> Port Calls'a Dön
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-sidebar-border/40 bg-card/30 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/port-calls">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground gap-1 text-xs">
                <ArrowLeft className="w-3.5 h-3.5" /> Port Calls
              </Button>
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-sm font-medium">{vessel?.name || "Bilinmeyen Gemi"} — {portCall.portName}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <Anchor className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Ship className="w-5 h-5 text-sky-400" />
                  {vessel?.name || "Bilinmeyen Gemi"}
                  <Badge className={`text-[10px] font-bold uppercase tracking-widest ${STATUS_COLORS[portCall.status || "expected"]}`}>
                    {STATUS_LABELS[portCall.status || "expected"]}
                  </Badge>
                </h1>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{portCall.portName}</span>
                  {portCall.eta && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />ETA: {fmtDate(portCall.eta)}</span>}
                  {portCall.voyageId && (
                    <Link href={`/voyages/${portCall.voyageId}`}>
                      <span className="text-sky-400 hover:underline">Voyage #{portCall.voyageId}</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-card/50 border border-sidebar-border/40 h-auto p-1 flex-wrap">
            <TabsTrigger value="overview" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white text-xs gap-1.5" data-testid="tab-overview">
              <TrendingUp className="w-3.5 h-3.5" /> Genel Bakış
            </TabsTrigger>
            <TabsTrigger value="nor" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white text-xs gap-1.5" data-testid="tab-nor">
              <FileText className="w-3.5 h-3.5" /> NOR
              {nors && nors.length > 0 && <Badge className="h-4 w-4 p-0 text-[9px] bg-sky-500 rounded-full">{nors.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="sof" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white text-xs gap-1.5" data-testid="tab-sof">
              <ClipboardList className="w-3.5 h-3.5" /> SOF
              {sofs && sofs.length > 0 && <Badge className="h-4 w-4 p-0 text-[9px] bg-sky-500 rounded-full">{sofs.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="expenses" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white text-xs gap-1.5" data-testid="tab-expenses">
              <DollarSign className="w-3.5 h-3.5" /> Masraflar
              {expenses && expenses.length > 0 && <Badge className="h-4 w-4 p-0 text-[9px] bg-sky-500 rounded-full">{expenses.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="cargo" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white text-xs gap-1.5" data-testid="tab-cargo">
              <Package className="w-3.5 h-3.5" /> Kargo Ops
            </TabsTrigger>
            <TabsTrigger value="participants" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white text-xs gap-1.5" data-testid="tab-participants">
              <Users className="w-3.5 h-3.5" /> Katılımcılar
              {participants && participants.length > 0 && <Badge className="h-4 w-4 p-0 text-[9px] bg-sky-500 rounded-full">{participants.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          {/* ── GENEL BAKIŞ TAB ── */}
          <TabsContent value="overview" className="space-y-6" data-testid="tab-content-overview">
            <Card className="bg-card/30 border-sidebar-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Durum Akışı</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusTimeline
                  status={portCall.status || "expected"}
                  onUpdate={(s) => updateStatusMutation.mutate(s)}
                />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card/30 border-sidebar-border/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Zaman Çizelgesi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "ETA / Beklenen Varış", value: portCall.eta, icon: "📅" },
                    { label: "Fiili Varış", value: portCall.actualArrival, icon: "⚓" },
                    { label: "NOR Tender", value: portCall.norTendered, icon: "📋" },
                    { label: "Yanaşma", value: portCall.berthingTime, icon: "🚢" },
                    { label: "Operasyon Başlangıç", value: portCall.operationsStart, icon: "⚙️" },
                    { label: "Operasyon Bitiş", value: portCall.operationsEnd, icon: "✅" },
                    { label: "Kalkış", value: portCall.departure, icon: "🛫" },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b border-sidebar-border/10 last:border-0">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span>{icon}</span>{label}
                      </span>
                      <span className={`text-xs font-mono ${value ? "text-slate-200" : "text-slate-600"}`}>
                        {value ? fmtDate(value) : "—"}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-card/30 border-sidebar-border/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Operasyon Detayları</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Liman", value: portCall.portName },
                    { label: "Rıhtım / İskele", value: portCall.berth },
                    { label: "Acente", value: portCall.agentName },
                    { label: "Kargo Tipi", value: portCall.cargoType },
                    { label: "Kargo Miktarı", value: portCall.cargoQuantity ? `${portCall.cargoQuantity} ${portCall.cargoUnit || "MT"}` : null },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b border-sidebar-border/10 last:border-0">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className={`text-xs ${value ? "text-slate-200" : "text-slate-600"}`}>{value || "—"}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    {[
                      { label: "Pilot", done: portCall.pilotArranged },
                      { label: "Römork", done: portCall.tugArranged },
                      { label: "Gümrük", done: portCall.customsCleared },
                      { label: "PDA", done: portCall.pdaIssued },
                      { label: "FDA", done: portCall.fdaIssued },
                    ].map(({ label, done }) => (
                      <div key={label} className={`flex items-center gap-1.5 p-2 rounded-lg text-xs ${done ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800/30 text-slate-600"}`}>
                        <CheckCircle2 className="w-3 h-3" /> {label}
                      </div>
                    ))}
                  </div>
                  {portCall.notes && (
                    <div className="pt-3 border-t border-sidebar-border/20">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Notlar</p>
                      <p className="text-xs text-slate-300">{portCall.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── NOR TAB ── */}
          <TabsContent value="nor" className="space-y-4" data-testid="tab-content-nor">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Notice of Readiness</h2>
              <Button size="sm" className="h-8 text-xs bg-sky-600 hover:bg-sky-500 gap-1.5" onClick={() => {
                norForm.reset({
                  vesselName: vessel?.name || "",
                  portName: portCall.portName || "",
                  agentName: portCall.agentName || "",
                  cargoType: portCall.cargoType || "",
                  operation: "loading",
                });
                setNorDialogOpen(true);
              }} data-testid="btn-create-nor">
                <Plus className="w-3.5 h-3.5" /> Yeni NOR
              </Button>
            </div>

            {!nors?.length ? (
              <Card className="bg-card/30 border-sidebar-border/40 border-dashed">
                <CardContent className="p-10 text-center">
                  <FileText className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                  <p className="text-sm text-muted-foreground mb-4">Bu port call için henüz NOR kaydı yok</p>
                  <Button size="sm" className="h-8 text-xs bg-sky-600 hover:bg-sky-500 gap-1.5" onClick={() => setNorDialogOpen(true)}>
                    <Plus className="w-3.5 h-3.5" /> İlk NOR'u Oluştur
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {nors.map(nor => (
                  <Card key={nor.id} className="bg-card/30 border-sidebar-border/40">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-slate-200">NOR #{nor.id}</span>
                            <Badge className={`text-[9px] uppercase font-bold ${NOR_STATUS_COLORS[nor.status || "draft"] || NOR_STATUS_COLORS.draft}`}>
                              {nor.status || "draft"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{nor.vesselName} — {nor.portName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {nor.status === "draft" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                              onClick={() => norActionMutation.mutate({ norId: nor.id, action: "tender" })}>
                              Tender Et
                            </Button>
                          )}
                          {nor.status === "tendered" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                              onClick={() => norActionMutation.mutate({ norId: nor.id, action: "accept" })}>
                              Kabul Et
                            </Button>
                          )}
                          {nor.status === "accepted" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                              onClick={() => norActionMutation.mutate({ norId: nor.id, action: "sign" })}>
                              İmzala
                            </Button>
                          )}
                          <Link href={`/nor/${nor.id}`}>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-sky-400 hover:text-sky-300">Detay</Button>
                          </Link>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: "Operasyon", value: nor.operation },
                          { label: "Kargo", value: nor.cargoType },
                          { label: "NOR Tender", value: nor.norTenderedAt ? fmtDate(nor.norTenderedAt) : null },
                          { label: "NOR Kabul", value: nor.norAcceptedAt ? fmtDate(nor.norAcceptedAt) : null },
                        ].map(({ label, value }) => (
                          <div key={label} className="space-y-0.5">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">{label}</p>
                            <p className={`text-xs ${value ? "text-slate-200" : "text-slate-600"}`}>{value || "—"}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── SOF TAB ── */}
          <TabsContent value="sof" className="space-y-4" data-testid="tab-content-sof">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Statement of Facts</h2>
              <div className="flex items-center gap-2">
                {sofs && sofs.length > 0 && (
                  <Button size="sm" variant="outline" className="h-8 text-xs border-emerald-500/30 text-emerald-400 gap-1.5"
                    onClick={() => {
                      setActiveSofId(sofs[0].id);
                      sofEventForm.reset({ eventType: "operation", isDeductible: false });
                      setSofEventDialogOpen(true);
                    }} data-testid="btn-add-sof-event">
                    <Plus className="w-3.5 h-3.5" /> Olay Ekle
                  </Button>
                )}
                <Button size="sm" className="h-8 text-xs bg-sky-600 hover:bg-sky-500 gap-1.5" onClick={() => {
                  sofForm.reset({ vesselName: vessel?.name || "", portName: portCall.portName || "" });
                  setSofDialogOpen(true);
                }} data-testid="btn-create-sof">
                  <Plus className="w-3.5 h-3.5" /> Yeni SOF
                </Button>
              </div>
            </div>

            {!sofs?.length ? (
              <Card className="bg-card/30 border-sidebar-border/40 border-dashed">
                <CardContent className="p-10 text-center">
                  <ClipboardList className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                  <p className="text-sm text-muted-foreground mb-4">Bu port call için henüz SOF kaydı yok</p>
                  <Button size="sm" className="h-8 text-xs bg-sky-600 hover:bg-sky-500 gap-1.5" onClick={() => setSofDialogOpen(true)}>
                    <Plus className="w-3.5 h-3.5" /> İlk SOF'u Oluştur
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {sofs.map(sof => (
                  <Card key={sof.id} className={`bg-card/30 border-sidebar-border/40 ${activeSofId === sof.id ? "ring-1 ring-sky-500/50" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="text-sm font-semibold text-slate-200">SOF #{sof.id}</span>
                          <Badge className="ml-2 text-[9px] uppercase font-bold bg-slate-700 text-slate-300">{sof.status || "draft"}</Badge>
                          <p className="text-xs text-muted-foreground mt-0.5">{sof.vesselName} — {sof.portName}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-7 text-xs border-sky-500/30 text-sky-400"
                            onClick={() => setActiveSofId(activeSofId === sof.id ? null : sof.id)}>
                            {activeSofId === sof.id ? "Kapat" : "Olayları Gör"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-500/30 text-emerald-400"
                            onClick={() => { setActiveSofId(sof.id); sofEventForm.reset({ eventType: "operation", isDeductible: false }); setSofEventDialogOpen(true); }}>
                            <Plus className="w-3 h-3" />
                          </Button>
                          <Link href={`/sof/${sof.id}`}>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-sky-400">Detay</Button>
                          </Link>
                        </div>
                      </div>

                      {activeSofId === sof.id && sofDetail && (
                        <div className="mt-3 border-t border-sidebar-border/20 pt-3 space-y-2">
                          {!sofDetail.events?.length ? (
                            <p className="text-xs text-slate-600 py-2 text-center">Henüz olay yok. Olay ekle butonuna tıkla.</p>
                          ) : (
                            sofDetail.events.map((evt, i) => (
                              <div key={evt.id} className="flex items-start gap-3 py-2 border-b border-sidebar-border/10 last:border-0">
                                <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                  <span className="text-[9px] font-bold text-sky-400">{i + 1}</span>
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-slate-200">{evt.eventName}</p>
                                  <p className="text-[10px] text-muted-foreground">{fmtDate(evt.eventDate)}</p>
                                  {evt.remarks && <p className="text-[10px] text-slate-500 mt-0.5">{evt.remarks}</p>}
                                </div>
                                {evt.isDeductible && <Badge className="text-[9px] bg-amber-500/10 text-amber-400">Dedüktible</Badge>}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── MASRAFLAR TAB ── */}
          <TabsContent value="expenses" className="space-y-4" data-testid="tab-content-expenses">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Liman Masrafları</h2>
                {expenses && expenses.length > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Toplam: <span className="font-bold text-emerald-400">${totalExpensesUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </p>
                )}
              </div>
              <Button size="sm" className="h-8 text-xs bg-sky-600 hover:bg-sky-500 gap-1.5"
                onClick={() => { expenseForm.reset({ currency: "USD" }); setExpenseDialogOpen(true); }}
                data-testid="btn-add-expense">
                <Plus className="w-3.5 h-3.5" /> Masraf Ekle
              </Button>
            </div>

            {!expenses?.length ? (
              <Card className="bg-card/30 border-sidebar-border/40 border-dashed">
                <CardContent className="p-10 text-center">
                  <DollarSign className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                  <p className="text-sm text-muted-foreground">Henüz masraf kaydı yok</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {expenses.map(exp => (
                  <Card key={exp.id} className="bg-card/30 border-sidebar-border/40 group">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <DollarSign className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-200">
                              {exp.category?.replace(/_/g, " ").toUpperCase()}
                            </p>
                            <p className="text-xs text-muted-foreground">{exp.vendor || exp.description || "—"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-bold font-mono text-emerald-400">
                              {exp.amount.toLocaleString()} {exp.currency}
                            </p>
                            {exp.expenseDate && <p className="text-[10px] text-muted-foreground">{fmtDate(exp.expenseDate)}</p>}
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
                            onClick={() => deleteExpenseMutation.mutate(exp.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── KARGO OPS TAB ── */}
          <TabsContent value="cargo" className="space-y-4" data-testid="tab-content-cargo">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Kargo Operasyonları</h2>
              <Button size="sm" className="h-8 text-xs bg-sky-600 hover:bg-sky-500 gap-1.5"
                onClick={() => { cargoOpForm.reset({ operation: "loading", unit: "MT", status: "planned" }); setCargoOpDialogOpen(true); }}
                data-testid="btn-add-cargo-op">
                <Plus className="w-3.5 h-3.5" /> Operasyon Ekle
              </Button>
            </div>

            {!cargoOps?.length ? (
              <Card className="bg-card/30 border-sidebar-border/40 border-dashed">
                <CardContent className="p-10 text-center">
                  <Package className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                  <p className="text-sm text-muted-foreground">Henüz kargo operasyonu yok</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {cargoOps.map((op: any) => (
                  <Card key={op.id} className="bg-card/30 border-sidebar-border/40 group">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${op.operation === "loading" ? "bg-blue-500/10 text-blue-400" : "bg-orange-500/10 text-orange-400"}`}>
                            {op.operation === "loading" ? "YÜK" : "BOŞ"}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-200">{op.cargoName}</p>
                            <p className="text-xs text-muted-foreground">
                              {op.quantity} {op.unit} {op.blNumber ? `— B/L: ${op.blNumber}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-[9px] ${op.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : op.status === "in_progress" ? "bg-blue-500/20 text-blue-400" : "bg-slate-700 text-slate-400"}`}>
                            {op.status}
                          </Badge>
                          <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-red-400"
                            onClick={() => deleteCargoOpMutation.mutate(op.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── KATILIMCİLAR TAB ── */}
          <TabsContent value="participants" className="space-y-4" data-testid="tab-content-participants">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Katılımcılar & Davetliler</h2>
              <Button size="sm" className="h-8 text-xs bg-sky-600 hover:bg-sky-500 gap-1.5"
                onClick={() => { participantForm.reset(); setParticipantDialogOpen(true); }}
                data-testid="btn-add-participant">
                <UserPlus className="w-3.5 h-3.5" /> Katılımcı Ekle
              </Button>
            </div>

            {!participants?.length ? (
              <Card className="bg-card/30 border-sidebar-border/40 border-dashed">
                <CardContent className="p-10 text-center">
                  <Users className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                  <p className="text-sm text-muted-foreground mb-4">Henüz katılımcı eklenmedi</p>
                  <p className="text-xs text-slate-500 mb-4">Armatör, satıcı, alıcı, broker veya surveyor davet edin</p>
                  <Button size="sm" className="h-8 text-xs bg-sky-600 hover:bg-sky-500 gap-1.5" onClick={() => setParticipantDialogOpen(true)}>
                    <UserPlus className="w-3.5 h-3.5" /> İlk Katılımcıyı Ekle
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {participants.map(p => (
                  <Card key={p.id} className={`bg-card/30 border-sidebar-border/40 group border ${ROLE_COLORS[p.role]?.split(" ").slice(2).join(" ") || ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs ${ROLE_COLORS[p.role] || ROLE_COLORS.other}`}>
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-200">{p.name}</p>
                              <Badge className={`text-[9px] font-bold uppercase ${ROLE_COLORS[p.role] || ROLE_COLORS.other}`}>
                                {PARTICIPANT_ROLES.find(r => r.value === p.role)?.label || p.role}
                              </Badge>
                            </div>
                          </div>
                          {p.company && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                              <Building2 className="w-3 h-3" />{p.company}
                            </p>
                          )}
                          {p.email && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                              <Mail className="w-3 h-3" />{p.email}
                            </p>
                          )}
                          {p.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Phone className="w-3 h-3" />{p.phone}
                            </p>
                          )}
                          {p.notes && <p className="text-xs text-slate-500 mt-2 border-t border-sidebar-border/20 pt-2">{p.notes}</p>}
                        </div>
                        <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-red-400 shrink-0"
                          onClick={() => deleteParticipantMutation.mutate(p.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── DIALOGS ── */}

      {/* NOR Create Dialog */}
      <Dialog open={norDialogOpen} onOpenChange={setNorDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-sky-400" /> Yeni NOR Oluştur</DialogTitle>
          </DialogHeader>
          <Form {...norForm}>
            <form onSubmit={norForm.handleSubmit(handleCreateNor)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={norForm.control} name="vesselName" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Gemi Adı</FormLabel><FormControl><Input {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl></FormItem>
                )} />
                <FormField control={norForm.control} name="portName" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Liman</FormLabel><FormControl><Input {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl></FormItem>
                )} />
                <FormField control={norForm.control} name="masterName" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Kaptan</FormLabel><FormControl><Input {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl></FormItem>
                )} />
                <FormField control={norForm.control} name="agentName" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Acente</FormLabel><FormControl><Input {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl></FormItem>
                )} />
                <FormField control={norForm.control} name="operation" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Operasyon</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="bg-slate-800 border-slate-600 h-9 text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="loading">Yükleme</SelectItem><SelectItem value="discharging">Tahliye</SelectItem></SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={norForm.control} name="cargoType" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Kargo Tipi</FormLabel><FormControl><Input {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl></FormItem>
                )} />
                <FormField control={norForm.control} name="norTenderedAt" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel className="text-xs">NOR Tender Tarihi</FormLabel><FormControl><Input type="datetime-local" {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl></FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setNorDialogOpen(false)}>İptal</Button>
                <Button type="submit" className="bg-sky-600 hover:bg-sky-500" disabled={createNorMutation.isPending}>
                  {createNorMutation.isPending ? "Oluşturuluyor..." : "NOR Oluştur"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* SOF Create Dialog */}
      <Dialog open={sofDialogOpen} onOpenChange={setSofDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-sky-400" /> Yeni SOF Oluştur</DialogTitle>
          </DialogHeader>
          <Form {...sofForm}>
            <form onSubmit={sofForm.handleSubmit(handleCreateSof)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={sofForm.control} name="vesselName" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Gemi Adı</FormLabel><FormControl><Input {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl></FormItem>
                )} />
                <FormField control={sofForm.control} name="portName" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Liman</FormLabel><FormControl><Input {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl></FormItem>
                )} />
                <FormField control={sofForm.control} name="operation" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Operasyon</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || "loading"}>
                      <FormControl><SelectTrigger className="bg-slate-800 border-slate-600 h-9 text-sm"><SelectValue placeholder="Seç" /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="loading">Yükleme</SelectItem><SelectItem value="discharging">Tahliye</SelectItem></SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={sofForm.control} name="masterName" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Kaptan</FormLabel><FormControl><Input {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl></FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setSofDialogOpen(false)}>İptal</Button>
                <Button type="submit" className="bg-sky-600 hover:bg-sky-500" disabled={createSofMutation.isPending}>
                  {createSofMutation.isPending ? "Oluşturuluyor..." : "SOF Oluştur"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* SOF Event Add Dialog */}
      <Dialog open={sofEventDialogOpen} onOpenChange={setSofEventDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-emerald-400" /> SOF Olayı Ekle</DialogTitle>
          </DialogHeader>
          <Form {...sofEventForm}>
            <form onSubmit={sofEventForm.handleSubmit(handleAddSofEvent)} className="space-y-4">
              <FormField control={sofEventForm.control} name="eventName" render={({ field }) => (
                <FormItem><FormLabel className="text-xs">Olay Adı *</FormLabel><FormControl><Input {...field} placeholder="örn. Pilot Gemiye Geldi" className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={sofEventForm.control} name="eventDate" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Tarih / Saat *</FormLabel><FormControl><Input type="datetime-local" {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={sofEventForm.control} name="eventType" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Tip</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="bg-slate-800 border-slate-600 h-9 text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="arrival">Varış</SelectItem>
                        <SelectItem value="departure">Kalkış</SelectItem>
                        <SelectItem value="operation">Operasyon</SelectItem>
                        <SelectItem value="weather">Hava</SelectItem>
                        <SelectItem value="other">Diğer</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <FormField control={sofEventForm.control} name="remarks" render={({ field }) => (
                <FormItem><FormLabel className="text-xs">Açıklamalar</FormLabel><FormControl><Textarea {...field} rows={2} className="bg-slate-800 border-slate-600 text-sm resize-none" /></FormControl></FormItem>
              )} />
              <FormField control={sofEventForm.control} name="isDeductible" render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="text-xs cursor-pointer">Dedüktible süre</FormLabel>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setSofEventDialogOpen(false)}>İptal</Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500" disabled={addSofEventMutation.isPending}>
                  {addSofEventMutation.isPending ? "Ekleniyor..." : "Olay Ekle"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Expense Add Dialog */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-400" /> Masraf Ekle</DialogTitle>
          </DialogHeader>
          <Form {...expenseForm}>
            <form onSubmit={expenseForm.handleSubmit(handleCreateExpense)} className="space-y-4">
              <FormField control={expenseForm.control} name="category" render={({ field }) => (
                <FormItem><FormLabel className="text-xs">Kategori *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="bg-slate-800 border-slate-600 h-9 text-sm"><SelectValue placeholder="Kategori seç" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat.replace(/_/g, " ").toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={expenseForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel className="text-xs">Açıklama</FormLabel><FormControl><Input {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl></FormItem>
              )} />
              <div className="grid grid-cols-3 gap-3">
                <FormField control={expenseForm.control} name="amount" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel className="text-xs">Tutar *</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={expenseForm.control} name="currency" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Döviz</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="bg-slate-800 border-slate-600 h-9 text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {["USD", "EUR", "TRY", "GBP"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <FormField control={expenseForm.control} name="vendor" render={({ field }) => (
                <FormItem><FormLabel className="text-xs">Tedarikçi / Firma</FormLabel><FormControl><Input {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setExpenseDialogOpen(false)}>İptal</Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500" disabled={createExpenseMutation.isPending}>
                  {createExpenseMutation.isPending ? "Ekleniyor..." : "Masraf Ekle"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Participant Add Dialog */}
      <Dialog open={participantDialogOpen} onOpenChange={setParticipantDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-sky-400" /> Katılımcı Ekle</DialogTitle>
          </DialogHeader>
          <Form {...participantForm}>
            <form onSubmit={participantForm.handleSubmit(handleAddParticipant)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={participantForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Ad Soyad *</FormLabel><FormControl><Input {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={participantForm.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Rol *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="bg-slate-800 border-slate-600 h-9 text-sm"><SelectValue placeholder="Rol seç" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {PARTICIPANT_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={participantForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">E-posta</FormLabel><FormControl><Input type="email" {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={participantForm.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Telefon</FormLabel><FormControl><Input {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl></FormItem>
                )} />
                <FormField control={participantForm.control} name="company" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel className="text-xs">Şirket</FormLabel><FormControl><Input {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl></FormItem>
                )} />
              </div>
              <FormField control={participantForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel className="text-xs">Notlar</FormLabel><FormControl><Textarea {...field} rows={2} className="bg-slate-800 border-slate-600 text-sm resize-none" /></FormControl></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setParticipantDialogOpen(false)}>İptal</Button>
                <Button type="submit" className="bg-sky-600 hover:bg-sky-500" disabled={addParticipantMutation.isPending}>
                  {addParticipantMutation.isPending ? "Ekleniyor..." : "Katılımcı Ekle"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Cargo Op Add Dialog */}
      <Dialog open={cargoOpDialogOpen} onOpenChange={setCargoOpDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Package className="w-5 h-5 text-sky-400" /> Kargo Operasyonu Ekle</DialogTitle>
          </DialogHeader>
          <Form {...cargoOpForm}>
            <form onSubmit={cargoOpForm.handleSubmit(handleCreateCargoOp)} className="space-y-4">
              <FormField control={cargoOpForm.control} name="cargoName" render={({ field }) => (
                <FormItem><FormLabel className="text-xs">Kargo Adı *</FormLabel><FormControl><Input {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={cargoOpForm.control} name="operation" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Operasyon</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="bg-slate-800 border-slate-600 h-9 text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="loading">Yükleme</SelectItem><SelectItem value="discharging">Tahliye</SelectItem></SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={cargoOpForm.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Durum</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="bg-slate-800 border-slate-600 h-9 text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="planned">Planlandı</SelectItem>
                        <SelectItem value="in_progress">Devam Ediyor</SelectItem>
                        <SelectItem value="completed">Tamamlandı</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={cargoOpForm.control} name="quantity" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Miktar</FormLabel><FormControl><Input type="number" {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl></FormItem>
                )} />
                <FormField control={cargoOpForm.control} name="unit" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Birim</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger className="bg-slate-800 border-slate-600 h-9 text-sm"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="MT">MT</SelectItem><SelectItem value="CBM">CBM</SelectItem><SelectItem value="Units">Units</SelectItem></SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <FormField control={cargoOpForm.control} name="blNumber" render={({ field }) => (
                <FormItem><FormLabel className="text-xs">B/L Numarası</FormLabel><FormControl><Input {...field} className="bg-slate-800 border-slate-600 text-sm h-9" /></FormControl></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setCargoOpDialogOpen(false)}>İptal</Button>
                <Button type="submit" className="bg-sky-600 hover:bg-sky-500" disabled={createCargoOpMutation.isPending}>
                  {createCargoOpMutation.isPending ? "Ekleniyor..." : "Operasyon Ekle"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
