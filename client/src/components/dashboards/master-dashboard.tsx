import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Compass, Ship, Anchor, ScrollText, FileCheck, ClipboardList,
  MessageSquare, Bell, ArrowRight, Calendar, Navigation, Clock,
  AlertTriangle, CheckCircle2, FileText, Wand2
} from "lucide-react";
import { AiSmartDropMini } from "@/components/ai-smart-drop";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/formatDate";

function StatCard({ label, value, loading, icon: Icon, color, href, testId }: {
  label: string; value: React.ReactNode; loading?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  color: string; href: string; testId: string;
}) {
  return (
    <Link href={href}>
      <Card
        className="p-4 hover:shadow-lg hover:shadow-black/25 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group relative overflow-hidden"
        style={{ borderLeft: `3px solid hsl(${color} / 0.5)` }}
        data-testid={testId}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{label}</p>
            {loading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <p className="text-2xl font-bold font-serif">{value}</p>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `hsl(${color} / 0.1)` }}>
            <Icon className="w-5 h-5" style={{ color: `hsl(${color})` } as any} />
          </div>
        </div>
      </Card>
    </Link>
  );
}

function QuickActionButton({ label, href, icon: Icon, variant = "outline" }: {
  label: string; href: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "outline";
}) {
  return (
    <Link href={href}>
      <Button variant={variant} size="sm" className="gap-2 w-full justify-start" data-testid={`btn-master-${label.toLowerCase().replace(/\s+/g, "-")}`}>
        <Icon className="w-4 h-4" />
        {label}
      </Button>
    </Link>
  );
}

function VesselCard({ vessels, loading }: { vessels: any[] | undefined; loading: boolean }) {
  const vessel = vessels?.[0];
  return (
    <Card className="p-5 space-y-4" data-testid="card-master-vessel">
      <div className="flex items-center gap-2">
        <Ship className="w-4 h-4 text-muted-foreground/60" />
        <h3 className="font-semibold text-sm">My Vessel</h3>
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      ) : vessel ? (
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-lg font-serif">{vessel.name}</p>
              <p className="text-sm text-muted-foreground">{vessel.vesselType || "General Cargo"}</p>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200">
              Active
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {vessel.imoNumber && (
              <div>
                <p className="text-muted-foreground">IMO</p>
                <p className="font-medium">{vessel.imoNumber}</p>
              </div>
            )}
            {vessel.flag && (
              <div>
                <p className="text-muted-foreground">Flag</p>
                <p className="font-medium">{vessel.flag}</p>
              </div>
            )}
            {vessel.grossTonnage && (
              <div>
                <p className="text-muted-foreground">GRT</p>
                <p className="font-medium">{vessel.grossTonnage.toLocaleString()}</p>
              </div>
            )}
            {vessel.yearBuilt && (
              <div>
                <p className="text-muted-foreground">Built</p>
                <p className="font-medium">{vessel.yearBuilt}</p>
              </div>
            )}
          </div>
          <Link href={`/vessels/${vessel.id}`}>
            <Button variant="outline" size="sm" className="w-full gap-2 mt-1" data-testid="btn-view-vessel">
              View Details <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="text-center py-4 space-y-3">
          <Ship className="w-10 h-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No vessel linked yet</p>
          <Link href="/vessels">
            <Button size="sm" className="gap-2" data-testid="btn-add-vessel">
              <Anchor className="w-4 h-4" /> Find My Vessel
            </Button>
          </Link>
        </div>
      )}
    </Card>
  );
}

function CurrentVoyageCard({ voyages, loading }: { voyages: any[] | undefined; loading: boolean }) {
  const active = voyages?.find((v: any) => v.status === "active" || v.status === "in_port") || voyages?.[0];
  return (
    <Card className="p-5 space-y-4" data-testid="card-master-voyage">
      <div className="flex items-center gap-2">
        <Navigation className="w-4 h-4 text-muted-foreground/60" />
        <h3 className="font-semibold text-sm">Current Voyage</h3>
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
      ) : active ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{active.portName || active.loadingPort || "Port Call"}</p>
              <p className="text-xs text-muted-foreground">{active.vesselName}</p>
            </div>
            <Badge className={
              active.status === "active" || active.status === "in_port"
                ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200"
            }>
              {active.status || "Active"}
            </Badge>
          </div>
          {active.eta && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              ETA: {fmtDate(active.eta)}
            </div>
          )}
          <Link href={`/voyages/${active.id}`}>
            <Button variant="outline" size="sm" className="w-full gap-2" data-testid="btn-view-voyage">
              View Details <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="text-center py-4 space-y-2">
          <Navigation className="w-8 h-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No active voyage</p>
          <Link href="/voyages">
            <Button variant="outline" size="sm" data-testid="btn-go-voyages">View Voyages</Button>
          </Link>
        </div>
      )}
    </Card>
  );
}

function RecentDocumentsCard({ nors, sofs, loading }: { nors: any[] | undefined; sofs: any[] | undefined; loading: boolean }) {
  const norItems = (nors || []).slice(0, 3).map((n: any) => ({ ...n, type: "NOR", href: `/nor/${n.id}` }));
  const sofItems = (sofs || []).slice(0, 2).map((s: any) => ({ ...s, type: "SOF", href: `/sof/${s.id}` }));
  const combined = [...norItems, ...sofItems].sort((a, b) =>
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  ).slice(0, 4);

  return (
    <Card className="p-5 space-y-3" data-testid="card-master-documents">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-muted-foreground/60" />
        <h3 className="font-semibold text-sm">Recent Documents</h3>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : combined.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-3">No documents yet</p>
      ) : (
        <div className="space-y-1">
          {combined.map((doc: any, i) => (
            <Link key={i} href={doc.href}>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={`doc-item-${i}`}>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {doc.type}
                  </Badge>
                  <span className="text-sm truncate max-w-[160px]">
                    {doc.vesselName || doc.vesselId || "Document"}
                  </span>
                </div>
                <ArrowRight className="w-3 h-3 text-muted-foreground/40 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Link href="/nor" className="flex-1">
          <Button variant="outline" size="sm" className="w-full text-xs gap-1" data-testid="btn-go-nor">
            <FileCheck className="w-3 h-3" /> NOR
          </Button>
        </Link>
        <Link href="/sof" className="flex-1">
          <Button variant="outline" size="sm" className="w-full text-xs gap-1" data-testid="btn-go-sof">
            <ClipboardList className="w-3 h-3" /> SOF
          </Button>
        </Link>
      </div>
    </Card>
  );
}

function CertificateAlertsCard({ certs, loading }: { certs: any[] | undefined; loading: boolean }) {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiring = (certs || []).filter((c: any) => {
    if (!c.expiryDate) return false;
    const exp = new Date(c.expiryDate);
    return exp <= in30;
  });

  return (
    <Card className="p-5 space-y-3" data-testid="card-master-certs">
      <div className="flex items-center gap-2">
        <ScrollText className="w-4 h-4 text-muted-foreground/60" />
        <h3 className="font-semibold text-sm">Certificate Alerts</h3>
        {expiring.length > 0 && (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 text-[10px] ml-auto">
            {expiring.length} expiring
          </Badge>
        )}
      </div>
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : expiring.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 py-2">
          <CheckCircle2 className="w-4 h-4" />
          All certificates valid
        </div>
      ) : (
        <div className="space-y-1.5">
          {expiring.slice(0, 3).map((cert: any, i) => {
            const exp = new Date(cert.expiryDate);
            const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50" data-testid={`cert-alert-${i}`}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-medium truncate max-w-[140px]">{cert.certificateType || cert.name}</span>
                </div>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {daysLeft <= 0 ? "Expired" : `${daysLeft}d`}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <Link href="/vessel-certificates">
        <Button variant="outline" size="sm" className="w-full gap-2 text-xs" data-testid="btn-view-certs">
          <ScrollText className="w-3 h-3" /> View All Certificates
        </Button>
      </Link>
    </Card>
  );
}

export function MasterDashboard({ user }: { user: any }) {
  const { data: vessels, isLoading: vesselsLoading } = useQuery<any[]>({
    queryKey: ["/api/vessels"],
  });
  const { data: voyagesData, isLoading: voyagesLoading } = useQuery<any>({
    queryKey: ["/api/voyages"],
  });
  const { data: norData, isLoading: norLoading } = useQuery<any>({
    queryKey: ["/api/nor"],
  });
  const { data: sofData, isLoading: sofLoading } = useQuery<any>({
    queryKey: ["/api/sof"],
  });
  const { data: certsData, isLoading: certsLoading } = useQuery<any[]>({
    queryKey: ["/api/vessel-certificates"],
  });
  const { data: notificationsData } = useQuery<any>({
    queryKey: ["/api/notifications"],
  });

  const voyages = Array.isArray(voyagesData) ? voyagesData : voyagesData?.voyages || [];
  const nors = Array.isArray(norData) ? norData : norData?.items || [];
  const sofs = Array.isArray(sofData) ? sofData : sofData?.items || [];
  const certs = Array.isArray(certsData) ? certsData : [];
  const unreadMessages = notificationsData?.unread || 0;

  const activeVoyages = voyages.filter((v: any) => v.status === "active" || v.status === "in_port").length;
  const openNors = nors.filter((n: any) => n.status !== "accepted" && n.status !== "rejected").length;
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringCerts = certs.filter((c: any) => c.expiryDate && new Date(c.expiryDate) <= in30).length;

  return (
    <div className="space-y-6" data-testid="master-dashboard">
      {/* Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Active Voyages"
          value={activeVoyages}
          loading={voyagesLoading}
          icon={Navigation}
          color="210 70% 40%"
          href="/voyages"
          testId="stat-active-voyages"
        />
        <StatCard
          label="Open NORs"
          value={openNors}
          loading={norLoading}
          icon={FileCheck}
          color="var(--maritime-secondary)"
          href="/nor"
          testId="stat-open-nors"
        />
        <StatCard
          label="Expiring Certs"
          value={expiringCerts}
          loading={certsLoading}
          icon={AlertTriangle}
          color={expiringCerts > 0 ? "38 92% 50%" : "142 76% 36%"}
          href="/vessel-certificates"
          testId="stat-expiring-certs"
        />
        <StatCard
          label="Notifications"
          value={unreadMessages}
          icon={Bell}
          color="var(--maritime-accent)"
          href="/notifications"
          testId="stat-unread-messages"
        />
      </div>

      {/* Quick Actions */}
      <Card className="p-5 space-y-3" data-testid="card-master-quick-actions">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-muted-foreground/60" />
          <h3 className="font-semibold text-sm">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <QuickActionButton label="My Vessel" href="/vessels" icon={Ship} />
          <QuickActionButton label="Sign NOR" href="/nor" icon={FileCheck} />
          <QuickActionButton label="Schedule" href="/vessel-schedule" icon={Calendar} />
          <QuickActionButton label="Messages" href="/messages" icon={MessageSquare} />
        </div>
      </Card>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          <VesselCard vessels={vessels} loading={vesselsLoading} />
          <CurrentVoyageCard voyages={voyages} loading={voyagesLoading} />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <RecentDocumentsCard nors={nors} sofs={sofs} loading={norLoading || sofLoading} />
          <CertificateAlertsCard certs={certs} loading={certsLoading} />
          <Card className="p-5 space-y-3" data-testid="card-master-ai-drop">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-muted-foreground/60" />
              <h3 className="font-semibold text-sm">AI Smart Drop</h3>
            </div>
            <p className="text-xs text-muted-foreground">Drop bridge emails or documents for instant analysis.</p>
            <AiSmartDropMini />
            <Link href="/ai-smart-drop">
              <Button variant="outline" size="sm" className="w-full gap-2 text-xs" data-testid="btn-ai-full">
                <Wand2 className="w-3 h-3" /> View Full History →
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
