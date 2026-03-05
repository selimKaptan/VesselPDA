import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, ArrowRight, Star, Phone, Mail, Globe, MapPin, Activity, MessageSquare, Crown, ShieldCheck, AlertTriangle, Clock, XCircle, Wrench, FileText, Anchor } from "lucide-react";
import { StatusDistributionChart } from "./dashboard-charts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompanyProfile } from "@shared/schema";
import { VerificationRequestDialog } from "@/components/verification-request-dialog";

function RecentActivityCard() {
  const { data } = useQuery<{ activities: any[] }>({
    queryKey: ["/api/user/recent-activity"],
  });
  const activities = data?.activities || [];

  function getActivityEmoji(type: string): string {
    const map: Record<string, string> = {
      voyage_created: "🗺️", status_changed: "🔄", eta_updated: "🕐",
      document_uploaded: "📄", document_signed: "✍️", checklist_completed: "✅",
      chat_message: "💬", sof_created: "📝", sof_finalized: "📝",
      pda_created: "📋", pda_approved: "📋", fda_created: "🧾", fda_approved: "🧾",
      invoice_created: "💳", invoice_paid: "💰", nomination_sent: "🤝",
      review_submitted: "⭐", custom_note: "📌",
    };
    return map[type] || "📌";
  }

  function timeAgo(dt: string) {
    const diff = Date.now() - new Date(dt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(dt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  return (
    <Card className="p-5 space-y-3" data-testid="card-recent-activity-feed">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground/60" />
        <h3 className="font-semibold text-sm">Recent Activity</h3>
      </div>
      {activities.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
      ) : (
        <div className="space-y-1">
          {activities.map((a: any) => (
            <div key={a.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0" data-testid={`feed-item-${a.id}`}>
              <span className="text-base flex-shrink-0">{getActivityEmoji(a.activityType)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{a.title}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</p>
              </div>
              <Link href={`/voyages/${a.voyageId}`}>
                <span className="text-xs text-sky-400 hover:underline flex-shrink-0 cursor-pointer">View →</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function StatCard({ label, value, loading, icon: Icon, color, href, testId }: {
  label: string; value: React.ReactNode; loading?: boolean;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string; href: string; testId: string;
}) {
  return (
    <Link href={href}>
      <Card className="p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group relative overflow-hidden" data-testid={testId}
        style={{ borderLeft: `3px solid hsl(${color} / 0.5)` }}>
        <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-40"
          style={{ background: `hsl(${color} / 0.05)` }} />
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            {loading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-bold font-serif">{value}</p>}
          </div>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
            style={{ background: `hsl(${color} / 0.12)` }}>
            <Icon className="w-4 h-4" style={{ color: `hsl(${color})` } as React.CSSProperties} />
          </div>
        </div>
        <p className="mt-2 text-[11px] font-medium flex items-center gap-1" style={{ color: `hsl(${color})` }}>
          View <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </p>
      </Card>
    </Link>
  );
}

export function ProviderDashboard({ user, myProfile }: { user: any; myProfile?: CompanyProfile | null }) {
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);

  const { data: serviceRequests, isLoading: srLoading } = useQuery<any[]>({ queryKey: ["/api/service-requests"] });
  const { data: invoices, isLoading: invLoading } = useQuery<any[]>({ queryKey: ["/api/invoices"] });
  const { data: dashData } = useQuery<any>({ queryKey: ["/api/stats/dashboard"] });

  const incomingRequests = (serviceRequests || []).filter((r: any) => r.status === "open" || r.status === "pending").length;
  const activeServices = (serviceRequests || []).filter((r: any) => r.status === "in_progress").length;
  const pendingInvoices = (invoices || []).filter((i: any) => i.status === "pending" || i.status === "unpaid").length;
  const servicePorts = ((myProfile as any)?.servedPorts as number[])?.length ?? 0;

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
  const verificationStatus = (myProfile as any)?.verificationStatus || "unverified";
  const verificationNote = (myProfile as any)?.verificationNote;

  const recentRequests = (serviceRequests || []).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Verification status banner */}
      {verificationStatus === "unverified" && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50" data-testid="banner-verification-unverified">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Your company is not yet verified</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Request verification to earn a trust badge in the directory.</p>
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
            <span className="font-medium">Your verification request is under review.</span>
          </p>
        </div>
      )}
      {verificationStatus === "verified" && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/40" data-testid="banner-verification-verified">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Your company is verified — trust badge displayed in directory.</p>
        </div>
      )}
      {verificationStatus === "rejected" && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/70 dark:border-red-800/50" data-testid="banner-verification-rejected">
          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Your verification request was rejected</p>
            {verificationNote && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{verificationNote}</p>}
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0 dark:border-red-700 dark:text-red-300" onClick={() => setVerifyDialogOpen(true)} data-testid="button-retry-verify">
            <ShieldCheck className="w-3 h-3" /> Apply Again
          </Button>
        </div>
      )}

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Incoming Requests" value={srLoading ? "…" : incomingRequests} loading={srLoading} icon={Wrench} color="var(--maritime-primary)" href="/service-requests" testId="stat-incoming-requests" />
        <StatCard label="Active Services" value={srLoading ? "…" : activeServices} loading={srLoading} icon={Activity} color="142 71% 35%" href="/service-requests" testId="stat-active-services" />
        <StatCard label="Pending Invoices" value={invLoading ? "…" : pendingInvoices} loading={invLoading} icon={FileText} color="38 92% 40%" href="/invoices" testId="stat-pending-invoices" />
        <StatCard label="Service Ports" value={servicePorts} icon={Anchor} color="var(--maritime-secondary)" href="/company-profile" testId="stat-service-ports" />
      </div>

      {/* Status Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatusDistributionChart title="Service Request Status" data={dashData?.voyageDistribution || []} testId="chart-sr-dist" />
        <StatusDistributionChart title="Tender Distribution" data={dashData?.tenderDistribution || []} testId="chart-tender-dist" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Service Requests */}
          <Card className="p-5 space-y-3" data-testid="card-service-requests">
            <div className="flex items-center justify-between">
              <h2 className="font-serif font-semibold text-base flex items-center gap-2">
                <Wrench className="w-4 h-4 text-muted-foreground/60" /> Recent Service Requests
              </h2>
              <Link href="/service-requests">
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">View All <ArrowRight className="w-3 h-3" /></Button>
              </Link>
            </div>
            {srLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : recentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No service requests yet</p>
            ) : (
              <div className="space-y-1.5">
                {recentRequests.map((req: any) => (
                  <Link key={req.id} href={`/service-requests/${req.id}`}>
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`row-request-${req.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center flex-shrink-0">
                          <Wrench className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{req.serviceType || `Request #${req.id}`}</p>
                          <p className="text-xs text-muted-foreground">{req.portName || req.description?.slice(0, 40)}</p>
                        </div>
                      </div>
                      <Badge className={`text-[10px] flex-shrink-0 capitalize ${req.status === "in_progress" ? "bg-blue-100 text-blue-700" : req.status === "open" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                        {req.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Profile Summary */}
          <div className="grid sm:grid-cols-2 gap-4">
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
                {(myProfile as any).city && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-xs">{(myProfile as any).city}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Badge className={`text-[10px] ${(myProfile as any).isActive !== false ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700"}`}>
                  {(myProfile as any).isActive !== false ? "Active" : "Inactive"}
                </Badge>
              </div>
            </Card>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="space-y-6">
          <RecentActivityCard />
          <Card className="p-5 space-y-3">
            <h2 className="font-serif font-semibold text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground/60" /> Quick Access
            </h2>
            <div className="space-y-1.5">
              {[
                { href: "/service-requests", icon: Wrench, label: "My Requests", desc: "View service requests", color: "var(--maritime-primary)", testId: "qa-requests" },
                { href: "/invoices", icon: FileText, label: "My Invoices", desc: "Billing and payments", color: "38 92% 50%", testId: "qa-invoices" },
                { href: "/company-profile", icon: Building2, label: "Edit Profile", desc: "Update your company listing", color: "var(--maritime-secondary)", testId: "qa-profile" },
                { href: `/directory/${(myProfile as any).id}`, icon: Star, label: "View My Listing", desc: "See how you appear in directory", color: "var(--maritime-accent)", testId: "qa-listing" },
                { href: "/forum", icon: MessageSquare, label: "Maritime Forum", desc: "Connect with industry professionals", color: "142 71% 30%", testId: "qa-forum" },
                { href: "/pricing", icon: Crown, label: "Upgrade Plan", desc: "Access premium features", color: "217 91% 40%", testId: "qa-pricing" },
              ].map((action) => (
                <Link key={action.href} href={action.href}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={action.testId}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `hsl(${action.color} / 0.1)` }}>
                      <action.icon className="w-4 h-4" style={{ color: `hsl(${action.color})` } as React.CSSProperties} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{action.label}</p>
                      <p className="text-xs text-muted-foreground">{action.desc}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <VerificationRequestDialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen} />
    </div>
  );
}
