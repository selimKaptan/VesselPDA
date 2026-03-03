import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  Ship, MapPin, Calendar, ArrowLeft, CheckCircle2, Circle, Trash2,
  Plus, Loader2, ChevronDown, Wrench, Fuel, ShoppingCart, Users as UsersIcon,
  Sparkles, HelpCircle, Clock, PlayCircle, XCircle, ClipboardList,
  FileText, Upload, Download, Star, MessageCircle, FolderOpen, Anchor, Cloud,
  CalendarClock, Pen, LayoutTemplate, GitBranch, BadgeCheck, UserPlus, Building2,
  Shield, Check, X as XIcon, Edit2, Route, Package, ChevronRight as ChevronRightIcon,
  ArrowRight, Navigation, MoreVertical, RefreshCw
} from "lucide-react";
import { WeatherPanel, EtaWeatherAlert } from "@/components/port-weather-panel";
import { VoyageTimeline } from "@/components/voyage-timeline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { useAuth } from "@/hooks/use-auth";
import type { Port } from "@shared/schema";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  planned:   { label: "Planlandı",    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",    icon: Clock },
  active:    { label: "Aktif",        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: PlayCircle },
  completed: { label: "Tamamlandı",   color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",        icon: CheckCircle2 },
  cancelled: { label: "İptal Edildi", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",         icon: XCircle },
};

const SERVICE_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  fuel:         { label: "Yakıt / Bunker", icon: Fuel,          color: "text-orange-500" },
  repair:       { label: "Teknik Tamir",   icon: Wrench,        color: "text-red-500" },
  provisioning: { label: "Provizyonlama",  icon: ShoppingCart,  color: "text-green-500" },
  crew_change:  { label: "Mürettebat",     icon: UsersIcon,     color: "text-blue-500" },
  cleaning:     { label: "Temizlik",       icon: Sparkles,      color: "text-purple-500" },
  other:        { label: "Diğer",          icon: HelpCircle,    color: "text-gray-500" },
};

const DOC_TYPE_CONFIG: Record<string, string> = {
  manifest:       "Manifesto",
  bill_of_lading: "Konşimento",
  certificate:    "Sertifika",
  port_clearance: "Liman İzni",
  other:          "Diğer",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  planned: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

const PC_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  planned:     { label: "Planned",    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",      icon: Clock },
  approaching: { label: "Approaching",color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",      icon: Navigation },
  at_anchor:   { label: "At Anchor",  color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Anchor },
  berthed:     { label: "Berthed",    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", icon: MapPin },
  operations:  { label: "Operations", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",  icon: PlayCircle },
  completed:   { label: "Completed",  color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",         icon: CheckCircle2 },
  skipped:     { label: "Skipped",    color: "bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400",          icon: XCircle },
};

const PC_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  loading:     { label: "Loading",     color: "text-green-600 bg-green-50 dark:bg-green-900/20" },
  discharging: { label: "Discharging", color: "text-orange-600 bg-orange-50 dark:bg-orange-900/20" },
  bunkering:   { label: "Bunkering",   color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20" },
  transit:     { label: "Transit",     color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
  repair:      { label: "Repair",      color: "text-red-600 bg-red-50 dark:bg-red-900/20" },
  crew_change: { label: "Crew Change", color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20" },
  other:       { label: "Other",       color: "text-gray-600 bg-gray-50 dark:bg-gray-800" },
};

const PC_STATUS_ORDER = ["planned","approaching","at_anchor","berthed","operations","completed","skipped"] as const;

function PortSearch({ value, onChange }: { value: string; onChange: (portId: number, portName: string) => void }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const closeTimeout = useState<ReturnType<typeof setTimeout> | null>(null);
  const { data: ports } = useQuery<Port[]>({
    queryKey: ["/api/ports", query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const res = await fetch(`/api/ports?q=${encodeURIComponent(query)}`);
      return res.json();
    },
    enabled: query.length >= 2,
  });
  const selectPort = (id: number, name: string) => {
    onChange(id, name);
    setQuery(name);
    setOpen(false);
  };
  return (
    <div className="relative">
      <Input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        placeholder="Search port..."
        onFocus={() => setOpen(true)}
        onBlur={() => { closeTimeout[1](setTimeout(() => setOpen(false), 200)); }}
        onKeyDown={e => {
          if (e.key === "Enter" && ports && ports.length > 0 && open) {
            e.preventDefault();
            selectPort(ports[0].id, ports[0].name);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        data-testid="input-port-search"
      />
      {open && ports && ports.length > 0 && (
        <div className="absolute z-[200] top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto" role="listbox">
          {ports.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={false}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
              data-testid={`port-search-option-${idx}`}
              onMouseDown={e => { e.preventDefault(); selectPort(p.id, p.name); }}
              onClick={() => selectPort(p.id, p.name)}
            >
              <span className="font-medium">{p.name}</span>
              {p.code && <span className="ml-2 text-xs text-muted-foreground">{p.code}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110"
          data-testid={`star-${i}`}
        >
          <Star
            className={`w-7 h-7 ${(hovered || value) >= i ? "fill-amber-400 text-amber-400 drop-shadow" : "text-muted-foreground"} transition-colors`}
          />
        </button>
      ))}
    </div>
  );
}

export default function VoyageDetail() {
  const { id } = useParams<{ id: string }>();
  const voyageId = parseInt(id || "0");
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newTask, setNewTask] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"route" | "operation" | "documents" | "comms" | "timeline" | "collaborators">("route");
  const [showAddPortCallDialog, setShowAddPortCallDialog] = useState(false);
  const [editingPortCall, setEditingPortCall] = useState<any | null>(null);
  const [pcForm, setPcForm] = useState({
    portId: 0, portName: "", portCallType: "discharging", status: "planned",
    eta: "", etd: "", berthName: "", terminalName: "",
    cargoType: "", cargoQuantity: "", cargoUnit: "MT", notes: "",
  });
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteTargetType, setInviteTargetType] = useState<"org" | "user">("org");
  const [inviteTargetId, setInviteTargetId] = useState<string | number | null>(null);
  const [inviteTargetName, setInviteTargetName] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor" | "manager">("viewer");
  const [invitePerms, setInvitePerms] = useState<Record<string, boolean>>({
    viewVoyage: true, editVoyage: false,
    viewDocuments: true, uploadDocuments: false, deleteDocuments: false, signDocuments: false,
    viewProforma: true, editProforma: false,
    viewInvoice: true,
    viewChecklist: true, editChecklist: false,
    viewChat: true, sendChat: false,
    viewTimeline: true,
  });
  const [editingCollab, setEditingCollab] = useState<any | null>(null);
  const [docFilter, setDocFilter] = useState<string>("all");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [showDocDialog, setShowDocDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [docForm, setDocForm] = useState({ name: "", docType: "other", notes: "", fileBase64: "", fileUrl: "", fileName: "", fileSize: 0 });
  const [docUploading, setDocUploading] = useState(false);
  const [isDragOverDropzone, setIsDragOverDropzone] = useState(false);
  const [isPanelDragOver, setIsPanelDragOver] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: "" });
  const [showApptForm, setShowApptForm] = useState(false);
  const [apptForm, setApptForm] = useState({ appointmentType: "pilot", scheduledAt: "", notes: "" });
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [signDocId, setSignDocId] = useState<number | null>(null);
  const [signatureText, setSignatureText] = useState("");
  const [serviceForm, setServiceForm] = useState({
    portId: 0, portName: "", vesselName: "", serviceType: "other",
    description: "", quantity: "", unit: "", preferredDate: "",
  });

  const { data: voyage, isLoading } = useQuery<any>({
    queryKey: ["/api/voyages", voyageId],
    queryFn: async () => {
      const res = await fetch(`/api/voyages/${voyageId}`);
      return res.json();
    },
  });

  const { data: docs = [], isLoading: docsLoading } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/voyages/${voyageId}/documents`);
      return res.json();
    },
    enabled: !!voyageId,
  });

  const { data: reviewData } = useQuery<{ reviews: any[]; myReview: any }>({
    queryKey: ["/api/voyages", voyageId, "reviews"],
    queryFn: async () => {
      const res = await fetch(`/api/voyages/${voyageId}/reviews`);
      return res.json();
    },
    enabled: !!voyageId,
  });

  const { data: portData } = useQuery<any>({
    queryKey: ["/api/ports", voyage?.portId],
    queryFn: async () => {
      const res = await fetch(`/api/ports/${voyage.portId}`);
      return res.json();
    },
    enabled: !!voyage?.portId,
  });

  const { data: chatMessages = [], refetch: refetchChat } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "chat"],
    queryFn: async () => {
      const res = await fetch(`/api/voyages/${voyageId}/chat`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!voyageId,
    refetchInterval: 10000,
  });

  const { data: appointments = [] } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "appointments"],
    queryFn: async () => {
      const res = await fetch(`/api/voyages/${voyageId}/appointments`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!voyageId,
  });

  const { data: docTemplates = [] } = useQuery<any[]>({
    queryKey: ["/api/document-templates"],
  });

  const { data: collaborators = [], refetch: refetchCollabs } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "collaborators"],
    queryFn: async () => {
      const res = await fetch(`/api/voyages/${voyageId}/collaborators`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!voyageId,
  });

  const { data: portCalls = [], refetch: refetchPortCalls } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "port-calls"],
    queryFn: async () => {
      const res = await fetch(`/api/voyages/${voyageId}/port-calls`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!voyageId,
  });

  const { data: orgSearchResults = [] } = useQuery<any[]>({
    queryKey: ["/api/directory", inviteSearch],
    queryFn: async () => {
      if (inviteSearch.length < 2) return [];
      const res = await fetch(`/api/directory?q=${encodeURIComponent(inviteSearch)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: inviteSearch.length >= 2 && inviteTargetType === "org",
  });

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const userId = (user as any)?.id || (user as any)?.claims?.sub;
  const isOwner = voyage?.userId === userId;
  const isAgent = voyage?.agentUserId === userId;

  const revieweeUserId = isOwner ? voyage?.agentUserId : (isAgent ? voyage?.userId : null);
  const canReview = voyage?.status === "completed" && (isOwner || isAgent) && revieweeUserId && !reviewData?.myReview;

  const inviteCollabMutation = useMutation({
    mutationFn: async () => {
      const body: any = { role: inviteRole, permissions: invitePerms };
      if (inviteTargetType === "org") body.organizationId = inviteTargetId;
      else body.userId = inviteTargetId;
      return apiRequest("POST", `/api/voyages/${voyageId}/collaborators`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "collaborators"] });
      setShowInviteDialog(false);
      setInviteSearch(""); setInviteTargetId(null); setInviteTargetName(""); setInviteRole("viewer");
      toast({ title: "Invitation sent" });
    },
    onError: () => toast({ title: "Failed to invite", variant: "destructive" }),
  });

  const updateCollabMutation = useMutation({
    mutationFn: async ({ collabId, role, permissions }: { collabId: number; role: string; permissions: Record<string, boolean> }) => {
      return apiRequest("PATCH", `/api/voyages/${voyageId}/collaborators/${collabId}`, { role, permissions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "collaborators"] });
      setEditingCollab(null);
      toast({ title: "Permissions updated" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const removeCollabMutation = useMutation({
    mutationFn: async (collabId: number) => {
      return apiRequest("DELETE", `/api/voyages/${voyageId}/collaborators/${collabId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "collaborators"] });
      toast({ title: "Collaborator removed" });
    },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  const respondCollabMutation = useMutation({
    mutationFn: async ({ collabId, status }: { collabId: number; status: string }) => {
      return apiRequest("PATCH", `/api/voyages/${voyageId}/collaborators/${collabId}/respond`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "collaborators"] });
      toast({ title: "Response recorded" });
    },
    onError: () => toast({ title: "Failed to respond", variant: "destructive" }),
  });

  const myPendingInvite = collaborators.find((c: any) =>
    c.status === "pending" && (c.user_id === userId)
  );

  function applyRoleDefaults(role: "viewer" | "editor" | "manager") {
    const presets: Record<string, Record<string, boolean>> = {
      viewer: { viewVoyage: true, editVoyage: false, viewDocuments: true, uploadDocuments: false, deleteDocuments: false, signDocuments: false, viewProforma: true, editProforma: false, viewInvoice: true, viewChecklist: true, editChecklist: false, viewChat: true, sendChat: false, viewTimeline: true },
      editor: { viewVoyage: true, editVoyage: true, viewDocuments: true, uploadDocuments: true, deleteDocuments: false, signDocuments: false, viewProforma: true, editProforma: false, viewInvoice: true, viewChecklist: true, editChecklist: true, viewChat: true, sendChat: true, viewTimeline: true },
      manager: { viewVoyage: true, editVoyage: true, viewDocuments: true, uploadDocuments: true, deleteDocuments: true, signDocuments: true, viewProforma: true, editProforma: true, viewInvoice: true, viewChecklist: true, editChecklist: true, viewChat: true, sendChat: true, viewTimeline: true },
    };
    setInvitePerms(presets[role]);
    setInviteRole(role);
  }

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/voyages/${voyageId}/status`, { status });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] }); toast({ title: "Durum güncellendi" }); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const addTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/checklist`, { title: newTask, assignedTo: "both" });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] }); setNewTask(""); },
    onError: () => toast({ title: "Görev eklenemedi", variant: "destructive" }),
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const res = await apiRequest("PATCH", `/api/voyages/${voyageId}/checklist/${itemId}`, {});
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (itemId: number) => {
      await apiRequest("DELETE", `/api/voyages/${voyageId}/checklist/${itemId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] }),
  });

  const createApptMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/voyages/${voyageId}/appointments`, {
        ...apptForm,
        scheduledAt: apptForm.scheduledAt || null,
        notes: apptForm.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "appointments"] });
      setApptForm({ appointmentType: "pilot", scheduledAt: "", notes: "" });
      setShowApptForm(false);
      toast({ title: "Randevu eklendi" });
    },
  });

  const updateApptMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PATCH", `/api/voyages/${voyageId}/appointments/${id}`, { status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "appointments"] }),
  });

  const deleteApptMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/voyages/${voyageId}/appointments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "appointments"] });
      toast({ title: "Randevu silindi" });
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        portId: serviceForm.portId || voyage?.portId,
        vesselName: serviceForm.vesselName || voyage?.vesselName || "Belirtilmedi",
        serviceType: serviceForm.serviceType,
        description: serviceForm.description,
        voyageId: voyageId,
      };
      if (serviceForm.quantity) payload.quantity = parseFloat(serviceForm.quantity);
      if (serviceForm.unit) payload.unit = serviceForm.unit;
      if (serviceForm.preferredDate) payload.preferredDate = serviceForm.preferredDate;
      const res = await apiRequest("POST", "/api/service-requests", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({ title: "Hizmet talebi oluşturuldu" });
      setShowServiceDialog(false);
      setServiceForm({ portId: 0, portName: "", vesselName: "", serviceType: "other", description: "", quantity: "", unit: "", preferredDate: "" });
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const uploadDocMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: docForm.name,
        docType: docForm.docType,
        notes: docForm.notes,
      };
      if (docForm.fileUrl) {
        payload.fileUrl = docForm.fileUrl;
        payload.fileName = docForm.fileName;
        payload.fileSize = docForm.fileSize;
      } else {
        payload.fileBase64 = docForm.fileBase64;
      }
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/documents`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "documents"] });
      toast({ title: "Document uploaded" });
      setShowDocDialog(false);
      setDocForm({ name: "", docType: "other", notes: "", fileBase64: "", fileUrl: "", fileName: "", fileSize: 0 });
    },
    onError: () => toast({ title: "Upload error", variant: "destructive" }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/voyages/${voyageId}/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "documents"] });
      toast({ title: "Doküman silindi" });
    },
    onError: () => toast({ title: "Silme hatası", variant: "destructive" }),
  });

  const fromTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/documents/from-template`, { templateId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "documents"] });
      setShowTemplateDialog(false);
      toast({ title: "Şablondan oluşturuldu", description: "Doküman otomatik dolduruldu" });
    },
    onError: () => toast({ title: "Hata", description: "Şablon uygulanamadı", variant: "destructive" }),
  });

  const signDocMutation = useMutation({
    mutationFn: async ({ docId, sigText }: { docId: number; sigText: string }) => {
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/documents/${docId}/sign`, { signatureText: sigText });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "documents"] });
      setShowSignDialog(false);
      setSignatureText("");
      setSignDocId(null);
      toast({ title: "Doküman imzalandı" });
    },
    onError: () => toast({ title: "İmzalama hatası", variant: "destructive" }),
  });

  const createReviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/reviews`, {
        revieweeUserId,
        rating: reviewForm.rating,
        comment: reviewForm.comment,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "reviews"] });
      toast({ title: "Değerlendirme kaydedildi" });
      setShowReviewDialog(false);
      setReviewForm({ rating: 0, comment: "" });
    },
    onError: () => toast({ title: "Değerlendirme hatası", variant: "destructive" }),
  });

  const sendChatMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/chat`, { content: chatMessage });
      return res.json();
    },
    onSuccess: () => {
      setChatMessage("");
      refetchChat();
    },
    onError: () => toast({ title: "Mesaj gönderilemedi", variant: "destructive" }),
  });

  const addPortCallMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/port-calls`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "port-calls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voyages"] });
      toast({ title: "Port call added" });
      setShowAddPortCallDialog(false);
      setEditingPortCall(null);
      setPcForm({ portId: 0, portName: "", portCallType: "discharging", status: "planned", eta: "", etd: "", berthName: "", terminalName: "", cargoType: "", cargoQuantity: "", cargoUnit: "MT", notes: "" });
    },
    onError: () => toast({ title: "Failed to add port call", variant: "destructive" }),
  });

  const updatePortCallMutation = useMutation({
    mutationFn: async ({ pcId, data }: { pcId: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/voyages/${voyageId}/port-calls/${pcId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "port-calls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voyages"] });
      toast({ title: "Port call updated" });
      setShowAddPortCallDialog(false);
      setEditingPortCall(null);
    },
    onError: () => toast({ title: "Failed to update port call", variant: "destructive" }),
  });

  const updatePcStatusMutation = useMutation({
    mutationFn: async ({ pcId, status }: { pcId: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/voyages/${voyageId}/port-calls/${pcId}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "port-calls"] });
      toast({ title: "Port call status updated" });
    },
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const deletePortCallMutation = useMutation({
    mutationFn: async (pcId: number) => {
      await apiRequest("DELETE", `/api/voyages/${voyageId}/port-calls/${pcId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "port-calls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voyages"] });
      toast({ title: "Port call removed" });
    },
    onError: () => toast({ title: "Failed to delete port call", variant: "destructive" }),
  });

  function openAddPortCall() {
    setEditingPortCall(null);
    setPcForm({ portId: 0, portName: "", portCallType: "discharging", status: "planned", eta: "", etd: "", berthName: "", terminalName: "", cargoType: "", cargoQuantity: "", cargoUnit: "MT", notes: "" });
    setShowAddPortCallDialog(true);
  }

  function openEditPortCall(pc: any) {
    setEditingPortCall(pc);
    setPcForm({
      portId: pc.port_id,
      portName: pc.port_name || "",
      portCallType: pc.port_call_type || "discharging",
      status: pc.status || "planned",
      eta: pc.eta ? new Date(pc.eta).toISOString().slice(0, 16) : "",
      etd: pc.etd ? new Date(pc.etd).toISOString().slice(0, 16) : "",
      berthName: pc.berth_name || "",
      terminalName: pc.terminal_name || "",
      cargoType: pc.cargo_type || "",
      cargoQuantity: pc.cargo_quantity ? String(pc.cargo_quantity) : "",
      cargoUnit: pc.cargo_unit || "MT",
      notes: pc.notes || "",
    });
    setShowAddPortCallDialog(true);
  }

  function submitPortCallForm() {
    const payload: any = {
      portId: pcForm.portId,
      portCallType: pcForm.portCallType,
      status: pcForm.status,
      berthName: pcForm.berthName || null,
      terminalName: pcForm.terminalName || null,
      cargoType: pcForm.cargoType || null,
      cargoQuantity: pcForm.cargoQuantity ? parseFloat(pcForm.cargoQuantity) : null,
      cargoUnit: pcForm.cargoUnit,
      notes: pcForm.notes || null,
    };
    if (pcForm.eta) payload.eta = pcForm.eta;
    if (pcForm.etd) payload.etd = pcForm.etd;

    if (editingPortCall) {
      updatePortCallMutation.mutate({ pcId: editingPortCall.id, data: payload });
    } else {
      addPortCallMutation.mutate(payload);
    }
  }

  function handleChatKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey && chatMessage.trim()) {
      e.preventDefault();
      sendChatMutation.mutate();
    }
  }

  async function processDroppedFile(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 20 MB", variant: "destructive" });
      return;
    }
    setDocUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/files/upload?folder=documents", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url, fileName: uploadedName, fileSize } = await res.json();
      setDocForm(f => ({
        ...f,
        fileUrl: url,
        fileBase64: "",
        fileName: uploadedName,
        fileSize,
        name: f.name || file.name.replace(/\.[^/.]+$/, ""),
      }));
    } catch {
      toast({ title: "Upload error", description: "Failed to upload file", variant: "destructive" });
    } finally {
      setDocUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processDroppedFile(file);
  }

  function handlePanelDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsPanelDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processDroppedFile(file);
    setShowDocDialog(true);
  }

  function downloadDoc(doc: any) {
    const href = doc.fileUrl || doc.fileBase64;
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    a.download = doc.fileName || doc.name;
    a.click();
  }

  function previewDoc(doc: any) {
    const href = doc.fileUrl || doc.fileBase64;
    if (href) window.open(href, "_blank");
  }

  if (isLoading) {
    return (
      <div className="px-3 py-5 space-y-4 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!voyage) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Sefer bulunamadı.</p>
        <Link href="/voyages"><Button variant="outline" className="mt-4">Geri Dön</Button></Link>
      </div>
    );
  }

  const s = STATUS_CONFIG[voyage.status] || STATUS_CONFIG.planned;
  const StatusIcon = s.icon;
  const checklist: any[] = voyage.checklists || [];
  const completed = checklist.filter(c => c.isCompleted).length;
  const serviceReqs: any[] = voyage.serviceRequests || [];
  const transitions = STATUS_TRANSITIONS[voyage.status] || [];
  const reviews: any[] = reviewData?.reviews || [];

  return (
    <div className="px-3 py-5 space-y-6 max-w-6xl mx-auto">
      <PageMeta title={`Sefer — ${voyage.vesselName || "Detay"} | VesselPDA`} description="Sefer detayı ve operasyon dosyası" />

      {/* Back */}
      <Link href="/voyages">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Seferler
        </button>
      </Link>

      {/* Header Card */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0">
              <Ship className="w-6 h-6 text-[hsl(var(--maritime-primary))]" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-bold">{voyage.vesselName || "Gemi Belirtilmedi"}</h1>
              <p className="text-sm text-muted-foreground">{voyage.purposeOfCall}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${s.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />{s.label}
            </span>
            {canReview && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setShowReviewDialog(true)} data-testid="button-review">
                <Star className="w-3.5 h-3.5" /> Değerlendir
              </Button>
            )}
            {reviewData?.myReview && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Değerlendirdiniz
              </span>
            )}
            {isOwner && transitions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    Durumu Değiştir <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {transitions.map(t => {
                    const cfg = STATUS_CONFIG[t];
                    const TIcon = cfg?.icon;
                    return (
                      <DropdownMenuItem
                        key={t}
                        onClick={() => (t === "completed" || t === "cancelled") ? setPendingStatus(t) : statusMutation.mutate(t)}
                        className="gap-2"
                      >
                        {TIcon && <TIcon className="w-4 h-4" />}{cfg?.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Liman</p>
            <p className="font-medium flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-muted-foreground" />{voyage.portName || `Port #${voyage.portId}`}</p>
          </div>
          {voyage.eta && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">ETA</p>
              <p className="font-medium flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-muted-foreground" />{new Date(voyage.eta).toLocaleDateString("tr-TR")}</p>
            </div>
          )}
          {voyage.etd && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">ETD</p>
              <p className="font-medium flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-muted-foreground" />{new Date(voyage.etd).toLocaleDateString("tr-TR")}</p>
            </div>
          )}
          {voyage.notes && (
            <div className="col-span-full">
              <p className="text-xs text-muted-foreground mb-0.5">Notlar</p>
              <p className="text-sm">{voyage.notes}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl overflow-x-auto">
        {([
          { key: "route",         label: "Route",          icon: Route },
          { key: "operation",     label: "Operation",      icon: ClipboardList },
          { key: "documents",     label: "Documents",      icon: FolderOpen },
          { key: "comms",         label: "Comms",          icon: MessageCircle },
          { key: "timeline",      label: "Timeline",       icon: GitBranch },
          { key: "collaborators", label: "Collaborators",  icon: UsersIcon },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === key
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-${key}`}
          >
            <Icon className="w-4 h-4" /> {label}
            {key === "route" && portCalls.length > 0 && (
              <span className="ml-1 text-[10px] bg-[hsl(var(--maritime-primary)/0.15)] text-[hsl(var(--maritime-primary))] px-1.5 py-0.5 rounded-full font-semibold">
                {portCalls.length}
              </span>
            )}
            {key === "comms" && chatMessages.length > 0 && (
              <span className="ml-1 text-[10px] bg-[hsl(var(--maritime-primary)/0.15)] text-[hsl(var(--maritime-primary))] px-1.5 py-0.5 rounded-full font-semibold">
                {chatMessages.length}
              </span>
            )}
            {key === "collaborators" && collaborators.filter((c: any) => c.status === "pending").length > 0 && (
              <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">
                {collaborators.filter((c: any) => c.status === "pending").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Route ─────────────────────────────────────────── */}
      {activeTab === "route" && (
        <div className="space-y-4">
          {/* Route Breadcrumb */}
          {portCalls.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 flex-wrap">
                {portCalls.map((pc: any, idx: number) => {
                  const scfg = PC_STATUS_CONFIG[pc.status] || PC_STATUS_CONFIG.planned;
                  const SIcon = scfg.icon;
                  return (
                    <div key={pc.id} className="flex items-center gap-2">
                      {idx > 0 && <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                        pc.status === "operations" || pc.status === "berthed"
                          ? "border-green-300 bg-green-50 dark:bg-green-900/20"
                          : pc.status === "completed"
                          ? "border-gray-300 bg-gray-50 dark:bg-gray-800/50"
                          : "border-border bg-background"
                      }`}>
                        <SIcon className={`w-3.5 h-3.5 ${
                          pc.status === "operations" ? "text-green-600" :
                          pc.status === "completed" ? "text-gray-400" : "text-muted-foreground"
                        }`} />
                        <span>{pc.port_name || `Port #${pc.port_id}`}</span>
                        <span className={`text-[9px] px-1 rounded ${
                          PC_TYPE_CONFIG[pc.port_call_type]?.color || "text-gray-500 bg-gray-50"
                        }`}>
                          {PC_TYPE_CONFIG[pc.port_call_type]?.label || pc.port_call_type}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Port Call List */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Route className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              <h2 className="font-semibold text-sm">Port Calls</h2>
              {portCalls.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">{portCalls.length} stop{portCalls.length !== 1 ? "s" : ""}</Badge>
              )}
            </div>
            <Button size="sm" onClick={openAddPortCall} className="gap-1.5 h-8 text-xs" data-testid="button-add-port-call">
              <Plus className="w-3.5 h-3.5" /> Add Port Call
            </Button>
          </div>

          {portCalls.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center mx-auto mb-4">
                <Anchor className="w-7 h-7 text-[hsl(var(--maritime-primary)/0.4)]" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground mb-1">No port calls yet</p>
              <p className="text-xs text-muted-foreground/70 mb-4">Add port calls to build the voyage route</p>
              <Button size="sm" onClick={openAddPortCall} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add First Port Call
              </Button>
            </Card>
          ) : (
            <div className="relative">
              {/* Vertical connector line */}
              <div className="absolute left-[22px] top-8 bottom-8 w-0.5 bg-border z-0" />

              <div className="space-y-3">
                {portCalls.map((pc: any, idx: number) => {
                  const scfg = PC_STATUS_CONFIG[pc.status] || PC_STATUS_CONFIG.planned;
                  const SIcon = scfg.icon;
                  const tcfg = PC_TYPE_CONFIG[pc.port_call_type] || PC_TYPE_CONFIG.other;
                  const isActive = pc.status === "operations" || pc.status === "berthed";
                  return (
                    <Card key={pc.id} className={`relative z-10 p-4 ${isActive ? "border-green-300 dark:border-green-700 shadow-sm" : ""}`} data-testid={`card-port-call-${pc.id}`}>
                      <div className="flex items-start gap-3">
                        {/* Step indicator */}
                        <div className={`w-11 h-11 rounded-full flex flex-col items-center justify-center flex-shrink-0 border-2 ${
                          isActive ? "border-green-400 bg-green-50 dark:bg-green-900/20" :
                          pc.status === "completed" ? "border-gray-300 bg-gray-50 dark:bg-gray-800" :
                          "border-[hsl(var(--maritime-primary)/0.3)] bg-[hsl(var(--maritime-primary)/0.05)]"
                        }`}>
                          <span className="text-[10px] font-bold text-muted-foreground">{String(idx + 1).padStart(2, "0")}</span>
                          <SIcon className={`w-3 h-3 ${isActive ? "text-green-600" : pc.status === "completed" ? "text-gray-400" : "text-[hsl(var(--maritime-primary))]"}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm">{pc.port_name || `Port #${pc.port_id}`}</span>
                                {pc.port_locode && <span className="text-[10px] font-mono text-muted-foreground">{pc.port_locode}</span>}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tcfg.color}`}>{tcfg.label}</span>
                                {isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-semibold animate-pulse">● CURRENT</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                                {pc.eta && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />ETA: {new Date(pc.eta).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>}
                                {pc.etd && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />ETD: {new Date(pc.etd).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>}
                                {pc.berth_name && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{pc.berth_name}</span>}
                                {pc.cargo_quantity && <span className="flex items-center gap-1"><Package className="w-3 h-3" />{pc.cargo_quantity.toLocaleString()} {pc.cargo_unit}</span>}
                              </div>
                              {pc.notes && <p className="text-xs text-muted-foreground mt-1 italic">{pc.notes}</p>}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" data-testid={`button-pc-status-${pc.id}`}>
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${scfg.color}`}>
                                      <SIcon className="w-3 h-3" />{scfg.label}
                                    </span>
                                    <ChevronDown className="w-3 h-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  {PC_STATUS_ORDER.map(s => {
                                    const c = PC_STATUS_CONFIG[s];
                                    const CIcon = c.icon;
                                    return (
                                      <DropdownMenuItem
                                        key={s}
                                        onClick={() => updatePcStatusMutation.mutate({ pcId: pc.id, status: s })}
                                        className={`text-xs gap-2 ${s === pc.status ? "font-semibold" : ""}`}
                                      >
                                        <CIcon className="w-3.5 h-3.5" />{c.label}
                                        {s === pc.status && <Check className="w-3 h-3 ml-auto" />}
                                      </DropdownMenuItem>
                                    );
                                  })}
                                </DropdownMenuContent>
                              </DropdownMenu>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-pc-menu-${pc.id}`}>
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditPortCall(pc)} className="text-xs gap-2">
                                    <Edit2 className="w-3.5 h-3.5" /> Edit Details
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => deletePortCallMutation.mutate(pc.id)}
                                    className="text-xs gap-2 text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Operasyon ─────────────────────────────────────── */}
      {activeTab === "operation" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Görev Listesi */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                  <h2 className="font-semibold text-sm">Görev Listesi</h2>
                </div>
                {checklist.length > 0 && (
                  <span className="text-xs text-muted-foreground">{completed}/{checklist.length} tamamlandı</span>
                )}
              </div>

              {checklist.length > 0 && (
                <div className="w-full bg-muted/40 rounded-full h-1.5">
                  <div
                    className="bg-[hsl(var(--maritime-primary))] h-1.5 rounded-full transition-all"
                    style={{ width: `${(completed / checklist.length) * 100}%` }}
                  />
                </div>
              )}

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {checklist.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Henüz görev yok. Aşağıdan ekleyin.</p>
                )}
                {checklist.map((item: any) => (
                  <div key={item.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${item.isCompleted ? "bg-green-50 dark:bg-green-950/20" : "bg-muted/30"}`} data-testid={`checklist-item-${item.id}`}>
                    <button onClick={() => toggleTaskMutation.mutate(item.id)} className="flex-shrink-0" data-testid={`button-toggle-task-${item.id}`}>
                      {item.isCompleted
                        ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                        : <Circle className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />}
                    </button>
                    <span className={`flex-1 text-sm ${item.isCompleted ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                    <button onClick={() => deleteTaskMutation.mutate(item.id)} className="flex-shrink-0 hover:text-destructive text-muted-foreground transition-colors" data-testid={`button-delete-task-${item.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="Yeni görev..." onKeyDown={e => { if (e.key === "Enter" && newTask.trim()) addTaskMutation.mutate(); }} className="text-sm h-8" data-testid="input-new-task" />
                <Button size="sm" className="h-8 px-3" onClick={() => { if (newTask.trim()) addTaskMutation.mutate(); }} disabled={addTaskMutation.isPending || !newTask.trim()} data-testid="button-add-task">
                  {addTaskMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </Card>

            {/* Hizmet Talepleri */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                  <h2 className="font-semibold text-sm">Hizmet Talepleri</h2>
                </div>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setShowServiceDialog(true)} data-testid="button-add-service-request">
                  <Plus className="w-3 h-3" /> Talep Oluştur
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {serviceReqs.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Bu sefere ait hizmet talebi yok.</p>
                )}
                {serviceReqs.map((req: any) => {
                  const cfg = SERVICE_TYPE_CONFIG[req.serviceType] || SERVICE_TYPE_CONFIG.other;
                  const TypeIcon = cfg.icon;
                  return (
                    <Link key={req.id} href={`/service-requests/${req.id}`}>
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer" data-testid={`service-req-${req.id}`}>
                        <TypeIcon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{cfg.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{req.description}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] flex-shrink-0 capitalize">{req.status}</Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Liman Koşulları */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Anchor className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              <h2 className="font-semibold text-sm">Liman Koşulları</h2>
              {portData?.name && <span className="ml-auto text-xs text-muted-foreground">{portData.name}</span>}
            </div>
            {!voyage?.portId ? (
              <Card className="p-4 flex items-center gap-2 text-muted-foreground text-sm">
                <Cloud className="w-4 h-4 opacity-40" /><span>Liman bilgisi bulunamadı.</span>
              </Card>
            ) : !portData ? (
              <Card className="p-4"><div className="grid grid-cols-2 gap-2">{[1,2,3,4].map(i => <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />)}</div></Card>
            ) : portData.latitude && portData.longitude ? (
              <div className="space-y-3">
                <EtaWeatherAlert lat={portData.latitude} lng={portData.longitude} eta={voyage.eta ?? null} />
                <WeatherPanel lat={portData.latitude} lng={portData.longitude} />
              </div>
            ) : (
              <Card className="p-4 flex items-center gap-2 text-muted-foreground text-sm">
                <Cloud className="w-4 h-4 opacity-40" /><span>Bu liman için koordinat bilgisi bulunamadı, hava durumu gösterilemiyor.</span>
              </Card>
            )}
          </div>

          {/* Port Call Randevuları */}
          {(isOwner || isAgent) && (
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                  <h2 className="font-semibold text-sm">Port Call Randevuları</h2>
                  {appointments.length > 0 && <span className="text-xs text-muted-foreground">({appointments.length})</span>}
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowApptForm(v => !v)} data-testid="button-add-appointment">
                  <Plus className="w-3.5 h-3.5 mr-1" />Randevu Ekle
                </Button>
              </div>

              {showApptForm && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-muted/30 rounded-lg">
                  <div>
                    <Select value={apptForm.appointmentType} onValueChange={v => setApptForm(f => ({ ...f, appointmentType: v }))}>
                      <SelectTrigger className="h-8 text-xs" data-testid="select-appt-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pilot">Pilot</SelectItem>
                        <SelectItem value="tugboat">Römorkör</SelectItem>
                        <SelectItem value="health">Sağlık</SelectItem>
                        <SelectItem value="customs">Gümrük</SelectItem>
                        <SelectItem value="immigration">Göçmenlik</SelectItem>
                        <SelectItem value="other">Diğer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Input type="datetime-local" className="h-8 text-xs" value={apptForm.scheduledAt} onChange={e => setApptForm(f => ({ ...f, scheduledAt: e.target.value }))} data-testid="input-appt-scheduled" />
                  </div>
                  <div className="flex gap-1">
                    <Input className="h-8 text-xs flex-1" placeholder="Not (opsiyonel)" value={apptForm.notes} onChange={e => setApptForm(f => ({ ...f, notes: e.target.value }))} data-testid="input-appt-notes" />
                    <Button size="sm" className="h-8 px-2" onClick={() => createApptMutation.mutate()} disabled={createApptMutation.isPending} data-testid="button-save-appointment">
                      {createApptMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>
              )}

              {appointments.length === 0 && !showApptForm && (
                <p className="text-xs text-muted-foreground text-center py-3">Henüz randevu eklenmemiş</p>
              )}

              <div className="space-y-2">
                {appointments.map((appt: any) => {
                  const typeLabels: Record<string, { label: string; color: string }> = {
                    pilot: { label: "Pilot", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
                    tugboat: { label: "Römorkör", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
                    health: { label: "Sağlık", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
                    customs: { label: "Gümrük", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
                    immigration: { label: "Göçmenlik", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" },
                    other: { label: "Diğer", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
                  };
                  const statusLabels: Record<string, { label: string; color: string }> = {
                    pending: { label: "Bekliyor", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
                    confirmed: { label: "Onaylandı", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
                    completed: { label: "Tamamlandı", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
                    cancelled: { label: "İptal", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
                  };
                  const typeCfg = typeLabels[appt.appointmentType] || typeLabels.other;
                  const stCfg = statusLabels[appt.status] || statusLabels.pending;
                  return (
                    <div key={appt.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30" data-testid={`appt-row-${appt.id}`}>
                      <Badge className={`text-xs shrink-0 ${typeCfg.color}`}>{typeCfg.label}</Badge>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {appt.scheduledAt ? new Date(appt.scheduledAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "Tarih belirsiz"}
                      </span>
                      {appt.notes && <span className="text-xs text-muted-foreground truncate flex-1">{appt.notes}</span>}
                      <div className="ml-auto flex items-center gap-1.5 shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1" data-testid={`button-appt-status-${appt.id}`}>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${stCfg.color}`}>{stCfg.label}</span>
                              <ChevronDown className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs">
                            {Object.entries(statusLabels).map(([k, v]) => (
                              <DropdownMenuItem key={k} className="text-xs" onClick={() => updateApptMutation.mutate({ id: appt.id, status: k })}>
                                {v.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => deleteApptMutation.mutate(appt.id)} data-testid={`button-delete-appt-${appt.id}`}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Değerlendirmeler */}
          {reviews.length > 0 && (
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <h2 className="font-semibold text-sm">Değerlendirmeler</h2>
              </div>
              <div className="space-y-3">
                {reviews.map((r: any) => (
                  <div key={r.id} className="flex items-start gap-3 px-3 py-3 rounded-lg bg-muted/30" data-testid={`review-${r.id}`}>
                    <div className="w-8 h-8 rounded-full bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0 text-sm font-bold text-[hsl(var(--maritime-primary))]">
                      {(r.reviewerName || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{r.reviewerName || "Kullanıcı"}</span>
                        <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("tr-TR")}</span>
                      </div>
                      <div className="flex gap-0.5 mt-1">
                        {[1,2,3,4,5].map(i => <Star key={i} className={`w-3.5 h-3.5 ${i <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />)}
                      </div>
                      {r.comment && <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Tab: Dokümanlar ────────────────────────────────────── */}
      {activeTab === "documents" && (
        <Card
          className={`p-5 space-y-4 relative transition-all duration-150 ${isPanelDragOver ? "ring-2 ring-[hsl(var(--maritime-primary))] bg-[hsl(var(--maritime-primary)/0.03)]" : ""}`}
          onDragOver={e => { e.preventDefault(); setIsPanelDragOver(true); }}
          onDragEnter={e => { e.preventDefault(); setIsPanelDragOver(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsPanelDragOver(false); }}
          onDrop={handlePanelDrop}
          data-testid="panel-documents"
        >
          {isPanelDragOver && (
            <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-[hsl(var(--maritime-primary)/0.08)] border-2 border-dashed border-[hsl(var(--maritime-primary))] z-10 pointer-events-none">
              <div className="text-center">
                <Upload className="w-8 h-8 mx-auto mb-2 text-[hsl(var(--maritime-primary))]" />
                <p className="text-sm font-semibold text-[hsl(var(--maritime-primary))]">Dosyayı buraya bırakın</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              <h2 className="font-semibold text-sm">Dokümanlar</h2>
              {Array.isArray(docs) && docs.length > 0 && <span className="text-xs text-muted-foreground">({docs.length})</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setShowTemplateDialog(true)} data-testid="button-from-template">
                <LayoutTemplate className="w-3 h-3" /> Şablondan
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setShowDocDialog(true)} data-testid="button-upload-doc">
                <Upload className="w-3 h-3" /> Yükle
              </Button>
            </div>
          </div>

          {/* Filtre butonları */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "all",           label: "Tümü" },
              { key: "manifest",      label: "Manifesto" },
              { key: "bill_of_lading",label: "Konşimento" },
              { key: "certificate",   label: "Sertifika" },
              { key: "port_clearance",label: "Liman İzni" },
              { key: "other",         label: "Diğer" },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setDocFilter(f.key)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  docFilter === f.key ? "bg-[hsl(var(--maritime-primary))] text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                data-testid={`filter-doc-${f.key}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {docsLoading ? (
            <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : (() => {
            const filtered = Array.isArray(docs) ? (docFilter === "all" ? docs : docs.filter((d: any) => d.docType === docFilter)) : [];
            return filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Upload className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Henüz doküman yok</p>
                <p className="text-xs mt-1">Dosyaları buraya sürükleyip bırakın veya "Yükle" butonunu kullanın</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((doc: any) => (
                  <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 group" data-testid={`doc-${doc.id}`}>
                    <FileText className="w-4 h-4 flex-shrink-0 text-blue-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        {doc.version > 1 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium flex-shrink-0" data-testid={`badge-doc-version-${doc.id}`}>v{doc.version}</span>
                        )}
                        {doc.templateId && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 font-medium flex-shrink-0">📋 Otomatik</span>
                        )}
                        {doc.signedAt ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium flex items-center gap-0.5 flex-shrink-0" data-testid={`badge-signed-${doc.id}`}>
                            <BadgeCheck className="w-3 h-3" /> {doc.signatureText}
                          </span>
                        ) : (
                          <button
                            onClick={() => { setSignDocId(doc.id); setShowSignDialog(true); }}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors flex items-center gap-0.5 flex-shrink-0"
                            data-testid={`button-sign-doc-${doc.id}`}
                          >
                            <Pen className="w-3 h-3" /> İmzala
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{DOC_TYPE_CONFIG[doc.docType] || "Diğer"} · {doc.uploaderName} · {new Date(doc.createdAt).toLocaleDateString("tr-TR")}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => downloadDoc(doc)} className="p-1 hover:text-primary transition-colors" data-testid={`button-download-doc-${doc.id}`}><Download className="w-4 h-4" /></button>
                      <button onClick={() => deleteDocMutation.mutate(doc.id)} className="p-1 hover:text-destructive transition-colors" data-testid={`button-delete-doc-${doc.id}`}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </Card>
      )}

      {/* ── Tab: İletişim ──────────────────────────────────────── */}
      {activeTab === "comms" && (() => {
        const role = (user as any)?.activeRole || (user as any)?.role;
        const canChat = isOwner || isAgent || role === "admin";
        const participants = Array.from(new Map(chatMessages.map((m: any) => [m.senderId, m.senderName])).entries());
        return (
          <Card className="flex flex-col overflow-hidden" style={{ height: 480 }}>
            {/* Chat header */}
            <div className="px-5 py-3.5 border-b flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                <h2 className="font-semibold text-sm">Ekip Chat</h2>
              </div>
              {chatMessages.length > 0 && (
                <span className="text-xs bg-[hsl(var(--maritime-primary)/0.1)] text-[hsl(var(--maritime-primary))] px-2 py-0.5 rounded-full font-semibold">
                  {chatMessages.length} mesaj
                </span>
              )}
            </div>

            {/* Participants strip */}
            {participants.length > 0 && (
              <div className="px-5 py-2 border-b flex items-center gap-2 flex-shrink-0 bg-muted/20">
                <span className="text-xs text-muted-foreground">Katılımcılar:</span>
                {participants.map(([sid, name]: [string, string]) => (
                  <div key={sid} title={name} className="w-6 h-6 rounded-full bg-[hsl(var(--maritime-primary))] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {(name || "?")[0].toUpperCase()}
                  </div>
                ))}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageCircle className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm font-medium">Henüz mesaj yok</p>
                  <p className="text-xs mt-1">İlk mesajı siz gönderin</p>
                </div>
              ) : (
                chatMessages.map((msg: any) => {
                  const isMine = msg.senderId === userId;
                  const time = new Date(msg.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
                  const date = new Date(msg.createdAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
                  const initial = (msg.senderName || "?")[0].toUpperCase();
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`} data-testid={`chat-msg-${msg.id}`}>
                      <div className={`max-w-[72%] ${isMine ? "" : "flex gap-2"}`}>
                        {!isMine && (
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 border">
                            {initial}
                          </div>
                        )}
                        <div>
                          <p className={`text-xs text-muted-foreground mb-1 ${isMine ? "text-right" : "ml-1"}`}>{msg.senderName}</p>
                          <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isMine
                              ? "bg-[hsl(var(--maritime-primary))] text-white rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm"
                          }`}>
                            {msg.content}
                          </div>
                          <p className={`text-[10px] text-muted-foreground mt-1 ${isMine ? "text-right" : "ml-1"}`}>{date} {time}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t flex-shrink-0 bg-background">
              {canChat ? (
                <div className="flex gap-2">
                  <Input
                    value={chatMessage}
                    onChange={e => setChatMessage(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder="Mesaj yazın..."
                    className="text-sm h-9"
                    data-testid="input-chat-message"
                  />
                  <Button
                    size="sm"
                    className="h-9 px-4 shrink-0"
                    onClick={() => sendChatMutation.mutate()}
                    disabled={!chatMessage.trim() || sendChatMutation.isPending}
                    data-testid="button-send-chat"
                  >
                    {sendChatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gönder"}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-1">Bu seferin katılımcısı değilsiniz.</p>
              )}
            </div>
          </Card>
        );
      })()}

      {/* ── Tab: Timeline ──────────────────────────────────────── */}
      {activeTab === "timeline" && (
        <Card className="p-6" data-testid="panel-timeline">
          <div className="flex items-center gap-2 mb-5">
            <GitBranch className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
            <h2 className="font-semibold text-sm">Voyage Timeline</h2>
            <span className="text-xs text-muted-foreground ml-auto">Chronological event history</span>
          </div>
          <VoyageTimeline voyageId={Number(voyageId)} />
        </Card>
      )}

      {/* ── Tab: Collaborators ─────────────────────────────────── */}
      {activeTab === "collaborators" && (
        <div className="space-y-4" data-testid="panel-collaborators">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UsersIcon className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              <h2 className="font-semibold text-sm">Voyage Collaborators</h2>
              <span className="text-xs text-muted-foreground">({collaborators.length})</span>
            </div>
            {isOwner && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowInviteDialog(true)} data-testid="button-invite-collaborator">
                <UserPlus className="w-3.5 h-3.5" /> Invite
              </Button>
            )}
          </div>

          {/* My pending invite banner */}
          {myPendingInvite && (
            <Card className="p-4 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">You have a pending collaboration invite</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Role: <span className="font-medium capitalize">{myPendingInvite.role}</span></p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" className="gap-1 border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => respondCollabMutation.mutate({ collabId: myPendingInvite.id, status: "declined" })}>
                    <XIcon className="w-3 h-3" /> Decline
                  </Button>
                  <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700"
                    onClick={() => respondCollabMutation.mutate({ collabId: myPendingInvite.id, status: "accepted" })}>
                    <Check className="w-3 h-3" /> Accept
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Collaborator list */}
          {collaborators.length === 0 ? (
            <Card className="p-8 text-center">
              <UsersIcon className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No collaborators yet.</p>
              {isOwner && <p className="text-xs text-muted-foreground mt-1">Invite agents, brokers or partners to collaborate on this voyage.</p>}
            </Card>
          ) : (
            <div className="space-y-3">
              {collaborators.map((c: any) => (
                <Card key={c.id} className="p-4" data-testid={`collab-card-${c.id}`}>
                  {editingCollab?.id === c.id ? (
                    /* Edit mode */
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Edit Permissions — {c.org_name || `${c.user_first_name} ${c.user_last_name}`}</span>
                      </div>
                      <div>
                        <Label className="text-xs">Role</Label>
                        <Select value={editingCollab.role} onValueChange={r => setEditingCollab((prev: any) => ({ ...prev, role: r }))}>
                          <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(editingCollab.permissions || {}).map(([key, val]) => (
                          <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
                            <input type="checkbox" checked={!!val} onChange={e => setEditingCollab((prev: any) => ({ ...prev, permissions: { ...prev.permissions, [key]: e.target.checked } }))} className="rounded" />
                            <span className="capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" onClick={() => updateCollabMutation.mutate({ collabId: c.id, role: editingCollab.role, permissions: editingCollab.permissions })} disabled={updateCollabMutation.isPending}>
                          {updateCollabMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingCollab(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {c.org_name ? <Building2 className="w-4 h-4 text-primary" /> : <UsersIcon className="w-4 h-4 text-primary" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">
                              {c.org_name || `${c.user_first_name || ""} ${c.user_last_name || ""}`.trim() || c.user_email}
                            </span>
                            <Badge variant="outline" className={`text-[10px] capitalize ${c.role === "manager" ? "border-blue-300 text-blue-600" : c.role === "editor" ? "border-green-300 text-green-600" : "border-gray-300 text-gray-600"}`}>
                              {c.role}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] ${c.status === "accepted" ? "border-green-300 text-green-600" : c.status === "declined" ? "border-red-300 text-red-600" : "border-amber-300 text-amber-600"}`}>
                              {c.status}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {c.permissions && Object.entries(c.permissions).filter(([, v]) => v).slice(0, 6).map(([k]) => (
                              <span key={k} className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                {k.replace(/([A-Z])/g, " $1").trim()}
                              </span>
                            ))}
                            {c.permissions && Object.entries(c.permissions).filter(([, v]) => v).length > 6 && (
                              <span className="text-[9px] text-muted-foreground">+{Object.entries(c.permissions).filter(([, v]) => v).length - 6} more</span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Invited by {c.inviter_first_name} {c.inviter_last_name} · {new Date(c.invited_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {isOwner && (
                        <div className="flex gap-1 flex-shrink-0">
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit permissions"
                            onClick={() => setEditingCollab({ id: c.id, role: c.role, permissions: { ...c.permissions } })}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" title="Remove"
                            onClick={() => removeCollabMutation.mutate(c.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit Port Call Dialog ──────────────────────────── */}
      <Dialog open={showAddPortCallDialog} onOpenChange={v => { setShowAddPortCallDialog(v); if (!v) setEditingPortCall(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="dialog-add-port-call">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <Route className="w-4 h-4" />
              {editingPortCall ? "Edit Port Call" : "Add Port Call"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Port <span className="text-destructive">*</span></Label>
              <PortSearch
                value={pcForm.portName}
                onChange={(id, name) => setPcForm(f => ({ ...f, portId: id, portName: name }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Call Type</Label>
                <Select value={pcForm.portCallType} onValueChange={v => setPcForm(f => ({ ...f, portCallType: v }))}>
                  <SelectTrigger data-testid="select-pc-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loading">Loading</SelectItem>
                    <SelectItem value="discharging">Discharging</SelectItem>
                    <SelectItem value="bunkering">Bunkering</SelectItem>
                    <SelectItem value="transit">Transit</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="crew_change">Crew Change</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={pcForm.status} onValueChange={v => setPcForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PC_STATUS_ORDER.map(s => (
                      <SelectItem key={s} value={s}>{PC_STATUS_CONFIG[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ETA</Label>
                <Input type="datetime-local" value={pcForm.eta} onChange={e => setPcForm(f => ({ ...f, eta: e.target.value }))} data-testid="input-pc-eta" />
              </div>
              <div className="space-y-1.5">
                <Label>ETD</Label>
                <Input type="datetime-local" value={pcForm.etd} onChange={e => setPcForm(f => ({ ...f, etd: e.target.value }))} data-testid="input-pc-etd" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Berth Name</Label>
                <Input value={pcForm.berthName} onChange={e => setPcForm(f => ({ ...f, berthName: e.target.value }))} placeholder="e.g. Berth 7" data-testid="input-pc-berth" />
              </div>
              <div className="space-y-1.5">
                <Label>Terminal</Label>
                <Input value={pcForm.terminalName} onChange={e => setPcForm(f => ({ ...f, terminalName: e.target.value }))} placeholder="e.g. T3" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Cargo Type</Label>
                <Input value={pcForm.cargoType} onChange={e => setPcForm(f => ({ ...f, cargoType: e.target.value }))} placeholder="e.g. Bulk Coal, Crude Oil..." />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={pcForm.cargoUnit} onValueChange={v => setPcForm(f => ({ ...f, cargoUnit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MT">MT</SelectItem>
                    <SelectItem value="CBM">CBM</SelectItem>
                    <SelectItem value="TEU">TEU</SelectItem>
                    <SelectItem value="BBL">BBL</SelectItem>
                    <SelectItem value="Units">Units</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Cargo Quantity</Label>
              <Input
                type="number"
                value={pcForm.cargoQuantity}
                onChange={e => setPcForm(f => ({ ...f, cargoQuantity: e.target.value }))}
                placeholder="0"
                data-testid="input-pc-cargo-qty"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={pcForm.notes}
                onChange={e => setPcForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddPortCallDialog(false); setEditingPortCall(null); }}>Cancel</Button>
            <Button
              onClick={submitPortCallForm}
              disabled={!pcForm.portId || addPortCallMutation.isPending || updatePortCallMutation.isPending}
              data-testid="button-save-port-call"
            >
              {(addPortCallMutation.isPending || updatePortCallMutation.isPending) ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{editingPortCall ? "Updating..." : "Adding..."}</>
              ) : (editingPortCall ? "Update Port Call" : "Add Port Call")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Collaborator Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2"><UserPlus className="w-4 h-4" /> Invite Collaborator</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Target type toggle */}
            <div className="flex gap-2">
              <Button size="sm" variant={inviteTargetType === "org" ? "default" : "outline"} onClick={() => { setInviteTargetType("org"); setInviteTargetId(null); setInviteTargetName(""); setInviteSearch(""); }} className="gap-1.5 flex-1">
                <Building2 className="w-3.5 h-3.5" /> Organization
              </Button>
              <Button size="sm" variant={inviteTargetType === "user" ? "default" : "outline"} onClick={() => { setInviteTargetType("user"); setInviteTargetId(null); setInviteTargetName(""); setInviteSearch(""); }} className="gap-1.5 flex-1">
                <UsersIcon className="w-3.5 h-3.5" /> Individual User
              </Button>
            </div>

            {/* Search */}
            <div className="space-y-1.5">
              <Label>{inviteTargetType === "org" ? "Search Organization" : "Enter User Email or ID"}</Label>
              {inviteTargetId ? (
                <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/50">
                  <span className="text-sm flex-1">{inviteTargetName}</span>
                  <button onClick={() => { setInviteTargetId(null); setInviteTargetName(""); setInviteSearch(""); }}><XIcon className="w-4 h-4 text-muted-foreground" /></button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    data-testid="input-invite-search"
                    value={inviteSearch}
                    onChange={e => setInviteSearch(e.target.value)}
                    placeholder={inviteTargetType === "org" ? "Search by company name..." : "Enter user ID or email..."}
                  />
                  {inviteTargetType === "org" && orgSearchResults.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {orgSearchResults.slice(0, 8).map((o: any) => (
                        <button key={o.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                          onClick={() => { setInviteTargetId(o.organizationId || o.id); setInviteTargetName(o.companyName || o.name); setInviteSearch(""); }}>
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span>{o.companyName || o.name}</span>
                          {o.companyType && <span className="text-xs text-muted-foreground ml-auto">{o.companyType}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {inviteTargetType === "user" && inviteSearch.length > 2 && (
                    <div className="mt-1 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setInviteTargetId(inviteSearch); setInviteTargetName(inviteSearch); }}>
                        Use "{inviteSearch}"
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(r: any) => applyRoleDefaults(r)}>
                <SelectTrigger data-testid="select-invite-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer — read-only access</SelectItem>
                  <SelectItem value="editor">Editor — can edit voyage & checklist</SelectItem>
                  <SelectItem value="manager">Manager — full access including documents & proforma</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom permissions */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Permissions</Label>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 bg-muted/40 rounded-md">
                {[
                  ["viewVoyage", "View Voyage"], ["editVoyage", "Edit Voyage"],
                  ["viewDocuments", "View Documents"], ["uploadDocuments", "Upload Documents"],
                  ["deleteDocuments", "Delete Documents"], ["signDocuments", "Sign Documents"],
                  ["viewProforma", "View Proforma"], ["editProforma", "Edit Proforma"],
                  ["viewInvoice", "View Invoice"], ["viewChecklist", "View Checklist"],
                  ["editChecklist", "Edit Checklist"], ["viewChat", "View Chat"],
                  ["sendChat", "Send Chat"], ["viewTimeline", "View Timeline"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!invitePerms[key]}
                      onChange={e => setInvitePerms(p => ({ ...p, [key]: e.target.checked }))}
                      className="rounded"
                      data-testid={`perm-${key}`}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
              <Button
                data-testid="button-send-invite"
                onClick={() => inviteCollabMutation.mutate()}
                disabled={!inviteTargetId || inviteCollabMutation.isPending}
              >
                {inviteCollabMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
                Send Invite
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Service Request Dialog */}
      <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Hizmet Talebi Oluştur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Hizmet Türü *</Label>
              <Select value={serviceForm.serviceType} onValueChange={v => setServiceForm(f => ({ ...f, serviceType: v }))}>
                <SelectTrigger data-testid="select-service-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SERVICE_TYPE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Gemi Adı *</Label>
              <Input value={serviceForm.vesselName || voyage?.vesselName || ""} onChange={e => setServiceForm(f => ({ ...f, vesselName: e.target.value }))} placeholder="Gemi adı" />
            </div>
            <div className="space-y-1.5">
              <Label>Açıklama *</Label>
              <Textarea value={serviceForm.description} onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))} placeholder="Hizmet detaylarını girin..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Miktar</Label>
                <Input type="number" value={serviceForm.quantity} onChange={e => setServiceForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Birim</Label>
                <Input value={serviceForm.unit} onChange={e => setServiceForm(f => ({ ...f, unit: e.target.value }))} placeholder="MT, LT, adet..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tercih Edilen Tarih</Label>
              <Input type="datetime-local" value={serviceForm.preferredDate} onChange={e => setServiceForm(f => ({ ...f, preferredDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowServiceDialog(false)}>İptal</Button>
            <Button onClick={() => createServiceMutation.mutate()} disabled={createServiceMutation.isPending || !serviceForm.description.trim()} data-testid="button-save-service-request">
              {createServiceMutation.isPending ? "Oluşturuluyor..." : "Talep Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Upload Dialog */}
      <Dialog open={showDocDialog} onOpenChange={setShowDocDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Doküman Yükle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Dosya Seç *</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-150 ${
                  isDragOverDropzone
                    ? "border-[hsl(var(--maritime-primary))] bg-[hsl(var(--maritime-primary)/0.06)]"
                    : "hover:border-primary/50 hover:bg-muted/30"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragOverDropzone(true); }}
                onDragEnter={e => { e.preventDefault(); setIsDragOverDropzone(true); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOverDropzone(false); }}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragOverDropzone(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) processDroppedFile(file);
                }}
                data-testid="doc-dropzone"
              >
                {docUploading ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </div>
                ) : docForm.fileName ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">{docForm.fileName}</span>
                    {docForm.fileSize > 0 && <span className="text-xs text-muted-foreground">({(docForm.fileSize / 1024).toFixed(0)} KB)</span>}
                    <button
                      onClick={e => { e.stopPropagation(); setDocForm(f => ({ ...f, fileBase64: "", fileUrl: "", fileName: "", fileSize: 0 })); }}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                    >×</button>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    <Upload className={`w-7 h-7 mx-auto mb-2 transition-colors ${isDragOverDropzone ? "text-[hsl(var(--maritime-primary))]" : "opacity-40"}`} />
                    <p className="text-sm font-medium">{isDragOverDropzone ? "Drop file here" : "Drag & drop or click to select"}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">PDF, PNG, JPG, DOCX — max 20 MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.docx"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-doc-file"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Doküman Adı *</Label>
              <Input value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))} placeholder="Doküman adı" data-testid="input-doc-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Doküman Türü</Label>
              <Select value={docForm.docType} onValueChange={v => setDocForm(f => ({ ...f, docType: v }))}>
                <SelectTrigger data-testid="select-doc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notlar</Label>
              <Input value={docForm.notes} onChange={e => setDocForm(f => ({ ...f, notes: e.target.value }))} placeholder="Opsiyonel notlar" data-testid="input-doc-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDocDialog(false)}>İptal</Button>
            <Button
              onClick={() => uploadDocMutation.mutate()}
              disabled={uploadDocMutation.isPending || docUploading || (!docForm.fileBase64 && !docForm.fileUrl) || !docForm.name.trim()}
              data-testid="button-save-doc"
            >
              {uploadDocMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yükle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Picker Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-lg" data-testid="dialog-template-picker">
          <DialogHeader>
            <DialogTitle className="font-serif">Şablondan Doküman Oluştur</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {docTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Şablon bulunamadı</p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {docTemplates.map((tmpl: any) => (
                  <button
                    key={tmpl.id}
                    onClick={() => fromTemplateMutation.mutate(tmpl.id)}
                    disabled={fromTemplateMutation.isPending}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:border-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.04)] transition-all text-left"
                    data-testid={`template-option-${tmpl.id}`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{tmpl.name}</p>
                      <p className="text-xs text-muted-foreground">{tmpl.category}</p>
                    </div>
                    {fromTemplateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature Dialog */}
      <Dialog open={showSignDialog} onOpenChange={v => { setShowSignDialog(v); if (!v) { setSignDocId(null); setSignatureText(""); } }}>
        <DialogContent className="max-w-sm" data-testid="dialog-sign-doc">
          <DialogHeader>
            <DialogTitle className="font-serif">Dokümanı İmzala</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Ad / Unvan *</Label>
              <Input
                value={signatureText}
                onChange={e => setSignatureText(e.target.value)}
                placeholder="Adınız ve unvanınız"
                data-testid="input-signature-text"
              />
            </div>
            <div className="space-y-1.5">
              <Label>İmzalanma Tarihi</Label>
              <Input value={new Date().toLocaleDateString("tr-TR")} disabled className="bg-muted" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignDialog(false)}>İptal</Button>
            <Button
              onClick={() => { if (signDocId && signatureText.trim()) signDocMutation.mutate({ docId: signDocId, sigText: signatureText.trim() }); }}
              disabled={signDocMutation.isPending || !signatureText.trim()}
              data-testid="button-confirm-sign"
            >
              {signDocMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "İmzala"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Sefer Değerlendirmesi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Bu seferdeki deneyiminizi değerlendirin.</p>
            <div className="space-y-1.5">
              <Label>Puan *</Label>
              <StarRatingInput value={reviewForm.rating} onChange={v => setReviewForm(f => ({ ...f, rating: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Yorum</Label>
              <Textarea
                value={reviewForm.comment}
                onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
                placeholder="Deneyiminizi anlatın..."
                rows={3}
                data-testid="textarea-review-comment"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>İptal</Button>
            <Button
              onClick={() => createReviewMutation.mutate()}
              disabled={createReviewMutation.isPending || reviewForm.rating === 0}
              data-testid="button-save-review"
            >
              {createReviewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Değerlendir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Confirmation Dialog */}
      <AlertDialog open={pendingStatus !== null} onOpenChange={open => { if (!open) setPendingStatus(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus === "completed" ? "Sefer Tamamlandı mı?" : "Sefer İptal Edilsin mi?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus === "completed"
                ? "Bu sefer tamamlandı olarak işaretlenecek. Bu işlem geri alınamaz ve sefer durumu artık değiştirilemez."
                : "Bu sefer iptal edildi olarak işaretlenecek. Bu işlem geri alınamaz."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingStatus(null)} data-testid="button-cancel-status">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (pendingStatus) { statusMutation.mutate(pendingStatus); setPendingStatus(null); } }}
              className={pendingStatus === "completed" ? "bg-gray-700 hover:bg-gray-800" : "bg-red-600 hover:bg-red-700"}
              data-testid="button-confirm-status"
            >
              {pendingStatus === "completed" ? "Evet, Tamamla" : "Evet, İptal Et"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
