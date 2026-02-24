import { Ship, Anchor, FileText, BarChart3, Shield, Globe, ArrowRight, Waves, Check, Zap, Crown, Star, Building2, User, Activity } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ActivityItem {
  type: string;
  message: string;
  timestamp: string;
  icon: string;
}

function getActivityIcon(type: string) {
  switch (type) {
    case "proforma": return <FileText className="w-4 h-4" />;
    case "vessel": return <Ship className="w-4 h-4" />;
    case "company": return <Building2 className="w-4 h-4" />;
    case "user": return <User className="w-4 h-4" />;
    default: return <Activity className="w-4 h-4" />;
  }
}

function getActivityColor(type: string) {
  switch (type) {
    case "proforma": return "from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/20";
    case "vessel": return "from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/20";
    case "company": return "from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/20";
    case "user": return "from-violet-500/20 to-purple-500/20 text-violet-400 border-violet-500/20";
    default: return "from-gray-500/20 to-slate-500/20 text-gray-400 border-gray-500/20";
  }
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function LiveActivityTicker() {
  const { data: activities } = useQuery<ActivityItem[]>({
    queryKey: ["/api/activity-feed"],
    refetchInterval: 30000,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  if (!activities || activities.length === 0) return null;

  const duplicated = [...activities, ...activities, ...activities];

  return (
    <section className="py-12 md:py-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--maritime-primary)/0.03)] via-[hsl(var(--maritime-primary)/0.06)] to-[hsl(var(--maritime-primary)/0.03)]" />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-[hsl(var(--maritime-accent)/0.04)] blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-48 h-48 rounded-full bg-[hsl(var(--maritime-secondary)/0.04)] blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative mb-8">
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Live Platform Activity</span>
          </div>
        </div>
      </div>

      <div
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        style={{ perspective: "1000px" }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-r from-background to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-l from-background to-transparent pointer-events-none" />

        <div
          ref={scrollRef}
          className="flex gap-4"
          style={{
            animation: `scroll-ticker ${activities.length * 4}s linear infinite`,
            animationPlayState: isPaused ? "paused" : "running",
            width: "max-content",
          }}
        >
          {duplicated.map((item, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[320px] group"
              style={{
                transform: "rotateY(-2deg)",
                transformStyle: "preserve-3d",
                transition: "transform 0.3s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "rotateY(0deg) scale(1.05) translateZ(20px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "rotateY(-2deg)"; }}
              data-testid={`activity-card-${i}`}
            >
              <div className={`relative rounded-xl border backdrop-blur-sm bg-gradient-to-br ${getActivityColor(item.type)} p-4 h-full shadow-lg shadow-black/5 transition-shadow group-hover:shadow-xl`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getActivityColor(item.type)} flex items-center justify-center flex-shrink-0 border border-current/10`}>
                    {getActivityIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                      {item.message}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {timeAgo(item.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes scroll-ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-[hsl(var(--maritime-primary))] flex items-center justify-center">
              <Anchor className="w-5 h-5 text-white" />
            </div>
            <span className="font-serif font-bold text-lg tracking-tight">MaritimePDA</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground transition-colors" data-testid="link-features">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors" data-testid="link-how-it-works">How It Works</a>
            <a href="/directory" className="text-sm text-muted-foreground transition-colors" data-testid="link-directory">Directory</a>
            <a href="/service-ports" className="text-sm text-muted-foreground transition-colors" data-testid="link-service-ports">Service Ports</a>
            <a href="/forum" className="text-sm text-muted-foreground transition-colors" data-testid="link-forum">Forum</a>
            <a href="#pricing" className="text-sm text-muted-foreground transition-colors" data-testid="link-pricing">Pricing</a>
          </div>
          <a href="/api/login">
            <Button data-testid="button-login">Sign In</Button>
          </a>
        </div>
      </nav>

      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[hsl(var(--maritime-accent)/0.08)] blur-3xl" />
          <div className="absolute top-1/2 -left-20 w-72 h-72 rounded-full bg-[hsl(var(--maritime-primary)/0.06)] blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--maritime-accent)/0.1)] text-[hsl(var(--maritime-accent))] text-sm font-medium">
                <Ship className="w-4 h-4" />
                <span>Professional Maritime Solutions</span>
              </div>
              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                Instant Proforma
                <span className="block text-[hsl(var(--maritime-primary))]">Disbursement Accounts</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Generate professional port expense estimates in seconds. Built for ship agents, 
                shipowners, and brokers who demand accuracy and speed.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <a href="/api/login">
                  <Button size="lg" className="gap-2" data-testid="button-get-started">
                    Get Started Free
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
                <a href="#features">
                  <Button variant="outline" size="lg" data-testid="button-learn-more">
                    Learn More
                  </Button>
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="w-4 h-4 text-[hsl(var(--maritime-success))]" />
                  <span>Free forever plan</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="w-4 h-4 text-[hsl(var(--maritime-accent))]" />
                  <span>All Turkish ports</span>
                </div>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <div className="relative rounded-md shadow-xl ring-1 ring-black/5 overflow-hidden transition-transform duration-500 hover:scale-[1.02]">
                <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--maritime-primary)/0.4)] to-transparent z-10" />
                <img
                  src="/images/hero-ship.png"
                  alt="Maritime vessel"
                  className="w-full h-[420px] object-cover"
                />
                <div className="absolute bottom-6 left-6 right-6 z-20">
                  <div className="backdrop-blur-sm bg-white/10 rounded-md p-4 border border-white/20">
                    <div className="flex items-center gap-3 text-white">
                      <FileText className="w-5 h-5" />
                      <div>
                        <p className="font-medium text-sm">MV CHELSEA 2 - Tekirdag Port</p>
                        <p className="text-xs text-white/70">Proforma generated in 3 seconds</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 w-32 h-32 rounded-full bg-[hsl(var(--maritime-accent)/0.1)] blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      <LiveActivityTicker />

      <section id="features" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">
              Everything You Need for Port Disbursements
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Streamline your proforma generation process with powerful tools designed for the maritime industry.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Ship,
                title: "Fleet Management",
                desc: "Add and manage all your vessels in one place. Track GRT, NRT, flag, and vessel specifications.",
                color: "var(--maritime-primary)",
              },
              {
                icon: FileText,
                title: "Instant Proformas",
                desc: "Generate professional proforma invoices in seconds based on real port tariff data.",
                color: "var(--maritime-secondary)",
              },
              {
                icon: BarChart3,
                title: "Tariff Calculator",
                desc: "Automated calculation engine using official port tariff rates for accurate cost estimates.",
                color: "var(--maritime-accent)",
              },
              {
                icon: Globe,
                title: "Multi-Port Support",
                desc: "Access tariff data for Turkish ports including Istanbul, Izmir, Tekirdag, and more.",
                color: "var(--maritime-success)",
              },
              {
                icon: Shield,
                title: "Agent & Provider Directory",
                desc: "Find and connect with trusted ship agents and maritime service providers across Turkish ports.",
                color: "var(--maritime-primary)",
              },
              {
                icon: Waves,
                title: "Company Profiles",
                desc: "Agents and providers can create professional profiles to advertise their services to shipowners.",
                color: "var(--maritime-secondary)",
              },
            ].map((feature, i) => (
              <Card key={i} className="p-6 space-y-4 hover-elevate" data-testid={`card-feature-${i}`}>
                <div
                  className="w-11 h-11 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: `hsl(${feature.color} / 0.1)` }}
                >
                  <feature.icon className="w-5 h-5" style={{ color: `hsl(${feature.color})` }} />
                </div>
                <h3 className="font-serif font-semibold text-lg">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 md:py-28 bg-card/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">
              How It Works
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Three simple steps to generate your proforma disbursement account.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Add Your Vessel", desc: "Enter vessel particulars including GRT, NRT, flag, and type." },
              { step: "02", title: "Select Port", desc: "Choose the destination port and specify cargo details." },
              { step: "03", title: "Generate Proforma", desc: "Get instant cost breakdown with official tariff calculations." },
            ].map((item, i) => (
              <div key={i} className="text-center space-y-4" data-testid={`step-${i}`}>
                <div className="w-16 h-16 rounded-full bg-[hsl(var(--maritime-primary))] text-white flex items-center justify-center mx-auto font-serif font-bold text-xl">
                  {item.step}
                </div>
                <h3 className="font-serif font-semibold text-xl">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <Badge variant="outline" className="px-4 py-1.5 text-sm font-medium border-[hsl(var(--maritime-accent))] text-[hsl(var(--maritime-accent))]" data-testid="badge-pricing">
              <Star className="w-3.5 h-3.5 mr-1.5" />
              Pricing Plans
            </Badge>
            <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">
              Choose Your Plan
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Start free and scale as your business grows. All plans include access to 800+ Turkish ports.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card className="relative p-8 space-y-6 border-border/60 hover-elevate" data-testid="card-plan-free">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center">
                  <Zap className="w-6 h-6 text-[hsl(var(--maritime-primary))]" />
                </div>
                <h3 className="font-serif font-bold text-xl">Free</h3>
                <p className="text-sm text-muted-foreground">Perfect for trying out the platform</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-4xl font-bold">$0</span>
                <span className="text-muted-foreground text-sm">/forever</span>
              </div>
              <ul className="space-y-3">
                {["1 proforma generation", "1 vessel registration", "All Turkish ports access", "Basic tariff calculations", "PDF export"].map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-[hsl(var(--maritime-success))] flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <a href="/api/login" className="block">
                <Button variant="outline" className="w-full" size="lg" data-testid="button-plan-free">
                  Get Started Free
                </Button>
              </a>
            </Card>

            <Card className="relative p-8 space-y-6 border-[hsl(var(--maritime-accent))] border-2 shadow-lg shadow-[hsl(var(--maritime-accent)/0.1)] hover-elevate" data-testid="card-plan-standard">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <Badge className="bg-[hsl(var(--maritime-accent))] text-white px-4 py-1 text-xs font-semibold shadow-md">
                  MOST POPULAR
                </Badge>
              </div>
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-lg bg-[hsl(var(--maritime-accent)/0.1)] flex items-center justify-center">
                  <Ship className="w-6 h-6 text-[hsl(var(--maritime-accent))]" />
                </div>
                <h3 className="font-serif font-bold text-xl">Standard</h3>
                <p className="text-sm text-muted-foreground">For active ship agents</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-4xl font-bold">$29</span>
                <span className="text-muted-foreground text-sm">/10 proformas</span>
              </div>
              <ul className="space-y-3">
                {["10 proforma generations", "Unlimited vessel registration", "All Turkish ports access", "Advanced tariff calculations", "PDF export & printing", "Priority support"].map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-[hsl(var(--maritime-accent))] flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <a href="/api/login" className="block">
                <Button className="w-full bg-[hsl(var(--maritime-accent))] hover:bg-[hsl(var(--maritime-accent)/0.9)] text-white" size="lg" data-testid="button-plan-standard">
                  Choose Standard
                </Button>
              </a>
            </Card>

            <Card className="relative p-8 space-y-6 border-border/60 hover-elevate bg-gradient-to-b from-[hsl(var(--maritime-primary)/0.03)] to-transparent" data-testid="card-plan-unlimited">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center">
                  <Crown className="w-6 h-6 text-[hsl(var(--maritime-primary))]" />
                </div>
                <h3 className="font-serif font-bold text-xl">Unlimited</h3>
                <p className="text-sm text-muted-foreground">For large-scale operations</p>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-4xl font-bold">$79</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
              <ul className="space-y-3">
                {["Unlimited proforma generations", "Unlimited vessel registration", "All Turkish ports access", "Advanced tariff calculations", "PDF export & printing", "Priority support", "Custom branding", "API access"].map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-[hsl(var(--maritime-primary))] flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <a href="/api/login" className="block">
                <Button variant="outline" className="w-full border-[hsl(var(--maritime-primary))] text-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.05)]" size="lg" data-testid="button-plan-unlimited">
                  Choose Unlimited
                </Button>
              </a>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">
            Ready to Streamline Your Port Operations?
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Join maritime professionals who trust MaritimePDA for accurate and instant proforma generation.
          </p>
          <a href="/api/login">
            <Button size="lg" className="gap-2" data-testid="button-cta-bottom">
              Start Generating Proformas
              <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Anchor className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
            <span className="text-sm font-medium">MaritimePDA</span>
          </div>
          <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} MaritimePDA. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
