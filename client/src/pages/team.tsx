import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, MoreVertical, Mail, Shield, Building2, UserCheck, Loader2, RefreshCw, Trash2, UserX, UserCheck2, Edit3 } from "lucide-react";
import { fmtDate } from "@/lib/formatDate";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  admin: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  manager: "bg-purple-500/15 text-purple-500 border-purple-500/30",
  member: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  viewer: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

const PERMISSION_LABELS: Record<string, string> = {
  canCreateProforma: "Create PDA",
  canApproveProforma: "Approve PDA",
  canCreateTender: "Create Tender",
  canManageVoyages: "Manage Voyages",
  canManageVessels: "Manage Vessels",
  canViewFinance: "View Finance",
  canManageTeam: "Manage Team",
  canSendMessages: "Send Messages",
};

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS);

const INDUSTRIES = [
  { value: "agency", label: "Shipping Agency" },
  { value: "shipowner", label: "Shipowner" },
  { value: "brokerage", label: "Brokerage" },
  { value: "services", label: "Service Provider" },
];

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ROLE_COLORS[role] ?? ROLE_COLORS.viewer}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${active ? "bg-green-500" : "bg-slate-500"}`} />
  );
}

function initials(firstName: string | null, lastName: string | null, email: string | null) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  if (email) return email[0].toUpperCase();
  return "?";
}

function CreateOrgCard({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: { name: string; industry?: string }) => apiRequest("POST", "/api/organizations", data),
    onSuccess: () => {
      toast({ title: "Organization created!", description: "Your team workspace is ready." });
      qc.invalidateQueries({ queryKey: ["/api/organizations/my"] });
      onCreated();
    },
    onError: () => {
      toast({ title: "Failed to create organization", variant: "destructive" });
    },
  });

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="p-8 max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7 text-sky-400" />
          </div>
          <h2 className="text-xl font-semibold">Create Your Organization</h2>
          <p className="text-sm text-muted-foreground">Set up a team workspace to invite colleagues and manage shared resources.</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Organization Name</label>
            <Input
              placeholder="e.g. Barbaros Shipping Co."
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-org-name"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Industry</label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger data-testid="select-org-industry">
                <SelectValue placeholder="Select industry..." />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((i) => (
                  <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            disabled={!name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate({ name: name.trim(), industry: industry || undefined })}
            data-testid="button-create-org"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Create Organization
          </Button>
        </div>
      </Card>
    </div>
  );
}

function InviteDialog({ orgId, open, onClose }: { orgId: number; open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [department, setDepartment] = useState("");
  const [title, setTitle] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const inviteMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/organizations/${orgId}/invite`, data),
    onSuccess: () => {
      toast({ title: "Invitation sent!", description: `Invite sent to ${email}` });
      qc.invalidateQueries({ queryKey: ["/api/organizations", orgId, "invites"] });
      qc.invalidateQueries({ queryKey: ["/api/organizations", orgId, "stats"] });
      setEmail(""); setRole("member"); setDepartment(""); setTitle("");
      onClose();
    },
    onError: (err: any) => {
      toast({ title: err?.message ?? "Failed to send invitation", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="dialog-invite-member">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-sky-400" /> Invite Team Member
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email Address <span className="text-red-400">*</span></label>
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-invite-email"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Role</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger data-testid="select-invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin — Full access except ownership transfer</SelectItem>
                <SelectItem value="manager">Manager — Create PDAs, tenders, manage voyages</SelectItem>
                <SelectItem value="member">Member — Standard operational access</SelectItem>
                <SelectItem value="viewer">Viewer — Read-only access</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Department</label>
              <Input
                placeholder="e.g. Operations"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                data-testid="input-invite-department"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Job Title</label>
              <Input
                placeholder="e.g. Port Agent"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-invite-title"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!email.trim() || !email.includes("@") || inviteMutation.isPending}
            onClick={() => inviteMutation.mutate({ email, orgRole: role, department: department || undefined, title: title || undefined })}
            data-testid="button-send-invite"
          >
            {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditMemberDialog({ member, orgId, open, onClose }: { member: any; orgId: number; open: boolean; onClose: () => void }) {
  const [orgRole, setOrgRole] = useState(member?.role ?? member?.orgRole ?? "member");
  const [department, setDepartment] = useState(member?.department ?? "");
  const [title, setTitle] = useState(member?.jobTitle ?? member?.title ?? "");
  const { toast } = useToast();
  const qc = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/organizations/${orgId}/members/${member.id}`, data),
    onSuccess: () => {
      toast({ title: "Member updated" });
      qc.invalidateQueries({ queryKey: ["/api/organizations", orgId, "members"] });
      onClose();
    },
    onError: () => {
      toast({ title: "Update failed", variant: "destructive" });
    },
  });

  if (!member) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Member — {member.firstName} {member.lastName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Role</label>
            <Select value={orgRole} onValueChange={setOrgRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Department</label>
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Job Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Job title" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ orgRole, department: department || undefined, title: title || undefined })}>
            {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembersTab({ org, myRole }: { org: any; myRole: string }) {
  const [showInvite, setShowInvite] = useState(false);
  const [editMember, setEditMember] = useState<any>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: members = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/organizations", org.id, "members"],
    queryFn: () => fetch(`/api/organizations/${org.id}/members`, { credentials: "include" }).then((r) => r.json()),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: number) => apiRequest("DELETE", `/api/organizations/${org.id}/members/${memberId}`, {}),
    onSuccess: () => {
      toast({ title: "Member removed" });
      qc.invalidateQueries({ queryKey: ["/api/organizations", org.id, "members"] });
      qc.invalidateQueries({ queryKey: ["/api/organizations", org.id, "stats"] });
    },
    onError: () => toast({ title: "Failed to remove member", variant: "destructive" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (memberId: number) => apiRequest("POST", `/api/organizations/${org.id}/members/${memberId}/deactivate`, {}),
    onSuccess: () => {
      toast({ title: "Member deactivated" });
      qc.invalidateQueries({ queryKey: ["/api/organizations", org.id, "members"] });
    },
    onError: () => toast({ title: "Failed to deactivate", variant: "destructive" }),
  });

  const reactivateMutation = useMutation({
    mutationFn: (memberId: number) => apiRequest("PATCH", `/api/organizations/${org.id}/members/${memberId}`, { isActive: true }),
    onSuccess: () => {
      toast({ title: "Member reactivated" });
      qc.invalidateQueries({ queryKey: ["/api/organizations", org.id, "members"] });
    },
    onError: () => toast({ title: "Failed to reactivate", variant: "destructive" }),
  });

  const canManage = ["owner", "admin"].includes(myRole);
  const canInvite = ["owner", "admin", "manager"].includes(myRole);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{members.length} member{members.length !== 1 ? "s" : ""}</p>
        {canInvite && (
          <Button size="sm" onClick={() => setShowInvite(true)} data-testid="button-invite-member">
            <Plus className="w-4 h-4 mr-1" /> Invite Member
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm" data-testid="table-members">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Member</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Department</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Joined</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                {canManage && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {members.map((m: any) => (
                <tr
                  key={m.id}
                  className={`border-b last:border-0 transition-colors hover:bg-muted/20 ${!m.isActive ? "opacity-60" : ""}`}
                  data-testid={`row-member-${m.userId}`}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={m.profileImageUrl ?? undefined} />
                        <AvatarFallback className="text-xs bg-sky-500/10 text-sky-400">
                          {initials(m.firstName, m.lastName, m.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{m.firstName} {m.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <RoleBadge role={m.role ?? m.orgRole ?? "member"} />
                  </td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">{m.department ?? "—"}</td>
                  <td className="p-3 hidden lg:table-cell text-muted-foreground text-xs">
                    {m.joinedAt ? fmtDate(m.joinedAt) : "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <StatusDot active={m.isActive} />
                      <span className="text-xs text-muted-foreground">{m.isActive ? "Active" : "Inactive"}</span>
                    </div>
                  </td>
                  {canManage && (
                    <td className="p-3">
                      {m.orgRole !== "owner" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-edit-role-${m.userId}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditMember(m)}>
                              <Edit3 className="w-3.5 h-3.5 mr-2" /> Edit Role
                            </DropdownMenuItem>
                            {m.isActive ? (
                              <DropdownMenuItem onClick={() => deactivateMutation.mutate(m.id)}>
                                <UserX className="w-3.5 h-3.5 mr-2" /> Deactivate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => reactivateMutation.mutate(m.id)}>
                                <UserCheck2 className="w-3.5 h-3.5 mr-2" /> Reactivate
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-red-500 focus:text-red-500"
                              onClick={() => {
                                if (confirm(`Remove ${m.firstName} ${m.lastName} from the organization?`)) {
                                  removeMutation.mutate(m.id);
                                }
                              }}
                              data-testid={`button-remove-member-${m.userId}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InviteDialog orgId={org.id} open={showInvite} onClose={() => setShowInvite(false)} />
      {editMember && (
        <EditMemberDialog member={editMember} orgId={org.id} open={!!editMember} onClose={() => setEditMember(null)} />
      )}
    </div>
  );
}

function InvitationsTab({ org, myRole }: { org: any; myRole: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: invites = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/organizations", org.id, "invites"],
    queryFn: () => fetch(`/api/organizations/${org.id}/invites`, { credentials: "include" }).then((r) => r.json()),
    enabled: ["owner", "admin", "manager"].includes(myRole),
  });

  const cancelMutation = useMutation({
    mutationFn: (inviteId: number) => apiRequest("DELETE", `/api/organizations/${org.id}/invites/${inviteId}`, {}),
    onSuccess: () => {
      toast({ title: "Invitation cancelled" });
      qc.invalidateQueries({ queryKey: ["/api/organizations", org.id, "invites"] });
    },
  });

  const resendMutation = useMutation({
    mutationFn: (inviteId: number) => apiRequest("POST", `/api/organizations/${org.id}/invites/${inviteId}/resend`, {}),
    onSuccess: () => {
      toast({ title: "Invitation resent" });
      qc.invalidateQueries({ queryKey: ["/api/organizations", org.id, "invites"] });
    },
  });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-amber-500/15 text-amber-500 border-amber-500/30",
      accepted: "bg-green-500/15 text-green-500 border-green-500/30",
      expired: "bg-red-500/15 text-red-500 border-red-500/30",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${map[status] ?? "bg-slate-500/15 text-slate-400 border-slate-500/30"}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (!["owner", "admin", "manager"].includes(myRole)) {
    return <p className="text-sm text-muted-foreground py-8 text-center">You don't have permission to view invitations.</p>;
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : invites.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <Mail className="w-8 h-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm text-muted-foreground">No invitations sent yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm" data-testid="table-invites">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Sent By</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Expires</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {invites.map((inv: any) => (
                <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/20" data-testid={`row-invite-${inv.id}`}>
                  <td className="p-3 font-medium">{inv.invitedEmail ?? inv.email}</td>
                  <td className="p-3"><RoleBadge role={inv.role ?? inv.orgRole ?? "member"} /></td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground text-xs">
                    {inv.inviterFirstName} {inv.inviterLastName}
                  </td>
                  <td className="p-3 hidden lg:table-cell text-muted-foreground text-xs">
                    {inv.expiresAt ? fmtDate(inv.expiresAt) : "—"}
                  </td>
                  <td className="p-3">{statusBadge(inv.status)}</td>
                  <td className="p-3">
                    {inv.status === "pending" && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => resendMutation.mutate(inv.id)}>
                          <RefreshCw className="w-3 h-3" /> Resend
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-red-500 hover:text-red-500" onClick={() => cancelMutation.mutate(inv.id)}>
                          <Trash2 className="w-3 h-3" /> Cancel
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PermissionsTab({ org, myRole }: { org: any; myRole: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: members = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/organizations", org.id, "members"],
    queryFn: () => fetch(`/api/organizations/${org.id}/members`, { credentials: "include" }).then((r) => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: ({ memberId, permissions }: { memberId: number; permissions: any }) =>
      apiRequest("PATCH", `/api/organizations/${org.id}/members/${memberId}`, { permissions }),
    onSuccess: () => {
      toast({ title: "Permissions updated" });
      qc.invalidateQueries({ queryKey: ["/api/organizations", org.id, "members"] });
    },
    onError: () => toast({ title: "Failed to update permissions", variant: "destructive" }),
  });

  const canEdit = ["owner", "admin"].includes(myRole);
  const activeMembers = members.filter((m: any) => m.isActive);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Configure individual permissions for each team member. Role changes automatically apply default permissions.</p>
      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground w-40">Member</th>
                {ALL_PERMISSIONS.map((perm) => (
                  <th key={perm} className="p-2 font-medium text-muted-foreground text-center whitespace-nowrap">
                    {PERMISSION_LABELS[perm]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeMembers.map((m: any) => {
                const perms: any = m.permissions ?? {};
                return (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-xs bg-sky-500/10 text-sky-400">
                            {initials(m.firstName, m.lastName, m.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium truncate text-xs">{m.firstName} {m.lastName}</p>
                          <RoleBadge role={m.role ?? m.orgRole ?? "member"} />
                        </div>
                      </div>
                    </td>
                    {ALL_PERMISSIONS.map((perm) => (
                      <td key={perm} className="p-2 text-center">
                        <Checkbox
                          checked={!!perms[perm]}
                          disabled={!canEdit || (m.role ?? m.orgRole) === "owner"}
                          onCheckedChange={(checked) => {
                            const newPerms = { ...perms, [perm]: !!checked };
                            updateMutation.mutate({ memberId: m.id, permissions: newPerms });
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Team() {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: myOrgs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/organizations/my"],
    queryFn: () => fetch("/api/organizations/my", { credentials: "include" }).then((r) => r.json()),
  });

  const activeOrg = myOrgs[0];
  const myRole = activeOrg?.myOrgRole ?? "member";

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/organizations", activeOrg?.id, "stats"],
    queryFn: () => fetch(`/api/organizations/${activeOrg?.id}/stats`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!activeOrg?.id,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="page-team">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
          <Users className="w-5 h-5 text-sky-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Team Management</h1>
          <p className="text-sm text-muted-foreground">Manage your organization's members, roles, and permissions.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !activeOrg ? (
        <CreateOrgCard onCreated={() => setRefreshKey((k) => k + 1)} />
      ) : (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[hsl(var(--maritime-primary))]/10 border border-[hsl(var(--maritime-primary))]/20 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-[hsl(var(--maritime-primary))]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{activeOrg.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    {activeOrg.industry && (
                      <span className="text-xs text-muted-foreground capitalize">{activeOrg.industry}</span>
                    )}
                    <span className="text-xs text-muted-foreground">·</span>
                    <RoleBadge role={myRole} />
                  </div>
                </div>
              </div>
              <div className="space-y-1 min-w-[160px]">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{stats?.memberCount ?? activeOrg.memberCount ?? 0} / {activeOrg.maxMembers} members</span>
                  {stats?.pendingInvites ? (
                    <span className="text-amber-500">{stats.pendingInvites} pending</span>
                  ) : null}
                </div>
                <Progress
                  value={((stats?.memberCount ?? activeOrg.memberCount ?? 0) / (activeOrg.maxMembers ?? 5)) * 100}
                  className="h-1.5"
                />
              </div>
            </div>
          </Card>

          <Tabs defaultValue="members">
            <TabsList className="mb-4">
              <TabsTrigger value="members" data-testid="tab-members" className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Members
              </TabsTrigger>
              <TabsTrigger value="invitations" data-testid="tab-invitations" className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Invitations
              </TabsTrigger>
              <TabsTrigger value="permissions" data-testid="tab-permissions" className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Permissions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="members">
              <MembersTab org={activeOrg} myRole={myRole} />
            </TabsContent>
            <TabsContent value="invitations">
              <InvitationsTab org={activeOrg} myRole={myRole} />
            </TabsContent>
            <TabsContent value="permissions">
              <PermissionsTab org={activeOrg} myRole={myRole} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
