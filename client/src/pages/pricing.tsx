import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ship, Check, Zap, Crown, ArrowLeft, CreditCard, X, Loader2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { PageMeta } from "@/components/page-meta";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function Pricing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutHtml, setCheckoutHtml] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);

  const { data: paymentStatus } = useQuery<{
    plan: string;
    proformaLimit: number;
    proformaCount: number;
    iyzicoEnabled: boolean;
  }>({
    queryKey: ["/api/payment/status"],
    enabled: !!user,
  });

  const iyzicoEnabled = paymentStatus?.iyzicoEnabled ?? false;
  const currentPlan = user?.subscriptionPlan || "free";

  // Handle URL status params from Iyzico callback redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const plan = params.get("plan");
    if (status === "success") {
      toast({ title: "Payment successful!", description: `Your plan has been upgraded to ${plan || "Standard"}.` });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment/status"] });
      setLocation("/pricing");
    } else if (status === "failed") {
      toast({ title: "Payment unsuccessful", description: "The payment could not be completed. Please try again.", variant: "destructive" });
      setLocation("/pricing");
    } else if (status === "error") {
      toast({ title: "Payment error", description: "An error occurred during payment. Please try again.", variant: "destructive" });
      setLocation("/pricing");
    }
  }, []);

  // Inject Iyzico checkout form scripts once HTML is loaded into DOM
  useEffect(() => {
    if (!checkoutHtml || !checkoutOpen || !formContainerRef.current) return;
    const container = formContainerRef.current;
    const scripts = container.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      if (oldScript.src) {
        newScript.src = oldScript.src;
        newScript.async = true;
      } else {
        newScript.textContent = oldScript.textContent;
      }
      document.head.appendChild(newScript);
    });
  }, [checkoutHtml, checkoutOpen]);

  const handleUpgrade = async (plan: string) => {
    if (!["standard", "unlimited"].includes(plan)) return;
    setSelectedPlan(plan);
    setCheckoutLoading(true);

    try {
      const res = await fetch("/api/payment/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Cannot initiate payment",
          description: data.error || "Payment service unavailable",
          variant: "destructive",
        });
        return;
      }

      if (data.checkoutFormContent) {
        setCheckoutHtml(data.checkoutFormContent);
        setCheckoutOpen(true);
      } else {
        toast({ title: "Error", description: data.error || "Payment failed to initialize", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Payment service is currently unavailable. Please try again later.", variant: "destructive" });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const plans = [
    {
      id: "free",
      name: "Free",
      price: "₺0",
      period: "/forever",
      desc: "Perfect for trying out the platform",
      icon: Zap,
      color: "var(--maritime-primary)",
      features: [
        "1 proforma generation",
        "1 vessel registration",
        "All Turkish ports access",
        "Basic tariff calculations",
        "PDF export",
      ],
      highlight: false,
    },
    {
      id: "standard",
      name: "Standard",
      price: "₺1,490",
      period: "/package (10 PDA)",
      desc: "For active ship agents",
      icon: Ship,
      color: "var(--maritime-accent)",
      features: [
        "10 proforma generations",
        "Unlimited vessel registration",
        "All Turkish ports access",
        "Advanced tariff calculations",
        "PDF export & printing",
        "Priority support",
      ],
      highlight: true,
    },
    {
      id: "unlimited",
      name: "Unlimited",
      price: "₺5,990",
      period: "/month",
      desc: "For large-scale operations",
      icon: Crown,
      color: "var(--maritime-primary)",
      features: [
        "Unlimited proforma generations",
        "Unlimited vessel registration",
        "All Turkish ports access",
        "Advanced tariff calculations",
        "PDF export & printing",
        "Priority support",
        "Custom branding",
        "API access",
      ],
      highlight: false,
    },
  ];

  return (
    <div className="px-3 py-5 space-y-8 max-w-7xl mx-auto">
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

      {!iyzicoEnabled && user && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            Online payment is currently being configured. To upgrade your plan, please contact us directly at{" "}
            <a href="mailto:info@vesselpda.com" className="font-semibold underline">info@vesselpda.com</a>.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isDowngrade =
            (currentPlan === "unlimited" && plan.id !== "unlimited") ||
            (currentPlan === "standard" && plan.id === "free");
          const isPending = checkoutLoading && selectedPlan === plan.id;

          return (
            <Card
              key={plan.id}
              className={`relative p-8 space-y-6 hover-elevate ${
                plan.highlight
                  ? "border-[hsl(var(--maritime-accent))] border-2 shadow-lg shadow-[hsl(var(--maritime-accent)/0.1)]"
                  : "border-border/60"
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
                className={`w-full gap-2 ${
                  plan.highlight && !isCurrent
                    ? "bg-[hsl(var(--maritime-accent))] hover:bg-[hsl(var(--maritime-accent)/0.9)] text-white"
                    : ""
                }`}
                variant={isCurrent ? "outline" : plan.highlight ? "default" : "outline"}
                size="lg"
                disabled={isCurrent || isDowngrade || isPending || plan.id === "free"}
                onClick={() => !isCurrent && !isDowngrade && plan.id !== "free" && handleUpgrade(plan.id)}
                data-testid={`button-select-${plan.id}`}
              >
                {isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                ) : isCurrent ? (
                  "Current Plan"
                ) : isDowngrade ? (
                  "Downgrade N/A"
                ) : plan.id === "free" ? (
                  "Free Plan"
                ) : (
                  <><CreditCard className="w-4 h-4" /> Pay & Upgrade</>
                )}
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
        <p className="text-xs text-muted-foreground">
          Prices shown in Turkish Lira (TRY). VAT may apply. Secure payment powered by Iyzico.
        </p>
      </Card>

      {/* Iyzico Checkout Modal */}
      <Dialog open={checkoutOpen} onOpenChange={(open) => { setCheckoutOpen(open); if (!open) setCheckoutHtml(""); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden" data-testid="dialog-checkout">
          <DialogHeader className="px-6 pt-6 pb-2">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[hsl(var(--maritime-accent))]" />
                Secure Payment
              </DialogTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Upgrading to <strong className="capitalize">{selectedPlan}</strong> plan &mdash; Powered by Iyzico
            </p>
          </DialogHeader>
          <div
            ref={formContainerRef}
            className="px-4 pb-6"
            data-testid="container-checkout-form"
            dangerouslySetInnerHTML={{ __html: checkoutHtml }}
          />
          <div className="px-6 pb-4 text-center">
            <p className="text-xs text-muted-foreground">
              Your payment is processed securely by Iyzico. VesselPDA does not store your card details.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
