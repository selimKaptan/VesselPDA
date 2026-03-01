import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, Users, Ship, FileText, Building2, Search, BarChart3, TrendingUp, Target, Gavel, CheckCircle, XCircle, Clock, Ban, UserCheck, MessageSquarePlus, Bug, Lightbulb, MessageCircle, MailCheck, ShieldCheck, ShieldX, Fuel, Plus, Edit2, Trash2, Loader2, MapPin, AlertTriangle, UserPlus, Activity, Megaphone, Settings, Database, Zap, Bell, Globe, ChevronRight, Wrench, Calendar, Eye, RotateCcw, CheckSquare, Server } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/models/auth";
import type { Vessel, Proforma, CompanyProfile } from "@shared/schema";
import { PageMeta } from "@/components/page-meta";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line
} from "recharts";

const ROLE_BADGES: Record<string, string> = {
  shipowner: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  agent: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  provider: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function AdminPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRole = (user as any)?.userRole;
  const [searchUsers, setSearchUsers] = useState("");
  const [searchVessels, setSearchVessels] = useState("");
  const [searchProformas, setSearchProformas] = useState("");
  const [searchProfiles, setSearchProfiles] = useState("");

  // New state for enhanced features
  const [deleteUserTarget, setDeleteUserTarget] = useState<string | null>(null);
  const [createUserDialog, setCreateUserDialog] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ email: "", password: "", firstName: "", lastName: "", userRole: "agent", subscriptionPlan: "free" });
  const [userDetailId, setUserDetailId] = useState<string | null>(null);
  const [announceForm, setAnnounceForm] = useState({ title: "", message: "", targetRole: "all" });
  const [announceHistory, setAnnounceHistory] = useState<any[]>([]);
  const [searchVoyages, setSearchVoyages] = useState("");
  const [searchSR, setSearchSR] = useState("");

  const [verifyNote, setVerifyNote] = useState<Record<number, string>>({});
  const [ofacResults, setOfacResults] = useState<Record<number, { clear: boolean; matches: any[]; checked: boolean }>>({});
  const [ofacLoading, setOfacLoading] = useState<Record<number, boolean>>({});

  const checkOfac = async (profileId: number, companyName: string) => {
    setOfacLoading(prev => ({ ...prev, [profileId]: true }));
    try {
      const res = await fetch(`/api/sanctions/check?name=${encodeURIComponent(companyName)}`, { credentials: "include" });
      const data = await res.json();
      setOfacResults(prev => ({ ...prev, [profileId]: { ...data, checked: true } }));
    } catch {
      toast({ title: "OFAC kontrolü başarısız", variant: "destructive" });
    } finally {
      setOfacLoading(prev => ({ ...prev, [profileId]: false }));
    }
  };

  const { data: stats, isLoading: statsLoading } = useQuery<any>({ queryKey: ["/api/admin/stats"] });
  const { data: enhancedStats, isLoading: enhancedStatsLoading } = useQuery<any>({ queryKey: ["/api/admin/stats/enhanced"] });
  const { data: activityFeed = [], isLoading: activityLoading } = useQuery<any[]>({ queryKey: ["/api/admin/activity"] });
  const { data: adminVoyages = [], isLoading: adminVoyagesLoading } = useQuery<any[]>({ queryKey: ["/api/admin/voyages"] });
  const { data: adminSR = [], isLoading: adminSRLoading } = useQuery<any[]>({ queryKey: ["/api/admin/service-requests-list"] });
  const { data: userGrowth = [], isLoading: userGrowthLoading } = useQuery<any[]>({ queryKey: ["/api/admin/reports/user-growth"] });
  const { data: activeUsers = [], isLoading: activeUsersLoading } = useQuery<any[]>({ queryKey: ["/api/admin/reports/active-users"] });
  const { data: userActivity = [], isLoading: userActivityLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users", userDetailId, "activity"],
    enabled: !!userDetailId,
  });
  const { data: allUsers, isLoading: usersLoading } = useQuery<User[]>({ queryKey: ["/api/admin/users"] });
  const { data: allVessels, isLoading: vesselsLoading } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
  const { data: allProformas, isLoading: proformasLoading } = useQuery<Proforma[]>({ queryKey: ["/api/proformas"] });
  const { data: allProfiles, isLoading: profilesLoading } = useQuery<CompanyProfile[]>({ queryKey: ["/api/admin/company-profiles"] });
  const { data: pendingProfiles, isLoading: pendingLoading } = useQuery<CompanyProfile[]>({ queryKey: ["/api/admin/companies/pending"] });
  const { data: allFeedbacks, isLoading: feedbacksLoading } = useQuery<any[]>({ queryKey: ["/api/admin/feedback"] });
  const { data: pendingVerifications, isLoading: verificationsLoading } = useQuery<CompanyProfile[]>({ queryKey: ["/api/admin/pending-verifications"] });
  const { data: bunkerPricesList = [], isLoading: bunkerLoading } = useQuery<any[]>({ queryKey: ["/api/market/bunker-prices"] });
  const { data: portAlerts = [], isLoading: portAlertsLoading } = useQuery<any[]>({ queryKey: ["/api/port-alerts"] });

  const [bunkerDialog, setBunkerDialog] = useState(false);
  const [alertDialog, setAlertDialog] = useState(false);
  const [editAlert, setEditAlert] = useState<any | null>(null);
  const [alertForm, setAlertForm] = useState({ portName: "", alertType: "weather", severity: "info", title: "", message: "", startsAt: "", endsAt: "", isActive: true });
  const [deleteAlertTarget, setDeleteAlertTarget] = useState<number | null>(null);
  const [editBunker, setEditBunker] = useState<any | null>(null);
  const [bunkerForm, setBunkerForm] = useState({ portName: "", portCode: "", region: "TR", ifo380: "", vlsfo: "", mgo: "" });
  const [deleteBunkerTarget, setDeleteBunkerTarget] = useState<number | null>(null);

  const REGION_LABELS: Record<string, string> = { TR: "Türkiye", EU: "Avrupa", ASIA: "Asya", ME: "Orta Doğu", US: "Amerika" };

  const addBunkerMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/bunker-prices", {
      portName: bunkerForm.portName, portCode: bunkerForm.portCode || null, region: bunkerForm.region,
      ifo380: bunkerForm.ifo380 ? parseFloat(bunkerForm.ifo380) : null,
      vlsfo: bunkerForm.vlsfo ? parseFloat(bunkerForm.vlsfo) : null,
      mgo: bunkerForm.mgo ? parseFloat(bunkerForm.mgo) : null,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/market/bunker-prices"] }); toast({ title: "Bunker fiyatı eklendi" }); setBunkerDialog(false); setBunkerForm({ portName: "", portCode: "", region: "TR", ifo380: "", vlsfo: "", mgo: "" }); setEditBunker(null); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const editBunkerMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/bunker-prices/${id}`, {
      portName: bunkerForm.portName, portCode: bunkerForm.portCode || null, region: bunkerForm.region,
      ifo380: bunkerForm.ifo380 ? parseFloat(bunkerForm.ifo380) : null,
      vlsfo: bunkerForm.vlsfo ? parseFloat(bunkerForm.vlsfo) : null,
      mgo: bunkerForm.mgo ? parseFloat(bunkerForm.mgo) : null,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/market/bunker-prices"] }); toast({ title: "Güncellendi" }); setBunkerDialog(false); setEditBunker(null); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const deleteBunkerMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/bunker-prices/${id}`, undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/market/bunker-prices"] }); toast({ title: "Silindi" }); setDeleteBunkerTarget(null); },
  });

  const ALERT_TYPE_LABELS: Record<string, string> = { strike: "Grev", closure: "Kapanış", weather: "Hava", restricted: "Kısıtlı", other: "Diğer" };
  const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
    info: { label: "Bilgi", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    warning: { label: "Uyarı", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    danger: { label: "Tehlike", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  };

  const addAlertMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/port-alerts", { ...alertForm, startsAt: alertForm.startsAt || null, endsAt: alertForm.endsAt || null }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/port-alerts"] }); toast({ title: "Uyarı eklendi" }); setAlertDialog(false); setAlertForm({ portName: "", alertType: "weather", severity: "info", title: "", message: "", startsAt: "", endsAt: "", isActive: true }); setEditAlert(null); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const editAlertMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/port-alerts/${id}`, { ...alertForm, startsAt: alertForm.startsAt || null, endsAt: alertForm.endsAt || null }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/port-alerts"] }); toast({ title: "Güncellendi" }); setAlertDialog(false); setEditAlert(null); },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const deleteAlertMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/port-alerts/${id}`, undefined),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/port-alerts"] }); toast({ title: "Silindi" }); setDeleteAlertTarget(null); },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/enhanced"] });
      toast({ title: "Kullanıcı silindi" });
      setDeleteUserTarget(null);
    },
    onError: async (err: any) => {
      const d = await err?.response?.json?.().catch(() => ({}));
      toast({ title: "Hata", description: d?.message || "Kullanıcı silinemedi", variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (form: typeof createUserForm) => {
      const res = await apiRequest("POST", "/api/admin/users", form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats/enhanced"] });
      toast({ title: "Kullanıcı oluşturuldu" });
      setCreateUserDialog(false);
      setCreateUserForm({ email: "", password: "", firstName: "", lastName: "", userRole: "agent", subscriptionPlan: "free" });
    },
    onError: async (err: any) => {
      const d = await err?.response?.json?.().catch(() => ({}));
      toast({ title: "Hata", description: d?.message || "Kullanıcı oluşturulamadı", variant: "destructive" });
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, userRole }: { userId: string; userRole: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { userRole });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Rol güncellendi" });
    },
    onError: () => toast({ title: "Hata", variant: "destructive" }),
  });

  const announceMutation = useMutation({
    mutationFn: async (form: typeof announceForm) => {
      const res = await apiRequest("POST", "/api/admin/announce", form);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: `Duyuru gönderildi — ${data.sent} kullanıcıya ulaştı` });
      setAnnounceHistory(h => [{ ...announceForm, sent: data.sent, sentAt: new Date().toISOString() }, ...h.slice(0, 9)]);
      setAnnounceForm({ title: "", message: "", targetRole: "all" });
    },
    onError: () => toast({ title: "Duyuru gönderilemedi", variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ profileId, action, note }: { profileId: number; action: "approve" | "reject"; note?: string }) => {
      const res = await apiRequest("POST", `/api/admin/verify-company/${profileId}`, { action, note });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/company-profiles"] });
      toast({ title: "Doğrulama güncellendi" });
    },
    onError: async (err: any) => {
      const d = await err?.response?.json?.().catch(() => ({}));
      toast({ title: "Hata", description: d?.message || "İşlem başarısız", variant: "destructive" });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ userId, plan }: { userId: string; plan: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/plan`, { plan });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Plan updated" });
    },
    onError: () => toast({ title: "Failed to update plan", variant: "destructive" }),
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ userId, suspended }: { userId: string; suspended: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/suspend`, { suspended });
      return res.json();
    },
    onSuccess: (_, { suspended }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: suspended ? "User suspended" : "User reactivated" });
    },
    onError: () => toast({ title: "Failed to update user", variant: "destructive" }),
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/verify-email`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Email doğrulandı", description: "Kullanıcı artık giriş yapabilir." });
    },
    onError: () => toast({ title: "Hata", description: "Email doğrulanamadı.", variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/companies/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/company-profiles"] });
      toast({ title: "Approved", description: "Company profile is now visible in the directory." });
    },
    onError: () => toast({ title: "Error", description: "Failed to approve.", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/companies/${id}/reject`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/company-profiles"] });
      toast({ title: "Rejected", description: "Company profile has been removed." });
    },
    onError: () => toast({ title: "Error", description: "Failed to reject.", variant: "destructive" }),
  });

  if (userRole !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-8 text-center space-y-3">
          <Shield className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="font-serif text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">You do not have admin privileges.</p>
        </Card>
      </div>
    );
  }

  const filteredUsers = allUsers?.filter(u =>
    `${u.firstName || ""} ${u.lastName || ""} ${u.email || ""} ${u.userRole}`.toLowerCase().includes(searchUsers.toLowerCase())
  ) || [];

  const filteredVessels = allVessels?.filter(v =>
    `${v.name} ${v.flag} ${v.vesselType}`.toLowerCase().includes(searchVessels.toLowerCase())
  ) || [];

  const filteredProformas = allProformas?.filter(p =>
    `${p.referenceNumber} ${p.purposeOfCall || ""} ${p.cargoType || ""}`.toLowerCase().includes(searchProformas.toLowerCase())
  ) || [];

  const filteredProfiles = allProfiles?.filter(p =>
    `${p.companyName} ${p.city || ""} ${p.companyType}`.toLowerCase().includes(searchProfiles.toLowerCase())
  ) || [];

  return (
    <div className="px-3 py-5 space-y-6 max-w-7xl mx-auto">
      <PageMeta title="Admin Panel | VesselPDA" description="System administration and management" />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold" data-testid="text-admin-title">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Full system overview and management</p>
        </div>
      </div>

      {/* Enhanced KPI Dashboard */}
      {enhancedStatsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : enhancedStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4" data-testid="stat-users">
            <div className="flex items-start justify-between">
              <div className="space-y-1 min-w-0">
                <p className="text-xs text-muted-foreground">Kullanıcılar</p>
                <p className="text-2xl font-bold font-serif">{enhancedStats.totalUsers}</p>
                <div className="flex gap-1 flex-wrap">
                  <Badge className="text-[9px] px-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0">🚢 {enhancedStats.usersByRole?.shipowner || 0}</Badge>
                  <Badge className="text-[9px] px-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">🤝 {enhancedStats.usersByRole?.agent || 0}</Badge>
                  <Badge className="text-[9px] px-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-0">🔧 {enhancedStats.usersByRole?.provider || 0}</Badge>
                </div>
              </div>
              <Users className="w-5 h-5 text-[hsl(var(--maritime-primary))] flex-shrink-0" />
            </div>
          </Card>
          <Card className="p-4" data-testid="stat-active-voyages">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Aktif Seferler</p>
                <p className="text-2xl font-bold font-serif text-emerald-600">{enhancedStats.activeVoyages}</p>
                <p className="text-[10px] text-muted-foreground">Toplam: {enhancedStats.totalVoyages}</p>
              </div>
              <Ship className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            </div>
          </Card>
          <Card className="p-4" data-testid="stat-today-txns">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Bugünkü İşlemler</p>
                <p className="text-2xl font-bold font-serif text-blue-600">{enhancedStats.todayTransactions}</p>
                <p className="text-[10px] text-muted-foreground">Proforma + Sefer + Talep</p>
              </div>
              <Activity className="w-5 h-5 text-blue-500 flex-shrink-0" />
            </div>
          </Card>
          <Card className="p-4" data-testid="stat-pending">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Bekleyen Onaylar</p>
                <p className={`text-2xl font-bold font-serif ${(enhancedStats.pendingApprovals + enhancedStats.pendingVerifications) > 0 ? "text-amber-600" : ""}`}>
                  {enhancedStats.pendingApprovals + enhancedStats.pendingVerifications}
                </p>
                <p className="text-[10px] text-muted-foreground">{enhancedStats.pendingApprovals} onay · {enhancedStats.pendingVerifications} doğrulama</p>
              </div>
              <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
            </div>
          </Card>
          <Card className="p-4" data-testid="stat-vessels">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Gemiler</p>
                <p className="text-2xl font-bold font-serif">{stats?.totalVessels || 0}</p>
              </div>
              <Ship className="w-5 h-5 text-[hsl(var(--maritime-secondary))] flex-shrink-0" />
            </div>
          </Card>
          <Card className="p-4" data-testid="stat-proformas">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Proformalar</p>
                <p className="text-2xl font-bold font-serif">{stats?.totalProformas || 0}</p>
              </div>
              <FileText className="w-5 h-5 text-[hsl(var(--maritime-accent))] flex-shrink-0" />
            </div>
          </Card>
          <Card className="p-4" data-testid="stat-profiles">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Şirket Profilleri</p>
                <p className="text-2xl font-bold font-serif">{stats?.totalCompanyProfiles || 0}</p>
              </div>
              <Building2 className="w-5 h-5 text-amber-500 flex-shrink-0" />
            </div>
          </Card>
          <Card className="p-4" data-testid="stat-system-health">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Sistem Sağlığı</p>
                <p className="text-2xl font-bold font-serif text-emerald-600">
                  {[enhancedStats.systemHealth?.dbOk, enhancedStats.systemHealth?.aisOk, enhancedStats.systemHealth?.teOk, enhancedStats.systemHealth?.resendOk].filter(Boolean).length}/4
                </p>
                <div className="flex gap-1">
                  <Badge className={`text-[9px] px-1 border-0 ${enhancedStats.systemHealth?.dbOk ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>DB</Badge>
                  <Badge className={`text-[9px] px-1 border-0 ${enhancedStats.systemHealth?.aisOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>AIS</Badge>
                  <Badge className={`text-[9px] px-1 border-0 ${enhancedStats.systemHealth?.resendOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>Email</Badge>
                </div>
              </div>
              <Zap className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            </div>
          </Card>
        </div>
      )}

      {/* Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-4" data-testid="activity-feed">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
            <h3 className="font-semibold text-sm">Son Aktiviteler</h3>
            <Badge variant="outline" className="text-[9px] ml-auto">Canlı</Badge>
          </div>
          {activityLoading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8" />)}</div>
          ) : activityFeed.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Henüz aktivite yok</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {activityFeed.map((item: any, i: number) => {
                const typeIcons: Record<string, string> = { proforma: "📄", voyage: "🚢", service_request: "🔧", user_register: "👤" };
                const timeAgo = item.createdAt ? (() => {
                  const diff = Date.now() - new Date(item.createdAt).getTime();
                  const m = Math.floor(diff / 60000); const h = Math.floor(diff / 3600000); const d = Math.floor(diff / 86400000);
                  return d > 0 ? `${d}g önce` : h > 0 ? `${h}s önce` : m > 0 ? `${m}dk önce` : "az önce";
                })() : "";
                return (
                  <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                    <span className="text-base leading-none">{typeIcons[item.type] || "📌"}</span>
                    <span className="flex-1 truncate text-foreground">{item.label}</span>
                    <span className="text-muted-foreground truncate max-w-[100px]">{item.user}</span>
                    <span className="text-muted-foreground whitespace-nowrap flex-shrink-0">{timeAgo}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card className="p-4" data-testid="plan-distribution">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
            <h3 className="font-semibold text-sm">Plan Dağılımı</h3>
          </div>
          {enhancedStats && (
            <div className="space-y-2">
              {[
                { label: "Free", count: enhancedStats.usersByPlan?.free || 0, color: "bg-muted" },
                { label: "Standard", count: enhancedStats.usersByPlan?.standard || 0, color: "bg-[hsl(var(--maritime-secondary))]" },
                { label: "Unlimited", count: enhancedStats.usersByPlan?.unlimited || 0, color: "bg-[hsl(var(--maritime-gold))]" },
              ].map(plan => {
                const total = enhancedStats.totalUsers || 1;
                const pct = Math.round((plan.count / total) * 100);
                return (
                  <div key={plan.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{plan.label}</span>
                      <span className="font-medium">{plan.count} <span className="text-muted-foreground">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full">
                      <div className={`h-1.5 rounded-full ${plan.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Tabs defaultValue="users">
        <TabsList data-testid="admin-tabs" className="flex-wrap h-auto gap-1">
          <TabsTrigger value="users" data-testid="tab-users">👥 Kullanıcılar ({allUsers?.length || 0})</TabsTrigger>
          <TabsTrigger value="vessels" data-testid="tab-vessels">🚢 Gemiler</TabsTrigger>
          <TabsTrigger value="proformas" data-testid="tab-proformas">📄 Proformalar</TabsTrigger>
          <TabsTrigger value="profiles" data-testid="tab-profiles">🏢 Profiller</TabsTrigger>
          <TabsTrigger value="content" data-testid="tab-content">📦 İçerik</TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending" className="relative">
            ✅ Onaylar
            {(pendingProfiles?.length ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-amber-500 text-white">
                {pendingProfiles!.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="verifications" data-testid="tab-verifications" className="relative">
            🔐 Doğrulamalar
            {(pendingVerifications?.length ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-blue-500 text-white">
                {pendingVerifications!.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="announce" data-testid="tab-announce">📢 Duyurular</TabsTrigger>
          <TabsTrigger value="financial" data-testid="tab-financial">💰 Finansal</TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">📈 Raporlar</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">📊 Analitik</TabsTrigger>
          <TabsTrigger value="feedback" data-testid="tab-feedback" className="relative">
            💬 Feedback
            {(allFeedbacks?.length ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-blue-500 text-white">
                {allFeedbacks!.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="bunker" data-testid="tab-bunker-prices">
            <Fuel className="w-3.5 h-3.5 mr-1.5" />Bunker ({bunkerPricesList.length})
          </TabsTrigger>
          <TabsTrigger value="port-alerts" data-testid="tab-port-alerts">⚠️ Liman Uyarıları</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">⚙️ Sistem Ayarları</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="İsim, email veya rol ile ara..."
                value={searchUsers}
                onChange={e => setSearchUsers(e.target.value)}
                className="pl-9"
                data-testid="input-search-users"
              />
            </div>
            <Button size="sm" onClick={() => setCreateUserDialog(true)} data-testid="button-create-user">
              <UserPlus className="w-4 h-4 mr-1.5" /> Yeni Kullanıcı
            </Button>
          </div>
          {usersLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-3 font-medium">İsim</th>
                      <th className="p-3 font-medium hidden md:table-cell">Email</th>
                      <th className="p-3 font-medium">Rol</th>
                      <th className="p-3 font-medium">Plan</th>
                      <th className="p-3 font-medium hidden sm:table-cell">Proforma</th>
                      <th className="p-3 font-medium text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => {
                      const isSuspended = (u as any).isSuspended;
                      return (
                        <tr key={u.id} className={`border-b last:border-0 hover:bg-muted/50 ${isSuspended ? "opacity-60 bg-red-50/50 dark:bg-red-950/10" : ""}`} data-testid={`row-user-${u.id}`}>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {u.profileImageUrl && <img src={u.profileImageUrl} className="w-6 h-6 rounded-full" alt="" />}
                              <div>
                                <span className="font-medium">{u.firstName || ""} {u.lastName || ""}</span>
                                {isSuspended && <Badge variant="destructive" className="ml-2 text-[9px] px-1 py-0">Suspended</Badge>}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground hidden md:table-cell">{u.email || "-"}</td>
                          <td className="p-3">
                            <Badge className={`text-[10px] ${ROLE_BADGES[u.userRole] || ""}`}>{u.userRole}</Badge>
                          </td>
                          <td className="p-3">
                            <Select
                              value={u.subscriptionPlan}
                              onValueChange={(plan) => updatePlanMutation.mutate({ userId: u.id, plan })}
                              disabled={updatePlanMutation.isPending}
                            >
                              <SelectTrigger className="h-7 text-xs w-28" data-testid={`select-plan-${u.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="free">Free</SelectItem>
                                <SelectItem value="standard">Standard</SelectItem>
                                <SelectItem value="unlimited">Unlimited</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-3 text-muted-foreground hidden sm:table-cell">{u.proformaCount}/{u.proformaLimit}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              {!(u as any).emailVerified && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20 h-7 text-xs px-2"
                                  onClick={() => verifyEmailMutation.mutate(u.id)}
                                  disabled={verifyEmailMutation.isPending}
                                  data-testid={`button-verify-email-${u.id}`}
                                  title="Email doğrula"
                                >
                                  <MailCheck className="w-3 h-3 mr-1" /> Doğrula
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                                onClick={() => setUserDetailId(u.id)}
                                data-testid={`button-detail-${u.id}`}
                                title="Kullanıcı detayı"
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant={isSuspended ? "outline" : "ghost"}
                                className={`h-7 text-xs px-2 ${isSuspended ? "text-green-600 border-green-300" : "text-amber-600 hover:text-amber-700"}`}
                                onClick={() => suspendMutation.mutate({ userId: u.id, suspended: !isSuspended })}
                                disabled={suspendMutation.isPending || u.userRole === "admin"}
                                data-testid={`button-suspend-${u.id}`}
                                title={isSuspended ? "Aktif et" : "Askıya al"}
                              >
                                {isSuspended ? <UserCheck className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                              </Button>
                              {u.userRole !== "admin" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setDeleteUserTarget(u.id)}
                                  data-testid={`button-delete-user-${u.id}`}
                                  title="Kullanıcıyı sil"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="vessels" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search vessels by name, flag, or type..."
              value={searchVessels}
              onChange={e => setSearchVessels(e.target.value)}
              className="pl-9"
              data-testid="input-search-vessels"
            />
          </div>
          {vesselsLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-3 font-medium">Name</th>
                      <th className="p-3 font-medium">Flag</th>
                      <th className="p-3 font-medium">Type</th>
                      <th className="p-3 font-medium">GRT</th>
                      <th className="p-3 font-medium">NRT</th>
                      <th className="p-3 font-medium">Owner ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVessels.map(v => (
                      <tr key={v.id} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-vessel-${v.id}`}>
                        <td className="p-3 font-medium">{v.name}</td>
                        <td className="p-3">{v.flag}</td>
                        <td className="p-3">{v.vesselType}</td>
                        <td className="p-3">{v.grt?.toLocaleString()}</td>
                        <td className="p-3">{v.nrt?.toLocaleString()}</td>
                        <td className="p-3 text-muted-foreground text-xs">{v.userId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="proformas" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search proformas by reference, purpose, or cargo..."
              value={searchProformas}
              onChange={e => setSearchProformas(e.target.value)}
              className="pl-9"
              data-testid="input-search-proformas"
            />
          </div>
          {proformasLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-3 font-medium">Reference</th>
                      <th className="p-3 font-medium">Purpose</th>
                      <th className="p-3 font-medium">Total USD</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium">Owner ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProformas.map(p => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-proforma-admin-${p.id}`}>
                        <td className="p-3 font-medium">{p.referenceNumber}</td>
                        <td className="p-3">{p.purposeOfCall}</td>
                        <td className="p-3 font-semibold">${p.totalUsd?.toLocaleString()}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">{p.userId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="profiles" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search company profiles..."
              value={searchProfiles}
              onChange={e => setSearchProfiles(e.target.value)}
              className="pl-9"
              data-testid="input-search-profiles"
            />
          </div>
          {profilesLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-3 font-medium">Şirket</th>
                      <th className="p-3 font-medium">Tür</th>
                      <th className="p-3 font-medium">Şehir</th>
                      <th className="p-3 font-medium">Doğrulama</th>
                      <th className="p-3 font-medium">Featured</th>
                      <th className="p-3 font-medium">Aktif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.map(p => {
                      const vs = (p as any).verificationStatus || "unverified";
                      return (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-profile-${p.id}`}>
                          <td className="p-3 font-medium">{p.companyName}</td>
                          <td className="p-3">
                            <Badge className={`text-[10px] ${ROLE_BADGES[p.companyType] || ""}`}>{p.companyType}</Badge>
                          </td>
                          <td className="p-3">{p.city || "-"}</td>
                          <td className="p-3">
                            {vs === "verified" && (
                              <Badge className="text-[10px] gap-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">
                                <ShieldCheck className="w-2.5 h-2.5" /> Doğrulandı
                              </Badge>
                            )}
                            {vs === "pending" && (
                              <Badge className="text-[10px] gap-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300">
                                <Clock className="w-2.5 h-2.5" /> Bekliyor
                              </Badge>
                            )}
                            {vs === "rejected" && (
                              <Badge className="text-[10px] gap-1 bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300">
                                <XCircle className="w-2.5 h-2.5" /> Reddedildi
                              </Badge>
                            )}
                            {vs === "unverified" && <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="p-3">{p.isFeatured ? "Evet" : "Hayır"}</td>
                          <td className="p-3">{p.isActive ? "Evet" : "Hayır"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4" data-testid="tab-content-pending">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-semibold">Pending Company Approvals</h3>
              <p className="text-sm text-muted-foreground">Review and approve or reject new company profile submissions</p>
            </div>
          </div>
          {pendingLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>
          ) : !pendingProfiles?.length ? (
            <Card className="p-10 text-center border-dashed">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-semibold mb-1">All caught up!</h3>
              <p className="text-sm text-muted-foreground">No company profiles are waiting for review.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingProfiles.map(p => (
                <Card key={p.id} className="p-4" data-testid={`card-pending-${p.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {p.logoUrl ? (
                        <img src={p.logoUrl} alt={p.companyName} className="w-10 h-10 rounded-lg object-contain border bg-white flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold truncate" data-testid={`text-pending-name-${p.id}`}>{p.companyName}</p>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          <Badge className={`text-[10px] ${ROLE_BADGES[p.companyType] || ""}`}>{p.companyType}</Badge>
                          {p.city && <span className="text-xs text-muted-foreground">{p.city}</span>}
                          {p.email && <span className="text-xs text-muted-foreground">{p.email}</span>}
                        </div>
                        {p.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Submitted {p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "recently"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950/30"
                        onClick={() => rejectMutation.mutate(p.id)}
                        disabled={rejectMutation.isPending || approveMutation.isPending}
                        data-testid={`button-reject-${p.id}`}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => approveMutation.mutate(p.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        data-testid={`button-approve-${p.id}`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6" data-testid="tab-content-analytics">
          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : stats && (
            <>
              {/* KPI Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4" data-testid="kpi-tenders">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Tenders</p>
                      <p className="text-2xl font-bold font-serif">{stats.totalTenders || 0}</p>
                    </div>
                    <Gavel className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
                  </div>
                </Card>
                <Card className="p-4" data-testid="kpi-bids">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Bids</p>
                      <p className="text-2xl font-bold font-serif">{stats.totalBids || 0}</p>
                    </div>
                    <BarChart3 className="w-5 h-5 text-[hsl(var(--maritime-secondary))]" />
                  </div>
                </Card>
                <Card className="p-4" data-testid="kpi-conversion">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Bid Conversion</p>
                      <p className="text-2xl font-bold font-serif">{stats.bidConversionRate || 0}%</p>
                    </div>
                    <Target className="w-5 h-5 text-emerald-600" />
                  </div>
                </Card>
                <Card className="p-4" data-testid="kpi-proformas">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Proformas</p>
                      <p className="text-2xl font-bold font-serif">{stats.totalProformas}</p>
                    </div>
                    <TrendingUp className="w-5 h-5 text-amber-500" />
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Subscription Distribution Pie */}
                <Card className="p-5" data-testid="chart-subscriptions">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                    Subscription Plans
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Free", value: stats.usersByPlan?.free || 0 },
                          { name: "Standard", value: stats.usersByPlan?.standard || 0 },
                          { name: "Unlimited", value: stats.usersByPlan?.unlimited || 0 },
                        ]}
                        cx="50%" cy="50%" outerRadius={75}
                        dataKey="value" label={({ name, value }) => `${name}: ${value}`}
                      >
                        <Cell fill="#003D7A" />
                        <Cell fill="#0077BE" />
                        <Cell fill="#F59E0B" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>

                {/* Monthly Proformas Bar Chart */}
                <Card className="p-5" data-testid="chart-monthly-proformas">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                    Monthly Proformas (Last 6 Months)
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.monthlyProformas || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#003D7A" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Tenders by Port Bar Chart */}
                {stats.tendersByPort?.length > 0 && (
                  <Card className="p-5 lg:col-span-2" data-testid="chart-tenders-by-port">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Gavel className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                      Tenders by Port (Top 10)
                    </h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={stats.tendersByPort} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="port" tick={{ fontSize: 11 }} width={120} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#0077BE" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          {feedbacksLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
          ) : !allFeedbacks?.length ? (
            <Card className="p-10 text-center">
              <MessageSquarePlus className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No feedback submitted yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Feedback from users will appear here</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {allFeedbacks.map((fb: any) => {
                const catConfig = {
                  bug: { icon: Bug, label: "Bug Report", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
                  feature: { icon: Lightbulb, label: "Feature Request", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
                  other: { icon: MessageCircle, label: "Other", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
                };
                const cat = catConfig[fb.category as keyof typeof catConfig] || catConfig.other;
                const CatIcon = cat.icon;
                const timeAgo = fb.createdAt ? (() => {
                  const diff = Date.now() - new Date(fb.createdAt).getTime();
                  const h = Math.floor(diff / 3600000);
                  const d = Math.floor(diff / 86400000);
                  return d > 0 ? `${d}d ago` : h > 0 ? `${h}h ago` : "just now";
                })() : "";
                return (
                  <Card key={fb.id} className="p-4" data-testid={`card-feedback-${fb.id}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cat.color}`}>
                        <CatIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge className={`text-[10px] px-2 py-0 border-0 ${cat.color}`}>{cat.label}</Badge>
                          {fb.pageUrl && (
                            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">{fb.pageUrl}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{timeAgo}</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{fb.message}</p>
                        {fb.userId && (
                          <p className="text-[10px] text-muted-foreground mt-1">User ID: {fb.userId}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Verifications Tab */}
        <TabsContent value="verifications" className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-base">Bekleyen Şirket Doğrulama Talepleri</h2>
          </div>
          {verificationsLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>
          ) : !pendingVerifications || pendingVerifications.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <ShieldCheck className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Bekleyen doğrulama talebi yok</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingVerifications.map((p: any) => (
                <Card key={p.id} className="p-5 border-blue-200/60" data-testid={`card-verification-${p.id}`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{p.companyName}</h3>
                        <Badge variant="outline" className="text-xs capitalize">{p.companyType}</Badge>
                        {ofacResults[p.id]?.checked && ofacResults[p.id]?.clear && (
                          <Badge className="text-[10px] gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                            <ShieldCheck className="w-2.5 h-2.5" /> OFAC: Temiz
                          </Badge>
                        )}
                        {ofacResults[p.id]?.checked && !ofacResults[p.id]?.clear && (
                          <Badge className="text-[10px] gap-1 bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300">
                            <ShieldX className="w-2.5 h-2.5" /> OFAC: Eşleşme!
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        <p><span className="font-medium text-foreground">Vergi No:</span> {p.taxNumber || "—"}</p>
                        <p><span className="font-medium text-foreground">MTO Kayıt:</span> {p.mtoRegistrationNumber || "—"}</p>
                        <p><span className="font-medium text-foreground">P&I Club:</span> {p.pandiClubName || "—"}</p>
                        {p.verificationRequestedAt && (
                          <p><span className="font-medium text-foreground">Talep tarihi:</span> {new Date(p.verificationRequestedAt).toLocaleDateString("tr-TR")}</p>
                        )}
                      </div>
                      {ofacResults[p.id]?.checked && !ofacResults[p.id]?.clear && (
                        <div className="mt-2 p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md text-xs space-y-1">
                          <p className="font-semibold text-red-700 dark:text-red-400">⚠ OFAC SDN Listesinde Eşleşme:</p>
                          {ofacResults[p.id].matches.map((m: any, i: number) => (
                            <p key={i} className="text-red-600 dark:text-red-500">
                              <span className="font-medium">{m.name}</span>
                              {m.type && <span className="text-muted-foreground"> · {m.type}</span>}
                              {m.programs?.length > 0 && <span className="text-muted-foreground"> · {m.programs.slice(0, 3).join(", ")}</span>}
                            </p>
                          ))}
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 gap-1.5 text-xs h-7"
                        onClick={() => checkOfac(p.id, p.companyName)}
                        disabled={ofacLoading[p.id]}
                        data-testid={`button-ofac-check-${p.id}`}
                      >
                        {ofacLoading[p.id] ? (
                          <>
                            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Kontrol ediliyor...
                          </>
                        ) : (
                          <><Shield className="w-3 h-3" /> OFAC Kontrol Et</>
                        )}
                      </Button>
                    </div>
                    <div className="space-y-2 min-w-0 flex-shrink-0">
                      <Input
                        placeholder="Not (ret sebebi vs.)"
                        value={verifyNote[p.id] || ""}
                        onChange={e => setVerifyNote(n => ({ ...n, [p.id]: e.target.value }))}
                        className="w-64 text-sm"
                        data-testid={`input-verify-note-${p.id}`}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => verifyMutation.mutate({ profileId: p.id, action: "approve", note: verifyNote[p.id] })}
                          disabled={verifyMutation.isPending}
                          data-testid={`button-approve-${p.id}`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" /> Onayla
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1.5"
                          onClick={() => verifyMutation.mutate({ profileId: p.id, action: "reject", note: verifyNote[p.id] || "Ret: Bilgiler doğrulanamadı" })}
                          disabled={verifyMutation.isPending}
                          data-testid={`button-reject-${p.id}`}
                        >
                          <ShieldX className="w-3.5 h-3.5" /> Reddet
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bunker" className="space-y-4" data-testid="tab-content-bunker">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Bunker Yakıt Fiyatları</h2>
              <p className="text-sm text-muted-foreground">Liman bazlı yakıt fiyatlarını yönetin (USD/MT)</p>
            </div>
            <Button size="sm" onClick={() => { setEditBunker(null); setBunkerForm({ portName: "", portCode: "", region: "TR", ifo380: "", vlsfo: "", mgo: "" }); setBunkerDialog(true); }} data-testid="button-add-bunker">
              <Plus className="w-4 h-4 mr-1" /> Fiyat Ekle
            </Button>
          </div>

          <Card data-testid="table-admin-bunker">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-3 font-medium text-muted-foreground">Liman</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Bölge</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">IFO 380</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">VLSFO</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">MGO</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Güncelleme</th>
                    <th className="p-3 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {bunkerLoading ? (
                    [0,1,2].map(i => (
                      <tr key={i} className="border-b">
                        <td className="p-3" colSpan={7}><div className="h-4 bg-muted animate-pulse rounded" /></td>
                      </tr>
                    ))
                  ) : bunkerPricesList.length === 0 ? (
                    <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Kayıt bulunamadı</td></tr>
                  ) : (
                    bunkerPricesList.map((row: any) => (
                      <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Fuel className="w-3.5 h-3.5 text-muted-foreground" />
                            {row.portName}
                            {row.portCode && <span className="text-xs text-muted-foreground">({row.portCode})</span>}
                          </div>
                        </td>
                        <td className="p-3"><Badge variant="outline" className="text-xs">{REGION_LABELS[row.region] ?? row.region}</Badge></td>
                        <td className="p-3 text-right tabular-nums">{row.ifo380 != null ? `$${row.ifo380}` : "—"}</td>
                        <td className="p-3 text-right tabular-nums">{row.vlsfo != null ? `$${row.vlsfo}` : "—"}</td>
                        <td className="p-3 text-right tabular-nums">{row.mgo != null ? `$${row.mgo}` : "—"}</td>
                        <td className="p-3 text-right text-xs text-muted-foreground">{new Date(row.updatedAt).toLocaleDateString("tr-TR")}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => { setEditBunker(row); setBunkerForm({ portName: row.portName, portCode: row.portCode ?? "", region: row.region, ifo380: row.ifo380?.toString() ?? "", vlsfo: row.vlsfo?.toString() ?? "", mgo: row.mgo?.toString() ?? "" }); setBunkerDialog(true); }} data-testid={`button-edit-bunker-${row.id}`}><Edit2 className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => setDeleteBunkerTarget(row.id)} data-testid={`button-delete-bunker-${row.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="port-alerts" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                <h3 className="font-semibold text-sm">Liman Uyarıları</h3>
                <span className="text-xs text-muted-foreground">({portAlerts.length})</span>
              </div>
              <Button size="sm" onClick={() => { setEditAlert(null); setAlertForm({ portName: "", alertType: "weather", severity: "info", title: "", message: "", startsAt: "", endsAt: "", isActive: true }); setAlertDialog(true); }} data-testid="button-new-alert">
                <Plus className="w-4 h-4 mr-1.5" /> Yeni Uyarı
              </Button>
            </div>
            {portAlertsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : portAlerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Henüz liman uyarısı yok</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 font-medium">Liman</th>
                    <th className="text-left py-2 font-medium">Tip</th>
                    <th className="text-left py-2 font-medium">Önem</th>
                    <th className="text-left py-2 font-medium">Başlık</th>
                    <th className="text-left py-2 font-medium">Durum</th>
                    <th className="py-2" />
                  </tr></thead>
                  <tbody>
                    {portAlerts.map((alert: any) => (
                      <tr key={alert.id} className="border-b border-border/50 hover:bg-muted/30" data-testid={`alert-row-${alert.id}`}>
                        <td className="py-2.5 font-medium">{alert.portName || `Port #${alert.portId}`}</td>
                        <td className="py-2.5 text-muted-foreground">{ALERT_TYPE_LABELS[alert.alertType] || alert.alertType}</td>
                        <td className="py-2.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SEVERITY_CONFIG[alert.severity]?.color || ""}`}>
                            {SEVERITY_CONFIG[alert.severity]?.label || alert.severity}
                          </span>
                        </td>
                        <td className="py-2.5 truncate max-w-xs">{alert.title}</td>
                        <td className="py-2.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${alert.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                            {alert.isActive ? "Aktif" : "Pasif"}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => { setEditAlert(alert); setAlertForm({ portName: alert.portName || "", alertType: alert.alertType, severity: alert.severity, title: alert.title, message: alert.message, startsAt: alert.startsAt ? new Date(alert.startsAt).toISOString().slice(0,16) : "", endsAt: alert.endsAt ? new Date(alert.endsAt).toISOString().slice(0,16) : "", isActive: alert.isActive }); setAlertDialog(true); }} data-testid={`button-edit-alert-${alert.id}`}><Edit2 className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => setDeleteAlertTarget(alert.id)} data-testid={`button-delete-alert-${alert.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Content Management Tab */}
        <TabsContent value="content" className="space-y-4">
          <Tabs defaultValue="voyages">
            <TabsList>
              <TabsTrigger value="voyages" data-testid="tab-content-voyages">🚢 Seferler ({adminVoyages.length})</TabsTrigger>
              <TabsTrigger value="service-requests" data-testid="tab-content-sr">🔧 Hizmet Talepleri ({adminSR.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="voyages" className="space-y-3 mt-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Sefer, gemi, liman ara..." value={searchVoyages} onChange={e => setSearchVoyages(e.target.value)} className="pl-9" data-testid="input-search-voyages" />
              </div>
              {adminVoyagesLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-left bg-muted/30">
                        <th className="p-3 font-medium">ID</th>
                        <th className="p-3 font-medium">Gemi</th>
                        <th className="p-3 font-medium">Liman</th>
                        <th className="p-3 font-medium">Kullanıcı</th>
                        <th className="p-3 font-medium">Durum</th>
                        <th className="p-3 font-medium">Tarih</th>
                      </tr></thead>
                      <tbody>
                        {adminVoyages.filter((v: any) => {
                          const q = searchVoyages.toLowerCase();
                          return !q || `${v.vessel_name} ${v.port_name} ${v.first_name} ${v.last_name} ${v.status}`.toLowerCase().includes(q);
                        }).map((v: any) => (
                          <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-voyage-admin-${v.id}`}>
                            <td className="p-3 font-mono text-xs">#{v.id}</td>
                            <td className="p-3 font-medium">{v.vessel_name || "—"}</td>
                            <td className="p-3">{v.port_name || "—"}</td>
                            <td className="p-3 text-muted-foreground text-xs">{`${v.first_name || ""} ${v.last_name || ""}`.trim() || v.email || "—"}</td>
                            <td className="p-3">
                              <Badge className={`text-[10px] ${v.status === "in_progress" ? "bg-emerald-100 text-emerald-700" : v.status === "completed" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{v.status}</Badge>
                            </td>
                            <td className="p-3 text-xs text-muted-foreground">{v.created_at ? new Date(v.created_at).toLocaleDateString("tr-TR") : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </TabsContent>
            <TabsContent value="service-requests" className="space-y-3 mt-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Hizmet türü, liman, kullanıcı ara..." value={searchSR} onChange={e => setSearchSR(e.target.value)} className="pl-9" data-testid="input-search-sr" />
              </div>
              {adminSRLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-left bg-muted/30">
                        <th className="p-3 font-medium">ID</th>
                        <th className="p-3 font-medium">Hizmet Türü</th>
                        <th className="p-3 font-medium">Liman</th>
                        <th className="p-3 font-medium">Talep Eden</th>
                        <th className="p-3 font-medium">Bütçe</th>
                        <th className="p-3 font-medium">Durum</th>
                        <th className="p-3 font-medium">Tarih</th>
                      </tr></thead>
                      <tbody>
                        {adminSR.filter((s: any) => {
                          const q = searchSR.toLowerCase();
                          return !q || `${s.service_type} ${s.port_name} ${s.first_name} ${s.last_name} ${s.status}`.toLowerCase().includes(q);
                        }).map((s: any) => (
                          <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-sr-admin-${s.id}`}>
                            <td className="p-3 font-mono text-xs">#{s.id}</td>
                            <td className="p-3 font-medium">{s.service_type || "—"}</td>
                            <td className="p-3">{s.port_name || "—"}</td>
                            <td className="p-3 text-xs text-muted-foreground">{`${s.first_name || ""} ${s.last_name || ""}`.trim() || s.email || "—"}</td>
                            <td className="p-3">{s.budget_usd ? `$${Number(s.budget_usd).toLocaleString()}` : "—"}</td>
                            <td className="p-3">
                              <Badge className={`text-[10px] ${s.status === "completed" ? "bg-emerald-100 text-emerald-700" : s.status === "open" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{s.status}</Badge>
                            </td>
                            <td className="p-3 text-xs text-muted-foreground">{s.created_at ? new Date(s.created_at).toLocaleDateString("tr-TR") : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Announcements Tab */}
        <TabsContent value="announce" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5" data-testid="card-announce-form">
              <div className="flex items-center gap-2 mb-4">
                <Megaphone className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                <h3 className="font-semibold">Duyuru / Bildirim Gönder</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Hedef Kitle</Label>
                  <Select value={announceForm.targetRole} onValueChange={v => setAnnounceForm(f => ({ ...f, targetRole: v }))}>
                    <SelectTrigger data-testid="select-announce-target"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">🌐 Tüm Kullanıcılar</SelectItem>
                      <SelectItem value="shipowner">🚢 Armatörler</SelectItem>
                      <SelectItem value="agent">🤝 Acenteler</SelectItem>
                      <SelectItem value="provider">🔧 Hizmet Sağlayıcılar</SelectItem>
                      <SelectItem value="broker">📋 Brokerlar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Başlık *</Label>
                  <Input value={announceForm.title} onChange={e => setAnnounceForm(f => ({ ...f, title: e.target.value }))} placeholder="Duyuru başlığı" data-testid="input-announce-title" />
                </div>
                <div className="space-y-1.5">
                  <Label>Mesaj *</Label>
                  <Textarea value={announceForm.message} onChange={e => setAnnounceForm(f => ({ ...f, message: e.target.value }))} placeholder="Duyuru içeriği..." rows={4} data-testid="input-announce-message" />
                </div>
                <Button
                  className="w-full gap-2"
                  onClick={() => announceMutation.mutate(announceForm)}
                  disabled={!announceForm.title || !announceForm.message || announceMutation.isPending}
                  data-testid="button-send-announce"
                >
                  {announceMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                  Duyuruyu Gönder
                </Button>
              </div>
            </Card>
            <Card className="p-5" data-testid="card-announce-history">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold">Gönderim Geçmişi</h3>
              </div>
              {announceHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Henüz duyuru gönderilmedi</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Gönderilen duyurular burada görünür</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {announceHistory.map((h: any, i: number) => (
                    <div key={i} className="border rounded-lg p-3 space-y-1" data-testid={`announce-history-${i}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{h.title}</span>
                        <Badge variant="outline" className="text-[10px] flex-shrink-0">{h.sent} kişi</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{h.message}</p>
                      <p className="text-[10px] text-muted-foreground">{h.sentAt ? new Date(h.sentAt).toLocaleString("tr-TR") : ""} · Hedef: {h.targetRole === "all" ? "Tümü" : h.targetRole}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-6">
          <Card className="p-5" data-testid="card-financial-overview">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              <h3 className="font-semibold">Abonelik Durumu</h3>
            </div>
            {enhancedStats ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Free Plan", count: enhancedStats.usersByPlan?.free || 0, color: "text-muted-foreground", bg: "bg-muted/50", desc: "Ücretsiz üyeler" },
                  { label: "Standard Plan", count: enhancedStats.usersByPlan?.standard || 0, color: "text-[hsl(var(--maritime-secondary))]", bg: "bg-[hsl(var(--maritime-secondary)/0.08)]", desc: "Standart aboneler" },
                  { label: "Unlimited Plan", count: enhancedStats.usersByPlan?.unlimited || 0, color: "text-[hsl(var(--maritime-gold))]", bg: "bg-[hsl(var(--maritime-gold)/0.08)]", desc: "Premium aboneler" },
                ].map(p => (
                  <div key={p.label} className={`rounded-lg p-4 ${p.bg}`}>
                    <p className="text-xs text-muted-foreground">{p.label}</p>
                    <p className={`text-3xl font-bold font-serif mt-1 ${p.color}`}>{p.count}</p>
                    <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
                  </div>
                ))}
              </div>
            ) : <Skeleton className="h-24" />}
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold">Ödeme Sistemi</h3>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Ödeme entegrasyonu henüz aktif değil</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Stripe entegrasyonu yapılandırılmadı. Abonelikler şu an manuel olarak yönetilmektedir. Canlı ödeme takibi için Stripe'ı entegre edin.</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium">Plan Bazlı Kullanıcı Listesi</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b">
                    <th className="text-left p-2 font-medium text-muted-foreground">Kullanıcı</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Rol</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Plan</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Kullanım</th>
                  </tr></thead>
                  <tbody>
                    {(allUsers || []).filter((u: any) => u.subscriptionPlan !== "free").map((u: any) => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-2">{`${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email}</td>
                        <td className="p-2"><Badge className={`text-[10px] ${ROLE_BADGES[u.userRole] || ""}`}>{u.userRole}</Badge></td>
                        <td className="p-2">
                          <Badge className={`text-[10px] ${u.subscriptionPlan === "unlimited" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{u.subscriptionPlan}</Badge>
                        </td>
                        <td className="p-2 text-muted-foreground text-xs">{u.proformaCount}/{u.proformaLimit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Card className="p-5" data-testid="chart-user-growth">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              <h3 className="font-semibold">Kullanıcı Büyüme Grafiği (Son 6 Ay)</h3>
            </div>
            {userGrowthLoading ? <Skeleton className="h-48" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={userGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#003D7A" strokeWidth={2} name="Toplam" dot />
                  <Line type="monotone" dataKey="shipowner" stroke="#0077BE" strokeWidth={1.5} name="Armatör" dot={false} />
                  <Line type="monotone" dataKey="agent" stroke="#10B981" strokeWidth={1.5} name="Acente" dot={false} />
                  <Line type="monotone" dataKey="provider" stroke="#8B5CF6" strokeWidth={1.5} name="Provider" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
          <Card className="p-5" data-testid="table-active-users">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              <h3 className="font-semibold">En Aktif 10 Kullanıcı</h3>
            </div>
            {activeUsersLoading ? <Skeleton className="h-48" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b">
                    <th className="text-left p-2 font-medium">#</th>
                    <th className="text-left p-2 font-medium">Kullanıcı</th>
                    <th className="text-left p-2 font-medium">Rol</th>
                    <th className="text-right p-2 font-medium">Proforma</th>
                    <th className="text-right p-2 font-medium">Sefer</th>
                    <th className="text-right p-2 font-medium">Hizmet Talebi</th>
                    <th className="text-right p-2 font-medium">Toplam</th>
                  </tr></thead>
                  <tbody>
                    {activeUsers.map((u: any, i: number) => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-active-user-${u.id}`}>
                        <td className="p-2 text-muted-foreground font-mono">{i + 1}</td>
                        <td className="p-2">
                          <div>
                            <p className="font-medium text-sm">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </td>
                        <td className="p-2"><Badge className={`text-[10px] ${ROLE_BADGES[u.role] || ""}`}>{u.role}</Badge></td>
                        <td className="p-2 text-right">{u.proformaCount}</td>
                        <td className="p-2 text-right">{u.voyageCount}</td>
                        <td className="p-2 text-right">{u.srCount}</td>
                        <td className="p-2 text-right font-semibold text-[hsl(var(--maritime-primary))]">{u.totalActivity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* System Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card className="p-5" data-testid="card-system-info">
            <div className="flex items-center gap-2 mb-4">
              <Server className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              <h3 className="font-semibold">Platform Bilgileri</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "Uygulama Adı", value: "VesselPDA" },
                { label: "Versiyon", value: "1.0.0" },
                { label: "Ortam", value: "Production" },
                { label: "Veritabanı", value: "PostgreSQL" },
                { label: "Backend", value: "Express.js + Drizzle ORM" },
                { label: "Frontend", value: "React + Vite + Tailwind CSS" },
              ].map(item => (
                <div key={item.label} className="flex justify-between border-b py-2 last:border-0">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5" data-testid="card-api-status">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
              <h3 className="font-semibold">API Entegrasyonları</h3>
            </div>
            <div className="space-y-3">
              {enhancedStats?.systemHealth && [
                { name: "Veritabanı (PostgreSQL)", status: enhancedStats.systemHealth.dbOk, desc: "Ana veritabanı bağlantısı" },
                { name: "AIS Stream", status: enhancedStats.systemHealth.aisOk, desc: "Gemi takip servisi — AIS_STREAM_API_KEY" },
                { name: "Trading Economics", status: enhancedStats.systemHealth.teOk, desc: "Navlun endeksi — TRADING_ECONOMICS_API_KEY (Markets planı gerekli)" },
                { name: "Resend (Email)", status: enhancedStats.systemHealth.resendOk, desc: "Bildirim ve onay e-postaları" },
              ].map(api => (
                <div key={api.name} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${api.status ? "bg-emerald-500" : "bg-amber-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{api.name}</p>
                    <p className="text-xs text-muted-foreground">{api.desc}</p>
                  </div>
                  <Badge className={`text-[10px] flex-shrink-0 ${api.status ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}>
                    {api.status ? "Aktif" : "Pasif"}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

      </Tabs>

      {/* ── NEW DIALOGS ───────────────────────────────────────────── */}
      {/* Create User Dialog */}
      <Dialog open={createUserDialog} onOpenChange={v => { setCreateUserDialog(v); if (!v) setCreateUserForm({ email: "", password: "", firstName: "", lastName: "", userRole: "agent", subscriptionPlan: "free" }); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Yeni Kullanıcı Oluştur</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ad *</Label>
                <Input value={createUserForm.firstName} onChange={e => setCreateUserForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Ad" data-testid="input-create-first-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Soyad *</Label>
                <Input value={createUserForm.lastName} onChange={e => setCreateUserForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Soyad" data-testid="input-create-last-name" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>E-posta *</Label>
              <Input type="email" value={createUserForm.email} onChange={e => setCreateUserForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" data-testid="input-create-email" />
            </div>
            <div className="space-y-1.5">
              <Label>Şifre *</Label>
              <Input type="password" value={createUserForm.password} onChange={e => setCreateUserForm(f => ({ ...f, password: e.target.value }))} placeholder="Güçlü şifre" data-testid="input-create-password" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Rol *</Label>
                <Select value={createUserForm.userRole} onValueChange={v => setCreateUserForm(f => ({ ...f, userRole: v }))}>
                  <SelectTrigger data-testid="select-create-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shipowner">Armatör</SelectItem>
                    <SelectItem value="agent">Acente</SelectItem>
                    <SelectItem value="provider">Hizmet Sağlayıcı</SelectItem>
                    <SelectItem value="broker">Broker</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select value={createUserForm.subscriptionPlan} onValueChange={v => setCreateUserForm(f => ({ ...f, subscriptionPlan: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="unlimited">Unlimited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateUserDialog(false)}>İptal</Button>
            <Button
              onClick={() => createUserMutation.mutate(createUserForm)}
              disabled={!createUserForm.email || !createUserForm.password || !createUserForm.firstName || !createUserForm.lastName || createUserMutation.isPending}
              data-testid="button-confirm-create-user"
            >
              {createUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Kullanıcı Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Detail Sheet */}
      <Sheet open={!!userDetailId} onOpenChange={open => { if (!open) setUserDetailId(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Kullanıcı Aktivitesi</SheetTitle>
          </SheetHeader>
          {userDetailId && (
            <div className="mt-4 space-y-4">
              {(() => {
                const u = allUsers?.find((u: any) => u.id === userDetailId);
                return u ? (
                  <div className="p-4 rounded-lg bg-muted/50 space-y-1">
                    <p className="font-semibold">{u.firstName} {u.lastName}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge className={`text-[10px] ${ROLE_BADGES[u.userRole] || ""}`}>{u.userRole}</Badge>
                      <Badge variant="outline" className="text-[10px]">{u.subscriptionPlan}</Badge>
                    </div>
                  </div>
                ) : null;
              })()}
              <div>
                <h4 className="text-sm font-semibold mb-2">Son Aktiviteler</h4>
                {userActivityLoading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10" />)}</div>
                ) : (userActivity as any[]).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Henüz aktivite yok</p>
                ) : (
                  <div className="space-y-2">
                    {(userActivity as any[]).map((a: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs p-2.5 rounded-lg border">
                        <span>{a.type === "proforma" ? "📄" : a.type === "voyage" ? "🚢" : "🔧"}</span>
                        <span className="flex-1">{a.label}</span>
                        <span className="text-muted-foreground">{a.createdAt ? new Date(a.createdAt).toLocaleDateString("tr-TR") : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Rolü Değiştir</h4>
                <div className="flex gap-2">
                  <Select
                    defaultValue={allUsers?.find((u: any) => u.id === userDetailId)?.userRole}
                    onValueChange={v => changeRoleMutation.mutate({ userId: userDetailId!, userRole: v })}
                  >
                    <SelectTrigger className="flex-1" data-testid="select-change-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shipowner">Armatör</SelectItem>
                      <SelectItem value="agent">Acente</SelectItem>
                      <SelectItem value="provider">Hizmet Sağlayıcı</SelectItem>
                      <SelectItem value="broker">Broker</SelectItem>
                    </SelectContent>
                  </Select>
                  {changeRoleMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete User Confirm */}
      <AlertDialog open={!!deleteUserTarget} onOpenChange={open => { if (!open) setDeleteUserTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kullanıcıyı Sil</AlertDialogTitle>
            <AlertDialogDescription>
              Bu kullanıcı ve tüm ilişkili veriler kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserTarget && deleteUserMutation.mutate(deleteUserTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-user"
            >
              {deleteUserMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Kalıcı Olarak Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Port Alert Dialog */}
      <Dialog open={alertDialog} onOpenChange={v => { setAlertDialog(v); if (!v) { setEditAlert(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editAlert ? "Uyarıyı Düzenle" : "Yeni Liman Uyarısı"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Liman Adı *</Label>
                <Input value={alertForm.portName} onChange={e => setAlertForm(f => ({ ...f, portName: e.target.value }))} placeholder="İstanbul" data-testid="input-alert-port-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Uyarı Tipi</Label>
                <Select value={alertForm.alertType} onValueChange={v => setAlertForm(f => ({ ...f, alertType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strike">Grev</SelectItem>
                    <SelectItem value="closure">Kapanış</SelectItem>
                    <SelectItem value="weather">Hava Durumu</SelectItem>
                    <SelectItem value="restricted">Kısıtlama</SelectItem>
                    <SelectItem value="other">Diğer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Önem Derecesi</Label>
                <Select value={alertForm.severity} onValueChange={v => setAlertForm(f => ({ ...f, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Bilgi</SelectItem>
                    <SelectItem value="warning">Uyarı</SelectItem>
                    <SelectItem value="danger">Tehlike</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex flex-col justify-end pb-0.5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={alertForm.isActive} onChange={e => setAlertForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 rounded border-border" />
                  Aktif
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Başlık *</Label>
              <Input value={alertForm.title} onChange={e => setAlertForm(f => ({ ...f, title: e.target.value }))} placeholder="Uyarı başlığı" />
            </div>
            <div className="space-y-1.5">
              <Label>Mesaj *</Label>
              <textarea value={alertForm.message} onChange={e => setAlertForm(f => ({ ...f, message: e.target.value }))} placeholder="Uyarı mesajı..." className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Başlangıç</Label>
                <Input type="datetime-local" value={alertForm.startsAt} onChange={e => setAlertForm(f => ({ ...f, startsAt: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Bitiş</Label>
                <Input type="datetime-local" value={alertForm.endsAt} onChange={e => setAlertForm(f => ({ ...f, endsAt: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlertDialog(false)}>İptal</Button>
            <Button onClick={() => editAlert ? editAlertMutation.mutate(editAlert.id) : addAlertMutation.mutate()} disabled={!alertForm.portName || !alertForm.title || !alertForm.message || addAlertMutation.isPending || editAlertMutation.isPending}>
              {(addAlertMutation.isPending || editAlertMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editAlert ? "Güncelle" : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteAlertTarget !== null} onOpenChange={() => setDeleteAlertTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Uyarıyı Sil</AlertDialogTitle><AlertDialogDescription>Bu liman uyarısı kalıcı olarak silinecek.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAlertTarget && deleteAlertMutation.mutate(deleteAlertTarget)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bunker Dialog */}
      <Dialog open={bunkerDialog} onOpenChange={v => { setBunkerDialog(v); if (!v) { setBunkerForm({ portName: "", portCode: "", region: "TR", ifo380: "", vlsfo: "", mgo: "" }); setEditBunker(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editBunker ? "Fiyatı Güncelle" : "Yeni Bunker Fiyatı"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Liman Adı *</Label>
                <Input value={bunkerForm.portName} onChange={e => setBunkerForm(f => ({ ...f, portName: e.target.value }))} placeholder="İstanbul" data-testid="input-bunker-port-name" />
              </div>
              <div>
                <Label>LOCODE</Label>
                <Input value={bunkerForm.portCode} onChange={e => setBunkerForm(f => ({ ...f, portCode: e.target.value }))} placeholder="TRIST" data-testid="input-bunker-port-code" />
              </div>
              <div>
                <Label>Bölge</Label>
                <Select value={bunkerForm.region} onValueChange={v => setBunkerForm(f => ({ ...f, region: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(REGION_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>IFO 380</Label>
                <Input type="number" value={bunkerForm.ifo380} onChange={e => setBunkerForm(f => ({ ...f, ifo380: e.target.value }))} placeholder="410" data-testid="input-bunker-ifo380" />
              </div>
              <div>
                <Label>VLSFO</Label>
                <Input type="number" value={bunkerForm.vlsfo} onChange={e => setBunkerForm(f => ({ ...f, vlsfo: e.target.value }))} placeholder="545" data-testid="input-bunker-vlsfo" />
              </div>
              <div className="col-span-2">
                <Label>MGO</Label>
                <Input type="number" value={bunkerForm.mgo} onChange={e => setBunkerForm(f => ({ ...f, mgo: e.target.value }))} placeholder="715" data-testid="input-bunker-mgo" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBunkerDialog(false)}>İptal</Button>
            <Button onClick={() => editBunker ? editBunkerMutation.mutate(editBunker.id) : addBunkerMutation.mutate()} disabled={!bunkerForm.portName || addBunkerMutation.isPending || editBunkerMutation.isPending} data-testid="button-save-bunker">
              {(addBunkerMutation.isPending || editBunkerMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editBunker ? "Güncelle" : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteBunkerTarget !== null} onOpenChange={() => setDeleteBunkerTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Kaydı Sil</AlertDialogTitle><AlertDialogDescription>Bu bunker fiyat kaydı silinecek.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteBunkerTarget && deleteBunkerMutation.mutate(deleteBunkerTarget)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete-bunker">Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
