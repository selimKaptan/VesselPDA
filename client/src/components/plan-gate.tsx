import { Link } from "wouter";
import { Lock, Zap, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubscription, canAccess, type SubscriptionPlan } from "@/hooks/use-subscription";

interface PlanGateProps {
  requiredPlan: SubscriptionPlan;
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: "Free",
  standard: "Standard",
  unlimited: "Unlimited",
};

const PLAN_ICONS: Record<SubscriptionPlan, React.ComponentType<{ className?: string }>> = {
  free: Lock,
  standard: Zap,
  unlimited: Crown,
};

export function PlanGate({ requiredPlan, feature, children, fallback }: PlanGateProps) {
  const { status, isLoading } = useSubscription();

  if (isLoading) return <>{children}</>;

  if (canAccess(status.plan, requiredPlan)) {
    return <>{children}</>;
  }

  if (fallback) return <>{fallback}</>;

  const Icon = PLAN_ICONS[requiredPlan];

  return (
    <div className="flex-1 flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md mx-auto p-8 space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--maritime-primary)/0.15)] to-[hsl(var(--maritime-accent)/0.1)] border border-[hsl(var(--maritime-primary)/0.2)] flex items-center justify-center mx-auto">
          <Icon className="w-8 h-8 text-[hsl(var(--maritime-primary))]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold font-serif">{feature}</h2>
          <p className="text-sm text-muted-foreground">
            This feature requires the{" "}
            <span className="font-semibold text-[hsl(var(--maritime-primary))]">
              {PLAN_LABELS[requiredPlan]}
            </span>{" "}
            plan or higher.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Badge
            variant="outline"
            className="mx-auto text-xs px-3 py-1 border-amber-400/40 text-amber-400 bg-amber-400/5"
          >
            Current plan: {PLAN_LABELS[status.plan]}
          </Badge>
          <Link href="/pricing">
            <Button
              className="w-full bg-gradient-to-r from-[hsl(var(--maritime-primary))] to-[hsl(var(--maritime-accent))] text-white border-0 hover:opacity-90"
              data-testid="button-upgrade-plan"
            >
              <Zap className="w-4 h-4 mr-2" />
              Upgrade to {PLAN_LABELS[requiredPlan]}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ProBadge({ plan = "standard" }: { plan?: SubscriptionPlan }) {
  const labels: Record<SubscriptionPlan, string> = {
    free: "",
    standard: "PRO",
    unlimited: "UNLIMITED",
  };
  const colors: Record<SubscriptionPlan, string> = {
    free: "",
    standard: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    unlimited: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };
  if (plan === "free") return null;
  return (
    <span
      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none ${colors[plan]}`}
      data-testid="badge-pro"
    >
      {labels[plan]}
    </span>
  );
}
