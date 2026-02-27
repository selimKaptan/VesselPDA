import { useMutation } from "@tanstack/react-query";
import { Ship, Check, Zap, Crown, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { PageMeta } from "@/components/page-meta";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Pricing() {
  const { user } = useAuth();
  const { toast } = useToast();

  const upgradeMutation = useMutation({
    mutationFn: async (plan: string) => {
      const res = await apiRequest("POST", "/api/subscription/upgrade", { plan });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Plan upgraded successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to upgrade plan", variant: "destructive" });
    },
  });

  const currentPlan = user?.subscriptionPlan || "free";

  const plans = [
    {
      id: "free",
      name: "Free",
      price: "$0",
      period: "/forever",
      desc: "Perfect for trying out the platform",
      icon: Zap,
      color: "var(--maritime-primary)",
      features: ["1 proforma generation", "1 vessel registration", "All Turkish ports access", "Basic tariff calculations", "PDF export"],
      highlight: false,
    },
    {
      id: "standard",
      name: "Standard",
      price: "$29",
      period: "/10 proformas",
      desc: "For active ship agents",
      icon: Ship,
      color: "var(--maritime-accent)",
      features: ["10 proforma generations", "Unlimited vessel registration", "All Turkish ports access", "Advanced tariff calculations", "PDF export & printing", "Priority support"],
      highlight: true,
    },
    {
      id: "unlimited",
      name: "Unlimited",
      price: "$79",
      period: "/month",
      desc: "For large-scale operations",
      icon: Crown,
      color: "var(--maritime-primary)",
      features: ["Unlimited proforma generations", "Unlimited vessel registration", "All Turkish ports access", "Advanced tariff calculations", "PDF export & printing", "Priority support", "Custom branding", "API access"],
      highlight: false,
    },
  ];

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <PageMeta title="Pricing & Plans | VesselPDA" description="Choose the right plan for your maritime operations. Free, Standard, and Unlimited plans available." />
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-pricing-title">Upgrade Your Plan</h1>
          <p className="text-muted-foreground">Choose the plan that fits your needs</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isDowngrade = (currentPlan === "unlimited" && plan.id !== "unlimited") ||
            (currentPlan === "standard" && plan.id === "free");

          return (
            <Card
              key={plan.id}
              className={`relative p-8 space-y-6 hover-elevate ${
                plan.highlight ? "border-[hsl(var(--maritime-accent))] border-2 shadow-lg shadow-[hsl(var(--maritime-accent)/0.1)]" : "border-border/60"
              } ${isCurrent ? "ring-2 ring-[hsl(var(--maritime-success))]" : ""}`}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <Badge className="bg-[hsl(var(--maritime-accent))] text-white px-4 py-1 text-xs font-semibold shadow-md">
                    MOST POPULAR
                  </Badge>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3.5 right-4">
                  <Badge className="bg-[hsl(var(--maritime-success))] text-white px-3 py-1 text-xs font-semibold">
                    CURRENT
                  </Badge>
                </div>
              )}
              <div className="space-y-3">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `hsl(${plan.color} / 0.1)` }}
                >
                  <plan.icon className="w-6 h-6" style={{ color: `hsl(${plan.color})` }} />
                </div>
                <h3 className="font-serif font-bold text-xl">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.desc}</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground text-sm">{plan.period}</span>
              </div>
              <ul className="space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: `hsl(${plan.color})` }} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={`w-full ${
                  plan.highlight && !isCurrent
                    ? "bg-[hsl(var(--maritime-accent))] hover:bg-[hsl(var(--maritime-accent)/0.9)] text-white"
                    : ""
                }`}
                variant={isCurrent ? "outline" : plan.highlight ? "default" : "outline"}
                size="lg"
                disabled={isCurrent || isDowngrade || upgradeMutation.isPending}
                onClick={() => !isCurrent && !isDowngrade && upgradeMutation.mutate(plan.id)}
                data-testid={`button-select-${plan.id}`}
              >
                {isCurrent ? "Current Plan" : isDowngrade ? "Downgrade N/A" : upgradeMutation.isPending ? "Upgrading..." : `Choose ${plan.name}`}
              </Button>
            </Card>
          );
        })}
      </div>

      <Card className="p-6 text-center space-y-3" data-testid="card-usage-info">
        <p className="text-sm text-muted-foreground">
          Currently on <strong>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</strong> plan
          {currentPlan !== "unlimited" && (
            <> &mdash; {user?.proformaCount ?? 0} / {user?.proformaLimit ?? 1} proformas used</>
          )}
        </p>
      </Card>
    </div>
  );
}
