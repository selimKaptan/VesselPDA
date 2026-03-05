import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  Ship, MapPin, Calendar, ArrowLeft, CheckCircle2, Circle, Trash2,
  Plus, Loader2, ChevronDown, Wrench, Fuel, ShoppingCart, Users as UsersIcon,
  Sparkles, HelpCircle, Clock, PlayCircle, XCircle, ClipboardList,
  FileText, Upload, Download, Star, MessageCircle, FolderOpen, Anchor, Cloud,
  CalendarClock, Pen, LayoutTemplate, GitBranch, BadgeCheck, DollarSign, Receipt, ExternalLink
} from "lucide-react";
import { WeatherPanel, EtaWeatherAlert } from "@/components/port-weather-panel";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import type { Port } from "@shared/schema";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  planned:   { label: "Planned",   color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",    icon: Clock },
  active:    { label: "Active",    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: PlayCircle },
  completed: { label: "Completed", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",        icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",         icon: XCircle },
};

const SERVICE_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  fuel:         { label: "Fuel / Bunker", icon: Fuel,          color: "text-orange-500" },
  repair:       { label: "Technical Repair", icon: Wrench,     color: "text-red-500" },
  provisioning: { label: "Provisioning",  icon: ShoppingCart,  color: "text-green-500" },
  crew_change:  { label: "Crew Change",   icon: UsersIcon,     color: "text-blue-500" },
  cleaning:     { label: "Cleaning",      icon: Sparkles,      color: "text-purple-500" },
  other:        { label: "Other",         icon: HelpCircle,    color: "text-gray-500" },
};

const DOC_TYPE_CONFIG: Record<string, string> = {
  manifest:       "Manifest",
  bill_of_lading: "Bill of Lading",
  certificate:    "Certificate",
  port_clearance: "Port Clearance",
  other:          "Other",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  planned: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

function PortSearch({ value, onChange }: { value: string; onChange: (portId: number, portName: string) => void }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const { data: ports } = useQuery<Port[]>({
    queryKey: ["/api/ports", query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const res = await fetch(`/api/ports?q=${encodeURIComponent(query)}`);
      return res.json();
    },
    enabled: query.length >= 2,
  });
  return (
    <div className="relative">
      <Input value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }} placeholder="Search port..." onFocus={() => setOpen(true)} />
      {open && ports && ports.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {ports.map(p => (
            <button key={p.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors" onMouseDown={() => { onChange(p.id, p.name); setQuery(p.name); setOpen(false); }}>
              <span className="font-medium">{p.name}</span>{p.code && <span className="ml-2 text-xs text-muted-foreground">{p.code}</span>}
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
  const { joinVoyage, leaveVoyage } = useSocket();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!voyageId) return;
    joinVoyage(voyageId);
    return () => { leaveVoyage(voyageId); };
  }, [voyageId]);

  const [newTask, setNewTask] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"operation" | "documents" | "comms" | "financial" | "activity">("operation");
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDesc, setNoteDesc] = useState("");
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

  const { data: voyageInvoices = [] } = useQuery<any[]>({
    queryKey: ["/api/invoices", "voyage", voyageId],
    queryFn: async () => {
      const res = await fetch(`/api/invoices?voyageId=${voyageId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.invoices ?? []);
    },
    enabled: !!voyageId,
  });

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const userId = (user as any)?.id || (user as any)?.claims?.sub;
  const isOwner = voyage?.userId === userId;
  const isAgent = voyage?.agentUserId === userId;

  const revieweeUserId = isOwner ? voyage?.agentUserId : (isAgent ? voyage?.userId : null);
  const canReview = voyage?.status === "completed" && (isOwner || isAgent) && revieweeUserId && !reviewData?.myReview;

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/voyages/${voyageId}/status`, { status });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] }); toast({ title: "Status updated" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const addTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/checklist`, { title: newTask, assignedTo: "both" });
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] }); setNewTask(""); },
    onError: () => toast({ title: "Could not add task", variant: "destructive" }),
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
      toast({ title: "Appointment added" });
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
      toast({ title: "Appointment deleted" });
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        portId: serviceForm.portId || voyage?.portId,
        vesselName: serviceForm.vesselName || voyage?.vesselName || "Unspecified",
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
      toast({ title: "Service request created" });
      setShowServiceDialog(false);
      setServiceForm({ portId: 0, portName: "", vesselName: "", serviceType: "other", description: "", quantity: "", unit: "", preferredDate: "" });
    },
    onError: () => toast({ title: "Error", variant: "destructive" }),
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
      toast({ title: "Document deleted" });
    },
    onError: () => toast({ title: "Delete error", variant: "destructive" }),
  });

  const fromTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const res = await apiRequest("POST", `/api/voyages/${voyageId}/documents/from-template`, { templateId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "documents"] });
      setShowTemplateDialog(false);
      toast({ title: "Created from template", description: "Document was auto-filled" });
    },
    onError: () => toast({ title: "Error", description: "Template could not be applied", variant: "destructive" }),
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
      toast({ title: "Document signed" });
    },
    onError: () => toast({ title: "Signing error", variant: "destructive" }),
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
      toast({ title: "Review saved" });
      setShowReviewDialog(false);
      setReviewForm({ rating: 0, comment: "" });
    },
    onError: () => toast({ title: "Review error", variant: "destructive" }),
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
    onError: () => toast({ title: "Message could not be sent", variant: "destructive" }),
  });

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

  const { data: activitiesData } = useQuery<{ activities: any[], total: number }>({
    queryKey: ["/api/voyages", voyageId, "activities"],
    enabled: activeTab === "activity",
  });
  const activities = activitiesData?.activities || [];

  const addNoteMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/voyages/${voyageId}/activities`, { title: noteTitle, description: noteDesc }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "activities"] });
      setShowNoteDialog(false);
      setNoteTitle(""); setNoteDesc("");
    }
  });

  function formatTimeAgo(dt: string | Date) {
    const d = new Date(dt);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    if (hrs < 48) return "Yesterday";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  function getActivityStyle(type: string): { bg: string; text: string; emoji: string } {
    const map: Record<string, { bg: string; text: string; emoji: string }> = {
      voyage_created:         { bg: "bg-sky-500/20",     text: "text-sky-400",     emoji: "🗺️" },
      status_changed:         { bg: "bg-amber-500/20",   text: "text-amber-400",   emoji: "🔄" },
      eta_updated:            { bg: "bg-blue-500/20",    text: "text-blue-400",    emoji: "🕐" },
      document_uploaded:      { bg: "bg-purple-500/20",  text: "text-purple-400",  emoji: "📄" },
      document_signed:        { bg: "bg-green-500/20",   text: "text-green-400",   emoji: "✍️" },
      checklist_added:        { bg: "bg-slate-500/20",   text: "text-slate-400",   emoji: "☐" },
      checklist_completed:    { bg: "bg-green-500/20",   text: "text-green-400",   emoji: "✅" },
      chat_message:           { bg: "bg-slate-500/20",   text: "text-slate-400",   emoji: "💬" },
      sof_created:            { bg: "bg-cyan-500/20",    text: "text-cyan-400",    emoji: "📝" },
      sof_finalized:          { bg: "bg-cyan-500/20",    text: "text-cyan-400",    emoji: "📝" },
      pda_created:            { bg: "bg-sky-500/20",     text: "text-sky-400",     emoji: "📋" },
      pda_approved:           { bg: "bg-green-500/20",   text: "text-green-400",   emoji: "📋" },
      fda_created:            { bg: "bg-amber-500/20",   text: "text-amber-400",   emoji: "🧾" },
      fda_approved:           { bg: "bg-green-500/20",   text: "text-green-400",   emoji: "🧾" },
      invoice_created:        { bg: "bg-emerald-500/20", text: "text-emerald-400", emoji: "💳" },
      invoice_paid:           { bg: "bg-green-500/20",   text: "text-green-400",   emoji: "💰" },
      nomination_sent:        { bg: "bg-sky-500/20",     text: "text-sky-400",     emoji: "🤝" },
      review_submitted:       { bg: "bg-yellow-500/20",  text: "text-yellow-400",  emoji: "⭐" },
      custom_note:            { bg: "bg-violet-500/20",  text: "text-violet-400",  emoji: "📌" },
    };
    return map[type] || { bg: "bg-slate-500/20", text: "text-slate-400", emoji: "📌" };
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
        <p>Voyage not found.</p>
        <Link href="/voyages"><Button variant="outline" className="mt-4">Go Back</Button></Link>
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
      <PageMeta title={`Voyage — ${voyage.vesselName || "Detail"} | VesselPDA`} description="Voyage detail and operation file" />

      {/* Back */}
      <Link href="/voyages">
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voyages
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
              <h1 className="font-serif text-xl font-bold">{voyage.vesselName || "Vessel Not Specified"}</h1>
              <p className="text-sm text-muted-foreground">{voyage.purposeOfCall}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${s.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />{s.label}
            </span>
            {canReview && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setShowReviewDialog(true)} data-testid="button-review">
                <Star className="w-3.5 h-3.5" /> Rate
              </Button>
            )}
            {reviewData?.myReview && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Rated
              </span>
            )}
            {isOwner && transitions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    Change Status <ChevronDown className="w-3.5 h-3.5" />
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
            <p className="text-xs text-muted-foreground mb-0.5">Port</p>
            <p className="font-medium flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-muted-foreground" />{voyage.portName || `Port #${voyage.portId}`}</p>
          </div>
          {voyage.eta && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">ETA</p>
              <p className="font-medium flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-muted-foreground" />{new Date(voyage.eta).toLocaleDateString("en-GB")}</p>
            </div>
          )}
          {voyage.etd && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">ETD</p>
              <p className="font-medium flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-muted-foreground" />{new Date(voyage.etd).toLocaleDateString("en-GB")}</p>
            </div>
          )}
          {voyage.notes && (
            <div className="col-span-full">
              <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
              <p className="text-sm">{voyage.notes}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl">
        {([
          { key: "operation", label: "Operation", icon: ClipboardList },
          { key: "activity",  label: "Activity",  icon: Clock },
          { key: "documents", label: "Documents", icon: FolderOpen },
          { key: "comms",     label: "Messages",  icon: MessageCircle },
          { key: "financial", label: "Financial", icon: DollarSign },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`tab-${key}`}
          >
            <Icon className="w-4 h-4" /> {label}
            {key === "comms" && chatMessages.length > 0 && (
              <span className="ml-1 text-[10px] bg-[hsl(var(--maritime-primary)/0.15)] text-[hsl(var(--maritime-primary))] px-1.5 py-0.5 rounded-full font-semibold">
                {chatMessages.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Operasyon ─────────────────────────────────────── */}
      {activeTab === "operation" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Görev Listesi */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                  <h2 className="font-semibold text-sm">Task List</h2>
                </div>
                {checklist.length > 0 && (
                  <span className="text-xs text-muted-foreground">{completed}/{checklist.length} completed</span>
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
                  <p className="text-xs text-muted-foreground text-center py-4">No tasks yet. Add one below.</p>
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
                <Input value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="New task..." onKeyDown={e => { if (e.key === "Enter" && newTask.trim()) addTaskMutation.mutate(); }} className="text-sm h-8" data-testid="input-new-task" />
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
                  <h2 className="font-semibold text-sm">Service Requests</h2>
                </div>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setShowServiceDialog(true)} data-testid="button-add-service-request">
                  <Plus className="w-3 h-3" /> Create Request
                </Button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {serviceReqs.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No service requests for this voyage.</p>
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
              <h2 className="font-semibold text-sm">Port Conditions</h2>
              {portData?.name && <span className="ml-auto text-xs text-muted-foreground">{portData.name}</span>}
            </div>
            {!voyage?.portId ? (
              <Card className="p-4 flex items-center gap-2 text-muted-foreground text-sm">
                <Cloud className="w-4 h-4 opacity-40" /><span>Port information not found.</span>
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
                <Cloud className="w-4 h-4 opacity-40" /><span>No coordinates found for this port — weather cannot be displayed.</span>
              </Card>
            )}
          </div>

          {/* Port Call Randevuları */}
          {(isOwner || isAgent) && (
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                  <h2 className="font-semibold text-sm">Port Call Appointments</h2>
                  {appointments.length > 0 && <span className="text-xs text-muted-foreground">({appointments.length})</span>}
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowApptForm(v => !v)} data-testid="button-add-appointment">
                  <Plus className="w-3.5 h-3.5 mr-1" />Add Appointment
                </Button>
              </div>

              {showApptForm && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-muted/30 rounded-lg">
                  <div>
                    <Select value={apptForm.appointmentType} onValueChange={v => setApptForm(f => ({ ...f, appointmentType: v }))}>
                      <SelectTrigger className="h-8 text-xs" data-testid="select-appt-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pilot">Pilot</SelectItem>
                        <SelectItem value="tugboat">Tugboat</SelectItem>
                        <SelectItem value="health">Health</SelectItem>
                        <SelectItem value="customs">Customs</SelectItem>
                        <SelectItem value="immigration">Immigration</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Input type="datetime-local" className="h-8 text-xs" value={apptForm.scheduledAt} onChange={e => setApptForm(f => ({ ...f, scheduledAt: e.target.value }))} data-testid="input-appt-scheduled" />
                  </div>
                  <div className="flex gap-1">
                    <Input className="h-8 text-xs flex-1" placeholder="Notes (optional)" value={apptForm.notes} onChange={e => setApptForm(f => ({ ...f, notes: e.target.value }))} data-testid="input-appt-notes" />
                    <Button size="sm" className="h-8 px-2" onClick={() => createApptMutation.mutate()} disabled={createApptMutation.isPending} data-testid="button-save-appointment">
                      {createApptMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>
              )}

              {appointments.length === 0 && !showApptForm && (
                <p className="text-xs text-muted-foreground text-center py-3">No appointments added yet</p>
              )}

              <div className="space-y-2">
                {appointments.map((appt: any) => {
                  const typeLabels: Record<string, { label: string; color: string }> = {
                    pilot: { label: "Pilot", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
                    tugboat: { label: "Tugboat", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
                    health: { label: "Health", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
                    customs: { label: "Customs", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
                    immigration: { label: "Immigration", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" },
                    other: { label: "Other", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
                  };
                  const statusLabels: Record<string, { label: string; color: string }> = {
                    pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
                    confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
                    completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
                    cancelled: { label: "Cancelled", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
                  };
                  const typeCfg = typeLabels[appt.appointmentType] || typeLabels.other;
                  const stCfg = statusLabels[appt.status] || statusLabels.pending;
                  return (
                    <div key={appt.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30" data-testid={`appt-row-${appt.id}`}>
                      <Badge className={`text-xs shrink-0 ${typeCfg.color}`}>{typeCfg.label}</Badge>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {appt.scheduledAt ? new Date(appt.scheduledAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "Date not set"}
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
                <h2 className="font-semibold text-sm">Reviews</h2>
              </div>
              <div className="space-y-3">
                {reviews.map((r: any) => (
                  <div key={r.id} className="flex items-start gap-3 px-3 py-3 rounded-lg bg-muted/30" data-testid={`review-${r.id}`}>
                    <div className="w-8 h-8 rounded-full bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0 text-sm font-bold text-[hsl(var(--maritime-primary))]">
                      {(r.reviewerName || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{r.reviewerName || "User"}</span>
                        <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("en-GB")}</span>
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
                <p className="text-sm font-semibold text-[hsl(var(--maritime-primary))]">Drop file here</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              <h2 className="font-semibold text-sm">Documents</h2>
              {Array.isArray(docs) && docs.length > 0 && <span className="text-xs text-muted-foreground">({docs.length})</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setShowTemplateDialog(true)} data-testid="button-from-template">
                <LayoutTemplate className="w-3 h-3" /> From Template
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setShowDocDialog(true)} data-testid="button-upload-doc">
                <Upload className="w-3 h-3" /> Upload
              </Button>
            </div>
          </div>

          {/* Filtre butonları */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "all",           label: "All" },
              { key: "manifest",      label: "Manifest" },
              { key: "bill_of_lading",label: "Bill of Lading" },
              { key: "certificate",   label: "Certificate" },
              { key: "port_clearance",label: "Port Clearance" },
              { key: "other",         label: "Other" },
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
                <p className="text-sm font-medium">No documents yet</p>
                <p className="text-xs mt-1">Drag &amp; drop files here or use the "Upload" button</p>
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
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 font-medium flex-shrink-0">📋 Auto</span>
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
                            <Pen className="w-3 h-3" /> Sign
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{DOC_TYPE_CONFIG[doc.docType] || "Other"} · {doc.uploaderName} · {new Date(doc.createdAt).toLocaleDateString("en-GB")}</p>
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
                <h2 className="font-semibold text-sm">Team Chat</h2>
              </div>
              {chatMessages.length > 0 && (
                <span className="text-xs bg-[hsl(var(--maritime-primary)/0.1)] text-[hsl(var(--maritime-primary))] px-2 py-0.5 rounded-full font-semibold">
                  {chatMessages.length} messages
                </span>
              )}
            </div>

            {/* Participants strip */}
            {participants.length > 0 && (
              <div className="px-5 py-2 border-b flex items-center gap-2 flex-shrink-0 bg-muted/20">
                <span className="text-xs text-muted-foreground">Participants:</span>
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
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs mt-1">Be the first to send a message</p>
                </div>
              ) : (
                chatMessages.map((msg: any) => {
                  const isMine = msg.senderId === userId;
                  const time = new Date(msg.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                  const date = new Date(msg.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
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
                    placeholder="Type a message..."
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
                    {sendChatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-1">You are not a participant in this voyage.</p>
              )}
            </div>
          </Card>
        );
      })()}

      {/* ── Tab: Financial ──────────────────────────────────────── */}
      {activeTab === "financial" && (
        <div className="space-y-5" data-testid="tab-content-financial">
          {/* Invoices Section */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                <h2 className="font-semibold text-sm">Invoices</h2>
                {voyageInvoices.length > 0 && (
                  <span className="text-xs text-muted-foreground">({voyageInvoices.length})</span>
                )}
              </div>
              <Link href="/invoices">
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1" data-testid="button-view-all-invoices">
                  <ExternalLink className="w-3 h-3" /> View All
                </Button>
              </Link>
            </div>

            {voyageInvoices.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground" data-testid="section-invoices-empty">
                <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No invoices for this voyage yet.</p>
              </div>
            ) : (
              <div className="space-y-2" data-testid="section-invoices">
                {voyageInvoices.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors" data-testid={`invoice-row-${inv.id}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{inv.title || `Invoice #${inv.id}`}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.invoiceType || "invoice"} · {inv.currency || "USD"} {Number(inv.amount || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        inv.status === "paid" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : inv.status === "overdue" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      }`}>
                        {inv.status || "pending"}
                      </span>
                      <Link href={`/invoices`}>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" data-testid={`button-view-invoice-${inv.id}`}>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* PDA Section */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                <h2 className="font-semibold text-sm">Proforma Disbursement Accounts</h2>
              </div>
              <Link href="/proformas/new">
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1" data-testid="button-create-pda">
                  <Plus className="w-3 h-3" /> Create PDA
                </Button>
              </Link>
            </div>
            <div className="text-center py-6 text-muted-foreground" data-testid="section-pdas">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Create a Proforma Disbursement Account for this voyage.</p>
              <Link href="/proformas/new">
                <Button size="sm" variant="default" className="mt-3 gap-1.5" data-testid="button-create-pda-cta">
                  <Plus className="w-3.5 h-3.5" /> New PDA
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      )}

      {/* ── Tab: Activity Timeline ─────────────────────────────── */}
      {activeTab === "activity" && (
        <div className="space-y-4" data-testid="tab-content-activity">
          {/* Header with Add Note button */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              Activity Timeline
            </h2>
            <Button size="sm" variant="outline" onClick={() => setShowNoteDialog(true)} data-testid="button-add-note">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Note
            </Button>
          </div>

          {/* Timeline */}
          {activities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No activity yet. Events will appear here as the voyage progresses.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-700/50" />
              <div className="space-y-4">
                {activities.map((activity: any) => {
                  const style = getActivityStyle(activity.activityType);
                  return (
                    <div key={activity.id} className="relative flex gap-4" data-testid={`activity-item-${activity.id}`}>
                      <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-base ${style.bg} ${style.text}`}>
                        {style.emoji}
                      </div>
                      <div className="flex-1 bg-card border border-border rounded-xl p-4 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold truncate">{activity.title}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{formatTimeAgo(activity.createdAt)}</span>
                        </div>
                        {activity.description && (
                          <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
                        )}
                        {activity.user && (
                          <div className="text-xs text-muted-foreground mt-2">
                            by {activity.user.firstName} {activity.user.lastName}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Load More */}
          {activities.length >= 50 && (
            <div className="text-center">
              <Button variant="ghost" size="sm">Load More</Button>
            </div>
          )}

          {/* Add Note Dialog */}
          <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Activity Note</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <Label>Title</Label>
                  <Input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Brief description..." data-testid="input-note-title" />
                </div>
                <div>
                  <Label>Details (optional)</Label>
                  <Textarea value={noteDesc} onChange={e => setNoteDesc(e.target.value)} placeholder="Additional details..." rows={3} data-testid="input-note-desc" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNoteDialog(false)}>Cancel</Button>
                <Button onClick={() => addNoteMutation.mutate()} disabled={!noteTitle.trim() || addNoteMutation.isPending} data-testid="button-save-note">
                  {addNoteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Note"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Service Request Dialog */}
      <Dialog open={showServiceDialog} onOpenChange={setShowServiceDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Create Service Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Service Type *</Label>
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
              <Label>Vessel Name *</Label>
              <Input value={serviceForm.vesselName || voyage?.vesselName || ""} onChange={e => setServiceForm(f => ({ ...f, vesselName: e.target.value }))} placeholder="Vessel name" />
            </div>
            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Textarea value={serviceForm.description} onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))} placeholder="Enter service details..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" value={serviceForm.quantity} onChange={e => setServiceForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Input value={serviceForm.unit} onChange={e => setServiceForm(f => ({ ...f, unit: e.target.value }))} placeholder="MT, LT, pcs..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Preferred Date</Label>
              <Input type="datetime-local" value={serviceForm.preferredDate} onChange={e => setServiceForm(f => ({ ...f, preferredDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowServiceDialog(false)}>Cancel</Button>
            <Button onClick={() => createServiceMutation.mutate()} disabled={createServiceMutation.isPending || !serviceForm.description.trim()} data-testid="button-save-service-request">
              {createServiceMutation.isPending ? "Creating..." : "Create Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Upload Dialog */}
      <Dialog open={showDocDialog} onOpenChange={setShowDocDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Select File *</Label>
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
              <Label>Document Name *</Label>
              <Input value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))} placeholder="Document name" data-testid="input-doc-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Document Type</Label>
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
              <Label>Notes</Label>
              <Input value={docForm.notes} onChange={e => setDocForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" data-testid="input-doc-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDocDialog(false)}>Cancel</Button>
            <Button
              onClick={() => uploadDocMutation.mutate()}
              disabled={uploadDocMutation.isPending || docUploading || (!docForm.fileBase64 && !docForm.fileUrl) || !docForm.name.trim()}
              data-testid="button-save-doc"
            >
              {uploadDocMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Picker Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-lg" data-testid="dialog-template-picker">
          <DialogHeader>
            <DialogTitle className="font-serif">Create Document from Template</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {docTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No templates found</p>
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
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature Dialog */}
      <Dialog open={showSignDialog} onOpenChange={v => { setShowSignDialog(v); if (!v) { setSignDocId(null); setSignatureText(""); } }}>
        <DialogContent className="max-w-sm" data-testid="dialog-sign-doc">
          <DialogHeader>
            <DialogTitle className="font-serif">Sign Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name / Title *</Label>
              <Input
                value={signatureText}
                onChange={e => setSignatureText(e.target.value)}
                placeholder="Your name and title"
                data-testid="input-signature-text"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Signature Date</Label>
              <Input value={new Date().toLocaleDateString("en-GB")} disabled className="bg-muted" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignDialog(false)}>Cancel</Button>
            <Button
              onClick={() => { if (signDocId && signatureText.trim()) signDocMutation.mutate({ docId: signDocId, sigText: signatureText.trim() }); }}
              disabled={signDocMutation.isPending || !signatureText.trim()}
              data-testid="button-confirm-sign"
            >
              {signDocMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Voyage Review</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Rate your experience on this voyage.</p>
            <div className="space-y-1.5">
              <Label>Rating *</Label>
              <StarRatingInput value={reviewForm.rating} onChange={v => setReviewForm(f => ({ ...f, rating: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Comment</Label>
              <Textarea
                value={reviewForm.comment}
                onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
                placeholder="Describe your experience..."
                rows={3}
                data-testid="textarea-review-comment"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createReviewMutation.mutate()}
              disabled={createReviewMutation.isPending || reviewForm.rating === 0}
              data-testid="button-save-review"
            >
              {createReviewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Confirmation Dialog */}
      <AlertDialog open={pendingStatus !== null} onOpenChange={open => { if (!open) setPendingStatus(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus === "completed" ? "Mark Voyage as Completed?" : "Cancel This Voyage?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus === "completed"
                ? "This voyage will be marked as completed. This action cannot be undone and the status can no longer be changed."
                : "This voyage will be marked as cancelled. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingStatus(null)} data-testid="button-cancel-status">Go Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (pendingStatus) { statusMutation.mutate(pendingStatus); setPendingStatus(null); } }}
              className={pendingStatus === "completed" ? "bg-gray-700 hover:bg-gray-800" : "bg-red-600 hover:bg-red-700"}
              data-testid="button-confirm-status"
            >
              {pendingStatus === "completed" ? "Yes, Complete" : "Yes, Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
