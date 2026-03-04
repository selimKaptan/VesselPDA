import { Link } from "wouter";
import { ShieldX, ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { PageMeta } from "@/components/page-meta";
import { useLocation } from "wouter";
import { getAllowedRolesForRoute } from "@/lib/route-permissions";

const ROLE_LABELS: Record<string, string> = {
  ship_agent:    "Ship Agent",
  shipowner:     "Shipowner",
  ship_broker:   "Ship Broker",
  ship_provider: "Service Provider",
  admin:         "Administrator",
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  ship_agent:    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400",
  shipowner:     "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400",
  ship_broker:   "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400",
  ship_provider: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400",
  admin:         "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400",
};

export default function UnauthorizedPage() {
  const { role, userRole } = useAuth();
  const [location] = useLocation();
  const currentRole = role || userRole || "shipowner";

  const allowedRoles = getAllowedRolesForRoute(location === "/unauthorized" ? "/" : location);
  const allowedLabels = allowedRoles.filter((r) => r !== "admin").map((r) => ROLE_LABELS[r] || r);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/30">
      <PageMeta title="Access Denied | VesselPDA" description="You do not have permission to access this page." />
      <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl border-2" data-testid="card-unauthorized">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center ring-4 ring-red-100/50 dark:ring-red-900/30">
            <ShieldX className="w-10 h-10 text-red-500" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-unauthorized-title">
            Access Denied
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You don't have permission to view this page with your current role.
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 p-4 text-left space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Access Information</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Your role:</span>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${ROLE_BADGE_COLORS[currentRole] || ""}`}>
                {ROLE_LABELS[currentRole] || currentRole}
              </Badge>
            </div>

            {allowedLabels.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">This page is accessible to:</p>
                <div className="flex flex-wrap gap-1.5">
                  {allowedLabels.map((label) => {
                    const roleKey = Object.entries(ROLE_LABELS).find(([, v]) => v === label)?.[0] || "";
                    return (
                      <Badge key={label} variant="outline" className={`text-[10px] px-1.5 py-0 ${ROLE_BADGE_COLORS[roleKey] || "bg-slate-100 text-slate-600"}`}>
                        {label}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link href="/dashboard">
            <Button
              className="gap-2 bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)] text-white w-full sm:w-auto"
              data-testid="button-go-dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              Go to Dashboard
            </Button>
          </Link>
        </div>

        <p className="text-[11px] text-muted-foreground/60">
          If you believe this is an error, contact your administrator.
        </p>
      </Card>
    </div>
  );
}
