import {
  Ship,
  FileText,
  BarChart3,
  Shield,
  Globe,
  ArrowRight,
  Anchor,
  Check,
  Star,
  Building2,
  User,
  Activity,
  Users,
  MessageSquare,
  MapPin,
  Menu,
  X,
  Download,
  Navigation,
  Zap,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { PageMeta } from "@/components/page-meta";
import { useQuery } from "@tanstack/react-query";

interface ActivityItem {
  type: string;
  message: string;
  timestamp: string;
  icon: string;
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
    <section className="py-16 relative overflow-hidden bg-slate-900/30">
      <div className="max-w-7xl mx-auto px-6 relative mb-8 text-center space-y-2">
        <div className="flex items-center justify-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold text-white uppercase tracking-widest">Live Platform Activity</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">LIVE</span>
        </div>
        <p className="text-xs text-slate-400">{activities.length} recent actions from VesselPDA users · refreshes every 30 seconds</p>
      </div>

      <div
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="absolute left-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-r from-[#0B1120] to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-l from-[#0B1120] to-transparent pointer-events-none" />

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
              className="flex-shrink-0 w-[300px]"
              data-testid={`activity-card-${i}`}
            >
              <div className={`relative rounded-xl border backdrop-blur-sm bg-gradient-to-br ${getActivityColor(item.type)} p-4 h-full shadow-md`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getActivityColor(item.type)} flex items-center justify-center flex-shrink-0`}>
                    {getActivityIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium text-white leading-snug line-clamp-2">{item.message}</p>
                    <p className="text-[11px] text-slate-400">{timeAgo(item.timestamp)}</p>
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

const FEATURES = [
  {
    icon: <FileText className="w-6 h-6" />,
    emoji: "📋",
    title: "Proforma Calculator",
    description: "Calculate accurate port disbursements using real tariff databases. Support for all major Turkish ports.",
    color: "from-sky-500/10 to-blue-500/10 border-sky-500/20 text-sky-400",
  },
  {
    icon: <Users className="w-6 h-6" />,
    emoji: "📢",
    title: "Port Call Tenders",
    description: "Create tenders for port calls. Receive bids from verified agents. Select the best offer.",
    color: "from-violet-500/10 to-purple-500/10 border-violet-500/20 text-violet-400",
  },
  {
    icon: <Navigation className="w-6 h-6" />,
    emoji: "🗺️",
    title: "Voyage Management",
    description: "Track voyages end-to-end. Checklists, documents, chat — all parties on the same page.",
    color: "from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-400",
  },
  {
    icon: <MapPin className="w-6 h-6" />,
    emoji: "📡",
    title: "Vessel Tracking",
    description: "Real-time AIS vessel tracking. Monitor your fleet positions on an interactive map.",
    color: "from-amber-500/10 to-orange-500/10 border-amber-500/20 text-amber-400",
  },
  {
    icon: <BookOpen className="w-6 h-6" />,
    emoji: "📝",
    title: "SOF & FDA",
    description: "Digital Statement of Facts and Final Disbursement Accounts. Export professional PDFs.",
    color: "from-rose-500/10 to-pink-500/10 border-rose-500/20 text-rose-400",
  },
  {
    icon: <Building2 className="w-6 h-6" />,
    emoji: "🏢",
    title: "Agent Directory",
    description: "Find verified ship agents by port. Read reviews, check trust scores, nominate directly.",
    color: "from-cyan-500/10 to-sky-500/10 border-cyan-500/20 text-cyan-400",
  },
];

const STEPS = [
  {
    num: 1,
    icon: <MapPin className="w-5 h-5" />,
    title: "Select Port",
    description: "Choose your destination port from our comprehensive Turkish ports database.",
  },
  {
    num: 2,
    icon: <Ship className="w-5 h-5" />,
    title: "Enter Vessel",
    description: "Add vessel details or search by IMO number to auto-fill specifications.",
  },
  {
    num: 3,
    icon: <Zap className="w-5 h-5" />,
    title: "Calculate",
    description: "Get instant tariff calculation with live exchange rates applied automatically.",
  },
  {
    num: 4,
    icon: <Download className="w-5 h-5" />,
    title: "Download PDF",
    description: "Save, send or share your professional proforma disbursement account.",
  },
];

const TESTIMONIALS = [
  {
    quote: "VesselPDA has streamlined our PDA process. What used to take hours now takes minutes. The Turkish port tariff data is spot-on.",
    author: "M. Yılmaz",
    role: "Ship Agent",
    port: "Iskenderun",
  },
  {
    quote: "The tender system helped us find reliable agents for our fleet. We received 4 competitive bids within hours of posting.",
    author: "K. Demir",
    role: "Shipowner",
    port: "Istanbul",
  },
  {
    quote: "The SOF and FDA features are exactly what we needed. PDF export saves us hours of manual formatting every month.",
    author: "A. Çelik",
    role: "Ship Agent",
    port: "Mersin",
  },
];

const PLAN_FREE_FEATURES = [
  "1 Proforma / month",
  "Vessel tracking (demo)",
  "Forum access",
  "Port directory",
  "Company profile",
];

const PLAN_STANDARD_FEATURES = [
  "10 Proformas / month",
  "Full vessel tracking",
  "Tender participation",
  "Voyage management",
  "PDF export",
  "Priority listing in directory",
];

const PLAN_UNLIMITED_FEATURES = [
  "Unlimited proformas",
  "Priority support",
  "API access (coming soon)",
  "Custom tariff tables",
  "Team management (coming soon)",
  "Dedicated account manager",
];

function PlanFeature({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <li className={`flex items-start gap-3 text-sm ${muted ? "text-slate-500" : "text-slate-300"}`}>
      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${muted ? "text-slate-600" : "text-sky-400"}`} />
      {text}
    </li>
  );
}

function useScrollY() {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return scrollY;
}

function useAnimateOnScroll() {
  useEffect(() => {
    const elements = document.querySelectorAll("[data-animate]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function smoothScrollTo(href: string) {
  if (href.startsWith("#")) {
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      return true;
    }
  }
  return false;
}

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const scrollY = useScrollY();
  useAnimateOnScroll();

  const { data: platformStats } = useQuery<{
    userCount: number;
    proformaCount: number;
    companyCount: number;
  }>({
    queryKey: ["/api/stats"],
    staleTime: 5 * 60 * 1000,
  });

  const userCount = platformStats?.userCount ?? 26;
  const proformaCount = platformStats?.proformaCount ?? 50;

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "#how-it-works", label: "How It Works" },
    { href: "#pricing", label: "Pricing" },
    { href: "/directory", label: "Directory" },
    { href: "/forum", label: "Forum" },
    { href: "/contact", label: "Contact" },
  ];

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (href.startsWith("#")) {
      e.preventDefault();
      smoothScrollTo(href);
      setMobileMenuOpen(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1120]" style={{ scrollBehavior: "smooth" }}>
      <PageMeta
        title="VesselPDA — Proforma Disbursement Account Software for Ship Agents"
        description="Calculate port disbursements instantly. Manage vessel operations, tenders, voyages and port call costs. The #1 PDA software for Turkish ports."
      />

      <style>{`
        [data-animate] {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        [data-animate].animate-in {
          opacity: 1;
          transform: translateY(0);
        }
        [data-animate-delay="1"] { transition-delay: 0.1s; }
        [data-animate-delay="2"] { transition-delay: 0.2s; }
        [data-animate-delay="3"] { transition-delay: 0.3s; }
        [data-animate-delay="4"] { transition-delay: 0.4s; }
        [data-animate-delay="5"] { transition-delay: 0.5s; }
        [data-animate-delay="6"] { transition-delay: 0.6s; }
      `}</style>

      {/* ─── NAV ─── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrollY > 20
            ? "bg-[#080c18]/95 backdrop-blur-md shadow-lg shadow-black/20 border-b border-slate-700/50"
            : "bg-[#080c18]/80 backdrop-blur-sm border-b border-slate-700/20"
        }`}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2.5 flex-shrink-0" data-testid="nav-logo">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <Anchor className="w-4 h-4 text-sky-400" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">VesselPDA</span>
          </a>

          <div className="hidden md:flex items-center gap-0.5">
            {navLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="px-3.5 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all duration-150"
                data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
              <a href="/login">
                <button
                  className="px-4 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all duration-150"
                  data-testid="button-login"
                >
                  Log in
                </button>
              </a>
              <a href="/register">
                <button
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-white transition-all duration-150 shadow-sm shadow-sky-500/20"
                  data-testid="button-signup"
                >
                  Get Started
                </button>
              </a>
            </div>

            <a href="/login" className="md:hidden">
              <button className="px-3 py-1.5 rounded-lg text-sm text-slate-300 border border-slate-700/50 hover:border-slate-600" data-testid="button-login-mobile">
                Log in
              </button>
            </a>
            <a href="/register" className="md:hidden">
              <button className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-sky-500 text-white" data-testid="button-signup-mobile">
                Sign up
              </button>
            </a>
            <button
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle menu"
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-700/30 bg-[#080c18]/98 backdrop-blur-md" data-testid="mobile-menu">
            <div className="max-w-7xl mx-auto px-4 py-3 space-y-0.5">
              {navLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => { handleNavClick(e, item.href); setMobileMenuOpen(false); }}
                  className="flex items-center px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all"
                  data-testid={`mobile-link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ─── HERO ─── */}
        <section
          id="hero"
          className="relative min-h-screen flex items-center pt-16 overflow-hidden"
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56,189,248,0.12), transparent), radial-gradient(ellipse 40% 40% at 80% 60%, rgba(99,102,241,0.06), transparent)",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(148,163,184,0.5) 60px, rgba(148,163,184,0.5) 61px), repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(148,163,184,0.5) 60px, rgba(148,163,184,0.5) 61px)",
            }}
          />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-0 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center min-h-[calc(100vh-4rem)]">

              {/* Left column */}
              <div className="space-y-8 lg:py-20">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium">
                  <span>🚀</span>
                  <span>Trusted by {userCount}+ maritime professionals</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
                  Calculate Port{" "}
                  <br className="hidden sm:block" />
                  Disbursements{" "}
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-cyan-400">
                    in Seconds
                  </span>
                </h1>

                <p className="text-lg text-slate-400 leading-relaxed max-w-xl">
                  The all-in-one platform for ship agents, shipowners and brokers.
                  Manage proformas, tenders, voyages and port operations — all in one place.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <a href="/register">
                    <button
                      className="w-full sm:w-auto h-12 px-8 rounded-xl text-base font-bold bg-sky-500 hover:bg-sky-400 text-white transition-all duration-200 shadow-lg shadow-sky-500/25 hover:shadow-sky-400/30 hover:-translate-y-0.5"
                      data-testid="button-hero-register"
                    >
                      Get Started Free
                    </button>
                  </a>
                  <a href="/demo">
                    <button
                      className="w-full sm:w-auto h-12 px-8 rounded-xl text-base font-semibold border border-sky-500/40 text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/60 transition-all duration-200"
                      data-testid="button-hero-demo"
                    >
                      Try Demo
                    </button>
                  </a>
                </div>

                <p className="text-xs text-slate-500">
                  No credit card required · Free plan includes 1 PDA
                </p>
              </div>

              {/* Right column — floating stat cards */}
              <div className="hidden lg:flex items-center justify-center relative h-[480px]">
                <div className="relative w-full max-w-md">
                  {/* Card 1 — top left */}
                  <div
                    className="absolute top-0 left-0 bg-slate-800/80 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm shadow-xl w-52"
                    style={{ transform: "rotate(-2deg)" }}
                  >
                    <p className="text-3xl font-bold text-white">2,500+</p>
                    <p className="text-sm text-slate-400 mt-1">Port Tariff Entries</p>
                    <div className="mt-3 h-1.5 w-full rounded-full bg-slate-700/50">
                      <div className="h-1.5 w-4/5 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500" />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">Turkish ports covered</p>
                  </div>

                  {/* Card 2 — center (larger) */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-800/90 border border-sky-500/20 rounded-2xl p-6 backdrop-blur-sm shadow-2xl shadow-sky-500/10 w-60 z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                        <BarChart3 className="w-4 h-4 text-sky-400" />
                      </div>
                      <span className="text-xs text-slate-400 font-medium">Live Calculation</span>
                    </div>
                    <p className="text-4xl font-bold text-white">18+</p>
                    <p className="text-sm text-slate-400 mt-1">Tariff Categories</p>
                    <div className="mt-4 space-y-1.5">
                      {["Port dues", "Pilotage", "Towage", "Agency fees"].map((t) => (
                        <div key={t} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                          <span className="text-xs text-slate-400">{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card 3 — bottom right */}
                  <div
                    className="absolute bottom-0 right-0 bg-slate-800/80 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm shadow-xl w-52"
                    style={{ transform: "rotate(2deg)" }}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs text-emerald-400 font-medium">Live</span>
                    </div>
                    <p className="text-xl font-bold text-white">Real-time</p>
                    <p className="text-sm text-slate-400 mt-0.5">Exchange Rates</p>
                    <p className="text-xs text-slate-500 mt-3">TCMB · Updated daily</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SOCIAL PROOF ─── */}
        <section id="social-proof" className="bg-slate-800/20 border-y border-slate-700/20 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-400 font-medium">Serving professionals across Turkish ports</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {["Mersin", "Istanbul", "Izmir", "Aliağa", "Gemlik", "Iskenderun"].map((port) => (
                  <span
                    key={port}
                    className="px-3 py-1 rounded-full text-xs text-slate-300 bg-slate-700/40 border border-slate-600/30"
                  >
                    {port}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  <strong className="text-white">{userCount}</strong> users
                </span>
                <span className="w-px h-4 bg-slate-700" />
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                  <strong className="text-white">{proformaCount}+</strong> proformas
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FEATURES ─── */}
        <section id="features" className="py-24 bg-[#0B1120]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16 space-y-4" data-animate>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">
                Everything You Need for Port Operations
              </h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                From proforma calculation to voyage management
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-6 hover:bg-slate-800/70 hover:border-slate-600/60 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group"
                  data-animate
                  data-animate-delay={String(i + 1)}
                  data-testid={`card-feature-${i}`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} border flex items-center justify-center mb-4`}>
                    <span className={f.color.split(" ").pop()}>{f.icon}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{f.emoji} {f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section id="how-it-works" className="py-24 bg-slate-900/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16 space-y-4" data-animate>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">
                Get Your Proforma in 4 Simple Steps
              </h2>
              <p className="text-lg text-slate-400">Calculate and send a professional PDA in under 2 minutes</p>
            </div>

            <div className="relative">
              <div className="hidden md:block absolute top-6 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />

              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {STEPS.map((step, i) => (
                  <div
                    key={step.num}
                    className="flex flex-col items-center text-center space-y-4"
                    data-animate
                    data-animate-delay={String(i + 1)}
                    data-testid={`step-${step.num}`}
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-sky-500 text-white font-bold text-xl flex items-center justify-center shadow-lg shadow-sky-500/30">
                        {step.num}
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/40 flex items-center justify-center text-sky-400">
                      {step.icon}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white mb-2">{step.title}</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── PRICING ─── */}
        <section id="pricing" className="py-24 bg-[#0B1120]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16 space-y-4" data-animate>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">
                Simple, Transparent Pricing
              </h2>
              <p className="text-lg text-slate-400">Start free, upgrade when you need more</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* FREE */}
              <div
                className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-8 flex flex-col"
                data-animate
                data-animate-delay="1"
                data-testid="card-plan-free"
              >
                <div className="mb-6">
                  <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">Free</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold text-white">$0</span>
                    <span className="text-slate-400 mb-1">/month</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">Perfect to get started</p>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {PLAN_FREE_FEATURES.map((f) => <PlanFeature key={f} text={f} />)}
                </ul>
                <a href="/register">
                  <button
                    className="w-full h-11 rounded-xl text-sm font-semibold border border-slate-600/50 text-slate-300 hover:border-slate-500 hover:text-white hover:bg-slate-700/30 transition-all duration-200"
                    data-testid="button-plan-free"
                  >
                    Get Started
                  </button>
                </a>
              </div>

              {/* STANDARD */}
              <div
                className="relative bg-sky-950/40 border-2 border-sky-500 rounded-2xl p-8 flex flex-col shadow-xl shadow-sky-500/10"
                data-animate
                data-animate-delay="2"
                data-testid="card-plan-standard"
              >
                <div className="absolute -top-3.5 right-6">
                  <span className="bg-sky-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow-lg">
                    Most Popular
                  </span>
                </div>
                <div className="mb-6">
                  <p className="text-sm font-semibold text-sky-400 uppercase tracking-widest mb-3">Standard</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold text-sky-400">₺49.90</span>
                    <span className="text-slate-400 mb-1">/month</span>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">For active ship agents</p>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {PLAN_STANDARD_FEATURES.map((f) => <PlanFeature key={f} text={f} />)}
                </ul>
                <a href="/register">
                  <button
                    className="w-full h-11 rounded-xl text-sm font-bold bg-sky-500 hover:bg-sky-400 text-white transition-all duration-200 shadow-md shadow-sky-500/20"
                    data-testid="button-plan-standard"
                  >
                    Start Free Trial
                  </button>
                </a>
              </div>

              {/* UNLIMITED */}
              <div
                className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-8 flex flex-col"
                data-animate
                data-animate-delay="3"
                data-testid="card-plan-unlimited"
              >
                <div className="mb-6">
                  <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">Unlimited</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold text-white">₺199.90</span>
                    <span className="text-slate-400 mb-1">/month</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">For agencies & fleets</p>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {PLAN_UNLIMITED_FEATURES.map((f) => (
                    <PlanFeature
                      key={f}
                      text={f}
                      muted={f.includes("coming soon")}
                    />
                  ))}
                </ul>
                <a href="/contact">
                  <button
                    className="w-full h-11 rounded-xl text-sm font-semibold border border-slate-600/50 text-slate-300 hover:border-slate-500 hover:text-white hover:bg-slate-700/30 transition-all duration-200"
                    data-testid="button-plan-unlimited"
                  >
                    Contact Sales
                  </button>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ─── TESTIMONIALS ─── */}
        <section className="py-20 bg-slate-900/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14 space-y-3" data-animate>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">
                Trusted by Maritime Professionals
              </h2>
              <p className="text-slate-400">What our users say about VesselPDA</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {TESTIMONIALS.map((t, i) => (
                <div
                  key={i}
                  className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-6 flex flex-col gap-4"
                  data-animate
                  data-animate-delay={String(i + 1)}
                  data-testid={`card-testimonial-${i}`}
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed flex-1">"{t.quote}"</p>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.author}</p>
                    <p className="text-xs text-slate-400">{t.role} · {t.port}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── LIVE ACTIVITY ─── */}
        <LiveActivityTicker />

        {/* ─── CTA ─── */}
        <section className="py-24 relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(37,99,235,0.05) 50%, rgba(6,182,212,0.04) 100%)",
            }}
          />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-500/20 to-transparent" />

          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-8" data-animate>
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
                Ready to Modernize Your{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-cyan-400">
                  Maritime Operations?
                </span>
              </h2>
              <p className="text-lg text-slate-400">
                Join {userCount}+ professionals already using VesselPDA
              </p>
            </div>

            <a href="/register">
              <button
                className="h-14 px-12 rounded-xl text-lg font-bold bg-sky-500 hover:bg-sky-400 text-white transition-all duration-200 shadow-xl shadow-sky-500/25 hover:shadow-sky-400/30 hover:-translate-y-0.5 inline-flex items-center gap-2"
                data-testid="button-cta-register"
              >
                Create Free Account
                <ArrowRight className="w-5 h-5" />
              </button>
            </a>

            <p className="text-sm text-slate-500">Free forever · No credit card needed</p>
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer className="bg-[#080c18] border-t border-slate-700/30 pt-14 pb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
              {/* Col 1 */}
              <div className="space-y-4">
                <a href="/" className="flex items-center gap-2" data-testid="footer-logo">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                    <Anchor className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <span className="font-bold text-white">VesselPDA</span>
                </a>
                <p className="text-sm text-slate-400 leading-relaxed">Maritime operations, simplified.</p>
                <p className="text-xs text-slate-500">© 2026 Barbaros Shipping</p>
              </div>

              {/* Col 2 — Product */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Product</p>
                <ul className="space-y-2.5">
                  {[
                    { label: "Features", href: "#features" },
                    { label: "Pricing", href: "#pricing", testid: "footer-link-pricing" },
                    { label: "Directory", href: "/directory", testid: "footer-link-directory" },
                    { label: "Forum", href: "/forum", testid: "footer-link-forum" },
                  ].map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        onClick={(e) => handleNavClick(e, l.href)}
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                        data-testid={(l as any).testid}
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Col 3 — Company */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Company</p>
                <ul className="space-y-2.5">
                  {[
                    { label: "About Us", href: "#" },
                    { label: "Contact", href: "/contact" },
                    { label: "Blog", href: "#", disabled: true },
                    { label: "Careers", href: "#", disabled: true },
                  ].map((l) => (
                    <li key={l.label}>
                      {l.disabled ? (
                        <span className="text-sm text-slate-600 cursor-default flex items-center gap-1.5">
                          {l.label}
                          <span className="text-[10px] bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-slate-500">Soon</span>
                        </span>
                      ) : (
                        <a href={l.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                          {l.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Col 4 — Legal */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Legal</p>
                <ul className="space-y-2.5">
                  {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((l) => (
                    <li key={l}>
                      <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-t border-slate-700/30 pt-6 flex items-center justify-center">
              <p className="text-sm text-slate-500">Made with ⚓ in Izmir, Turkey</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
