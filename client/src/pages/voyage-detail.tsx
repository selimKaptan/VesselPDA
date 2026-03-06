import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  Ship, MapPin, Calendar, ArrowLeft, CheckCircle2, Circle, Trash2,
  Plus, Loader2, ChevronDown, Wrench, Fuel, ShoppingCart, Users as UsersIcon,
  Sparkles, HelpCircle, Clock, PlayCircle, XCircle, ClipboardList,
  FileText, Upload, Download, Star, MessageCircle, FolderOpen, Anchor, Cloud,
  CalendarClock, Pen, LayoutTemplate, GitBranch, BadgeCheck, DollarSign, Receipt, ExternalLink,
  FileCheck, Users2, UserPlus, MoreVertical, Package, Navigation, CheckCheck, Settings, Archive, X,
  TrendingUp, TrendingDown, AlertTriangle, Mail,
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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

// ─── Port Call Stepper ────────────────────────────────────────────────────────

const PORT_CALL_STEPS: { key: string; label: string; icon: any }[] = [
  { key: "pre_arrival", label: "Pre-Arrival", icon: Anchor     },
  { key: "anchorage",   label: "Anchorage",   icon: Anchor     },
  { key: "berthed",     label: "Berthed",     icon: Ship       },
  { key: "cargo_ops",   label: "Cargo Ops",   icon: Package    },
  { key: "departed",    label: "Departed",    icon: Navigation },
];

function getStepperIndex(status: string): number {
  if (status === "planned")   return 0;
  if (status === "active")    return 3;
  if (status === "completed") return 4;
  return -1;
}

function getDateTag(dt: string | null | undefined): {
  label: string; relText: string; color: string;
} | null {
  if (!dt) return null;
  const now = Date.now();
  const ms = new Date(dt).getTime();
  const days = Math.ceil((ms - now) / 86_400_000);
  const label = new Date(dt).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
  if (days > 3)  return { label, relText: `in ${days} days`,        color: "text-slate-300 bg-slate-700/50 border-slate-600/30"   };
  if (days > 0)  return { label, relText: days === 1 ? "Tomorrow" : `in ${days} days`, color: "text-orange-400 bg-orange-500/20 border-orange-500/20" };
  if (days === 0) return { label, relText: "Today",                  color: "text-red-400 bg-red-500/20 border-red-500/20"          };
  return            { label, relText: `${Math.abs(days)} days ago`, color: "text-red-400 bg-red-500/20 border-red-500/20"          };
}

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
  const [activeTab, setActiveTab] = useState<"operation" | "documents" | "comms" | "financial" | "activity" | "participants" | "cargo_ops" | "contacts">("operation");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteTab, setInviteTab] = useState<"email" | "directory" | "bulk">("email");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("observer");
  const [inviteServiceType, setInviteServiceType] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkRole, setBulkRole] = useState("observer");
  const [directorySearch, setDirectorySearch] = useState("");
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDesc, setNoteDesc] = useState("");
  const [showAddLogDialog, setShowAddLogDialog] = useState(false);
  const [logForm, setLogForm] = useState<{
    fromTime: string; toTime: string; logType: string; remarks: string; delayReason: string; delayNotes: string;
    receiverEntries: Record<number, { amount: string; trucks: string }>;
  }>({ fromTime: "", toTime: "", logType: "operation", remarks: "", delayReason: "", delayNotes: "", receiverEntries: {} });
  const [showCargoReportDialog, setShowCargoReportDialog] = useState(false);
  const [reportEmail, setReportEmail] = useState("");
  const [reportSelectedEmails, setReportSelectedEmails] = useState<string[]>([]);
  const [reportManualEmail, setReportManualEmail] = useState("");
  const [contactBulkText, setContactBulkText] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactRole, setNewContactRole] = useState("other");
  const [showAddReceiverDialog, setShowAddReceiverDialog] = useState(false);
  const [receiverForm, setReceiverForm] = useState({ name: "", allocatedMt: 0 });
  const [docFilter, setDocFilter] = useState<string>("all");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [showServiceDialog, setShowServiceDialog] = useState(false);
  const [showDocDialog, setShowDocDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [docForm, setDocForm] = useState({ name: "", docType: "other", notes: "", fileBase64: "", fileUrl: "", fileName: "", fileSize: 0 });
  const [docUploading, setDocUploading] = useState(false);
  const [isDragOverDropzone, setIsDragOverDropzone] = useState(false);
  const [isPanelDragOver, setIsPanelDragOver] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generatingCount, setGeneratingCount] = useState(0);
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null);
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

  const { data: voyageNors = [] } = useQuery<any[]>({
    queryKey: ["/api/nor", "voyage", voyageId],
    queryFn: async () => {
      const res = await fetch(`/api/nor?voyageId=${voyageId}`);
      return res.ok ? res.json() : [];
    },
    enabled: !!voyageId,
  });
  const activeNor = (voyageNors as any[])[0];

  const { data: voyageSofs = [] } = useQuery<any[]>({
    queryKey: ["/api/sof", "voyage", voyageId],
    queryFn: async () => {
      const res = await fetch(`/api/sof?voyageId=${voyageId}`);
      return res.ok ? res.json() : [];
    },
    enabled: !!voyageId,
  });
  const activeSof = (voyageSofs as any[])[0];

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

  async function handleDownloadAllZip() {
    if (!Array.isArray(docs) || docs.length === 0) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    await Promise.all(docs.map(async (doc: any) => {
      const fileName = doc.fileName || doc.name || `document-${doc.id}`;
      if (doc.fileBase64) {
        const b64 = doc.fileBase64.includes(",") ? doc.fileBase64.split(",")[1] : doc.fileBase64;
        zip.file(fileName, b64, { base64: true });
      } else if (doc.fileUrl) {
        try {
          const res = await fetch(doc.fileUrl, { credentials: "include" });
          const blob = await res.blob();
          zip.file(fileName, blob);
        } catch {
          // skip files that fail to fetch
        }
      }
    }));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voyage-${voyageId}-documents.zip`;
    a.click();
    URL.revokeObjectURL(url);
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

  const { data: cargoLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "cargo-logs"],
    queryFn: () => fetch(`/api/voyages/${voyageId}/cargo-logs`, { credentials: "include" }).then(r => r.json()),
    enabled: activeTab === "cargo_ops",
  });

  const { data: receivers = [] } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "cargo-receivers"],
    queryFn: () => fetch(`/api/voyages/${voyageId}/cargo-receivers`, { credentials: "include" }).then(r => r.json()),
    enabled: activeTab === "cargo_ops",
  });

  const { data: voyageContactsList = [] } = useQuery<any[]>({
    queryKey: ["/api/voyages", voyageId, "contacts"],
    queryFn: () => fetch(`/api/voyages/${voyageId}/contacts`, { credentials: "include" }).then(r => r.json()),
    enabled: activeTab === "contacts" || showCargoReportDialog,
  });

  const addCargoLogMutation = useMutation({
    mutationFn: () => {
      const fromIso = logForm.fromTime ? new Date(logForm.fromTime).toISOString() : undefined;
      const toIso = logForm.toTime ? new Date(logForm.toTime).toISOString() : undefined;
      if (logForm.logType === "operation") {
        const entries = Object.entries(logForm.receiverEntries)
          .filter(([, v]) => v.amount && parseFloat(v.amount) > 0)
          .map(([rId, v]) => ({
            receiverId: Number(rId),
            amountHandled: parseFloat(v.amount),
            truckCount: v.trucks ? parseInt(v.trucks) : undefined,
          }));
        return apiRequest("POST", `/api/voyages/${voyageId}/cargo-logs`, {
          fromTime: fromIso, toTime: toIso, logType: "operation", entries,
        });
      } else {
        const fullReason = logForm.delayReason + (logForm.delayNotes ? `: ${logForm.delayNotes}` : "");
        return apiRequest("POST", `/api/voyages/${voyageId}/cargo-logs`, {
          fromTime: fromIso, toTime: toIso, logType: "delay",
          amountHandled: 0, remarks: fullReason,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "cargo-logs"] });
      setShowAddLogDialog(false);
      setLogForm({ fromTime: "", toTime: "", logType: "operation", remarks: "", delayReason: "", delayNotes: "", receiverEntries: {} });
      toast({ title: "Log added" });
    },
  });

  const deleteCargoLogMutation = useMutation({
    mutationFn: (logId: number) => apiRequest("DELETE", `/api/voyages/${voyageId}/cargo-logs/${logId}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "cargo-logs"] }),
  });

  const deleteBatchMutation = useMutation({
    mutationFn: (batchId: string) => apiRequest("DELETE", `/api/voyages/${voyageId}/cargo-logs/batch/${batchId}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "cargo-logs"] }),
  });

  const sendCargoReportMutation = useMutation({
    mutationFn: (toEmails: string[]) => apiRequest("POST", `/api/voyages/${voyageId}/send-cargo-report`, { toEmails }),
    onSuccess: (_data, toEmails) => {
      setShowCargoReportDialog(false);
      setReportSelectedEmails([]);
      setReportManualEmail("");
      toast({ title: "Report sent", description: `Cargo report sent to ${toEmails.length} recipient(s)` });
    },
    onError: () => toast({ title: "Failed to send report", variant: "destructive" }),
  });

  const addContactMutation = useMutation({
    mutationFn: (data: { email: string; name?: string; role?: string }) =>
      apiRequest("POST", `/api/voyages/${voyageId}/contacts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "contacts"] });
      setNewContactEmail(""); setNewContactName(""); setNewContactRole("other");
      toast({ title: "Contact added" });
    },
    onError: () => toast({ title: "Failed to add contact", variant: "destructive" }),
  });

  const bulkImportContactsMutation = useMutation({
    mutationFn: (emails: string) => apiRequest("POST", `/api/voyages/${voyageId}/contacts/bulk`, { emails }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "contacts"] });
      setContactBulkText("");
      toast({ title: `${data.inserted} contact(s) added`, description: data.skipped > 0 ? `${data.skipped} duplicate(s) skipped` : undefined });
    },
    onError: () => toast({ title: "Bulk import failed", variant: "destructive" }),
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ contactId, updates }: { contactId: number; updates: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/voyages/${voyageId}/contacts/${contactId}`, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "contacts"] }),
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: number) => apiRequest("DELETE", `/api/voyages/${voyageId}/contacts/${contactId}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "contacts"] }),
  });

  const addReceiverMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/voyages/${voyageId}/cargo-receivers`, {
      name: receiverForm.name,
      allocatedMt: Number(receiverForm.allocatedMt),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "cargo-receivers"] });
      setShowAddReceiverDialog(false);
      setReceiverForm({ name: "", allocatedMt: 0 });
      toast({ title: "Receiver added" });
    },
  });

  const deleteReceiverMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/voyages/${voyageId}/cargo-receivers/${id}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "cargo-receivers"] }),
  });

  const { data: collaboratorsData, refetch: refetchCollaborators } = useQuery<{ invitations: any[], participants: any[] }>({
    queryKey: ["/api/voyages", voyageId, "invitations"],
    queryFn: () => fetch(`/api/voyages/${voyageId}/invitations`, { credentials: "include" }).then(r => r.json()),
    enabled: !!voyageId,
  });
  const participants = collaboratorsData?.participants ?? [];
  const pendingInvites = collaboratorsData?.invitations?.filter((i: any) => i.status === "pending") ?? [];

  const sendInviteMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/voyages/${voyageId}/invite`, data),
    onSuccess: () => {
      toast({ title: "Invitation sent" });
      refetchCollaborators();
      setShowInviteDialog(false);
      setInviteEmail(""); setInviteRole("observer"); setInviteServiceType(""); setInviteMessage("");
    },
    onError: () => toast({ title: "Failed to send invitation", variant: "destructive" }),
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (inviteId: number) => apiRequest("DELETE", `/api/voyages/${voyageId}/invitations/${inviteId}`, {}),
    onSuccess: () => { toast({ title: "Invitation cancelled" }); refetchCollaborators(); },
  });

  const resendInviteMutation = useMutation({
    mutationFn: (inviteId: number) => apiRequest("POST", `/api/voyages/${voyageId}/invitations/${inviteId}/resend`, {}),
    onSuccess: () => { toast({ title: "Invitation resent" }); refetchCollaborators(); },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: (participantId: number) => apiRequest("DELETE", `/api/voyages/${voyageId}/participants/${participantId}`, {}),
    onSuccess: () => { toast({ title: "Participant removed" }); refetchCollaborators(); },
  });

  const sendBulkInviteMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/voyages/${voyageId}/invite-bulk`, data),
    onSuccess: (res: any) => {
      res.json().then((d: any) => toast({ title: `${d.sent} invitation${d.sent !== 1 ? "s" : ""} sent` }));
      refetchCollaborators();
      setShowInviteDialog(false);
      setBulkEmails("");
    },
    onError: () => toast({ title: "Bulk invite failed", variant: "destructive" }),
  });

  const { data: directoryResults = [] } = useQuery<any[]>({
    queryKey: ["/api/directory", directorySearch],
    queryFn: () => fetch(`/api/directory?search=${encodeURIComponent(directorySearch)}&limit=8`, { credentials: "include" }).then(r => r.json()),
    enabled: directorySearch.length >= 2,
  });

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

  function formatActivityTime(dt: string | Date): string {
    const d = new Date(dt);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    if (isToday)     return `Today, ${time}`;
    if (isYesterday) return `Yesterday, ${time}`;
    return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}, ${time}`;
  }

  function getActivityStyle(type: string): { bg: string; text: string; emoji: string; isSystem: boolean } {
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
      nor_tendered:           { bg: "bg-amber-500/20",   text: "text-amber-400",   emoji: "📋" },
      nor_accepted:           { bg: "bg-green-500/20",   text: "text-green-400",   emoji: "✅" },
    };
    const base = map[type] || { bg: "bg-slate-500/20", text: "text-slate-400", emoji: "📌" };
    return { ...base, isSystem: type !== "custom_note" };
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

      {/* ── HEADER CARD ─────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden border-border bg-card" data-testid="voyage-header-card">

        {/* ── ROW 1: Temel Bilgiler ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap px-5 pt-5 pb-4">

          {/* Sol: ship icon + vessel name + purpose pill */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Ship className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight">
                {voyage.vesselName || "Vessel Not Specified"}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 bg-muted/40 px-2 py-0.5 rounded-full border border-border/50">
                  {voyage.purposeOfCall}
                </span>
              </div>
            </div>
          </div>

          {/* Sağ: status badge + butonlar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status badge */}
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${
              voyage.status === "active"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                : voyage.status === "planned"
                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                : voyage.status === "completed"
                ? "bg-muted/40 text-muted-foreground border-border"
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`} data-testid="badge-voyage-status">
              <StatusIcon className="w-3.5 h-3.5" />
              {s.label}
              {voyage.status === "active" && (
                <span className="relative flex h-1.5 w-1.5 ml-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
              )}
            </span>

            {/* Rate button */}
            {canReview && (
              <Button size="sm" variant="outline" className="gap-1.5 h-8"
                onClick={() => setShowReviewDialog(true)} data-testid="button-review">
                <Star className="w-3.5 h-3.5" /> Rate
              </Button>
            )}
            {reviewData?.myReview && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Rated
              </span>
            )}

            {/* Change Status dropdown */}
            {isOwner && transitions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1" data-testid="button-change-status">
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
                        onClick={() =>
                          (t === "completed" || t === "cancelled")
                            ? setPendingStatus(t)
                            : statusMutation.mutate(t)
                        }
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

        {/* ── ROW 2: Port Call Stepper ──────────────────────────────────────── */}
        <div className="px-5 py-4 border-t border-b border-border/50 bg-muted/20" data-testid="port-call-stepper">
          {(() => {
            const activeIdx = getStepperIndex(voyage.status);
            return (
              <div className="flex items-start gap-0">
                {PORT_CALL_STEPS.map((step, idx) => {
                  const StepIcon = step.icon;
                  const isPast   = activeIdx >= 0 && idx < activeIdx;
                  const isActive = activeIdx >= 0 && idx === activeIdx;
                  const isLast   = idx === PORT_CALL_STEPS.length - 1;

                  return (
                    <div key={step.key} className="flex items-center flex-1 min-w-0">
                      {/* Step node + label */}
                      <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all
                          ${isActive
                            ? "bg-primary border-primary text-primary-foreground shadow-[0_0_14px_rgba(59,130,246,0.45)]"
                            : isPast
                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                            : "bg-muted/30 border-border/50 text-muted-foreground/35"
                          }
                        `}>
                          {isPast
                            ? <CheckCheck className="w-3.5 h-3.5" />
                            : <StepIcon className="w-3.5 h-3.5" />
                          }
                        </div>
                        <span className={`text-[10px] font-semibold text-center whitespace-nowrap ${
                          isActive ? "text-primary"
                          : isPast  ? "text-emerald-400/80"
                          : "text-muted-foreground/35"
                        }`}>
                          {step.label}
                        </span>
                      </div>

                      {/* Connector line */}
                      {!isLast && (
                        <div className={`
                          h-0.5 flex-1 mx-1 mb-5 rounded-full transition-all
                          ${isPast ? "bg-emerald-500/40" : "bg-border/40"}
                        `} />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* ── ROW 3: Kompakt Detay Tag'ları ─────────────────────────────────── */}
        <div className="px-5 py-4 flex flex-wrap items-start gap-3">

          {/* Port Tag */}
          <div className="flex items-center gap-2.5 bg-muted/30 border border-border/60 rounded-xl px-3 py-2.5"
               data-testid="tag-port">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide leading-none mb-0.5">Port</p>
              <p className="text-sm font-bold truncate leading-tight">
                {voyage.portName || `Port #${voyage.portId}`}
              </p>
            </div>
          </div>

          {/* ETA Tag */}
          {voyage.eta && (() => {
            const tag = getDateTag(voyage.eta);
            if (!tag) return null;
            return (
              <div className="flex items-center gap-2.5 bg-muted/30 border border-border/60 rounded-xl px-3 py-2.5"
                   data-testid="tag-eta">
                <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide leading-none mb-0.5">ETA</p>
                  <p className="text-sm font-bold leading-tight">{tag.label}</p>
                  <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full border mt-0.5 leading-none ${tag.color}`}>
                    {tag.relText}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* ETD Tag */}
          {voyage.etd && (() => {
            const tag = getDateTag(voyage.etd);
            if (!tag) return null;
            return (
              <div className="flex items-center gap-2.5 bg-muted/30 border border-border/60 rounded-xl px-3 py-2.5"
                   data-testid="tag-etd">
                <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                  <CalendarClock className="w-3.5 h-3.5 text-orange-400" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide leading-none mb-0.5">ETD</p>
                  <p className="text-sm font-bold leading-tight">{tag.label}</p>
                  <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full border mt-0.5 leading-none ${tag.color}`}>
                    {tag.relText}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Notes chip */}
          {voyage.notes && (
            <div className="flex items-center gap-2.5 bg-muted/30 border border-border/60 rounded-xl px-3 py-2.5 max-w-xs"
                 data-testid="tag-notes">
              <div className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                <Pen className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide leading-none mb-0.5">Notes</p>
                <p className="text-xs text-foreground/80 truncate leading-tight">{voyage.notes}</p>
              </div>
            </div>
          )}
        </div>

      </Card>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl">
        {([
          { key: "operation",   label: "Operation",  icon: ClipboardList },
          { key: "cargo_ops",   label: "Cargo Ops",  icon: Package },
          { key: "activity",    label: "Activity",   icon: Clock },
          { key: "documents",   label: "Documents",  icon: FolderOpen },
          { key: "comms",       label: "Messages",   icon: MessageCircle },
          { key: "financial",   label: "Financial",  icon: DollarSign },
          { key: "participants", label: "Team",      icon: Users2 },
          { key: "contacts",    label: "Contacts",  icon: Mail },
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
          {/* ── MAIN 3-COLUMN GRID ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT: Live Port Call Workflow (col-span-2) */}
            <div className="lg:col-span-2">
              {(() => {
                const portCallStep = (() => {
                  if (voyage.status === "completed") return 8;
                  if (activeNor?.status === "accepted") return 5;
                  if (activeNor?.status === "tendered") return 4;
                  if (voyage.status === "active") return 3;
                  return 2;
                })();

                const berthingDeadline = voyage.eta
                  ? (() => {
                      const d = new Date(new Date(voyage.eta).getTime() + 24 * 60 * 60 * 1000);
                      return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
                    })()
                  : "Tomorrow, 14:30";

                const STEPS = [
                  { id: 1, emoji: "📡", title: "Arrival Declared", text: "Vessel arrival officially declared to Port Authority.", completedBadge: "✅ Arrival Declared (07:00 LT)" },
                  { id: 2, emoji: "🛃", title: "Customs Arrival Control", text: "Customs inward clearance completed.", completedBadge: "✅ Arrival Approved & Customs Cleared (08:15 LT)" },
                  { id: 3, emoji: "⚓", title: "Berthing Clearance", text: "Berthing ordino granted by Harbour Master. Valid for 24h.", completedBadge: null },
                  { id: 4, emoji: "⏱️", title: "NOR Tendered", text: "Notice of Readiness will be tendered.", completedBadge: null },
                  { id: 5, emoji: "🛬", title: "Vessel Berthed", text: "Waiting to be safely moored alongside.", completedBadge: null },
                  { id: 6, emoji: "📋", title: "Survey Controls", text: "Initial draft and bunker surveys.", completedBadge: null },
                  { id: 7, emoji: "🏗️", title: "Cargo Operations", text: "Waiting for survey completion.", completedBadge: null },
                ];

                return (
                  <div className="rounded-xl border border-slate-700 bg-slate-800/40 backdrop-blur-sm p-6 space-y-5" data-testid="card-port-call-workflow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[hsl(var(--maritime-primary)/0.15)] border border-[hsl(var(--maritime-primary)/0.3)] flex items-center justify-center">
                          <Navigation className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                        </div>
                        <div>
                          <h2 className="font-bold text-sm text-slate-50">Live Port Call Workflow</h2>
                          <p className="text-xs text-slate-500">{voyage.portName || "Port"} · Active Operation</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-700 rounded-full px-3 py-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-xs font-semibold text-slate-300">Step {Math.min(portCallStep, 7)} of 7</span>
                      </div>
                    </div>

                    <div className="space-y-0">
                      {STEPS.map((step, idx) => {
                        const isDone = portCallStep > step.id;
                        const isActive = portCallStep === step.id;
                        const isLast = idx === STEPS.length - 1;
                        return (
                          <div key={step.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                                isDone ? "bg-emerald-500/20 border-2 border-emerald-500/60" :
                                isActive ? "bg-amber-500/20 border-2 border-amber-500 animate-pulse" :
                                "bg-slate-700/60 border-2 border-slate-600/40"
                              }`}>
                                {isDone
                                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                  : <span className={`text-base ${isActive ? "text-amber-300" : "text-slate-500"}`}>{step.emoji}</span>
                                }
                              </div>
                              {!isLast && (
                                <div className={`w-0.5 flex-1 mt-1 mb-1 min-h-[20px] rounded-full ${isDone ? "bg-emerald-500/30" : "bg-slate-700/40"}`} />
                              )}
                            </div>
                            <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-5"}`}>
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span className={`text-sm font-semibold ${isDone ? "text-slate-400" : isActive ? "text-slate-50" : "text-slate-500"}`}>{step.title}</span>
                                {isDone && step.id <= 2 && (
                                  <span className="text-[10px] text-slate-500">{step.id === 1 ? "07:00 LT" : "08:15 LT"}</span>
                                )}
                              </div>
                              <p className={`text-xs leading-relaxed ${isDone ? "text-slate-600" : isActive ? "text-slate-400" : "text-slate-600"}`}>{step.text}</p>
                              {isDone && step.completedBadge && (
                                <div className="mt-1.5 inline-flex items-center gap-1 bg-emerald-950/40 border border-emerald-800/30 rounded-md px-2 py-0.5">
                                  <span className="text-[10px] text-emerald-400 font-medium">{step.completedBadge}</span>
                                </div>
                              )}
                              {isActive && step.id === 3 && (
                                <div className="mt-2 flex items-start gap-2 bg-amber-900/30 border border-amber-500/40 rounded-lg p-2.5">
                                  <span className="text-base leading-none mt-0.5">⏳</span>
                                  <div>
                                    <p className="text-xs font-bold text-amber-300 uppercase tracking-wide">Strict Deadline</p>
                                    <p className="text-xs text-amber-200/80 mt-0.5">Must berth before <span className="font-semibold">{berthingDeadline}</span><span className="text-amber-400/70 ml-1">(18h remaining)</span></p>
                                  </div>
                                </div>
                              )}
                              {isActive && step.id === 4 && !activeNor && (
                                <div className="mt-2">
                                  <Link href={`/nor?voyageId=${voyageId}`}>
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-amber-500/40 text-amber-300 hover:bg-amber-900/30">
                                      <Plus className="w-3 h-3" /> Tender NOR Now
                                    </Button>
                                  </Link>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* RIGHT: Supporting Modules (col-span-1) */}
            <div className="flex flex-col gap-6">
              {/* Voyage Team */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-sm flex items-center gap-2">
                    <Users2 className="w-4 h-4 text-sky-400" />
                    Voyage Team
                    <span className="text-xs text-muted-foreground">({participants.length + 1})</span>
                  </h3>
                  {(isOwner || isAgent) && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setActiveTab("participants")}>
                      <UserPlus className="w-3 h-3 mr-1" /> Invite
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {voyage && (
                    <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
                      <div className="w-5 h-5 rounded-full bg-amber-600 flex items-center justify-center text-[10px] font-bold text-white">
                        {voyage.ownerFirstName?.[0] ?? "O"}
                      </div>
                      <span className="text-xs font-medium">{`${voyage.ownerFirstName ?? ""} ${voyage.ownerLastName ?? ""}`.trim() || "Owner"}</span>
                      <span className="text-[10px] text-amber-400/70">Owner</span>
                    </div>
                  )}
                  {participants.slice(0, 5).map((p: any) => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-muted/40 rounded-full px-3 py-1 border border-border/50">
                      <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                        {p.firstName?.[0] ?? p.inviteeEmail?.[0] ?? "?"}
                      </div>
                      <span className="text-xs font-medium">{`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.email || "—"}</span>
                      <span className="text-[10px] text-muted-foreground capitalize">{p.role}</span>
                    </div>
                  ))}
                  {participants.length > 5 && (
                    <button onClick={() => setActiveTab("participants")} className="text-xs text-sky-400 hover:underline">
                      +{participants.length - 5} more
                    </button>
                  )}
                  {participants.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No participants yet. Invite agents, providers or surveyors.</p>
                  )}
                </div>
              </Card>

              {/* Service Requests */}
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

              {/* NOR Card */}
              <Card className="p-5 space-y-3" data-testid="card-nor-status">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                    <h2 className="font-semibold text-sm">Notice of Readiness</h2>
                  </div>
                  {!activeNor ? (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" asChild>
                      <Link href={`/nor?voyageId=${voyageId}`}>
                        <Plus className="w-3 h-3" /> Create NOR
                      </Link>
                    </Button>
                  ) : (
                    <Link href={`/nor/${activeNor.id}`}>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">View NOR →</Button>
                    </Link>
                  )}
                </div>
                {!activeNor ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No Notice of Readiness created for this voyage yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Status</span>
                      <Badge className={
                        activeNor.status === "accepted" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                        activeNor.status === "tendered" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                        activeNor.status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                        "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      }>{activeNor.status}</Badge>
                    </div>
                    {activeNor.norTenderedAt && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Tendered</span>
                        <span>{new Date(activeNor.norTenderedAt).toLocaleString("en-GB")}</span>
                      </div>
                    )}
                    {activeNor.laytimeStartsAt && (
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-muted-foreground">Laytime Starts</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {new Date(activeNor.laytimeStartsAt).toLocaleString("en-GB")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* SOF Card */}
          <Card className="p-5 space-y-3" data-testid="card-sof-status">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                <h2 className="font-semibold text-sm">Statement of Facts</h2>
              </div>
              {!activeSof ? (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" asChild>
                  <Link href={`/sof?voyageId=${voyageId}`}>
                    <Plus className="w-3 h-3" /> Create SOF
                  </Link>
                </Button>
              ) : (
                <Link href={`/sof/${activeSof.id}`}>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">View SOF →</Button>
                </Link>
              )}
            </div>
            {!activeSof ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                No Statement of Facts created for this voyage yet.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={
                    activeSof.status === "final" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                    activeSof.status === "draft" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }>{activeSof.status}</Badge>
                </div>
                {activeSof.vesselName && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Vessel</span>
                    <span>{activeSof.vesselName}</span>
                  </div>
                )}
              </div>
            )}
          </Card>

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

      {/* ── Tab: Cargo Ops ─────────────────────────────────────── */}
      {activeTab === "cargo_ops" && (() => {
        const totalMt = (voyage as any)?.cargoTotalMt ?? 0;
        const handledMt = cargoLogs.reduce((sum: number, l: any) => sum + (l.amountHandled || 0), 0);
        const remainingMt = Math.max(0, totalMt - handledMt);
        const progressPct = totalMt > 0 ? Math.min(100, Math.round((handledMt / totalMt) * 100)) : 0;
        const totalLogged = cargoLogs.reduce((s: number, l: any) => {
          if (!l.fromTime || !l.toTime) return s;
          const hours = (new Date(l.toTime).getTime() - new Date(l.fromTime).getTime()) / 3_600_000;
          return s + hours;
        }, 0);
        const avgRate = totalLogged > 0 ? Math.round((handledMt / totalLogged) * 24) : 0;
        const RECEIVER_COLORS = ["from-sky-500 to-blue-400", "from-violet-500 to-purple-400", "from-emerald-500 to-teal-400", "from-orange-500 to-amber-400", "from-rose-500 to-pink-400"];
        const BADGE_COLORS = [
          "bg-sky-500/15 text-sky-400 border-sky-500/25",
          "bg-violet-500/15 text-violet-400 border-violet-500/25",
          "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
          "bg-orange-500/15 text-orange-400 border-orange-500/25",
          "bg-rose-500/15 text-rose-400 border-rose-500/25",
        ];
        const receiverIndexMap: Record<number, number> = Object.fromEntries(receivers.map((r: any, i: number) => [r.id, i]));

        // ETC as timestamp for time + countdown
        const etcTs = avgRate > 0 && remainingMt > 0
          ? new Date(Date.now() + (remainingMt / avgRate) * 86_400_000)
          : null;
        const etcFormatted = etcTs
          ? etcTs.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
          : null;
        const etcTime = etcTs
          ? etcTs.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
          : null;
        const etcCountdown = (() => {
          if (!etcTs) return null;
          const diffMs = etcTs.getTime() - Date.now();
          if (diffMs <= 0) return "imminent";
          const totalMins = Math.round(diffMs / 60_000);
          const h = Math.floor(totalMins / 60);
          const m = totalMins % 60;
          return h > 0 ? `in ~${h}h ${m}m` : `in ~${m}m`;
        })();

        // Group logs by batchId for table display
        const batchMap = new Map<string, any[]>();
        cargoLogs.forEach((log: any) => {
          const key = log.batchId || String(log.id);
          if (!batchMap.has(key)) batchMap.set(key, []);
          batchMap.get(key)!.push(log);
        });
        const groupedLogs = Array.from(batchMap.values());

        // Active receivers from last batch
        const lastBatch = groupedLogs.length > 0 ? groupedLogs[groupedLogs.length - 1] : null;
        const activeReceiverNames = lastBatch
          ? lastBatch
              .filter((l: any) => l.receiverId && l.logType !== "delay")
              .map((l: any) => receivers.find((r: any) => r.id === l.receiverId)?.name)
              .filter(Boolean)
              .join(" & ") || null
          : null;
        const lastBatchFromTime = lastBatch?.[0]?.fromTime ?? null;

        return (
          <div className="space-y-5" data-testid="tab-content-cargo-ops">

            {/* ── Dashboard Card ─────────────────── */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-[hsl(var(--maritime-primary))]" /> Cargo Operations
                </h2>
                {totalMt === 0 && (
                  <span className="text-xs text-amber-400">Set total cargo below to begin tracking</span>
                )}
              </div>

              {/* Active Status Banner */}
              {lastBatch && (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-green-500/40 bg-green-500/[0.08]">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                  <span className="text-xs font-bold text-green-400 uppercase tracking-widest">
                    Currently {voyage?.purposeOfCall ?? "Operating"}
                    {activeReceiverNames ? `: ${activeReceiverNames}` : ""}
                  </span>
                  {lastBatchFromTime && (
                    <span className="ml-auto text-[10px] text-green-400/60 whitespace-nowrap">
                      Since {new Date(lastBatchFromTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              )}

              {/* Stat row */}
              <div className="flex flex-wrap items-baseline gap-6 text-sm">
                <span>Total: <strong>{totalMt.toLocaleString()} MT</strong></span>
                <span>Handled: <strong className="text-green-400">{handledMt.toLocaleString()} MT ({progressPct}%)</strong></span>
                <span>Remaining: <strong className="text-amber-400">{remainingMt.toLocaleString()} MT</strong></span>
              </div>

              {/* Main Progress bar */}
              <div className="h-4 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* ── Receivers / Cargo Parcels ──────── */}
              <div className="space-y-2 border-t border-border/40 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Cargo Parcels / Receivers</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 px-2"
                    onClick={() => setShowAddReceiverDialog(true)} data-testid="button-add-receiver">
                    <Plus className="w-3 h-3" /> Add Receiver
                  </Button>
                </div>
                {receivers.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No receivers yet — add cargo parcels to track per-receiver progress.</p>
                ) : (
                  <div className="space-y-2.5">
                    {receivers.map((r: any, idx: number) => {
                      const rHandled = cargoLogs.filter((l: any) => l.receiverId === r.id).reduce((s: number, l: any) => s + (l.amountHandled || 0), 0);
                      const rPct = r.allocatedMt > 0 ? Math.min(100, Math.round((rHandled / r.allocatedMt) * 100)) : 0;
                      const color = RECEIVER_COLORS[idx % RECEIVER_COLORS.length];
                      const rRemaining = Math.max(0, r.allocatedMt - rHandled);
                      const rEtcTs = avgRate > 0 && rRemaining > 0
                        ? new Date(Date.now() + (rRemaining / avgRate) * 86_400_000)
                        : null;
                      const rEtcStr = rEtcTs
                        ? rEtcTs.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " " +
                          rEtcTs.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                        : null;
                      return (
                        <div key={r.id} className="space-y-1" data-testid={`receiver-row-${r.id}`}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{r.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground tabular-nums">
                                {rHandled.toLocaleString()} / {r.allocatedMt.toLocaleString()} MT
                              </span>
                              <span className={`font-semibold tabular-nums ${rPct >= 100 ? "text-green-400" : "text-sky-400"}`}>
                                ({rPct}%)
                              </span>
                              <button
                                onClick={() => deleteReceiverMutation.mutate(r.id)}
                                className="text-muted-foreground/50 hover:text-destructive transition-colors"
                                data-testid={`button-delete-receiver-${r.id}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="h-2 rounded-full bg-slate-800 border border-slate-700/50 overflow-hidden">
                            <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
                              style={{ width: `${rPct}%` }} />
                          </div>
                          {rEtcStr && rPct < 100 && (
                            <p className="text-[10px] text-muted-foreground/60">Est: {rEtcStr}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Set total input */}
              <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                <span className="text-xs text-muted-foreground">Set Total Cargo:</span>
                <Input
                  type="number" min={0}
                  className="h-7 w-32 text-xs"
                  defaultValue={totalMt > 0 ? totalMt : ""}
                  placeholder="e.g. 60000"
                  onBlur={e => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) apiRequest("PATCH", `/api/voyages/${voyageId}/cargo-total`, { cargoTotalMt: v })
                      .then(() => queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId] }));
                  }}
                  data-testid="input-cargo-total-mt"
                />
                <span className="text-xs text-muted-foreground">MT</span>
              </div>
            </Card>

            {/* ── 3 Metric Cards ──────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">Current Rate</p>
                <p className="text-2xl font-bold">{avgRate > 0 ? `${avgRate.toLocaleString()} MT` : "—"}</p>
                <p className="text-xs text-muted-foreground">per day (based on timed periods)</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-1.5">
                <p className="text-[11px] text-amber-400 font-semibold uppercase tracking-wide">Est. Completion (ETC)</p>
                {etcFormatted ? (
                  <>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-lg font-bold text-amber-300">{etcFormatted}</span>
                      <span className="text-xl font-extrabold text-amber-200 tabular-nums">{etcTime}</span>
                    </div>
                    {etcCountdown && (
                      <p className="text-xs font-semibold text-amber-400/80">{etcCountdown}</p>
                    )}
                  </>
                ) : (
                  <p className="text-2xl font-bold text-amber-300">—</p>
                )}
                <p className="text-xs text-muted-foreground">based on current avg rate</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-4 space-y-1">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">Operation Type</p>
                <div className="pt-1">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${
                    voyage?.purposeOfCall === "Loading"
                      ? "bg-green-500/15 text-green-400 border-green-500/25"
                      : voyage?.purposeOfCall === "Discharging"
                      ? "bg-orange-500/15 text-orange-400 border-orange-500/25"
                      : "bg-slate-500/15 text-slate-400 border-slate-500/25"
                  }`}>
                    {voyage?.purposeOfCall ?? "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Operation Logs ───────────────────── */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[hsl(var(--maritime-primary))]" /> Operation Logs
                </h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowCargoReportDialog(true)} data-testid="button-send-cargo-report">
                    <Mail className="w-3.5 h-3.5 mr-1" /> Send Report
                  </Button>
                  <Button size="sm" onClick={() => setShowAddLogDialog(true)} data-testid="button-add-cargo-log">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Log
                  </Button>
                </div>
              </div>

              {groupedLogs.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No logs yet. Add an operation log to start tracking cargo progress.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-xs text-muted-foreground">
                        <th className="text-left py-2 pr-4 font-semibold whitespace-nowrap">Period (From → To)</th>
                        <th className="text-left py-2 pr-4 font-semibold">Receiver</th>
                        <th className="text-right py-2 pr-4 font-semibold whitespace-nowrap">Handled (MT & Trucks)</th>
                        <th className="text-right py-2 pr-4 font-semibold whitespace-nowrap">Period Rate</th>
                        <th className="text-right py-2 pr-4 font-semibold whitespace-nowrap">Cumulative</th>
                        <th className="text-left py-2 pr-4 font-semibold">Remarks</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {groupedLogs.map((batch: any[], batchIdx: number) => {
                        const rep = batch[0];
                        const isDelay = rep.logType === "delay";
                        const isTruckWait = isDelay && (rep.remarks || "").toLowerCase().includes("waiting_for_trucks");
                        const fmtDT = (dt: string) => new Date(dt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " " + new Date(dt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                        const fmtTime = (dt: string) => new Date(dt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                        const batchMt = batch.reduce((s: number, l: any) => s + (l.amountHandled || 0), 0);
                        const batchTrucks = batch.reduce((s: number, l: any) => s + (l.truckCount || 0), 0);
                        const logHours = rep.fromTime && rep.toTime
                          ? (new Date(rep.toTime).getTime() - new Date(rep.fromTime).getTime()) / 3_600_000
                          : 0;
                        const batchRate = logHours > 0 && batchMt > 0 ? parseFloat((batchMt / logHours).toFixed(1)) : null;
                        const prevBatch = batchIdx > 0 ? groupedLogs[batchIdx - 1] : null;
                        const prevMt = prevBatch ? prevBatch.reduce((s: number, l: any) => s + (l.amountHandled || 0), 0) : 0;
                        const prevHours = prevBatch?.[0]?.fromTime && prevBatch?.[0]?.toTime
                          ? (new Date(prevBatch[0].toTime).getTime() - new Date(prevBatch[0].fromTime).getTime()) / 3_600_000
                          : 0;
                        const prevRate = prevHours > 0 && prevMt > 0 ? parseFloat((prevMt / prevHours).toFixed(1)) : 0;
                        const rateTrend = batchRate && prevRate > 0
                          ? (batchRate > prevRate ? "up" : batchRate < prevRate ? "down" : "flat")
                          : null;
                        const periodLabel = rep.fromTime && rep.toTime
                          ? `${fmtDT(rep.fromTime)} → ${fmtTime(rep.toTime)}`
                          : rep.logDate
                          ? new Date(rep.logDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                          : "—";
                        const batchKey = rep.batchId || String(rep.id);

                        let rowBg = "hover:bg-muted/20";
                        if (isTruckWait) rowBg = "bg-amber-900/20 hover:bg-amber-900/30";
                        else if (isDelay) rowBg = "bg-red-900/20 hover:bg-red-900/30";

                        return (
                          <tr key={batchKey}
                            className={`transition-colors ${rowBg}`}
                            data-testid={`row-cargo-batch-${batchKey}`}>
                            <td className="py-2.5 pr-4 text-xs whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                {isTruckWait && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                                {isDelay && !isTruckWait && <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                                <span>{periodLabel}</span>
                              </div>
                            </td>
                            <td className="py-2.5 pr-4">
                              {isDelay ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {batch.filter((l: any) => l.receiverId).map((l: any) => {
                                    const rName = receivers.find((r: any) => r.id === l.receiverId)?.name;
                                    const rIdx = receiverIndexMap[l.receiverId] ?? 0;
                                    const bc = BADGE_COLORS[rIdx % BADGE_COLORS.length];
                                    return rName ? (
                                      <span key={l.id} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${bc}`}>
                                        {rName}
                                      </span>
                                    ) : null;
                                  })}
                                  {batch.every((l: any) => !l.receiverId) && (
                                    <span className="text-xs text-muted-foreground">General</span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="text-right py-2.5 pr-4 font-mono font-semibold whitespace-nowrap">
                              {isDelay ? (
                                <span className={`text-xs font-semibold ${isTruckWait ? "text-amber-400" : "text-red-400"}`}>
                                  {rep.remarks?.replace("waiting_for_trucks", "Waiting for Trucks") || "Stoppage"}
                                </span>
                              ) : (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="text-green-400">{batchMt.toLocaleString()} MT</span>
                                  {batchTrucks > 0 && (
                                    <span className="text-[10px] text-muted-foreground font-normal">({batchTrucks} Trucks)</span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="text-right py-2.5 pr-4 font-mono text-xs whitespace-nowrap">
                              {batchRate && !isDelay ? (
                                <span className={`flex items-center justify-end gap-1 ${rateTrend === "up" ? "text-green-400" : rateTrend === "down" ? "text-red-400" : "text-sky-300"}`}>
                                  {rateTrend === "up" && <TrendingUp className="w-3 h-3" />}
                                  {rateTrend === "down" && <TrendingDown className="w-3 h-3" />}
                                  {batchRate.toLocaleString()} MT/H
                                </span>
                              ) : "—"}
                            </td>
                            <td className="text-right py-2.5 pr-4 font-mono text-muted-foreground text-xs">
                              {rep.cumulativeTotal ? rep.cumulativeTotal.toLocaleString() : "—"}
                            </td>
                            <td className="py-2.5 pr-4 text-muted-foreground text-xs max-w-[140px] truncate">
                              {isDelay ? "" : (rep.remarks || "—")}
                            </td>
                            <td className="py-2.5 text-right">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => rep.batchId
                                  ? deleteBatchMutation.mutate(rep.batchId)
                                  : deleteCargoLogMutation.mutate(rep.id)}
                                data-testid={`button-delete-batch-${batchKey}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* ── Add Operation Log Dialog ─────────── */}
            {(() => {
              const periodHours = logForm.fromTime && logForm.toTime
                ? (new Date(logForm.toTime).getTime() - new Date(logForm.fromTime).getTime()) / 3_600_000
                : 0;
              const totalEntryMt = Object.values(logForm.receiverEntries).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
              const modalRate = periodHours > 0 && totalEntryMt > 0
                ? parseFloat((totalEntryMt / periodHours).toFixed(1))
                : 0;
              const canSubmit = !!logForm.fromTime && !!logForm.toTime &&
                (logForm.logType === "operation"
                  ? totalEntryMt > 0
                  : !!logForm.delayReason);

              return (
                <Dialog open={showAddLogDialog} onOpenChange={v => {
                  setShowAddLogDialog(v);
                  if (!v) setLogForm({ fromTime: "", toTime: "", logType: "operation", remarks: "", delayReason: "", delayNotes: "", receiverEntries: {} });
                }}>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Add Operation Log</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">

                      {/* Log Type */}
                      <div>
                        <Label className="text-xs">Log Type</Label>
                        <Select value={logForm.logType} onValueChange={v => setLogForm(f => ({ ...f, logType: v }))}>
                          <SelectTrigger className="h-9 text-xs" data-testid="select-log-type"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="operation">Operation (Cargo Handling)</SelectItem>
                            <SelectItem value="delay">Delay / Stoppage</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* From / To */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">From *</Label>
                          <Input type="datetime-local" value={logForm.fromTime}
                            onChange={e => setLogForm(f => ({ ...f, fromTime: e.target.value }))}
                            className="text-xs h-9" data-testid="input-log-from-time" />
                        </div>
                        <div>
                          <Label className="text-xs">To *</Label>
                          <Input type="datetime-local" value={logForm.toTime}
                            onChange={e => setLogForm(f => ({ ...f, toTime: e.target.value }))}
                            className="text-xs h-9" data-testid="input-log-to-time" />
                        </div>
                      </div>

                      {/* ── OPERATION MODE: multi-receiver grid ─────────── */}
                      {logForm.logType === "operation" && (
                        <div className="space-y-2">
                          <Label className="text-xs">Cargo Delivered by Receiver</Label>
                          {receivers.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic py-2">No receivers configured — add cargo parcels first.</p>
                          ) : (
                            <div className="rounded-lg border border-border/60 divide-y divide-border/40 overflow-hidden">
                              {/* Header row */}
                              <div className="grid grid-cols-[1fr_120px_100px] gap-2 px-3 py-1.5 bg-muted/30 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                                <span>Receiver</span>
                                <span className="text-right">Amount (MT)</span>
                                <span className="text-right">Trucks #</span>
                              </div>
                              {receivers.map((r: any, rIdx: number) => {
                                const entry = logForm.receiverEntries[r.id] || { amount: "", trucks: "" };
                                const truckNum = parseInt(entry.trucks) || 0;
                                const truckEst = truckNum > 0 ? truckNum * 24 : 0;
                                const rColor = BADGE_COLORS[rIdx % BADGE_COLORS.length];
                                return (
                                  <div key={r.id} className="grid grid-cols-[1fr_120px_100px] gap-2 px-3 py-2 items-start">
                                    <div className="pt-1.5">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${rColor}`}>
                                        {r.name}
                                      </span>
                                      <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                                        Alloc: {r.allocatedMt.toLocaleString()} MT
                                      </div>
                                    </div>
                                    <div>
                                      <Input
                                        type="number" min={0} placeholder="0"
                                        value={entry.amount}
                                        onChange={e => setLogForm(f => ({
                                          ...f,
                                          receiverEntries: { ...f.receiverEntries, [r.id]: { ...entry, amount: e.target.value } }
                                        }))}
                                        className="h-8 text-xs text-right"
                                        data-testid={`input-receiver-amount-${r.id}`}
                                      />
                                    </div>
                                    <div>
                                      <Input
                                        type="number" min={0} placeholder="—"
                                        value={entry.trucks}
                                        onChange={e => setLogForm(f => ({
                                          ...f,
                                          receiverEntries: { ...f.receiverEntries, [r.id]: { ...entry, trucks: e.target.value } }
                                        }))}
                                        className="h-8 text-xs text-right"
                                        data-testid={`input-receiver-trucks-${r.id}`}
                                      />
                                      {truckEst > 0 && (
                                        <p className="text-[10px] text-muted-foreground/60 text-right mt-0.5">Est: ~{truckEst} MT</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {modalRate > 0 && (
                            <p className="text-xs text-amber-400 font-medium">
                              ✨ Period rate: {modalRate.toLocaleString()} MT/H ({totalEntryMt.toLocaleString()} MT total)
                            </p>
                          )}
                        </div>
                      )}

                      {/* ── DELAY MODE: reason dropdown + notes ─────────── */}
                      {logForm.logType === "delay" && (
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">Delay Reason *</Label>
                            <Select value={logForm.delayReason} onValueChange={v => setLogForm(f => ({ ...f, delayReason: v }))}>
                              <SelectTrigger
                                className={`h-9 text-xs ${logForm.delayReason === "waiting_for_trucks" ? "border-amber-500/60 ring-1 ring-amber-500/30" : ""}`}
                                data-testid="select-delay-reason"
                              >
                                <SelectValue placeholder="Select reason..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="waiting_for_trucks">
                                  ⚠ Waiting for Trucks / Tankers
                                </SelectItem>
                                <SelectItem value="Rain / Weather">Rain / Weather</SelectItem>
                                <SelectItem value="Equipment Breakdown">Equipment Breakdown</SelectItem>
                                <SelectItem value="Shift Change">Shift Change</SelectItem>
                                <SelectItem value="Customs / Inspection">Customs / Inspection</SelectItem>
                                <SelectItem value="Hatch Shifting">Hatch Shifting</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            {logForm.delayReason === "waiting_for_trucks" && (
                              <p className="text-[11px] text-amber-400 mt-1.5 font-medium">
                                ⚠ This stoppage will be highlighted in the log table.
                              </p>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs">Additional Notes (optional)</Label>
                            <Textarea
                              value={logForm.delayNotes}
                              onChange={e => setLogForm(f => ({ ...f, delayNotes: e.target.value }))}
                              placeholder="e.g. 15 trucks pending at gate..." rows={2}
                              data-testid="input-delay-notes"
                            />
                          </div>
                        </div>
                      )}

                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAddLogDialog(false)}>Cancel</Button>
                      <Button
                        onClick={() => addCargoLogMutation.mutate()}
                        disabled={!canSubmit || addCargoLogMutation.isPending}
                        data-testid="button-save-cargo-log"
                      >
                        {addCargoLogMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Save Log
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              );
            })()}

            {/* ── Send Cargo Report Dialog ─────────── */}
            {(() => {
              const autoContacts = voyageContactsList.filter((c: any) =>
                ["owner", "charterer", "receiver"].includes(c.role) && c.includeInDailyReports
              );
              const manualEmailValid = reportManualEmail.includes("@");
              const finalEmails = [
                ...reportSelectedEmails,
                ...(manualEmailValid ? [reportManualEmail.trim().toLowerCase()] : []),
              ].filter((e, i, arr) => arr.indexOf(e) === i);

              return (
                <Dialog open={showCargoReportDialog} onOpenChange={open => {
                  setShowCargoReportDialog(open);
                  if (open) {
                    setReportSelectedEmails(autoContacts.map((c: any) => c.email));
                    setReportManualEmail("");
                  }
                }}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Mail className="w-4 h-4" /> Send Cargo Report
                      </DialogTitle>
                      <DialogDescription>
                        A live cargo operations summary will be emailed to selected recipients.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-1">
                      {/* Auto-suggested recipients */}
                      {autoContacts.length > 0 ? (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Recipients from Contacts (Owner / Charterer / Receiver):</p>
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {autoContacts.map((c: any) => {
                              const ROLE_LABEL: Record<string, string> = { owner: "Owner", charterer: "Charterer", receiver: "Receiver" };
                              const isChecked = reportSelectedEmails.includes(c.email);
                              return (
                                <label key={c.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${isChecked ? "border-sky-500/50 bg-sky-500/5" : "border-muted bg-muted/20"}`} data-testid={`label-recipient-${c.id}`}>
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={checked => {
                                      setReportSelectedEmails(prev =>
                                        checked ? [...prev, c.email] : prev.filter(e => e !== c.email)
                                      );
                                    }}
                                    data-testid={`checkbox-recipient-${c.id}`}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{c.email}</p>
                                    {c.name && <p className="text-xs text-muted-foreground truncate">{c.name}</p>}
                                  </div>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground border shrink-0">
                                    {ROLE_LABEL[c.role] ?? c.role}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-xs">
                          <Mail className="w-5 h-5 mx-auto mb-1.5 opacity-30" />
                          No Owner / Charterer / Receiver contacts with Daily Reports enabled.{" "}
                          <button className="text-sky-400 underline underline-offset-2" onClick={() => { setShowCargoReportDialog(false); setActiveTab("contacts"); }}>
                            Go to Contacts
                          </button>
                        </div>
                      )}

                      {/* Manual email addition */}
                      <div>
                        <Label className="text-xs">Add Another Recipient (optional)</Label>
                        <Input
                          type="email"
                          value={reportManualEmail}
                          onChange={e => setReportManualEmail(e.target.value)}
                          placeholder="additional@example.com"
                          className="mt-1"
                          data-testid="input-report-email"
                        />
                      </div>

                      {/* Summary */}
                      {finalEmails.length > 0 && (
                        <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-3 text-xs text-sky-300">
                          <p className="font-semibold mb-1">Report will be sent to {finalEmails.length} address{finalEmails.length > 1 ? "es" : ""}:</p>
                          <ul className="list-disc list-inside space-y-0.5 text-sky-400/80">
                            {finalEmails.map(e => <li key={e}>{e}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCargoReportDialog(false)}>Cancel</Button>
                      <Button
                        onClick={() => sendCargoReportMutation.mutate(finalEmails)}
                        disabled={finalEmails.length === 0 || sendCargoReportMutation.isPending}
                        data-testid="button-confirm-send-report"
                      >
                        {sendCargoReportMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Send to {finalEmails.length} Recipient{finalEmails.length !== 1 ? "s" : ""}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              );
            })()}

            {/* ── Add Receiver Dialog ───────────────── */}
            <Dialog open={showAddReceiverDialog} onOpenChange={v => { setShowAddReceiverDialog(v); if (!v) setReceiverForm({ name: "", allocatedMt: 0 }); }}>
              <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle>Add Cargo Receiver</DialogTitle></DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label className="text-xs">Receiver / Parcel Name *</Label>
                    <Input placeholder="e.g. IFFCO" value={receiverForm.name}
                      onChange={e => setReceiverForm(f => ({ ...f, name: e.target.value }))}
                      data-testid="input-receiver-name" />
                  </div>
                  <div>
                    <Label className="text-xs">Allocated MT *</Label>
                    <Input type="number" min={0} placeholder="e.g. 30000"
                      value={receiverForm.allocatedMt || ""}
                      onChange={e => setReceiverForm(f => ({ ...f, allocatedMt: parseFloat(e.target.value) || 0 }))}
                      data-testid="input-receiver-allocated-mt" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddReceiverDialog(false)}>Cancel</Button>
                  <Button
                    onClick={() => addReceiverMutation.mutate()}
                    disabled={!receiverForm.name || !receiverForm.allocatedMt || addReceiverMutation.isPending}
                    data-testid="button-save-receiver"
                  >
                    {addReceiverMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Add Receiver
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        );
      })()}

      {/* ── Tab: Dokümanlar ────────────────────────────────────── */}
      {activeTab === "documents" && (
        <div className="space-y-6">

          {/* ── Existing Document Management ── */}
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
                {Array.isArray(docs) && docs.length > 0 && (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={handleDownloadAllZip} data-testid="button-download-all-zip">
                    <Archive className="w-3 h-3" /> Download All
                  </Button>
                )}
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

          {/* ── Port Formalities Auto-Generator ── */}
          {(() => {
        const PORT_TEMPLATES = [
          { id: "police_arrival",    emoji: "🛂", tr: "Emniyet Deniz Limani — GELIS",            en: "Maritime Police — Arrival" },
          { id: "police_departure",  emoji: "🛂", tr: "Emniyet Deniz Limani — GIDIS",            en: "Maritime Police — Departure" },
          { id: "passport_arrival",  emoji: "🪪", tr: "Denizlimani Sube Mdr. — GIRIS",           en: "Port Immigration — Passport Arrival" },
          { id: "tcdd_berth",        emoji: "⚓", tr: "TCDD Izmir — Yanasma Mektubu",            en: "TCDD Berthing Letter" },
          { id: "tcdd_depart",       emoji: "🚢", tr: "TCDD Izmir — Kalkis Mektubu",             en: "TCDD Departure Letter" },
          { id: "kiyi_emniyeti",     emoji: "🛟", tr: "Kiyi Emniyeti — Yanasma/Kalkma Talep",   en: "Coastguard Pilotage/Towage Request" },
          { id: "arrival_decl",      emoji: "📋", tr: "Gelis Bildirim Tutanagi",                 en: "Arrival Declaration (Immigration)" },
          { id: "shore_pass_notif",  emoji: "📝", tr: "Teblig ve Tebellug Belgesi",              en: "Shore Pass Notification Document" },
          { id: "departure_decl",    emoji: "📋", tr: "Gidis Bildirim Tutanagi",                 en: "Departure Declaration (Immigration)" },
          { id: "power_of_attorney", emoji: "🔏", tr: "Hususi Vekaletname",                      en: "Private Power of Attorney" },
          { id: "tcdd_m10",          emoji: "📦", tr: "TCDD M.10 — Yukleme/Bosaltma Talepnamesi",en: "TCDD Cargo Operations Request (M.10)" },
          { id: "tcdd_watch_table",  emoji: "👷", tr: "TCDD Amele Postasi Talep Tablosu",        en: "TCDD Watch/Labour Request Table" },
          { id: "port_arrival",      emoji: "🏛️", tr: "Gemi Gelis Bildirimi — Liman Baskanligi", en: "Vessel Arrival Report — Port Authority" },
          { id: "shore_pass",        emoji: "🆔", tr: "Liman Sehri Gezer Belgesi (Shore Pass)",  en: "Request Shore Pass (Landing Card)" },
        ];

            const generateOnePdf = async (templateId: string) => {
              setLoadingTemplateId(templateId);
              try {
                const resp = await fetch(`/api/voyages/${voyageId}/generate-port-document`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ templateId }),
                });
                if (!resp.ok) throw new Error("PDF generation failed");
                const blob = await resp.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                const tmplName = PORT_TEMPLATES.find(t => t.id === templateId)?.tr || templateId;
                a.href = url;
                a.download = `${templateId}_${(voyage.vesselName || "vessel").replace(/\s+/g, "_")}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "documents"] });
                toast({ title: "PDF Generated", description: `${tmplName} downloaded and saved to Documents.` });
              } catch {
                toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
              } finally {
                setLoadingTemplateId(null);
              }
            };

            const generateAllForms = async () => {
              setIsGeneratingAll(true);
              setGeneratingCount(0);
              for (let i = 0; i < PORT_TEMPLATES.length; i++) {
                setGeneratingCount(i + 1);
                await generateOnePdf(PORT_TEMPLATES[i].id);
                if (i < PORT_TEMPLATES.length - 1) await new Promise(r => setTimeout(r, 400));
              }
              queryClient.invalidateQueries({ queryKey: ["/api/voyages", voyageId, "documents"] });
              toast({ title: "✅ All 14 Forms Generated!", description: "All 14 port documents downloaded and saved." });
              setIsGeneratingAll(false);
              setGeneratingCount(0);
            };

            return (
              <div className="space-y-4" data-testid="section-auto-doc-generator">
                {/* Section header */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base">⚡</span>
                      <h3 className="text-sm font-bold text-slate-100">Port Formalities — Auto-Generate</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 font-medium">5 templates</span>
                    </div>
                    <p className="text-xs text-slate-500 ml-6">Generate official port documents pre-filled with vessel data</p>
                  </div>
                  <Button
                    className="bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/25 gap-2 text-sm font-semibold flex-shrink-0 disabled:opacity-60"
                    onClick={generateAllForms}
                    disabled={isGeneratingAll || loadingTemplateId !== null}
                    data-testid="button-generate-all-forms"
                  >
                    {isGeneratingAll ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating {generatingCount}/14...
                      </>
                    ) : (
                      <>🚀 Generate All (14 Forms)</>
                    )}
                  </Button>
                </div>

                {/* Vessel Context Card */}
                <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4" data-testid="card-vessel-context">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium mb-2">Auto-fill data source</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Vessel", value: voyage.vesselName || "—" },
                      { label: "IMO", value: voyage.imoNumber || "—" },
                      { label: "Port", value: voyage.portName || "—" },
                      { label: "ETA", value: voyage.eta ? new Date(voyage.eta).toLocaleDateString("en-GB") : "—" },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <span className="text-[10px] text-slate-500">{label}</span>
                        <p className="text-sm font-semibold text-slate-200 truncate">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Template Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PORT_TEMPLATES.map((template) => {
                    const isLoading = loadingTemplateId === template.id;
                    return (
                      <div
                        key={template.id}
                        className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-start gap-3 hover:border-slate-600 transition-all"
                        data-testid={`card-template-${template.id}`}
                      >
                        <span className="text-2xl flex-shrink-0 mt-0.5">{template.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-100 leading-tight">{template.tr}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{template.en}</p>
                          <p className="text-[10px] text-slate-500 mt-1.5">Pre-filled with vessel data · Saved to Documents</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-shrink-0 h-8 px-3 gap-1.5 border-slate-600 hover:border-sky-500 hover:text-sky-400 text-slate-300 text-xs disabled:opacity-50"
                          onClick={() => generateOnePdf(template.id)}
                          disabled={isLoading || isGeneratingAll}
                          data-testid={`button-gen-pdf-${template.id}`}
                        >
                          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                          {isLoading ? "..." : "Generate PDF"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        </div>
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
              <Link href={`/proformas/new?voyageId=${voyageId}`}>
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1" data-testid="button-create-pda">
                  <Plus className="w-3 h-3" /> Create PDA
                </Button>
              </Link>
            </div>
            <div className="text-center py-6 text-muted-foreground" data-testid="section-pdas">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Create a Proforma Disbursement Account for this voyage.</p>
              <Link href={`/proformas/new?voyageId=${voyageId}`}>
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
              <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No activity yet. Events will appear here as the voyage progresses.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[1.125rem] top-0 bottom-0 w-px bg-border/40" />
              <div className="space-y-3">
                {activities.map((activity: any) => {
                  const style = getActivityStyle(activity.activityType);
                  const isSystem = style.isSystem;
                  const initials = activity.user
                    ? `${(activity.user.firstName || '')[0] ?? ''}${(activity.user.lastName || '')[0] ?? ''}`.toUpperCase()
                    : '';
                  return (
                    <div key={activity.id} className="relative flex gap-3.5" data-testid={`activity-item-${activity.id}`}>
                      {/* Left icon */}
                      {isSystem ? (
                        <div className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-muted/60 border border-border/50 text-muted-foreground">
                          <Settings className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-blue-500/15 border border-blue-500/25 text-blue-400 text-xs font-bold">
                          {initials || <MessageCircle className="w-3.5 h-3.5" />}
                        </div>
                      )}
                      {/* Content card */}
                      <div className={`flex-1 rounded-xl border px-4 py-3 min-w-0 ${
                        isSystem
                          ? "bg-card border-border/60"
                          : "bg-blue-500/5 border-blue-500/15"
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-sm font-medium leading-snug ${isSystem ? "text-muted-foreground" : "text-foreground"}`}>
                            {isSystem
                              ? `System: ${activity.title}`
                              : `${activity.user?.firstName ?? 'User'} added a note: ${activity.title}`}
                          </span>
                          <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap flex-shrink-0 mt-0.5 tabular-nums">
                            {formatActivityTime(activity.createdAt)}
                          </span>
                        </div>
                        {activity.description && (
                          <p className={`text-xs mt-1.5 leading-relaxed ${isSystem ? "text-muted-foreground/70" : "text-foreground/70"}`}>
                            {activity.description}
                          </p>
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

      {/* ── Tab: Participants / Team ─────────────────────────── */}
      {activeTab === "participants" && (
        <div className="space-y-6" data-testid="tab-content-participants">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Users2 className="w-4 h-4 text-sky-400" /> Voyage Team
              </h3>
              <p className="text-sm text-muted-foreground">{participants.length + 1} member{participants.length !== 0 ? "s" : ""}</p>
            </div>
            {(isOwner || isAgent) && (
              <Button onClick={() => setShowInviteDialog(true)} data-testid="button-invite-participant">
                <UserPlus className="w-4 h-4 mr-2" /> Invite
              </Button>
            )}
          </div>

          {/* Participants Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="participants-grid">
            {/* Owner card */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-sm font-bold text-white uppercase">
                    {voyage?.ownerFirstName?.[0] ?? "O"}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{`${voyage?.ownerFirstName ?? ""} ${voyage?.ownerLastName ?? ""}`.trim() || "Voyage Owner"}</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30">Owner</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Voyage owner</p>
            </div>

            {participants.map((p: any) => {
              const roleColors: Record<string, string> = {
                agent:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
                observer: "bg-violet-500/15 text-violet-400 border-violet-500/30",
                broker:   "bg-teal-500/15 text-teal-400 border-teal-500/30",
                provider: "bg-orange-500/15 text-orange-400 border-orange-500/30",
                surveyor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
              };
              const ROLE_LABELS: Record<string, string> = {
                agent:    "Agent Staff",
                observer: "Shipowner",
                broker:   "Charterer",
                provider: "Provider",
                surveyor: "Surveyor",
              };
              const roleColor = roleColors[p.role] ?? roleColors.observer;
              const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.email || "—";
              const initials = (p.firstName?.[0] ?? p.email?.[0] ?? "?").toUpperCase();
              return (
                <div key={p.id} className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white uppercase">
                        {p.profileImageUrl
                          ? <img src={p.profileImageUrl} alt={name} className="w-10 h-10 rounded-full object-cover" />
                          : initials}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{name}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleColor}`}>{ROLE_LABELS[p.role] ?? p.role}</span>
                      </div>
                    </div>
                    {isOwner && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreVertical className="w-3.5 h-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-destructive" onClick={() => removeParticipantMutation.mutate(p.id)}>
                            Remove from voyage
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  {p.serviceType && <p className="text-xs text-muted-foreground">Service: {p.serviceType}</p>}
                  <p className="text-xs text-muted-foreground">
                    Joined {p.respondedAt ? new Date(p.respondedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                  </p>
                  {p.permissions && (
                    <div className="flex flex-wrap gap-1.5">
                      {p.permissions.canViewDocuments && <span className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground">Docs</span>}
                      {p.permissions.canChat && <span className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground">Chat</span>}
                      {p.permissions.canViewFinancials && <span className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground">Finance</span>}
                      {p.permissions.canEditChecklist && <span className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground">Tasks</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pending Invitations */}
          {pendingInvites.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-amber-400" />
                Pending Invitations
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs border bg-amber-500/15 text-amber-500 border-amber-500/30">{pendingInvites.length}</span>
              </h4>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm" data-testid="table-pending-invites">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">Invitee</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
                      <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Sent</th>
                      <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Expires</th>
                      {(isOwner || isAgent) && <th className="p-3" />}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvites.map((inv: any) => {
                      const inviteeLabel = (inv.inviteeEmail ?? (`${inv.firstName ?? ""} ${inv.lastName ?? ""}`.trim() || "—"));
                      const rColors: Record<string, string> = {
                        agent: "bg-sky-500/15 text-sky-500 border-sky-500/30",
                        provider: "bg-purple-500/15 text-purple-500 border-purple-500/30",
                        surveyor: "bg-amber-500/15 text-amber-500 border-amber-500/30",
                        broker: "bg-green-500/15 text-green-500 border-green-500/30",
                        observer: "bg-slate-500/15 text-slate-400 border-slate-500/30",
                      };
                      return (
                        <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="p-3 font-medium text-sm">{inviteeLabel}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${rColors[inv.role] ?? rColors.observer} capitalize`}>{inv.role}</span>
                          </td>
                          <td className="p-3 text-muted-foreground text-xs hidden md:table-cell">
                            {inv.invitedAt ? new Date(inv.invitedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                          </td>
                          <td className="p-3 text-muted-foreground text-xs hidden lg:table-cell">
                            {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                          </td>
                          {(isOwner || isAgent) && (
                            <td className="p-3">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => resendInviteMutation.mutate(inv.id)}>Resend</Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-500" onClick={() => cancelInviteMutation.mutate(inv.id)}>Cancel</Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {participants.length === 0 && pendingInvites.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No participants yet</p>
              <p className="text-xs mt-1">Invite agents, providers, or surveyors to collaborate on this voyage.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Contacts ──────────────────────────────────────── */}
      {activeTab === "contacts" && (
        <div className="space-y-5" data-testid="tab-content-contacts">

          {/* Bulk Paste Section */}
          <Card className="p-5">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-sky-400" />
              Bulk Import
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Paste multiple email addresses (separated by comma, semicolon, or newline). The system will parse and add them automatically.</p>
            <Textarea
              value={contactBulkText}
              onChange={e => setContactBulkText(e.target.value)}
              placeholder="owner@example.com, charterer@shipping.com; receiver@port.com"
              rows={4}
              className="mb-3 font-mono text-xs"
              data-testid="textarea-bulk-contacts"
            />
            <Button
              onClick={() => bulkImportContactsMutation.mutate(contactBulkText)}
              disabled={!contactBulkText.trim() || bulkImportContactsMutation.isPending}
              data-testid="button-bulk-import"
              size="sm"
            >
              {bulkImportContactsMutation.isPending && <Loader2 className="w-3 h-3 animate-spin mr-2" />}
              Import Contacts
            </Button>
          </Card>

          {/* Contact List */}
          <Card className="p-5">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
              <Users2 className="w-4 h-4 text-sky-400" />
              Contact List
              <span className="text-xs text-muted-foreground font-normal">({voyageContactsList.length})</span>
            </h3>

            {voyageContactsList.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Mail className="w-7 h-7 mx-auto mb-2 opacity-25" />
                <p className="text-sm font-medium">No contacts yet</p>
                <p className="text-xs mt-1">Use bulk import above or add individually below.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Role color map */}
                {voyageContactsList.map((c: any) => {
                  const ROLE_BADGE: Record<string, string> = {
                    owner: "bg-amber-500/15 text-amber-400 border-amber-500/30",
                    charterer: "bg-blue-500/15 text-blue-400 border-blue-500/30",
                    receiver: "bg-green-500/15 text-green-400 border-green-500/30",
                    sub_agent: "bg-violet-500/15 text-violet-400 border-violet-500/30",
                    other: "bg-muted/50 text-muted-foreground border-muted",
                  };
                  const roleColor = ROLE_BADGE[c.role] ?? ROLE_BADGE.other;
                  const initials = (c.name || c.email).slice(0, 2).toUpperCase();
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors" data-testid={`contact-row-${c.id}`}>
                      <div className="w-8 h-8 rounded-full bg-sky-700 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" data-testid={`contact-email-${c.id}`}>{c.email}</p>
                        {c.name && <p className="text-xs text-muted-foreground truncate">{c.name}</p>}
                      </div>

                      {/* Role Select */}
                      <Select
                        value={c.role}
                        onValueChange={val => updateContactMutation.mutate({ contactId: c.id, updates: { role: val } })}
                      >
                        <SelectTrigger className="w-32 h-7 text-xs" data-testid={`select-role-${c.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="charterer">Charterer</SelectItem>
                          <SelectItem value="receiver">Receiver</SelectItem>
                          <SelectItem value="sub_agent">Sub-Agent</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Daily Reports Toggle */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Switch
                          checked={c.includeInDailyReports}
                          onCheckedChange={val => updateContactMutation.mutate({ contactId: c.id, updates: { includeInDailyReports: val } })}
                          data-testid={`switch-daily-${c.id}`}
                        />
                        <span className="text-[10px] text-muted-foreground hidden sm:block">Daily</span>
                      </div>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                        onClick={() => deleteContactMutation.mutate(c.id)}
                        data-testid={`button-delete-contact-${c.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Single Contact Form */}
            <div className="mt-5 pt-4 border-t space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Add Contact Manually</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  placeholder="Email address *"
                  value={newContactEmail}
                  onChange={e => setNewContactEmail(e.target.value)}
                  className="flex-1 h-8 text-xs"
                  data-testid="input-new-contact-email"
                />
                <Input
                  placeholder="Display name (optional)"
                  value={newContactName}
                  onChange={e => setNewContactName(e.target.value)}
                  className="flex-1 h-8 text-xs"
                  data-testid="input-new-contact-name"
                />
                <Select value={newContactRole} onValueChange={setNewContactRole}>
                  <SelectTrigger className="w-32 h-8 text-xs" data-testid="select-new-contact-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="charterer">Charterer</SelectItem>
                    <SelectItem value="receiver">Receiver</SelectItem>
                    <SelectItem value="sub_agent">Sub-Agent</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={() => addContactMutation.mutate({ email: newContactEmail, name: newContactName || undefined, role: newContactRole })}
                  disabled={!newContactEmail.includes("@") || addContactMutation.isPending}
                  data-testid="button-add-contact"
                >
                  {addContactMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  <span className="ml-1">Add</span>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Voyage Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog} data-testid="dialog-invite-participant">
        <DialogContent className="max-w-lg" data-testid="dialog-invite-participant">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Invite to Voyage
            </DialogTitle>
          </DialogHeader>
          {/* Invite Tabs */}
          <div className="flex gap-1 bg-muted/30 p-1 rounded-lg mb-4">
            {[
              { key: "email", label: "By Email" },
              { key: "directory", label: "From Directory" },
              { key: "bulk", label: "Bulk" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setInviteTab(key as any)}
                className={`flex-1 py-1.5 text-sm rounded-md transition-all ${inviteTab === key ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
                data-testid={`tab-invite-${key}`}
              >
                {label}
              </button>
            ))}
          </div>

          {inviteTab === "email" && (
            <div className="space-y-4">
              <div>
                <Label>Email Address *</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  data-testid="input-invite-email-field"
                />
              </div>
              <div>
                <Label>Role *</Label>
                <Select value={inviteRole} onValueChange={setInviteRole} data-testid="select-invite-role">
                  <SelectTrigger data-testid="select-invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent Staff — Full Access</SelectItem>
                    <SelectItem value="observer">Shipowner — View Only</SelectItem>
                    <SelectItem value="broker">Charterer</SelectItem>
                    <SelectItem value="provider">Provider / Supplier</SelectItem>
                    <SelectItem value="surveyor">Surveyor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {inviteRole === "provider" && (
                <div>
                  <Label>Service Type</Label>
                  <Select value={inviteServiceType} onValueChange={setInviteServiceType}>
                    <SelectTrigger><SelectValue placeholder="Select service..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stevedoring">Stevedoring</SelectItem>
                      <SelectItem value="surveying">Surveying</SelectItem>
                      <SelectItem value="fumigation">Fumigation</SelectItem>
                      <SelectItem value="customs">Customs</SelectItem>
                      <SelectItem value="forwarding">Forwarding</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Personal Message <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Textarea
                  value={inviteMessage}
                  onChange={e => setInviteMessage(e.target.value)}
                  placeholder="Add a personal note to your invitation..."
                  rows={3}
                  maxLength={500}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
                <Button
                  onClick={() => sendInviteMutation.mutate({ inviteeEmail: inviteEmail, role: inviteRole, serviceType: inviteServiceType || undefined, message: inviteMessage || undefined })}
                  disabled={!inviteEmail.includes("@") || sendInviteMutation.isPending}
                  data-testid="button-send-voyage-invite"
                >
                  {sendInviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Send Invitation
                </Button>
              </DialogFooter>
            </div>
          )}

          {inviteTab === "directory" && (
            <div className="space-y-4">
              <div>
                <Label>Search Companies</Label>
                <Input
                  value={directorySearch}
                  onChange={e => setDirectorySearch(e.target.value)}
                  placeholder="Search by company name..."
                />
              </div>
              {directorySearch.length >= 2 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {(directoryResults as any[]).map((co: any) => (
                    <div key={co.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 cursor-pointer" onClick={() => { setInviteEmail(co.email || ""); setDirectorySearch(""); }}>
                      <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-xs font-bold">{co.companyName?.[0] ?? "?"}</div>
                      <div>
                        <p className="text-sm font-medium">{co.companyName}</p>
                        <p className="text-xs text-muted-foreground">{co.portName ?? co.city}</p>
                      </div>
                    </div>
                  ))}
                  {(directoryResults as any[]).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No results</p>}
                </div>
              )}
              <div>
                <Label>Role *</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent Staff — Full Access</SelectItem>
                    <SelectItem value="observer">Shipowner — View Only</SelectItem>
                    <SelectItem value="broker">Charterer</SelectItem>
                    <SelectItem value="provider">Provider / Supplier</SelectItem>
                    <SelectItem value="surveyor">Surveyor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
                <Button
                  onClick={() => sendInviteMutation.mutate({ inviteeEmail: inviteEmail, role: inviteRole })}
                  disabled={!inviteEmail.includes("@") || sendInviteMutation.isPending}
                  data-testid="button-send-voyage-invite"
                >
                  {sendInviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Send Invitation
                </Button>
              </DialogFooter>
            </div>
          )}

          {inviteTab === "bulk" && (
            <div className="space-y-4" data-testid="tab-invite-bulk">
              <div>
                <Label>Email Addresses <span className="text-muted-foreground text-xs">(one per line)</span></Label>
                <Textarea
                  value={bulkEmails}
                  onChange={e => setBulkEmails(e.target.value)}
                  placeholder={"agent@company.com\nsurveyor@firm.com\nprovider@service.com"}
                  rows={6}
                  data-testid="textarea-bulk-emails"
                />
                <p className="text-xs text-muted-foreground mt-1">{bulkEmails.split("\n").filter(l => l.trim()).length} emails</p>
              </div>
              <div>
                <Label>Role for all *</Label>
                <Select value={bulkRole} onValueChange={setBulkRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent Staff — Full Access</SelectItem>
                    <SelectItem value="observer">Shipowner — View Only</SelectItem>
                    <SelectItem value="broker">Charterer</SelectItem>
                    <SelectItem value="provider">Provider / Supplier</SelectItem>
                    <SelectItem value="surveyor">Surveyor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    const invitations = bulkEmails.split("\n").filter(l => l.trim()).map(email => ({ email: email.trim(), role: bulkRole }));
                    sendBulkInviteMutation.mutate({ invitations });
                  }}
                  disabled={bulkEmails.trim().length === 0 || sendBulkInviteMutation.isPending}
                >
                  {sendBulkInviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Send All
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
