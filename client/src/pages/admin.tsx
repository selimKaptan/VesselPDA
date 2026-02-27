import { useQuery } from "@tanstack/react-query";
import { Shield, Users, Ship, FileText, Building2, Search, BarChart3, TrendingUp, Target, Gavel } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import type { User } from "@shared/models/auth";
import type { Vessel, Proforma, CompanyProfile } from "@shared/schema";
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
        <TabsList data-testid="admin-tabs">
          <TabsTrigger value="users" data-testid="tab-users">Users ({allUsers?.length || 0})</TabsTrigger>
          <TabsTrigger value="vessels" data-testid="tab-vessels">Vessels ({allVessels?.length || 0})</TabsTrigger>
          <TabsTrigger value="proformas" data-testid="tab-proformas">Proformas ({allProformas?.length || 0})</TabsTrigger>
          <TabsTrigger value="profiles" data-testid="tab-profiles">Profiles ({allProfiles?.length || 0})</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
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
                      <th className="p-3 font-medium">Email</th>
                      <th className="p-3 font-medium">Role</th>
                      <th className="p-3 font-medium">Plan</th>
                      <th className="p-3 font-medium">Proformas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/50" data-testid={`row-user-${u.id}`}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {u.profileImageUrl && <img src={u.profileImageUrl} className="w-6 h-6 rounded-full" alt="" />}
                            <span className="font-medium">{u.firstName || ""} {u.lastName || ""}</span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{u.email || "-"}</td>
                        <td className="p-3">
                          <Badge className={`text-[10px] ${ROLE_BADGES[u.userRole] || ""}`}>{u.userRole}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px]">{u.subscriptionPlan}</Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{u.proformaCount}/{u.proformaLimit}</td>
                      </tr>
                    ))}
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
      </Tabs>
    </div>
  );
}
