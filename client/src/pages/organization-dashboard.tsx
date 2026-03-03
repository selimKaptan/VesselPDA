import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Building2, Users, Ship, Navigation, FileText, Receipt,
  Plus, Trash2, Edit2, Check, X, Download, Filter,
  BarChart3, Activity, Settings, Shield, Clock, ChevronDown,
  UserPlus, Mail, Crown, Eye, AlertTriangle, Loader2, RefreshCw,
  Calendar, Search
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { PageMeta } from "@/components/page-meta";
import type { OrgPermissions } from "@shared/schema";

const MODULES = [
  { key: "vessels",      label: "Vessels",      actions: ["view","create","edit","delete"] },
  { key: "voyages",      label: "Voyages",       actions: ["view","create","edit","delete"] },
  { key: "proformas",    label: "Proformas",     actions: ["view","create","edit","delete","approve","send"] },
  { key: "invoices",     label: "Invoices",      actions: ["view","create","edit","delete","pay"] },
  { key: "tenders",      label: "Tenders",       actions: ["view","create","bid","nominate"] },
  { key: "documents",    label: "Documents",     actions: ["view","upload","delete","sign"] },
  { key: "messages",     label: "Messages",      actions: ["view","send"] },
  { key: "fixtures",     label: "Fixtures",      actions: ["view","create","edit"] },
  { key: "crew",         label: "Crew",          actions: ["view","manage"] },
  { key: "certificates", label: "Certificates",  actions: ["view","manage"] },
  { key: "reports",      label: "Reports",       actions: ["view","export"] },
  { key: "settings",     label: "Settings",      actions: ["view","manage"] },
  { key: "members",      label: "Members",       actions: ["view","invite","remove","editRoles"] },
] as const;

function buildDefaultPermissions(): OrgPermissions {
  const p: any = {};
  MODULES.forEach(m => {
    p[m.key] = {};
    m.actions.forEach(a => { p[m.key][a] = false; });
  });
  return p;
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: any; color: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

function ActivityItem({ item }: { item: any }) {
  const time = new Date(item.created_at);
  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Activity className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{item.first_name} {item.last_name}</span>
          {" — "}
          <span className="text-muted-foreground">{item.description}</span>
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {time.toLocaleDateString()} {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      <Badge variant="outline" className="text-[9px] capitalize flex-shrink-0">{item.action}</Badge>
    </div>
  );
}

export default function OrganizationDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const userId = (user as any)?.id || (user as any)?.claims?.sub;

  const { data: myOrgs = [] } = useQuery<any[]>({ queryKey: ["/api/organizations/my"] });
  const activeOrgId = (user as any)?.activeOrganizationId;
  const activeOrg = myOrgs.find((o: any) => o.id === activeOrgId) || myOrgs[0];
  const orgId = activeOrg?.id;

  const isOrgAdmin = activeOrg?.role === "admin" || activeOrg?.role === "owner" || activeOrg?.owner_id === userId;

  const { data: org, refetch: refetchOrg } = useQuery<any>({
    queryKey: ["/api/organizations", orgId],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${orgId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!orgId,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/organizations", orgId, "dashboard-stats"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${orgId}/dashboard-stats`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!orgId,
  });

  const { data: chartData = [] } = useQuery<any[]>({
    queryKey: ["/api/organizations", orgId, "activity-chart"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${orgId}/activity-chart`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!orgId,
  });

  const { data: members = [], refetch: refetchMembers } = useQuery<any[]>({
    queryKey: ["/api/organizations", orgId, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${orgId}/members`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!orgId,
  });

  const { data: invites = [], refetch: refetchInvites } = useQuery<any[]>({
    queryKey: ["/api/organizations", orgId, "invites"],
    queryFn: async () => {
      if (!isOrgAdmin) return [];
      const res = await fetch(`/api/organizations/${orgId}/invites`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!orgId && isOrgAdmin,
  });

  const { data: roles = [], refetch: refetchRoles } = useQuery<any[]>({
    queryKey: ["/api/organizations", orgId, "roles"],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${orgId}/roles`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!orgId,
  });

  const [activityPage, setActivityPage] = useState(1);
  const [activityUserId, setActivityUserId] = useState("");
  const [activityAction, setActivityAction] = useState("");
  const [activityFrom, setActivityFrom] = useState("");
  const [activityTo, setActivityTo] = useState("");
  const [activitySearch, setActivitySearch] = useState("");

  const activityQueryKey = ["/api/organizations", orgId, "activity",
    { page: activityPage, userId: activityUserId, action: activityAction, from: activityFrom, to: activityTo }];

  const { data: activityResp, isFetching: activityLoading } = useQuery<any>({
    queryKey: activityQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(activityPage), limit: "25" });
      if (activityUserId) params.set("userId", activityUserId);
      if (activityAction) params.set("action", activityAction);
      if (activityFrom) params.set("from", activityFrom);
      if (activityTo) params.set("to", activityTo);
      const res = await fetch(`/api/organizations/${orgId}/activity?${params}`);
      if (!res.ok) return { data: [], total: 0 };
      return res.json();
    },
    enabled: !!orgId,
  });
  const activityRows: any[] = activityResp?.data || [];
  const activityTotal: number = activityResp?.total || 0;

  const recentActivity = useMemo(() => activityRows.slice(0, 6), [activityRows]);

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [editMemberRole, setEditMemberRole] = useState("");
  const [editMemberDept, setEditMemberDept] = useState("");

  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [roleForm, setRoleForm] = useState({ name: "", color: "#3B82F6", permissions: buildDefaultPermissions() });

  const [settingsForm, setSettingsForm] = useState({ name: "", website: "", phone: "", address: "" });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  if (org && !settingsLoaded) {
    setSettingsForm({ name: org.name || "", website: org.website || "", phone: org.phone || "", address: org.address || "" });
    setSettingsLoaded(true);
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  const inviteMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/organizations/${orgId}/invite`, { email: inviteEmail, role: inviteRole }),
    onSuccess: () => { refetchInvites(); setShowInviteDialog(false); setInviteEmail(""); toast({ title: "Invitation sent" }); },
    onError: () => toast({ title: "Failed to invite", variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (membUserId: string) => apiRequest("DELETE", `/api/organizations/${orgId}/members/${membUserId}`),
    onSuccess: () => { refetchMembers(); toast({ title: "Member removed" }); },
    onError: () => toast({ title: "Failed to remove member", variant: "destructive" }),
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ membUserId, role, department }: any) =>
      apiRequest("PATCH", `/api/organizations/${orgId}/members/${membUserId}`, { role, department }),
    onSuccess: () => { refetchMembers(); setEditingMember(null); toast({ title: "Member updated" }); },
    onError: () => toast({ title: "Failed to update member", variant: "destructive" }),
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (inviteId: number) => apiRequest("DELETE", `/api/organizations/${orgId}/invites/${inviteId}`),
    onSuccess: () => { refetchInvites(); toast({ title: "Invite cancelled" }); },
    onError: () => toast({ title: "Failed to cancel invite", variant: "destructive" }),
  });

  const createRoleMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/organizations/${orgId}/roles`, data),
    onSuccess: () => { refetchRoles(); setShowRoleDialog(false); toast({ title: "Role created" }); },
    onError: () => toast({ title: "Failed to create role", variant: "destructive" }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest("PATCH", `/api/organizations/${orgId}/roles/${id}`, data),
    onSuccess: () => { refetchRoles(); setShowRoleDialog(false); toast({ title: "Role updated" }); },
    onError: () => toast({ title: "Failed to update role", variant: "destructive" }),
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: number) => apiRequest("DELETE", `/api/organizations/${orgId}/roles/${roleId}`),
    onSuccess: () => { refetchRoles(); toast({ title: "Role deleted" }); },
    onError: () => toast({ title: "Cannot delete built-in roles", variant: "destructive" }),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/organizations/${orgId}`, data),
    onSuccess: () => { refetchOrg(); queryClient.invalidateQueries({ queryKey: ["/api/organizations/my"] }); toast({ title: "Settings saved" }); },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const deleteOrgMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/organizations/${orgId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/my"] });
      toast({ title: "Organization deleted" });
      navigate("/organization");
    },
    onError: () => toast({ title: "Failed to delete organization", variant: "destructive" }),
  });

  function openCreateRole() {
    setEditingRole(null);
    setRoleForm({ name: "", color: "#3B82F6", permissions: buildDefaultPermissions() });
    setShowRoleDialog(true);
  }

  function openEditRole(role: any) {
    setEditingRole(role);
    setRoleForm({ name: role.name, color: role.color, permissions: role.permissions });
    setShowRoleDialog(true);
  }

  function togglePerm(mod: string, action: string, val: boolean) {
    setRoleForm(f => ({
      ...f,
      permissions: {
        ...f.permissions,
        [mod]: { ...(f.permissions as any)[mod], [action]: val }
      }
    }));
  }

  function exportActivityCSV() {
    const headers = ["Date", "User", "Action", "Entity Type", "Entity ID", "Description"];
    const rows = activityRows.map((r: any) => [
      new Date(r.created_at).toISOString(),
      `${r.first_name} ${r.last_name}`,
      r.action, r.entity_type, r.entity_id, r.description
    ]);
    const csv = [headers, ...rows].map(r => r.map((c: any) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `activity-${orgId}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center gap-4">
        <Building2 className="w-12 h-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">You are not a member of any organization.</p>
        <Button onClick={() => navigate("/organization")}>Create or Join Organization</Button>
      </div>
    );
  }

  return (
    <div className="px-3 py-5 space-y-5 max-w-7xl mx-auto">
      <PageMeta title={`${org?.name || "Organization"} Dashboard | VesselPDA`} description="Organization management panel" />

      {/* Header */}
      <div className="flex items-center gap-4">
        {org?.logo_url ? (
          <img src={org.logo_url} alt={org.name} className="w-12 h-12 rounded-lg object-contain border" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
        )}
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">{org?.name || "Organization Dashboard"}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="capitalize text-xs">{org?.type?.replace("_", " ") || "Organization"}</Badge>
            {isOrgAdmin && <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">Admin</Badge>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-1.5" data-testid="tab-overview"><BarChart3 className="w-3.5 h-3.5" />Overview</TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5" data-testid="tab-members"><Users className="w-3.5 h-3.5" />Members</TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5" data-testid="tab-roles"><Shield className="w-3.5 h-3.5" />Roles</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5" data-testid="tab-activity"><Activity className="w-3.5 h-3.5" />Activity</TabsTrigger>
          {isOrgAdmin && <TabsTrigger value="settings" className="gap-1.5" data-testid="tab-settings"><Settings className="w-3.5 h-3.5" />Settings</TabsTrigger>}
        </TabsList>

        {/* ── OVERVIEW ─────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-5 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Total Members" value={stats?.members?.total ?? "—"} sub={`${stats?.members?.active ?? 0} active`} icon={Users} color="bg-blue-500" />
            <StatCard label="Vessels" value={stats?.vessels?.total ?? "—"} icon={Ship} color="bg-cyan-500" />
            <StatCard label="Active Voyages" value={stats?.voyages?.active ?? "—"} sub={`${stats?.voyages?.total ?? 0} total`} icon={Navigation} color="bg-emerald-500" />
            <StatCard label="Proformas This Month" value={stats?.proformas?.thisMonthAmount ? `$${Number(stats.proformas.thisMonthAmount).toLocaleString("en", { maximumFractionDigits: 0 })}` : "—"} icon={FileText} color="bg-violet-500" />
            <StatCard label="Pending Invoices" value={stats?.invoices?.pending ?? "—"} sub={`${stats?.invoices?.total ?? 0} total`} icon={Receipt} color="bg-amber-500" />
          </div>

          {/* Chart */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Team Performance — Last 30 Days</h3>
            </div>
            {chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gVoyages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gProformas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gInvoices" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                  <Tooltip labelFormatter={v => String(v)} contentStyle={{ fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="voyages" stroke="#10B981" fill="url(#gVoyages)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="proformas" stroke="#8B5CF6" fill="url(#gProformas)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="invoices" stroke="#F59E0B" fill="url(#gInvoices)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Recent Activity */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Recent Activity</h3>
              </div>
            </div>
            {activityRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No activity recorded yet.</p>
            ) : (
              recentActivity.map((item: any) => <ActivityItem key={item.id} item={item} />)
            )}
          </Card>
        </TabsContent>

        {/* ── MEMBERS ──────────────────────────────────────────────── */}
        <TabsContent value="members" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold">Members ({members.length})</h2>
            {isOrgAdmin && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowInviteDialog(true)} data-testid="button-invite-member">
                <UserPlus className="w-3.5 h-3.5" /> Invite Member
              </Button>
            )}
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Joined</TableHead>
                  {isOrgAdmin && <TableHead className="w-24">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m: any) => (
                  <TableRow key={m.user_id} data-testid={`member-row-${m.user_id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {(m.first_name?.[0] || m.email?.[0] || "?").toUpperCase()}
                        </div>
                        <span className="text-sm font-medium">{m.first_name} {m.last_name}</span>
                        {m.user_id === activeOrg?.owner_id && <Crown className="w-3 h-3 text-amber-500" title="Owner" />}
                        {m.user_id === userId && <Badge variant="outline" className="text-[9px]">You</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.email}</TableCell>
                    <TableCell>
                      {editingMember?.user_id === m.user_id ? (
                        <Select value={editMemberRole} onValueChange={setEditMemberRole}>
                          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={`text-[10px] capitalize ${m.role === "owner" ? "border-amber-300 text-amber-600" : m.role === "admin" ? "border-blue-300 text-blue-600" : ""}`}>
                          {m.role}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingMember?.user_id === m.user_id ? (
                        <Input value={editMemberDept} onChange={e => setEditMemberDept(e.target.value)} className="h-7 w-32 text-xs" placeholder="e.g. Operations" />
                      ) : (
                        <span className="text-sm text-muted-foreground">{m.department || "—"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : "—"}
                    </TableCell>
                    {isOrgAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          {editingMember?.user_id === m.user_id ? (
                            <>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateMemberMutation.mutate({ membUserId: m.user_id, role: editMemberRole, department: editMemberDept })} disabled={updateMemberMutation.isPending}>
                                <Check className="w-3.5 h-3.5 text-green-600" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingMember(null)}>
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="icon" variant="ghost" className="h-6 w-6" title="Edit" onClick={() => { setEditingMember(m); setEditMemberRole(m.role); setEditMemberDept(m.department || ""); }}>
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              {m.user_id !== activeOrg?.owner_id && m.user_id !== userId && (
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" title="Remove" onClick={() => removeMemberMutation.mutate(m.user_id)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Pending Invites */}
          {isOrgAdmin && invites.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pending Invites ({invites.length})</h3>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Invited By</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="w-20">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.map((inv: any) => (
                      <TableRow key={inv.id} data-testid={`invite-row-${inv.id}`}>
                        <TableCell className="text-sm flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-muted-foreground" />{inv.invited_email}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize text-[10px]">{inv.role}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{inv.first_name} {inv.last_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : "—"}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" className="text-xs h-6 gap-1 text-red-500 border-red-200"
                            onClick={() => cancelInviteMutation.mutate(inv.id)} disabled={cancelInviteMutation.isPending}>
                            <X className="w-3 h-3" /> Cancel
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── ROLES ────────────────────────────────────────────────── */}
        <TabsContent value="roles" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Roles ({roles.length})</h2>
            {isOrgAdmin && (
              <Button size="sm" className="gap-1.5" onClick={openCreateRole} data-testid="button-create-role">
                <Plus className="w-3.5 h-3.5" /> New Role
              </Button>
            )}
          </div>

          <div className="grid gap-3">
            {roles.map((role: any) => (
              <Card key={role.id} className="p-4" data-testid={`role-card-${role.id}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{role.name}</span>
                        {role.is_owner_role && <Badge className="text-[9px] bg-amber-100 text-amber-700 border-0">Owner</Badge>}
                        {role.is_default && <Badge variant="outline" className="text-[9px]">Default</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{role.member_count || 0} members</p>
                    </div>
                  </div>
                  {isOrgAdmin && !role.is_owner_role && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditRole(role)}><Edit2 className="w-3.5 h-3.5" /></Button>
                      {!role.is_default && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteRoleMutation.mutate(role.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      )}
                    </div>
                  )}
                </div>
                {/* Permission preview */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {role.permissions && MODULES.map(m => {
                    const modPerms = (role.permissions as any)[m.key] || {};
                    const activePerms = m.actions.filter(a => modPerms[a]);
                    if (activePerms.length === 0) return null;
                    return (
                      <Badge key={m.key} variant="outline" className="text-[9px]">
                        {m.label}: {activePerms.join(", ")}
                      </Badge>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── ACTIVITY ─────────────────────────────────────────────── */}
        <TabsContent value="activity" className="space-y-4 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-semibold">Activity Log {activityTotal > 0 && <span className="text-muted-foreground font-normal text-sm">({activityTotal} total)</span>}</h2>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={exportActivityCSV} data-testid="button-export-csv">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>

          {/* Filters */}
          <Card className="p-3">
            <div className="flex items-center gap-1 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Filter className="w-3 h-3" /> Filters
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Select value={activityUserId} onValueChange={v => { setActivityUserId(v === "_all" ? "" : v); setActivityPage(1); }}>
                <SelectTrigger className="h-8 text-xs" data-testid="filter-activity-user"><SelectValue placeholder="All members" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All members</SelectItem>
                  {members.map((m: any) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={activityAction} onValueChange={v => { setActivityAction(v === "_all" ? "" : v); setActivityPage(1); }}>
                <SelectTrigger className="h-8 text-xs" data-testid="filter-activity-action"><SelectValue placeholder="All actions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All actions</SelectItem>
                  {["create","update","delete","invite","approve","send","upload"].map(a => (
                    <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" className="h-8 text-xs" value={activityFrom} onChange={e => { setActivityFrom(e.target.value); setActivityPage(1); }} placeholder="From" />
              <Input type="date" className="h-8 text-xs" value={activityTo} onChange={e => { setActivityTo(e.target.value); setActivityPage(1); }} placeholder="To" />
            </div>
            {(activityUserId || activityAction || activityFrom || activityTo) && (
              <Button size="sm" variant="ghost" className="mt-2 h-7 text-xs gap-1 text-muted-foreground" onClick={() => { setActivityUserId(""); setActivityAction(""); setActivityFrom(""); setActivityTo(""); setActivityPage(1); }}>
                <X className="w-3 h-3" /> Clear filters
              </Button>
            )}
          </Card>

          <Card>
            {activityLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : activityRows.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">No activity matches your filters.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityRows.map((r: any) => (
                    <TableRow key={r.id} data-testid={`activity-row-${r.id}`}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString()}{" "}
                        {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{r.first_name} {r.last_name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{r.action}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground capitalize">{r.entity_type} {r.entity_id ? `#${r.entity_id}` : ""}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{r.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {/* Pagination */}
            {activityTotal > 25 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
                <span>Page {activityPage} of {Math.ceil(activityTotal / 25)}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={activityPage <= 1} onClick={() => setActivityPage(p => p - 1)}>Previous</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={activityPage >= Math.ceil(activityTotal / 25)} onClick={() => setActivityPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── SETTINGS ─────────────────────────────────────────────── */}
        {isOrgAdmin && (
          <TabsContent value="settings" className="space-y-5 mt-4">
            <Card className="p-5 space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Organization Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Organization Name *</Label>
                  <Input data-testid="input-org-name" value={settingsForm.name} onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input data-testid="input-org-website" value={settingsForm.website} onChange={e => setSettingsForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input data-testid="input-org-phone" value={settingsForm.phone} onChange={e => setSettingsForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input data-testid="input-org-address" value={settingsForm.address} onChange={e => setSettingsForm(f => ({ ...f, address: e.target.value }))} />
                </div>
              </div>
              <Button onClick={() => updateSettingsMutation.mutate(settingsForm)} disabled={updateSettingsMutation.isPending} data-testid="button-save-settings">
                {updateSettingsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Save Changes
              </Button>
            </Card>

            {/* Danger Zone */}
            <Card className="p-5 border-red-200 dark:border-red-900/50 space-y-3">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <h3 className="font-semibold text-sm">Danger Zone</h3>
              </div>
              <p className="text-sm text-muted-foreground">Permanently delete this organization and all associated data. This action cannot be undone.</p>
              <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setShowDeleteConfirm(true)} data-testid="button-delete-org">
                <Trash2 className="w-3.5 h-3.5" /> Delete Organization
              </Button>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* ── Invite Member Dialog ───────────────────────────────────── */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-serif flex items-center gap-2"><UserPlus className="w-4 h-4" /> Invite Member</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Email Address *</Label>
              <Input data-testid="input-invite-email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="name@company.com" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger data-testid="select-invite-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button data-testid="button-send-invite" onClick={() => inviteMutation.mutate()} disabled={!inviteEmail || inviteMutation.isPending}>
              {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Mail className="w-4 h-4 mr-1" />}
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Role Create/Edit Dialog ─────────────────────────────────── */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif flex items-center gap-2"><Shield className="w-4 h-4" /> {editingRole ? "Edit Role" : "New Role"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label>Role Name *</Label>
                <Input data-testid="input-role-name" value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Operations Manager" />
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <input type="color" value={roleForm.color} onChange={e => setRoleForm(f => ({ ...f, color: e.target.value }))} className="h-10 w-16 rounded-md border cursor-pointer" data-testid="input-role-color" />
              </div>
            </div>

            {/* Permissions Matrix */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Permissions</Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Module</th>
                      <th className="px-2 py-2 font-medium text-center" colSpan={6}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((mod, i) => {
                      const modPerms = (roleForm.permissions as any)[mod.key] || {};
                      return (
                        <tr key={mod.key} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                          <td className="px-3 py-2 font-medium">{mod.label}</td>
                          {mod.actions.map(action => (
                            <td key={action} className="px-2 py-2 text-center">
                              <label className="flex flex-col items-center gap-0.5 cursor-pointer" title={action}>
                                <input
                                  type="checkbox"
                                  checked={!!modPerms[action]}
                                  onChange={e => togglePerm(mod.key, action, e.target.checked)}
                                  className="rounded"
                                  data-testid={`perm-${mod.key}-${action}`}
                                />
                                <span className="text-[9px] text-muted-foreground capitalize">{action}</span>
                              </label>
                            </td>
                          ))}
                          {Array.from({ length: 6 - mod.actions.length }).map((_, j) => <td key={j} />)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>Cancel</Button>
            <Button
              data-testid="button-save-role"
              onClick={() => {
                if (editingRole) updateRoleMutation.mutate({ id: editingRole.id, ...roleForm });
                else createRoleMutation.mutate(roleForm);
              }}
              disabled={!roleForm.name || createRoleMutation.isPending || updateRoleMutation.isPending}
            >
              {(createRoleMutation.isPending || updateRoleMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {editingRole ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ──────────────────────────────────── */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-serif flex items-center gap-2 text-red-600"><AlertTriangle className="w-4 h-4" /> Delete Organization</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">This will permanently delete <strong>{org?.name}</strong> and all associated data. Type the organization name to confirm.</p>
            <Input data-testid="input-delete-confirm" value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder={org?.name} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button
              variant="destructive"
              data-testid="button-confirm-delete-org"
              disabled={deleteInput !== org?.name || deleteOrgMutation.isPending}
              onClick={() => deleteOrgMutation.mutate()}
            >
              {deleteOrgMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
