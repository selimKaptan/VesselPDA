import { Ship, FileText, BarChart3, Shield, Globe, ArrowRight, Waves, Check, Zap, Crown, Star, Building2, User, Activity, Anchor, Users, Briefcase, MessageSquare, ChevronDown, TrendingUp, MapPin, Lock, CheckCircle2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

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
    case "forum": return <MessageSquare className="w-4 h-4" />;
    default: return <Activity className="w-4 h-4" />;
  }
}

function getActivityColor(type: string) {
  switch (type) {
    case "proforma": return "from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/20";
    case "vessel": return "from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/20";
    case "company": return "from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/20";
    case "user": return "from-violet-500/20 to-purple-500/20 text-violet-400 border-violet-500/20";
    case "forum": return "from-rose-500/20 to-pink-500/20 text-rose-400 border-rose-500/20";
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

  const [isPaused, setIsPaused] = useState(false);

  if (!activities || activities.length === 0) return null;

  const duplicated = [...activities, ...activities, ...activities];

  return (
    <section className="py-14 md:py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--maritime-primary)/0.02)] via-[hsl(var(--maritime-primary)/0.05)] to-[hsl(var(--maritime-primary)/0.02)]" />

      <div className="max-w-7xl mx-auto px-6 relative mb-8">
        <div className="flex items-center justify-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Live Platform Activity</span>
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
              className="flex-shrink-0 w-[300px] group"
              style={{
                transform: "rotateY(-2deg)",
                transformStyle: "preserve-3d",
                transition: "transform 0.3s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "rotateY(0deg) scale(1.04) translateZ(16px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "rotateY(-2deg)"; }}
              data-testid={`activity-card-${i}`}
            >
              <div className={`relative rounded-xl border backdrop-blur-sm bg-gradient-to-br ${getActivityColor(item.type)} p-4 h-full shadow-md transition-shadow group-hover:shadow-lg`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getActivityColor(item.type)} flex items-center justify-center flex-shrink-0`}>
                    {getActivityIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{item.message}</p>
                    <p className="text-[11px] text-muted-foreground">{timeAgo(item.timestamp)}</p>
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

const WELCOME_KEY = "vesselPDA_welcomed";

export default function Landing() {
  const [showWelcome, setShowWelcome] = useState(() => {
    try { return !localStorage.getItem(WELCOME_KEY); } catch { return true; }
  });

  function closeWelcome() {
    try { localStorage.setItem(WELCOME_KEY, "1"); } catch {}
    setShowWelcome(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <Dialog open={showWelcome} onOpenChange={(open) => { if (!open) closeWelcome(); }}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0" data-testid="dialog-welcome">
          <div className="bg-[hsl(var(--maritime-primary))] px-8 py-7 flex items-center gap-4">
            <img src="/logo-v2.png" alt="VesselPDA" className="w-14 h-14 rounded-xl object-contain bg-white/10 p-1 flex-shrink-0" />
            <div>
              <h2 className="font-serif text-2xl font-bold text-white tracking-tight">VesselPDA'ya Hoş Geldiniz</h2>
              <p className="text-white/75 text-sm mt-1">Denizcilik profesyonelleri için geliştirilmiş dijital platform</p>
            </div>
          </div>
          <div className="px-8 py-6 space-y-6">
            <p className="text-muted-foreground text-sm leading-relaxed">
              <strong className="text-foreground">VesselPDA</strong>, gemi acentelerinin anlık proforma borçlandırma hesabı (Disbursement Account) üretmesini sağlayan ve gemi sahiplerini denizcilik servis sağlayıcılarıyla buluşturan profesyonel bir denizcilik platformudur. Türkiye'nin 804 limanına ait tarife verileri ile formül tabanlı 22 kalem hesaplama motoru içerir.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border bg-card p-4 space-y-2">
                <div className="w-9 h-9 rounded-md bg-blue-500/10 flex items-center justify-center">
                  <Anchor className="w-5 h-5 text-blue-600" />
                </div>
                <p className="font-semibold text-sm">Gemi Sahibi / Broker</p>
                <p className="text-xs text-muted-foreground leading-relaxed">Proforma faturalarını görüntüleyin, rehberden acente ve tedarikçi bulun, filosunuzu yönetin.</p>
              </div>
              <div className="rounded-lg border bg-card p-4 space-y-2">
                <div className="w-9 h-9 rounded-md bg-emerald-500/10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="font-semibold text-sm">Gemi Acentesi</p>
                <p className="text-xs text-muted-foreground leading-relaxed">Saniyeler içinde proforma üretin, şirket profili oluşturun ve denizcilik rehberinde yer alın.</p>
              </div>
              <div className="rounded-lg border bg-card p-4 space-y-2">
                <div className="w-9 h-9 rounded-md bg-amber-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-600" />
                </div>
                <p className="font-semibold text-sm">Servis Sağlayıcı</p>
                <p className="text-xs text-muted-foreground leading-relaxed">Şirket profilinizi oluşturun, hizmet verdiğiniz limanlarda görünür olun ve müşteri kazanın.</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">Bu mesaj bir daha gösterilmeyecek.</p>
              <Button onClick={closeWelcome} className="gap-2" data-testid="button-welcome-close">
                Platforma Gir <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/85 border-b border-border/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo-v2.png" alt="VesselPDA" className="w-8 h-8 rounded-md object-contain" />
            <span className="font-serif font-bold text-lg tracking-tight">VesselPDA</span>
          </div>
          <div className="hidden md:flex items-center gap-7">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-features">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-how-it-works">How It Works</a>
            <a href="/directory" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-directory">Directory</a>
            <a href="/service-ports" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-service-ports">Service Ports</a>
            <a href="/forum" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-forum">Forum</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-pricing">Pricing</a>
          </div>
          <div className="flex items-center gap-2">
            <a href="/api/login">
              <Button size="sm" variant="outline" data-testid="button-login">Log in</Button>
            </a>
            <a href="/api/login">
              <Button size="sm" className="shadow-sm" data-testid="button-signup">Sign up</Button>
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-32 pb-24 md:pt-44 md:pb-32 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--maritime-primary)/0.07)] via-background to-[hsl(var(--maritime-accent)/0.05)]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--maritime-primary)/0.3)] to-transparent" />
          <div className="absolute -top-24 right-[5%] w-[500px] h-[500px] rounded-full bg-[hsl(var(--maritime-accent)/0.07)] blur-[80px]" />
          <div className="absolute top-1/2 -left-32 w-[400px] h-[400px] rounded-full bg-[hsl(var(--maritime-primary)/0.06)] blur-[80px]" />
          <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "radial-gradient(hsl(var(--maritime-primary)) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[hsl(var(--maritime-primary)/0.25)] bg-[hsl(var(--maritime-primary)/0.07)] text-[hsl(var(--maritime-primary))] text-xs font-semibold tracking-wide uppercase">
                <Ship className="w-3.5 h-3.5" />
                <span>Professional Maritime Platform</span>
              </div>

              <div className="space-y-4">
                <h1 className="font-serif text-4xl md:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] tracking-tight text-foreground">
                  Instant Proforma<br />
                  <span className="text-[hsl(var(--maritime-primary))]">Disbursement</span><br />
                  <span className="text-[hsl(var(--maritime-secondary))]">Accounts</span>
                </h1>
                <p className="text-base md:text-lg text-muted-foreground max-w-md leading-relaxed">
                  Generate professional port expense estimates in seconds. Built for ship agents, shipowners, and brokers who demand accuracy and speed.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a href="/api/login">
                  <Button size="lg" className="gap-2 shadow-md shadow-[hsl(var(--maritime-primary)/0.25)] bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)]" data-testid="button-get-started">
                    Get Started Free
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
                <a href="#features">
                  <Button variant="outline" size="lg" className="gap-2 border-border/80 hover:border-[hsl(var(--maritime-primary)/0.4)]" data-testid="button-learn-more">
                    See Features
                  </Button>
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                    <Check className="w-3 h-3 text-emerald-600" />
                  </div>
                  <span>Free forever plan</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
                    <Check className="w-3 h-3 text-blue-600" />
                  </div>
                  <span>804+ Turkish ports</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center">
                    <Check className="w-3 h-3 text-purple-600" />
                  </div>
                  <span>No credit card needed</span>
                </div>
              </div>
            </div>

            {/* Hero ship image */}
            <div className="relative hidden lg:block">
              <div className="relative rounded-2xl shadow-2xl shadow-[hsl(var(--maritime-primary)/0.25)] overflow-hidden transition-transform duration-500 hover:scale-[1.02]">
                <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--maritime-primary)/0.65)] via-[hsl(var(--maritime-primary)/0.15)] to-transparent z-10" />
                <img
                  src="/images/hero-ship.png"
                  alt="Maritime vessel"
                  className="w-full h-[420px] object-cover"
                />
                <div className="absolute bottom-6 left-6 right-6 z-20">
                  <div className="backdrop-blur-sm bg-white/10 rounded-xl p-4 border border-white/20">
                    <div className="flex items-center gap-3 text-white">
                      <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">MV BARBARA — Tekirdag Port</p>
                        <p className="text-xs text-white/70">Proforma generated in 3 seconds</p>
                      </div>
                      <Badge className="ml-auto bg-emerald-500/80 text-white border-0 text-[10px]">Live</Badge>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 w-40 h-40 rounded-full bg-[hsl(var(--maritime-accent)/0.15)] blur-3xl pointer-events-none" />
              <div className="absolute -top-4 -left-4 w-24 h-24 rounded-full bg-[hsl(var(--maritime-secondary)/0.1)] blur-2xl pointer-events-none" />
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-8 hidden md:flex flex-col items-center gap-1 text-muted-foreground/50 animate-bounce">
            <ChevronDown className="w-5 h-5" />
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="border-y border-border/60 bg-[hsl(var(--maritime-primary)/0.03)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border/60">
            {[
              { value: "804+", label: "Turkish Ports", icon: MapPin, color: "var(--maritime-primary)" },
              { value: "22", label: "Calculation Items", icon: BarChart3, color: "var(--maritime-secondary)" },
              { value: "3", label: "Subscription Plans", icon: Shield, color: "var(--maritime-accent)" },
              { value: "100%", label: "Formula-Based", icon: TrendingUp, color: "var(--maritime-success)" },
            ].map((stat, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `hsl(${stat.color} / 0.1)` }}>
                  <stat.icon className="w-4.5 h-4.5" style={{ color: `hsl(${stat.color})` }} />
                </div>
                <div>
                  <p className="font-serif text-xl font-bold leading-none" style={{ color: `hsl(${stat.color})` }}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LiveActivityTicker />

      {/* FEATURES */}
      <section id="features" className="py-24 md:py-32 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <Badge variant="outline" className="px-4 py-1.5 text-xs font-semibold border-[hsl(var(--maritime-primary)/0.3)] text-[hsl(var(--maritime-primary))] uppercase tracking-wide">
              Platform Features
            </Badge>
            <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">
              Everything You Need for<br className="hidden md:block" /> Port Disbursements
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-base md:text-lg leading-relaxed">
              Streamline your proforma generation process with powerful tools designed for the maritime industry.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: Ship,
                title: "Fleet Management",
                desc: "Add and manage all your vessels in one place. Track GRT, NRT, flag, and vessel specifications with ease.",
                color: "var(--maritime-primary)",
                bg: "from-blue-500/10 to-cyan-500/5",
              },
              {
                icon: FileText,
                title: "Instant Proformas",
                desc: "Generate professional proforma invoices in seconds based on real port tariff data and vessel particulars.",
                color: "var(--maritime-secondary)",
                bg: "from-sky-500/10 to-blue-500/5",
              },
              {
                icon: BarChart3,
                title: "Tariff Calculator",
                desc: "Automated calculation engine using official port tariff rates for 22 line items — accurate every time.",
                color: "var(--maritime-accent)",
                bg: "from-cyan-500/10 to-teal-500/5",
              },
              {
                icon: Globe,
                title: "Multi-Port Support",
                desc: "Access tariff data for all 804 Turkish ports including Istanbul, Izmir, Tekirdag, and many more.",
                color: "var(--maritime-success)",
                bg: "from-emerald-500/10 to-green-500/5",
              },
              {
                icon: Users,
                title: "Agent & Provider Directory",
                desc: "Find and connect with trusted ship agents and maritime service providers across Turkish ports.",
                color: "var(--maritime-primary)",
                bg: "from-blue-500/10 to-indigo-500/5",
              },
              {
                icon: Building2,
                title: "Company Profiles",
                desc: "Agents and providers can create professional profiles to advertise their services to shipowners.",
                color: "var(--maritime-secondary)",
                bg: "from-sky-500/10 to-blue-400/5",
              },
            ].map((feature, i) => (
              <Card
                key={i}
                className="p-6 space-y-4 hover:shadow-lg hover:border-[hsl(var(--maritime-primary)/0.25)] transition-all duration-200 group cursor-default"
                data-testid={`card-feature-${i}`}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${feature.bg}`}
                >
                  <feature.icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" style={{ color: `hsl(${feature.color})` }} />
                </div>
                <div>
                  <h3 className="font-serif font-semibold text-base mb-1.5">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                </div>
                <div className="pt-1">
                  <div className="h-0.5 w-8 rounded-full transition-all duration-300 group-hover:w-16" style={{ backgroundColor: `hsl(${feature.color} / 0.5)` }} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-24 md:py-32 scroll-mt-20 bg-gradient-to-b from-[hsl(var(--maritime-primary)/0.03)] to-transparent border-y border-border/40">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <Badge variant="outline" className="px-4 py-1.5 text-xs font-semibold border-[hsl(var(--maritime-accent)/0.4)] text-[hsl(var(--maritime-accent))] uppercase tracking-wide">
              How It Works
            </Badge>
            <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">
              Three Steps to Your Proforma
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-base md:text-lg">
              From vessel details to a finished cost breakdown in under a minute.
            </p>
          </div>

          {/* Steps — desktop: horizontal with connector; mobile: vertical */}
          <div className="relative">
            {/* Connector line — passes behind circles; circles mask it with bg-background */}
            <div className="absolute top-7 left-[16.666%] right-[16.666%] h-0.5 bg-gradient-to-r from-[hsl(var(--maritime-primary)/0.35)] via-[hsl(var(--maritime-accent)/0.5)] to-[hsl(var(--maritime-primary)/0.35)] hidden md:block" />

            <div className="grid md:grid-cols-3 gap-4 md:gap-8">
              {[
                {
                  n: 1,
                  title: "Save Your Vessel",
                  desc: "Enter GRT, NRT, flag and vessel type once. It stays on file and is ready for every future port call.",
                  icon: Ship,
                  color: "var(--maritime-primary)",
                },
                {
                  n: 2,
                  title: "Pick Port & Cargo",
                  desc: "Select from 804+ Turkish ports and specify cargo type. Live tariff schedules load automatically — no manual lookup.",
                  icon: MapPin,
                  color: "var(--maritime-secondary)",
                },
                {
                  n: 3,
                  title: "Your Proforma is Ready",
                  desc: "22 official line items appear instantly, calculated at current tariff rates. Export as PDF and share with owners in seconds.",
                  icon: FileText,
                  color: "var(--maritime-accent)",
                },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center gap-5" data-testid={`step-${i}`}>
                  {/* Number circle — sits on top of the connector line */}
                  <div
                    className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 bg-background shadow-md border-2"
                    style={{ borderColor: `hsl(${item.color} / 0.45)`, boxShadow: `0 0 0 4px hsl(${item.color} / 0.08), 0 4px 12px hsl(${item.color} / 0.18)` }}
                  >
                    <span className="text-xl font-bold" style={{ color: `hsl(${item.color})` }}>{item.n}</span>
                  </div>

                  {/* Card */}
                  <Card className="w-full p-6 space-y-3 hover:shadow-md transition-shadow duration-200 border-border/60">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto"
                      style={{ background: `hsl(${item.color} / 0.09)` }}
                    >
                      <item.icon className="w-5 h-5" style={{ color: `hsl(${item.color})` }} />
                    </div>
                    <h3 className="font-serif font-bold text-base">{item.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                  </Card>
                </div>
              ))}
            </div>
          </div>

          {/* Outcome / completion moment */}
          <div className="mt-12 flex justify-center">
            <div className="flex flex-col sm:flex-row items-center gap-4 px-6 py-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 max-w-lg w-full">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-center sm:text-left flex-1 min-w-0">
                <p className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm">Your proforma is ready to share</p>
                <p className="text-emerald-700 dark:text-emerald-400 text-xs mt-0.5">22 line items · Official tariff rates · Instant PDF export</p>
              </div>
              <a href="/api/login" className="flex-shrink-0">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5" data-testid="button-hiw-cta">
                  Try It Free <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="py-24 md:py-32 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <Badge variant="outline" className="px-4 py-1.5 text-xs font-semibold border-[hsl(var(--maritime-gold)/0.5)] text-[hsl(var(--maritime-gold))] uppercase tracking-wide" data-testid="badge-pricing">
              <Star className="w-3 h-3 mr-1.5 inline fill-current" />
              Pricing Plans
            </Badge>
            <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">
              Choose Your Plan
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-base md:text-lg">
              Start free and scale as your business grows. All plans include access to 800+ Turkish ports.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Free */}
            <Card className="relative p-0 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200" data-testid="card-plan-free">
              <div className="h-1.5 w-full bg-gradient-to-r from-slate-300 to-slate-400" />
              <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-xl">Free</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Perfect for getting started</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-4xl font-bold">$0</span>
                  <span className="text-muted-foreground text-sm">/forever</span>
                </div>
                <ul className="space-y-2.5">
                  {["1 proforma generation", "1 vessel registration", "All Turkish ports access", "Basic tariff calculations", "PDF export"].map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 text-slate-500" />
                      </div>
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <a href="/api/login" className="block">
                  <Button variant="outline" className="w-full border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40" size="lg" data-testid="button-plan-free">
                    Get Started Free
                  </Button>
                </a>
              </div>
            </Card>

            {/* Standard — Most Popular */}
            <Card className="relative p-0 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-200 shadow-lg shadow-[hsl(var(--maritime-gold)/0.15)] ring-2 ring-[hsl(var(--maritime-gold)/0.4)]" data-testid="card-plan-standard">
              <div className="h-1.5 w-full bg-gradient-to-r from-[hsl(var(--maritime-gold)/0.8)] to-[hsl(var(--maritime-gold))]" />
              <div className="absolute top-5 right-5">
                <Badge className="bg-[hsl(var(--maritime-gold))] text-white text-[10px] font-bold px-2.5 py-0.5 shadow-sm">
                  MOST POPULAR
                </Badge>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-[hsl(var(--maritime-gold)/0.15)] flex items-center justify-center">
                    <Ship className="w-5 h-5 text-[hsl(var(--maritime-gold))]" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-xl">Standard</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">For active ship agents</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-4xl font-bold">$29</span>
                  <span className="text-muted-foreground text-sm">/10 proformas</span>
                </div>
                <ul className="space-y-2.5">
                  {["10 proforma generations", "Unlimited vessel registration", "All Turkish ports access", "Advanced tariff calculations", "PDF export & printing", "Priority support"].map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <div className="w-4 h-4 rounded-full bg-[hsl(var(--maritime-gold)/0.15)] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 text-[hsl(var(--maritime-gold))]" />
                      </div>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a href="/api/login" className="block">
                  <Button className="w-full bg-[hsl(var(--maritime-gold))] hover:bg-[hsl(var(--maritime-gold)/0.9)] text-white shadow-md shadow-[hsl(var(--maritime-gold)/0.3)]" size="lg" data-testid="button-plan-standard">
                    Choose Standard
                  </Button>
                </a>
              </div>
            </Card>

            {/* Unlimited */}
            <Card className="relative p-0 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-gradient-to-b from-[hsl(var(--maritime-primary)/0.04)] to-transparent" data-testid="card-plan-unlimited">
              <div className="h-1.5 w-full bg-gradient-to-r from-[hsl(var(--maritime-primary)/0.8)] to-[hsl(var(--maritime-accent))]" />
              <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center">
                    <Crown className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-xl">Unlimited</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">For large-scale operations</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-4xl font-bold">$79</span>
                  <span className="text-muted-foreground text-sm">/month</span>
                </div>
                <ul className="space-y-2.5">
                  {["Unlimited proforma generations", "Unlimited vessel registration", "All Turkish ports access", "Advanced tariff calculations", "PDF export & printing", "Priority support", "Custom branding", "API access"].map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <div className="w-4 h-4 rounded-full bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 text-[hsl(var(--maritime-primary))]" />
                      </div>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a href="/api/login" className="block">
                  <Button variant="outline" className="w-full border-[hsl(var(--maritime-primary)/0.4)] text-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.05)]" size="lg" data-testid="button-plan-unlimited">
                    Choose Unlimited
                  </Button>
                </a>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-[hsl(var(--maritime-primary))] via-[hsl(var(--maritime-secondary))] to-[hsl(var(--maritime-primary)/0.9)] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="max-w-4xl mx-auto px-6 text-center relative space-y-7">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 text-white text-xs font-semibold uppercase tracking-wider">
            <Anchor className="w-3.5 h-3.5" />
            Start Today
          </div>
          <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
            Ready to Streamline Your<br />Port Operations?
          </h2>
          <p className="text-white/75 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Join maritime professionals who trust VesselPDA for accurate and instant proforma generation. Free to start, no credit card required.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a href="/api/login">
              <Button size="lg" variant="secondary" className="gap-2 bg-white text-[hsl(var(--maritime-primary))] hover:bg-white/90 shadow-lg font-semibold px-8" data-testid="button-cta-bottom">
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
          </div>
          <p className="text-white/50 text-xs pt-1">No credit card required · Free plan available</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t bg-card/50">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-1 space-y-4">
              <div className="flex items-center gap-2.5">
                <img src="/logo-v2.png" alt="VesselPDA" className="w-8 h-8 rounded-md object-contain" />
                <span className="font-serif font-bold text-base tracking-tight">VesselPDA</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Professional maritime platform for ship agents, shipowners, and service providers in Turkey.
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Product</p>
              <ul className="space-y-2">
                {[
                  { href: "/directory", label: "Directory" },
                  { href: "/service-ports", label: "Service Ports" },
                  { href: "/forum", label: "Forum" },
                  { href: "/api/login", label: "Sign Up Free" },
                ].map((l) => (
                  <li key={l.label}><a href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l.label}</a></li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Support</p>
              <ul className="space-y-2">
                {[
                  { href: "mailto:info@vesselpda.com", label: "Contact Us" },
                  { href: "/forum", label: "Community Forum" },
                  { href: "#pricing", label: "Pricing & Plans" },
                ].map((l) => (
                  <li key={l.label}><a href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l.label}</a></li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Coverage</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>804+ Turkish Ports</li>
                <li>22 Tariff Line Items</li>
                <li>USD / EUR / TRY Rates</li>
                <li>Real-time Calculations</li>
              </ul>
            </div>
          </div>
          <Separator />
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6">
            <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} VesselPDA. All rights reserved.</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="w-3 h-3" />
              <span>Secure platform for maritime professionals</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
