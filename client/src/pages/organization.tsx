import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Building2, Users, Mail, Phone, Globe, MapPin, Plus, Trash2, Settings,
  UserPlus, Shield, Clock, CheckCircle2, XCircle, Crown,
} from "lucide-react";

const ORG_TYPES = [
  { value: "agent", label: "Ship Agent" },
  { value: "shipowner", label: "Shipowner" },
  { value: "broker", label: "Broker" },
  { value: "operator", label: "Operator" },
  { value: "provider", label: "Service Provider" },
  { value: "other", label: "Other" },
];

const MEMBER_ROLES = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
  { value: "viewer", label: "Viewer" },
];

function roleBadgeVariant(role: string) {
  if (role === "owner") return "destructive";
  if (role === "admin") return "default";
  return "secondary";
}

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant={roleBadgeVariant(role)} className="capitalize text-xs">
      {role === "owner" && <Crown className="w-3 h-3 mr-1" />}
      {role === "admin" && <Shield className="w-3 h-3 mr-1" />}
      {role}
    </Badge>
  );
}

export default function OrganizationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeOrgId, setActiveOrgId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const [form, setForm] = useState({
    name: "", type: "agent", website: "", phone: "", email: "", address: "", country: "", taxId: "",
  });

  const { data: myOrgs = [], isLoading: orgsLoading } = useQuery<any[]>({
    queryKey: ["/api/organizations/my"],
  });

  const currentOrgId = activeOrgId || (user as any)?.activeOrganizationId || myOrgs[0]?.id;
  const currentOrg = myOrgs.find((o: any) => o.id === currentOrgId) || myOrgs[0];

  const { data: members = [], isLoading: membersLoading } = useQuery<any[]>({
    queryKey: currentOrgId ? [`/api/organizations/${currentOrgId}/members`] : ["noop-members"],
    enabled: !!currentOrgId,
  });

  const { data: invites = [] } = useQuery<any[]>({
    queryKey: currentOrgId ? [`/api/organizations/${currentOrgId}/invites`] : [],
    enabled: !!currentOrgId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/organizations", data);
      return res.json();
    },
    onSuccess: (org) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setShowCreateDialog(false);
      setActiveOrgId(org.id);
      setForm({ name: "", type: "agent", website: "", phone: "", email: "", address: "", country: "", taxId: "" });
      toast({ title: "Organization created", description: org.name });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/organizations/${currentOrgId}/invite`, { email: inviteEmail, role: inviteRole });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${currentOrgId}/invites`] });
      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteRole("member");
      toast({ title: "Invitation sent", description: `Invite sent to ${inviteEmail}` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await apiRequest("DELETE", `/api/organizations/${currentOrgId}/members/${memberId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${currentOrgId}/members`] });
      toast({ title: "Member removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async (inviteId: number) => {
      const res = await apiRequest("DELETE", `/api/organizations/${currentOrgId}/invites/${inviteId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${currentOrgId}/invites`] });
      toast({ title: "Invite cancelled" });
    },
  });

  const switchOrgMutation = useMutation({
    mutationFn: async (orgId: number) => {
      const res = await apiRequest("POST", `/api/organizations/switch/${orgId}`, {});
      return res.json();
    },
    onSuccess: (_, orgId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setActiveOrgId(orgId);
      toast({ title: "Organization switched" });
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/organizations/${currentOrgId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations/my"] });
      toast({ title: "Organization updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const userId = (user as any)?.id;
  const isOwner = currentOrg?.owner_id === userId;
  const myMembership = members.find((m: any) => m.user_id === userId);
  const canAdmin = isOwner || myMembership?.role === "admin";

  return (
    <>
    <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold font-serif">Organization</h1>
              <p className="text-muted-foreground text-sm mt-1">Manage your organization and team members</p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="btn-create-org">
              <Plus className="w-4 h-4 mr-2" /> New Organization
            </Button>
          </div>

          {/* Org selector (if multiple) */}
          {myOrgs.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {myOrgs.map((org: any) => (
                <Button
                  key={org.id}
                  variant={org.id === currentOrgId ? "default" : "outline"}
                  size="sm"
                  onClick={() => switchOrgMutation.mutate(org.id)}
                  data-testid={`btn-switch-org-${org.id}`}
                >
                  <Building2 className="w-3.5 h-3.5 mr-1.5" />
                  {org.name}
                </Button>
              ))}
            </div>
          )}

          {orgsLoading && <p className="text-muted-foreground text-sm">Loading...</p>}

          {!orgsLoading && myOrgs.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 flex flex-col items-center gap-4">
                <Building2 className="w-12 h-12 text-muted-foreground/40" />
                <div className="text-center">
                  <p className="font-semibold">No organization yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Create an organization to collaborate with your team</p>
                </div>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Create Organization
                </Button>
              </CardContent>
            </Card>
          )}

          {currentOrg && (
            <Tabs defaultValue="members">
              <TabsList>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="invites">Invitations</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              {/* MEMBERS TAB */}
              <TabsContent value="members" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">{currentOrg.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {members.length} / {currentOrg.max_members} members
                    </p>
                  </div>
                  {canAdmin && (
                    <Button size="sm" onClick={() => setShowInviteDialog(true)} data-testid="btn-invite-member">
                      <UserPlus className="w-4 h-4 mr-2" /> Invite Member
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  {membersLoading ? (
                    <p className="text-sm text-muted-foreground">Loading members...</p>
                  ) : members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No members yet</p>
                  ) : (
                    members.map((m: any) => {
                      const initials = `${m.first_name?.[0] || ""}${m.last_name?.[0] || ""}`.toUpperCase() || "?";
                      const fullName = `${m.first_name || ""} ${m.last_name || ""}`.trim() || m.email;
                      const isSelf = m.user_id === userId;
                      return (
                        <Card key={m.id} data-testid={`member-row-${m.id}`}>
                          <CardContent className="py-3 flex items-center gap-3">
                            <Avatar className="w-9 h-9 flex-shrink-0">
                              <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm truncate">{fullName}</span>
                                <RoleBadge role={m.role} />
                                {isSelf && <Badge variant="outline" className="text-xs">You</Badge>}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                <span>{m.email}</span>
                                {m.job_title && <span>· {m.job_title}</span>}
                                {m.department && <span>· {m.department}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                              <Clock className="w-3 h-3" />
                              {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : "—"}
                            </div>
                            {canAdmin && !isSelf && m.role !== "owner" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => removeMemberMutation.mutate(m.user_id)}
                                data-testid={`btn-remove-member-${m.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </TabsContent>

              {/* INVITATIONS TAB */}
              <TabsContent value="invites" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Pending Invitations</h2>
                  {canAdmin && (
                    <Button size="sm" onClick={() => setShowInviteDialog(true)}>
                      <UserPlus className="w-4 h-4 mr-2" /> Send Invite
                    </Button>
                  )}
                </div>

                {invites.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <Mail className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No pending invitations</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {invites.map((inv: any) => (
                      <Card key={inv.id} data-testid={`invite-row-${inv.id}`}>
                        <CardContent className="py-3 flex items-center gap-3">
                          <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm">{inv.invited_email}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-xs capitalize">{inv.role}</Badge>
                              <span className="text-xs text-muted-foreground">
                                Expires {new Date(inv.expires_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          {canAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => cancelInviteMutation.mutate(inv.id)}
                              data-testid={`btn-cancel-invite-${inv.id}`}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* SETTINGS TAB */}
              <TabsContent value="settings" className="mt-4">
                <OrgSettingsForm org={currentOrg} canEdit={canAdmin} isOwner={isOwner} onSave={updateOrgMutation.mutate} isSaving={updateOrgMutation.isPending} />
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Create Org Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Organization</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Organization Name *</Label>
                <Input
                  placeholder="Acme Shipping Co."
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  data-testid="input-org-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger data-testid="select-org-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORG_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input placeholder="info@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="input-org-email" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input placeholder="+1 555 000 0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-org-phone" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input placeholder="https://yourcompany.com" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} data-testid="input-org-website" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input placeholder="Turkey" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} data-testid="input-org-country" />
                </div>
                <div className="space-y-2">
                  <Label>Tax ID</Label>
                  <Input placeholder="1234567890" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} data-testid="input-org-taxid" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending || !form.name.trim()}
                data-testid="btn-submit-create-org"
              >
                {createMutation.isPending ? "Creating..." : "Create Organization"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Invite Dialog */}
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Email Address *</Label>
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  data-testid="input-invite-email"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger data-testid="select-invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBER_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
              <Button
                onClick={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending || !inviteEmail.trim()}
                data-testid="btn-submit-invite"
              >
                {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </>
  );
}

function OrgSettingsForm({ org, canEdit, isOwner, onSave, isSaving }: {
  org: any; canEdit: boolean; isOwner: boolean; onSave: (data: any) => void; isSaving: boolean;
}) {
  const [form, setForm] = useState({
    name: org.name || "",
    type: org.type || "other",
    email: org.email || "",
    phone: org.phone || "",
    website: org.website || "",
    address: org.address || "",
    country: org.country || "",
    taxId: org.tax_id || "",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="w-4 h-4" /> Organization Settings
        </CardTitle>
        {!canEdit && <CardDescription>Only admins can edit organization settings</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Organization Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!canEdit} data-testid="settings-input-name" />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })} disabled={!canEdit}>
            <SelectTrigger data-testid="settings-select-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ORG_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!canEdit} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!canEdit} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Website</Label>
          <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} disabled={!canEdit} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Country</Label>
            <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} disabled={!canEdit} />
          </div>
          <div className="space-y-2">
            <Label>Tax ID</Label>
            <Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} disabled={!canEdit} />
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => onSave(form)} disabled={isSaving} data-testid="btn-save-org-settings">
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
