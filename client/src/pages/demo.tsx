import { useState } from "react";
import { useLocation } from "wouter";
import { Anchor, Ship, Handshake, Wrench, ArrowRight, Loader2, Compass } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";

const DEMO_ROLES = [
  {
    role: "agent",
    label: "Ship Agent",
    icon: Anchor,
    color: "blue",
    description: "Manage port calls, submit bids on tenders, and generate proforma disbursement accounts for vessels calling at your ports.",
    colorClasses: "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  {
    role: "shipowner",
    label: "Shipowner",
    icon: Ship,
    color: "green",
    description: "Track your fleet, post port call tenders, manage voyages, and review proforma disbursement accounts from your agents.",
    colorClasses: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  {
    role: "broker",
    label: "Ship Broker",
    icon: Handshake,
    color: "purple",
    description: "Manage fixtures and charter negotiations, track cargo positions, and monitor Baltic market data and freight rates.",
    colorClasses: "border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20",
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
    badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  {
    role: "provider",
    label: "Ship Provider",
    icon: Wrench,
    color: "orange",
    description: "List your maritime services in the directory, respond to service requests, and manage invoices for port services.",
    colorClasses: "border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20",
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
    badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  {
    role: "master",
    label: "Ship Master",
    icon: Compass,
    color: "sky",
    description: "Track your vessel's port calls from the bridge, sign NOR, view certificates, and drop bridge emails for AI analysis.",
    colorClasses: "border-sky-200 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/20",
    iconBg: "bg-sky-100 dark:bg-sky-900/30",
    iconColor: "text-sky-600 dark:text-sky-400",
    badgeClass: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  },
];

export default function DemoPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  async function handleDemoLogin(role: string) {
    setLoadingRole(role);
    try {
      const res = await fetch("/api/demo/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to start demo" }));
        throw new Error(err.message || "Failed to start demo");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/dashboard");
    } catch (err: any) {
      toast({
        title: "Demo login failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingRole(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[hsl(var(--maritime-primary)/0.15)] to-slate-900 flex flex-col">
      <PageMeta title="Try the Demo | VesselPDA" description="Experience the VesselPDA maritime platform as different roles — Ship Agent, Shipowner, Broker, or Service Provider." />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/logo-v2.png" alt="VesselPDA" className="w-8 h-8 rounded-md object-contain" />
          <span className="font-serif font-bold text-white text-sm">VesselPDA</span>
        </a>
        <div className="flex items-center gap-3">
          <a href="/login">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10" data-testid="button-demo-login">
              Sign in
            </Button>
          </a>
          <a href="/register">
            <Button size="sm" className="bg-white text-slate-900 hover:bg-white/90" data-testid="button-demo-register">
              Create Account
            </Button>
          </a>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-4xl w-full space-y-10">
          {/* Title */}
          <div className="text-center space-y-3">
            <Badge className="bg-white/10 text-white border-white/20 text-xs" data-testid="badge-demo-mode">
              Demo Mode
            </Badge>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-white" data-testid="text-demo-title">
              Explore VesselPDA
            </h1>
            <p className="text-white/60 text-base max-w-lg mx-auto">
              Try the platform as any role with no registration required. Select a role below to get started instantly.
            </p>
          </div>

          {/* Role cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DEMO_ROLES.map((item) => {
              const Icon = item.icon;
              const isLoading = loadingRole === item.role;
              return (
                <Card
                  key={item.role}
                  className={`p-6 border-2 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${item.colorClasses}`}
                  data-testid={`card-demo-role-${item.role}`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.iconBg}`}>
                        <Icon className={`w-6 h-6 ${item.iconColor}`} />
                      </div>
                      <Badge className={`text-[10px] ${item.badgeClass}`}>{item.label}</Badge>
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="font-serif font-semibold text-lg text-foreground">{item.label}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                    </div>
                    <Button
                      className="w-full gap-2 group"
                      onClick={() => handleDemoLogin(item.role)}
                      disabled={!!loadingRole}
                      data-testid={`button-try-role-${item.role}`}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                        </>
                      ) : (
                        <>
                          Try this role
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Footer note */}
          <p className="text-center text-white/40 text-xs">
            Demo accounts are shared and reset periodically. For full access,{" "}
            <a href="/register" className="underline hover:text-white/60 transition-colors">create a free account</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
