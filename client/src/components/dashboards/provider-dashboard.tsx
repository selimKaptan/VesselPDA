import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, ArrowRight, Star, Phone, Mail, Globe, MapPin, Activity, MessageSquare, Crown, ShieldCheck, AlertTriangle, Clock, XCircle, Wrench, TrendingUp, CheckCircle2, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { CompanyProfile } from "@shared/schema";
import { VerificationRequestDialog } from "@/components/verification-request-dialog";

function buildMonthlyActivity(requests: any[]) {
  const months: { month: string; open: number; fulfilled: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const label = d.toLocaleDateString("en-GB", { month: "short" });
    const monthReqs = requests.filter((r) => {
      const rDate = new Date(r.createdAt || r.created_at || "");
      return rDate.getFullYear() === d.getFullYear() && rDate.getMonth() === d.getMonth();
    });
    months.push({
      month: label,
      open: monthReqs.filter((r) => r.status === "open" || r.status === "pending").length,
      fulfilled: monthReqs.filter((r) => r.status === "fulfilled" || r.status === "completed").length,
    });
  }
  return months;
}

export function ProviderDashboard({ user, myProfile }: { user: any; myProfile?: CompanyProfile | null }) {
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);

  const { data: serviceRequests = [], isLoading: srLoading } = useQuery<any[]>({
    queryKey: ["/api/service-requests"],
  });

  if (!myProfile) {
    return (
      <div className="space-y-6">
        <Card className="p-8 border-dashed border-2 border-[hsl(var(--maritime-primary)/0.25)] bg-[hsl(var(--maritime-primary)/0.02)]" data-testid="card-no-profile">
          <div className="flex flex-col items-center text-center gap-5 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center">
              <Building2 className="w-8 h-8 text-[hsl(var(--maritime-primary))]" />
            </div>
            <div className="space-y-2">
              <h2 className="font-serif font-semibold text-lg">Create Your Company Profile</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Set up your service provider profile to appear in the maritime directory. Shipowners and agents will be able to find and contact you directly.
              </p>
            </div>
            <Link href="/company-profile">
              <Button className="gap-2 bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)] text-white shadow-sm" data-testid="button-create-profile">
                <Building2 className="w-4 h-4" /> Create Profile Now
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const serviceTypes = ((myProfile as any).serviceTypes as string[]) || [];
  const servedPorts = ((myProfile as any).servedPorts as number[]) || [];
  const verificationStatus = (myProfile as any)?.verificationStatus || "unverified";
  const verificationNote = (myProfile as any)?.verificationNote;

  const openRequests = serviceRequests.filter((r) => r.status === "open" || r.status === "pending");
  const fulfilledRequests = serviceRequests.filter((r) => r.status === "fulfilled" || r.status === "completed");
  const totalRequests = serviceRequests.length;
  const winRate = totalRequests > 0 ? Math.round((fulfilledRequests.length / totalRequests) * 100) : 0;
  const activityData = buildMonthlyActivity(serviceRequests);
  const hasActivity = activityData.some((d) => d.open > 0 || d.fulfilled > 0);

  const pieData = [
    { name: "Fulfilled", value: fulfilledRequests.length, color: "#10b981" },
    { name: "Open", value: openRequests.length, color: "hsl(var(--maritime-primary))" },
    { name: "Other", value: Math.max(0, totalRequests - fulfilledRequests.length - openRequests.length), color: "#94a3b8" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-5">
      {/* Verification status banners */}
      {verificationStatus === "unverified" && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50" data-testid="banner-verification-unverified">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Your company is not yet verified</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Send a verification request to earn a trust badge in the directory.</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-100 flex-shrink-0 dark:border-amber-700 dark:text-amber-300" onClick={() => setVerifyDialogOpen(true)} data-testid="button-go-verify">
            <ShieldCheck className="w-3 h-3" /> Request Verification
          </Button>
        </div>
      )}
      {verificationStatus === "pending" && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/50" data-testid="banner-verification-pending">
          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <span className="font-medium">Verification request under review.</span>{" "}
            <span className="font-normal text-blue-600 dark:text-blue-400">We will get back to you shortly.</span>
          </p>
        </div>
      )}
      {verificationStatus === "verified" && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/40" data-testid="banner-verification-verified">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Your company is verified — trust badge visible in directory.</p>
        </div>
      )}
      {verificationStatus === "rejected" && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/70 dark:border-red-800/50" data-testid="banner-verification-rejected">
          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Verification request was rejected</p>
            {verificationNote && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{verificationNote}</p>}
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0 dark:border-red-700 dark:text-red-300" onClick={() => setVerifyDialogOpen(true)} data-testid="button-retry-verify">
            <ShieldCheck className="w-3 h-3" /> Re-apply
          </Button>
        </div>
      )}

      {/* Stat bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/service-requests">
          <Card className="p-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer border-l-[3px] border-l-[hsl(var(--maritime-primary)/0.5)]" data-testid="stat-open-requests">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Open Requests</p>
            {srLoading ? <Skeleton className="h-8 w-12 mt-1.5" /> : <p className="text-2xl font-bold font-serif mt-1.5">{openRequests.length}</p>}
            <p className="text-[11px] mt-2 font-medium text-[hsl(var(--maritime-primary))] flex items-center gap-1">View <ArrowRight className="w-3 h-3" /></p>
          </Card>
        </Link>
        <Link href="/service-requests">
          <Card className="p-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer border-l-[3px] border-l-[hsl(142_71%_35%/0.5)]" data-testid="stat-fulfilled">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fulfilled</p>
            {srLoading ? <Skeleton className="h-8 w-12 mt-1.5" /> : <p className="text-2xl font-bold font-serif mt-1.5">{fulfilledRequests.length}</p>}
            <p className="text-[11px] mt-2 font-medium text-emerald-600 flex items-center gap-1">View <ArrowRight className="w-3 h-3" /></p>
          </Card>
        </Link>
        <Card className="p-4 border-l-[3px] border-l-[hsl(38_92%_50%/0.5)]" data-testid="stat-win-rate">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Win Rate</p>
          <p className="text-2xl font-bold font-serif mt-1.5">{winRate}%</p>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${winRate}%` }} />
          </div>
        </Card>
        <Link href="/company-profile">
          <Card className="p-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer border-l-[3px] border-l-[hsl(var(--maritime-accent)/0.5)]" data-testid="stat-served-ports">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Served Ports</p>
            <p className="text-2xl font-bold font-serif mt-1.5">{servedPorts.length}</p>
            <p className="text-[11px] mt-2 font-medium text-[hsl(var(--maritime-accent))] flex items-center gap-1">Edit <ArrowRight className="w-3 h-3" /></p>
          </Card>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Service Requests */}
          <Card className="p-5 space-y-3" data-testid="card-service-requests">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                <Wrench className="w-4 h-4 text-muted-foreground/60" /> Open Service Requests
                {openRequests.length > 0 && <Badge className="text-[10px]">{openRequests.length}</Badge>}
              </h2>
              <Link href="/service-requests">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">All <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </div>
            {srLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : openRequests.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400/60" />
                No open service requests
              </div>
            ) : (
              <div className="space-y-1.5">
                {openRequests.slice(0, 6).map((r) => (
                  <Link key={r.id} href={`/service-requests/${r.id}`}>
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`row-sr-${r.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center flex-shrink-0">
                          <Wrench className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{r.serviceType || r.title || `Request #${r.id}`}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.portName || r.description?.slice(0, 40)}</p>
                        </div>
                      </div>
                      <Badge className="text-[10px] flex-shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Open</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Activity Chart */}
          <Card className="p-5 space-y-3" data-testid="card-activity-chart">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground/60" /> 6-Month Request Activity
              </h2>
            </div>
            {srLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !hasActivity ? (
              <div className="text-center py-8 text-sm text-muted-foreground">No service request activity yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={activityData} barSize={14} barGap={2}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                    cursor={{ fill: "hsl(var(--muted)/0.4)" }}
                  />
                  <Bar dataKey="open" name="Open" fill="hsl(var(--maritime-primary) / 0.7)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="fulfilled" name="Fulfilled" fill="hsl(142 71% 35%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Bid ratio */}
          {totalRequests > 0 && (
            <Card className="p-5" data-testid="card-bid-ratio">
              <div className="flex items-center gap-5">
                <div className="flex-shrink-0">
                  <ResponsiveContainer width={80} height={80}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={22} outerRadius={36} dataKey="value" strokeWidth={0}>
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <h2 className="font-serif font-semibold text-sm">Request Outcome</h2>
                  <div className="space-y-1">
                    {pieData.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-muted-foreground flex-1">{d.name}</span>
                        <span className="font-semibold">{d.value} ({totalRequests > 0 ? Math.round((d.value / totalRequests) * 100) : 0}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right col */}
        <div className="space-y-5">
          {/* Services + Contact */}
          <Card className="p-5 space-y-3" data-testid="card-services">
            <h2 className="font-serif font-semibold text-sm">Services Offered</h2>
            {serviceTypes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {serviceTypes.map((s) => (
                  <Badge key={s} variant="secondary" className="text-[11px] px-2 py-0.5">{s}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">No services listed yet</p>
            )}
            <Link href="/company-profile">
              <Button variant="ghost" size="sm" className="w-full text-xs mt-1 border border-dashed">
                {serviceTypes.length > 0 ? "Edit Services" : "Add Services"}
              </Button>
            </Link>
          </Card>

          <Card className="p-5 space-y-3" data-testid="card-contact">
            <h2 className="font-serif font-semibold text-sm">Contact & Visibility</h2>
            <div className="space-y-2 text-sm">
              {(myProfile as any).email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate text-xs">{(myProfile as any).email}</span>
                </div>
              )}
              {(myProfile as any).phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs">{(myProfile as any).phone}</span>
                </div>
              )}
              {(myProfile as any).website && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate text-xs">{(myProfile as any).website}</span>
                </div>
              )}
              {(myProfile as any).city && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs">{(myProfile as any).city}{(myProfile as any).country ? `, ${(myProfile as any).country}` : ""}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Badge className={`text-[10px] ${(myProfile as any).isActive !== false ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700"}`}>
                {(myProfile as any).isActive !== false ? "Active" : "Inactive"}
              </Badge>
              {(myProfile as any).isFeatured && (
                <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <Star className="w-2.5 h-2.5 mr-0.5 fill-amber-500" /> Featured
                </Badge>
              )}
              {servedPorts.length > 0 && (
                <span className="text-xs text-muted-foreground">{servedPorts.length} port{servedPorts.length !== 1 ? "s" : ""}</span>
              )}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-5 space-y-3">
            <h2 className="font-serif font-semibold text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground/60" /> Quick Actions
            </h2>
            <div className="space-y-1.5">
              {[
                { href: "/company-profile", icon: Building2, label: "Edit Profile", color: "var(--maritime-primary)", testId: "qa-edit-profile" },
                { href: `/directory/${(myProfile as any).id}`, icon: Star, label: "View My Listing", color: "38 92% 50%", testId: "qa-view-listing" },
                { href: "/service-requests", icon: Wrench, label: "Service Requests", color: "var(--maritime-accent)", testId: "qa-service-requests" },
                { href: "/directory", icon: Building2, label: "Browse Directory", color: "217 91% 40%", testId: "qa-browse-directory" },
                { href: "/forum", icon: MessageSquare, label: "Maritime Forum", color: "142 71% 30%", testId: "qa-forum" },
                { href: "/pricing", icon: Crown, label: "Upgrade Plan", color: "0 84% 35%", testId: "qa-pricing" },
              ].map((action) => (
                <Link key={action.href} href={action.href}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={action.testId}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `hsl(${action.color} / 0.1)` }}>
                      <action.icon className="w-4 h-4" style={{ color: `hsl(${action.color})` } as React.CSSProperties} />
                    </div>
                    <span className="text-sm font-medium flex-1">{action.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          {!(myProfile as any).isFeatured && (
            <Card className="p-4 border-amber-200/60 dark:border-amber-800/40 bg-gradient-to-r from-amber-50/50 to-yellow-50/30 dark:from-amber-950/20 dark:to-yellow-950/10" data-testid="card-featured-upsell">
              <div className="flex items-start gap-3">
                <Star className="w-5 h-5 text-amber-600 fill-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-semibold text-sm">Get Featured</p>
                  <p className="text-xs text-muted-foreground">Appear at the top of the directory with a highlighted badge.</p>
                </div>
              </div>
              <Link href="/pricing">
                <Button size="sm" className="gap-1.5 w-full mt-3 bg-amber-500 hover:bg-amber-600 text-white">
                  <Crown className="w-3.5 h-3.5" /> Upgrade
                </Button>
              </Link>
            </Card>
          )}
        </div>
      </div>

      <VerificationRequestDialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen} />
    </div>
  );
}
