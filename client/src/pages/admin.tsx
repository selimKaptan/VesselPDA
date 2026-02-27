import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, Users, Ship, FileText, Building2, Search, BarChart3, TrendingUp, Target, Gavel, CheckCircle, XCircle, Clock, Ban, UserCheck, MessageSquarePlus, Bug, Lightbulb, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/models/auth";
import type { Vessel, Proforma, CompanyProfile } from "@shared/schema";
import { PageMeta } from "@/components/page-meta";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
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

  const { data: stats, isLoading: statsLoading } = useQuery<any>({ queryKey: ["/api/admin/stats"] });
  const { data: allUsers, isLoading: usersLoading } = useQuery<User[]>({ queryKey: ["/api/admin/users"] });
  const { data: allVessels, isLoading: vesselsLoading } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
  const { data: allProformas, isLoading: proformasLoading } = useQuery<Proforma[]>({ queryKey: ["/api/proformas"] });
  const { data: allProfiles, isLoading: profilesLoading } = useQuery<CompanyProfile[]>({ queryKey: ["/api/admin/company-profiles"] });
  const { data: pendingProfiles, isLoading: pendingLoading } = useQuery<CompanyProfile[]>({ queryKey: ["/api/admin/companies/pending"] });
  const { data: allFeedbacks, isLoading: feedbacksLoading } = useQuery<any[]>({ queryKey: ["/api/admin/feedback"] });

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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
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

      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4" data-testid="stat-users">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Users</p>
                <p className="text-2xl font-bold font-serif">{stats.totalUsers}</p>
                <div className="flex gap-1 flex-wrap">
                  <Badge variant="outline" className="text-[9px] px-1">{stats.usersByRole.shipowner} owners</Badge>
                  <Badge variant="outline" className="text-[9px] px-1">{stats.usersByRole.agent} agents</Badge>
                  <Badge variant="outline" className="text-[9px] px-1">{stats.usersByRole.provider} providers</Badge>
                </div>
              </div>
              <Users className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
            </div>
          </Card>
          <Card className="p-4" data-testid="stat-vessels">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Vessels</p>
                <p className="text-2xl font-bold font-serif">{stats.totalVessels}</p>
              </div>
              <Ship className="w-5 h-5 text-[hsl(var(--maritime-secondary))]" />
            </div>
          </Card>
          <Card className="p-4" data-testid="stat-proformas">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Proformas</p>
                <p className="text-2xl font-bold font-serif">{stats.totalProformas}</p>
              </div>
              <FileText className="w-5 h-5 text-[hsl(var(--maritime-accent))]" />
            </div>
          </Card>
          <Card className="p-4" data-testid="stat-profiles">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Company Profiles</p>
                <p className="text-2xl font-bold font-serif">{stats.totalCompanyProfiles}</p>
              </div>
              <Building2 className="w-5 h-5 text-amber-500" />
            </div>
          </Card>
        </div>
      )}

      <Tabs defaultValue="users">
        <TabsList data-testid="admin-tabs" className="flex-wrap h-auto gap-1">
          <TabsTrigger value="users" data-testid="tab-users">Users ({allUsers?.length || 0})</TabsTrigger>
          <TabsTrigger value="vessels" data-testid="tab-vessels">Vessels ({allVessels?.length || 0})</TabsTrigger>
          <TabsTrigger value="proformas" data-testid="tab-proformas">Proformas ({allProformas?.length || 0})</TabsTrigger>
          <TabsTrigger value="profiles" data-testid="tab-profiles">Profiles ({allProfiles?.length || 0})</TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending" className="relative">
            Pending
            {(pendingProfiles?.length ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-amber-500 text-white">
                {pendingProfiles!.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          <TabsTrigger value="feedback" data-testid="tab-feedback" className="relative">
            Feedback
            {(allFeedbacks?.length ?? 0) > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-blue-500 text-white">
                {allFeedbacks!.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name, email, or role..."
              value={searchUsers}
              onChange={e => setSearchUsers(e.target.value)}
              className="pl-9"
              data-testid="input-search-users"
            />
          </div>
          {usersLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-3 font-medium">Name</th>
                      <th className="p-3 font-medium hidden md:table-cell">Email</th>
                      <th className="p-3 font-medium">Role</th>
                      <th className="p-3 font-medium">Plan</th>
                      <th className="p-3 font-medium hidden sm:table-cell">Proformas</th>
                      <th className="p-3 font-medium text-right">Actions</th>
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
                            <Button
                              size="sm"
                              variant={isSuspended ? "outline" : "ghost"}
                              className={isSuspended ? "text-green-600 border-green-300" : "text-red-600 hover:text-red-700"}
                              onClick={() => suspendMutation.mutate({ userId: u.id, suspended: !isSuspended })}
                              disabled={suspendMutation.isPending || u.userRole === "admin"}
                              data-testid={`button-suspend-${u.id}`}
                              title={isSuspended ? "Activate account" : "Suspend account"}
                            >
                              {isSuspended ? <UserCheck className="w-3.5 h-3.5 mr-1" /> : <Ban className="w-3.5 h-3.5 mr-1" />}
                              {isSuspended ? "Activate" : "Suspend"}
                            </Button>
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
                      <th className="p-3 font-medium">Company</th>
                      <th className="p-3 font-medium">Type</th>
                      <th className="p-3 font-medium">City</th>
                      <th className="p-3 font-medium">Featured</th>
                      <th className="p-3 font-medium">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.map(p => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-profile-${p.id}`}>
                        <td className="p-3 font-medium">{p.companyName}</td>
                        <td className="p-3">
                          <Badge className={`text-[10px] ${ROLE_BADGES[p.companyType] || ""}`}>{p.companyType}</Badge>
                        </td>
                        <td className="p-3">{p.city || "-"}</td>
                        <td className="p-3">{p.isFeatured ? "Yes" : "No"}</td>
                        <td className="p-3">{p.isActive ? "Yes" : "No"}</td>
                      </tr>
                    ))}
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
      </Tabs>
    </div>
  );
}
