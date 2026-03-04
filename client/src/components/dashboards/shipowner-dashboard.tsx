import { Link } from "wouter";
import { Ship, FileText, Gavel, Bell, Plus, ArrowRight, Crown, Zap, Navigation, Users, Building2, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Vessel, Proforma } from "@shared/schema";

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

function SectionCard({ title, icon: Icon, href, linkLabel, children }: {
  title: string; icon?: React.ComponentType<{ className?: string }>;
  href?: string; linkLabel?: string; children: React.ReactNode;
}) {
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-serif font-semibold text-base flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-muted-foreground/60" />} {title}
        </h2>
        {href && linkLabel && (
          <Link href={href}>
            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
              {linkLabel} <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        )}
      </div>
      {children}
    </Card>
  );
}

function EmptyState({ icon: Icon, title, desc, cta, href }: {
  icon: React.ComponentType<{ className?: string }>; title: string; desc: string; cta: string; href: string;
}) {
  return (
    <div className="text-center py-8 space-y-3">
      <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center mx-auto">
        <Icon className="w-5 h-5 text-muted-foreground/40" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">{desc}</p>
      </div>
      <Link href={href}>
        <Button variant="outline" size="sm" className="gap-1.5">{cta}</Button>
      </Link>
    </div>
  );
}

const FLAG_EMOJI: Record<string, string> = {
  Turkey: "🇹🇷", Panama: "🇵🇦", "Marshall Islands": "🇲🇭", Liberia: "🇱🇷", Bahamas: "🇧🇸",
  Malta: "🇲🇹", Cyprus: "🇨🇾", Greece: "🇬🇷", Singapore: "🇸🇬",
};

export function ShipownerDashboard({ user, vessels, vesselsLoading, proformas, proformasLoading, tenders, notificationsData, plan, proformaCount, proformaLimit }: {
  user: any; vessels?: Vessel[]; vesselsLoading?: boolean; proformas?: Proforma[];
  proformasLoading?: boolean; tenders: any[]; notificationsData: any; plan: string;
  proformaCount: number; proformaLimit: number;
}) {
  const openTenders = tenders.filter((t) => t.status === "open");
  const recentProformas = proformas?.slice(0, 5) || [];
  const recentVessels = vessels?.slice(0, 5) || [];
  const unread = notificationsData?.unreadCount ?? 0;
  const proformaPercent = Math.min((proformaCount / Math.max(proformaLimit, 1)) * 100, 100);
  const progressColor = proformaPercent >= 90 ? "bg-red-500" : proformaPercent >= 60 ? "bg-amber-500" : "bg-emerald-500";

  const planIcons = { free: Zap, standard: Ship, unlimited: Crown };
  const PlanIcon = planIcons[plan as keyof typeof planIcons] || Zap;

  const quickActions = [
    { href: "/proformas/new", icon: FileText, label: "New Proforma", desc: "Generate a proforma D/A", color: "var(--maritime-secondary)", testId: "qa-new-proforma" },
    { href: "/tenders", icon: Gavel, label: "Post a Tender", desc: "Request port call quotes from agents", color: "38 92% 50%", testId: "qa-new-tender" },
    { href: "/vessels?new=true", icon: Ship, label: "Add Vessel", desc: "Register a new ship to your fleet", color: "var(--maritime-primary)", testId: "qa-add-vessel" },
    { href: "/directory", icon: Users, label: "Find an Agent", desc: "Browse maritime service directory", color: "var(--maritime-accent)", testId: "qa-find-agent" },
    { href: "/vessel-track", icon: Navigation, label: "Fleet Tracker", desc: "View live vessel positions on map", color: "217 91% 40%", testId: "qa-vessel-track" },
  ];

  return (
    <div className="space-y-6">
      {/* Stat bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="My Fleet" value={vessels?.length ?? 0} loading={vesselsLoading} icon={Ship} color="var(--maritime-primary)" href="/vessels" testId="stat-fleet" />
        <StatCard label="Proformas" value={proformas?.length ?? 0} loading={proformasLoading} icon={FileText} color="var(--maritime-secondary)" href="/proformas" testId="stat-proformas" />
        <StatCard label="Open Tenders" value={openTenders.length} icon={Gavel} color="38 92% 50%" href="/tenders" testId="stat-tenders" />
        <StatCard label="Notifications" value={unread} icon={Bell} color="var(--maritime-accent)" href="/forum" testId="stat-notifications" />
      </div>

      {/* Subscription + Plan Usage */}
      <Card className="p-4 border-[hsl(var(--maritime-primary)/0.2)]" data-testid="card-subscription">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, hsl(var(--maritime-primary)/0.12), hsl(var(--maritime-accent)/0.08))" }}>
              <PlanIcon className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm capitalize">{plan} Plan</p>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[hsl(var(--maritime-primary)/0.1)] text-[hsl(var(--maritime-primary))] uppercase tracking-wide">{plan}</span>
              </div>
              {plan !== "unlimited" ? (
                <div className="flex items-center gap-2 mt-1">
                  <div className="relative h-1.5 w-36 bg-muted rounded-full overflow-hidden">
                    <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${proformaPercent}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{proformaCount}/{proformaLimit} proformas</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">Unlimited proforma generations</p>
              )}
            </div>
          </div>
          {plan !== "unlimited" && (
            <Link href="/pricing">
              <Button size="sm" className="gap-1.5 bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)] text-white shadow-sm shrink-0">
                <Crown className="w-3.5 h-3.5" /> Upgrade Plan
              </Button>
            </Link>
          )}
        </div>
      </Card>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left col: Fleet + Tenders */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fleet Summary */}
          <SectionCard title="My Fleet" icon={Ship} href="/vessels" linkLabel="Manage Fleet">
            {vesselsLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
            ) : recentVessels.length === 0 ? (
              <EmptyState icon={Ship} title="No vessels yet" desc="Add your first vessel to start managing your fleet" cta="Add First Vessel" href="/vessels?new=true" />
            ) : (
              <div className="space-y-1.5">
                {recentVessels.map((v) => (
                  <Link key={v.id} href="/vessels">
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={`row-vessel-${v.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg flex-shrink-0">{FLAG_EMOJI[v.flag] || "🚢"}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{v.name}</p>
                          <p className="text-xs text-muted-foreground">{v.flag} · {v.grt?.toLocaleString()} GRT</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0 border-[hsl(var(--maritime-primary)/0.3)] text-[hsl(var(--maritime-primary))]">
                        {v.vesselType}
                      </Badge>
                    </div>
                  </Link>
                ))}
                <Link href="/vessels?new=true">
                  <Button variant="ghost" size="sm" className="w-full mt-1 gap-1.5 text-muted-foreground hover:text-foreground border border-dashed border-border/50">
                    <Plus className="w-3.5 h-3.5" /> Add Vessel
                  </Button>
                </Link>
              </div>
            )}
          </SectionCard>

          {/* Active Tenders */}
          <SectionCard title="My Tenders" icon={Gavel} href="/tenders" linkLabel="All Tenders">
            {openTenders.length === 0 ? (
              <EmptyState icon={Gavel} title="No active tenders" desc="Post a tender to receive quotes from agents in your ports" cta="Post First Tender" href="/tenders" />
            ) : (
              <div className="space-y-1.5">
                {openTenders.slice(0, 5).map((t) => {
                  const bidCount = t.bidCount ?? 0;
                  return (
                    <Link key={t.id} href={`/tenders/${t.id}`}>
                      <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={`row-tender-${t.id}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-md bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center flex-shrink-0">
                            <Gavel className="w-3.5 h-3.5 text-amber-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{t.portName || `Port #${t.portId}`}</p>
                            <p className="text-xs text-muted-foreground">{t.cargoType} · {new Date(t.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                          </div>
                        </div>
                        <Badge className={`text-[10px] flex-shrink-0 ${bidCount > 0 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                          {bidCount} bid{bidCount !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* Recent Proformas */}
          <SectionCard title="Recent Proformas" icon={FileText} href="/proformas" linkLabel="View All">
            {proformasLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
            ) : recentProformas.length === 0 ? (
              <EmptyState icon={FileText} title="No proformas yet" desc="Generate your first proforma disbursement account" cta="Create Proforma" href="/proformas/new" />
            ) : (
              <div className="space-y-1.5">
                {recentProformas.map((pda) => (
                  <Link key={pda.id} href={`/proformas/${pda.id}`}>
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={`row-proforma-${pda.id}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center flex-shrink-0">
                          <FileText className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{pda.referenceNumber}</p>
                          <p className="text-xs text-muted-foreground truncate">{pda.purposeOfCall}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-[hsl(var(--maritime-primary))]">${pda.totalUsd?.toLocaleString()}</p>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{pda.status}</Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right col: Quick Actions */}
        <div>
          <SectionCard title="Quick Actions" icon={Activity}>
            <div className="space-y-1.5">
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={action.testId}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                      style={{ background: `hsl(${action.color} / 0.1)` }}>
                      <action.icon className="w-4 h-4" style={{ color: `hsl(${action.color})` } as React.CSSProperties} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{action.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{action.desc}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:translate-x-0.5 group-hover:text-muted-foreground/80 transition-all flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
