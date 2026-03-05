import {
  Ship,
  FileText,
  BarChart3,
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
  ChevronDown,
  Briefcase,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
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
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">LIVE</span>
        </div>
        <p className="text-xs text-slate-400">{activities.length} recent actions · refreshes every 30 seconds</p>
      </div>
      <div className="relative" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
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
            <div key={i} className="flex-shrink-0 w-[300px]" data-testid={`activity-card-${i}`}>
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
  { num: 1, icon: <MapPin className="w-5 h-5" />, title: "Select Port", description: "Choose your destination port from our comprehensive Turkish ports database." },
  { num: 2, icon: <Ship className="w-5 h-5" />, title: "Enter Vessel", description: "Add vessel details or search by IMO number to auto-fill specifications." },
  { num: 3, icon: <Zap className="w-5 h-5" />, title: "Calculate", description: "Get instant tariff calculation with live TCMB exchange rates applied automatically." },
  { num: 4, icon: <Download className="w-5 h-5" />, title: "Download PDF", description: "Save, send or share your professional proforma disbursement account." },
];

const TESTIMONIALS = [
  { quote: "VesselPDA has streamlined our PDA process. What used to take hours now takes minutes. The Turkish port tariff data is spot-on.", author: "M. Yılmaz", role: "Ship Agent", port: "Iskenderun" },
  { quote: "The tender system helped us find reliable agents for our fleet. We received 4 competitive bids within hours of posting.", author: "K. Demir", role: "Shipowner", port: "Istanbul" },
  { quote: "The SOF and FDA features are exactly what we needed. PDF export saves us hours of manual formatting every month.", author: "A. Çelik", role: "Ship Agent", port: "Mersin" },
];

const PLAN_FREE = ["1 Proforma / month", "Vessel tracking (demo)", "Forum access", "Port directory", "Company profile"];
const PLAN_STANDARD = ["10 Proformas / month", "Full vessel tracking", "Tender participation", "Voyage management", "PDF export", "Priority listing in directory"];
const PLAN_UNLIMITED = ["Unlimited proformas", "Priority support", "API access (coming soon)", "Custom tariff tables", "Team management (coming soon)", "Dedicated account manager"];

const COMPARISON_ROWS = [
  { label: "Calculation time", manual: "2–4 hours", vessel: "Under 2 minutes" },
  { label: "Port tariff data", manual: "Manual lookup / outdated", vessel: "Live database, auto-updated" },
  { label: "Exchange rates", manual: "Manual lookup daily", vessel: "TCMB live rates applied" },
  { label: "PDF output", manual: "Manual formatting in Word", vessel: "One-click professional PDF" },
  { label: "Tender management", manual: "Email back-and-forth", vessel: "Built-in bid system" },
  { label: "Voyage tracking", manual: "Spreadsheet / phone calls", vessel: "Real-time dashboard" },
  { label: "SOF & FDA", manual: "Manual Word documents", vessel: "Digital, auto-calculated" },
  { label: "Cost", manual: "Your time (expensive)", vessel: "Free to start" },
];

const FAQ_ITEMS = [
  {
    q: "Which Turkish ports are covered?",
    a: "VesselPDA covers all major Turkish commercial ports including Mersin, Iskenderun, Izmir, Istanbul (Haydarpaşa, Ambarlı, Zeytinburnu), Aliağa, Gemlik, Derince, Bandırma, Samsun and more. Tariff data is updated regularly from official port authority sources.",
  },
  {
    q: "How accurate is the tariff data?",
    a: "Our tariff database is sourced from official Turkish port authority tariff books and is updated whenever ports announce changes. Exchange rates are fetched live from TCMB (Turkish Central Bank) daily. All calculations include the standard 18+ tariff categories used in Turkish port operations.",
  },
  {
    q: "Can I export the proforma to PDF?",
    a: "Yes. Every proforma disbursement account can be exported to a professional PDF with one click. The PDF includes your company letterhead (if configured), vessel details, port, all line items, and totals in both TRY and USD.",
  },
  {
    q: "Is the free plan really free? What are the limits?",
    a: "The free plan is permanently free and includes 1 proforma calculation per month, access to the forum, the agent directory, and a demo vessel tracking view. No credit card is required to sign up.",
  },
  {
    q: "How does the Port Call Tender system work?",
    a: "Shipowners post a port call tender with vessel details and port requirements. Verified ship agents receive the tender and submit competitive bids with their PDA estimate. The shipowner reviews bids, selects the best agent, and initiates the voyage — all within the platform.",
  },
  {
    q: "Can I manage multiple vessels?",
    a: "Yes. Shipowners can add unlimited vessels to their fleet and manage separate voyages, proformas, and documents for each vessel. The Standard and Unlimited plans support full voyage management.",
  },
  {
    q: "What is a Statement of Facts (SOF)?",
    a: "A Statement of Facts documents the chronology of port events (arrival, berthing, cargo operations, departure). VesselPDA auto-generates 13 standard SOF events when you create one, lets you add custom events with timestamps, and exports a professional PDF. You can also create a Final Disbursement Account (FDA) from any proforma.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. VesselPDA uses industry-standard encryption, secure session management, and regular backups. We never share your proforma data, vessel information, or client details with third parties.",
  },
  {
    q: "Can I use VesselPDA in Turkish?",
    a: "VesselPDA has a Turkish/English language toggle. You can switch between languages at any time from the top bar.",
  },
  {
    q: "How do I get started?",
    a: "Click 'Get Started Free' to create your account in under 2 minutes. No credit card required. Once registered, select your role (ship agent, shipowner, or broker) and you'll be taken to your role-specific dashboard where you can immediately start calculating your first proforma.",
  },
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
      { threshold: 0.08 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function smoothScrollTo(href: string) {
  if (href.startsWith("#")) {
    const el = document.querySelector(href);
    if (el) { el.scrollIntoView({ behavior: "smooth" }); return true; }
  }
  return false;
}

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(() => {
    try { return sessionStorage.getItem("vpda_banner_dismissed") !== "1"; } catch { return true; }
  });
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const scrollY = useScrollY();
  useAnimateOnScroll();

  const { data: platformStats } = useQuery<{ userCount: number; proformaCount: number; companyCount: number }>({
    queryKey: ["/api/stats"],
    staleTime: 5 * 60 * 1000,
  });

  const userCount = platformStats?.userCount ?? 26;
  const proformaCount = platformStats?.proformaCount ?? 50;

  function dismissBanner() {
    try { sessionStorage.setItem("vpda_banner_dismissed", "1"); } catch {}
    setBannerVisible(false);
  }

  const BANNER_H = bannerVisible ? 36 : 0;

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "#how-it-works", label: "How It Works" },
    { href: "#pricing", label: "Pricing" },
    { href: "/directory", label: "Directory" },
    { href: "/forum", label: "Forum" },
    { href: "/contact", label: "Contact" },
  ];

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (href.startsWith("#")) { e.preventDefault(); smoothScrollTo(href); setMobileMenuOpen(false); }
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
        [data-animate].animate-in { opacity: 1; transform: translateY(0); }
        [data-animate-delay="1"] { transition-delay: 0.1s; }
        [data-animate-delay="2"] { transition-delay: 0.2s; }
        [data-animate-delay="3"] { transition-delay: 0.3s; }
        [data-animate-delay="4"] { transition-delay: 0.4s; }
        [data-animate-delay="5"] { transition-delay: 0.5s; }
        [data-animate-delay="6"] { transition-delay: 0.6s; }
        @keyframes scroll-ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .faq-answer {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 0.3s ease;
        }
        .faq-answer.open {
          grid-template-rows: 1fr;
        }
        .faq-answer > div { overflow: hidden; }
      `}</style>

      {/* ─── ANNOUNCEMENT BANNER ─── */}
      {bannerVisible && (
        <div
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-3 px-4 h-9 text-xs font-medium text-white"
          style={{ background: "linear-gradient(90deg, #0284c7 0%, #1d4ed8 50%, #0284c7 100%)" }}
          data-testid="announcement-banner"
        >
          <span className="flex items-center gap-1.5">
            <span>⚡</span>
            <span className="hidden sm:inline">New: SOF & FDA modules are now live — manage your Statement of Facts digitally · </span>
            <span className="sm:hidden">New: SOF & FDA modules live · </span>
            <a href="/login" className="underline underline-offset-2 hover:text-sky-200 transition-colors font-semibold">
              Learn more →
            </a>
          </span>
          <button
            onClick={dismissBanner}
            className="absolute right-3 p-1 rounded hover:bg-white/20 transition-colors"
            aria-label="Dismiss banner"
            data-testid="button-dismiss-banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── NAV ─── */}
      <header
        className={`fixed left-0 right-0 z-50 transition-all duration-300 ${
          scrollY > 20
            ? "bg-[#080c18]/95 backdrop-blur-md shadow-lg shadow-black/20 border-b border-slate-700/50"
            : "bg-[#080c18]/80 backdrop-blur-sm border-b border-slate-700/20"
        }`}
        style={{ top: `${BANNER_H}px` }}
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
                <button className="px-4 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all" data-testid="button-login">
                  Log in
                </button>
              </a>
              <a href="/register">
                <button className="px-4 py-2 rounded-lg text-sm font-semibold bg-sky-500 hover:bg-sky-400 text-white transition-all shadow-sm shadow-sky-500/20" data-testid="button-signup">
                  Get Started
                </button>
              </a>
            </div>
            <a href="/login" className="md:hidden">
              <button className="px-3 py-1.5 rounded-lg text-sm text-slate-300 border border-slate-700/50" data-testid="button-login-mobile">Log in</button>
            </a>
            <a href="/register" className="md:hidden">
              <button className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-sky-500 text-white" data-testid="button-signup-mobile">Sign up</button>
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

      <main style={{ paddingTop: `${BANNER_H + 64}px` }}>

        {/* ─── HERO ─── */}
        <section id="hero" className="relative min-h-[calc(100vh-100px)] flex items-center overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56,189,248,0.12), transparent), radial-gradient(ellipse 40% 40% at 80% 60%, rgba(99,102,241,0.06), transparent)",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(148,163,184,0.5) 60px, rgba(148,163,184,0.5) 61px), repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(148,163,184,0.5) 60px, rgba(148,163,184,0.5) 61px)",
            }}
          />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

              {/* Left */}
              <div className="space-y-8">
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
                    <button className="w-full sm:w-auto h-12 px-8 rounded-xl text-base font-bold bg-sky-500 hover:bg-sky-400 text-white transition-all duration-200 shadow-lg shadow-sky-500/25 hover:-translate-y-0.5" data-testid="button-hero-register">
                      Get Started Free
                    </button>
                  </a>
                  <div className="flex flex-col items-center gap-1.5">
                    <a href="/register?demo=true">
                      <button className="w-full sm:w-auto h-12 px-8 rounded-xl text-base font-semibold border border-sky-500/40 text-sky-400 hover:bg-sky-500/10 hover:border-sky-500/60 transition-all duration-200" data-testid="button-hero-demo">
                        Try Demo — Free Account
                      </button>
                    </a>
                    <p className="text-xs text-sky-400/70">Create a free account · Sample data included</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">No credit card required · Free plan includes 1 PDA</p>
              </div>

              {/* Right — PDA Document Mockup */}
              <div className="hidden lg:flex items-center justify-center">
                <div className="relative">
                  {/* PDF Ready badge */}
                  <div className="absolute -top-3 -right-3 z-20 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg shadow-emerald-500/30 flex items-center gap-1">
                    <span>✓</span> PDF Ready
                  </div>

                  {/* PDA card */}
                  <div
                    className="bg-slate-800/90 border border-slate-700/40 rounded-2xl shadow-2xl shadow-sky-500/10 overflow-hidden w-[340px]"
                    style={{ transform: "rotate(-2deg)" }}
                    data-testid="hero-pda-mockup"
                  >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-sky-600 to-blue-700 px-5 py-3">
                      <p className="text-[10px] font-bold text-white uppercase tracking-widest">Proforma Disbursement Account</p>
                      <p className="text-[10px] text-white/70 mt-0.5">VesselPDA · Generated in 2 seconds</p>
                    </div>

                    {/* Vessel info */}
                    <div className="px-5 py-3 bg-slate-900/40 border-b border-slate-700/30">
                      <div className="grid grid-cols-2 gap-y-1">
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wide">Vessel</p>
                          <p className="text-xs font-semibold text-white">MV NORTH STAR</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wide">IMO</p>
                          <p className="text-xs text-slate-300 font-mono">9812345</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wide">Port</p>
                          <p className="text-xs font-semibold text-white">Mersin</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wide">GRT</p>
                          <p className="text-xs text-slate-300 font-mono">8,500</p>
                        </div>
                      </div>
                    </div>

                    {/* Line items */}
                    <div className="px-5 py-3 space-y-1.5">
                      {[
                        { label: "Port Dues", amount: "$3,825" },
                        { label: "Pilotage", amount: "$980" },
                        { label: "Towage", amount: "$2,100" },
                        { label: "Mooring", amount: "$450" },
                        { label: "Agency Fee", amount: "$1,800" },
                        { label: "Miscellaneous", amount: "$620" },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">{row.label}</span>
                          <span className="text-[11px] text-slate-300 font-mono">{row.amount}</span>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="mx-5 mb-3 rounded-xl bg-sky-500/10 border border-sky-500/20 px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-white">TOTAL USD</span>
                      <span className="text-base font-bold text-sky-400 font-mono">$9,775</span>
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-2.5 bg-slate-900/50 flex items-center justify-between border-t border-slate-700/20">
                      <span className="text-[10px] text-slate-400">1 USD = 32.45 ₺</span>
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        TCMB Live Rate
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SOCIAL PROOF STRIP ─── */}
        <section id="social-proof" className="bg-slate-800/20 border-y border-slate-700/20 py-7">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-400 font-medium whitespace-nowrap">Serving professionals across Turkish ports</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {["Mersin", "Istanbul", "Izmir", "Aliağa", "Gemlik", "Iskenderun"].map((port) => (
                  <span key={port} className="px-3 py-1 rounded-full text-xs text-slate-300 bg-slate-700/40 border border-slate-600/30">
                    {port}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-400 whitespace-nowrap">
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

        {/* ─── WHO IS IT FOR ─── */}
        <section id="for-whom" className="py-20 bg-[#0B1120]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14 space-y-3" data-animate>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">Built for Every Maritime Professional</h2>
              <p className="text-lg text-slate-400">One platform — three distinct workflows</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* Ship Agent */}
              <div
                className="bg-slate-800/40 border border-sky-500/20 hover:border-sky-500/50 rounded-2xl p-7 flex flex-col gap-4 hover:-translate-y-1 transition-all duration-300"
                data-animate data-animate-delay="1"
                data-testid="card-persona-agent"
              >
                <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Ship Agent</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">Stop calculating port costs manually. Generate a professional PDA in 2 minutes instead of 2 hours.</p>
                </div>
                <ul className="space-y-2 flex-1">
                  {["Instant tariff calculation", "Client-ready PDF export", "Port call tender management"].map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-sky-400 flex-shrink-0" />{b}
                    </li>
                  ))}
                </ul>
                <a href="/register" className="text-sm font-semibold text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1">
                  Start as Agent <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              {/* Shipowner */}
              <div
                className="bg-slate-800/40 border border-violet-500/20 hover:border-violet-500/50 rounded-2xl p-7 flex flex-col gap-4 hover:-translate-y-1 transition-all duration-300 relative"
                data-animate data-animate-delay="2"
                data-testid="card-persona-shipowner"
              >
                <div className="absolute -top-3 right-5">
                  <span className="bg-violet-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">Most Common</span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <Ship className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Shipowner</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">Find the right agent for every port. Compare bids, track voyages, and control costs across your fleet.</p>
                </div>
                <ul className="space-y-2 flex-1">
                  {["Multi-vessel fleet management", "Agent nomination & tender system", "Real-time AIS vessel tracking"].map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />{b}
                    </li>
                  ))}
                </ul>
                <a href="/register" className="text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1">
                  Start as Shipowner <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              {/* Broker */}
              <div
                className="bg-slate-800/40 border border-amber-500/20 hover:border-amber-500/50 rounded-2xl p-7 flex flex-col gap-4 hover:-translate-y-1 transition-all duration-300"
                data-animate data-animate-delay="3"
                data-testid="card-persona-broker"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Broker / Trader</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">Stay on top of cargo positions, freight rates, and market data. Connect cargo to ships in one platform.</p>
                </div>
                <ul className="space-y-2 flex-1">
                  {["Cargo & position board", "Fixture & laytime calculator", "Market indices (BDI, BCI)"].map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />{b}
                    </li>
                  ))}
                </ul>
                <a href="/register" className="text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1">
                  Start as Broker <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FEATURES ─── */}
        <section id="features" className="py-24 bg-slate-900/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16 space-y-4" data-animate>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">Everything You Need for Port Operations</h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">From proforma calculation to voyage management</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-6 hover:bg-slate-800/70 hover:border-slate-600/60 hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                  data-animate data-animate-delay={String(i + 1)}
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

        {/* ─── COMPARISON TABLE ─── */}
        <section id="comparison" className="py-20 bg-[#0B1120]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14 space-y-3" data-animate>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">Why VesselPDA vs. Manual Process?</h2>
              <p className="text-lg text-slate-400">Ship agents who switch report saving 3–4 hours per port call</p>
            </div>

            <div className="rounded-2xl overflow-hidden border border-slate-700/40" data-testid="table-comparison" data-animate>
              {/* Table header */}
              <div className="grid grid-cols-3 bg-slate-800/60">
                <div className="px-5 py-4 text-xs font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-700/40" />
                <div className="px-5 py-4 border-b border-l border-slate-700/40 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-red-400">Manual / Excel</span>
                </div>
                <div className="px-5 py-4 border-b border-l border-slate-700/40 bg-sky-500/5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-sky-400">VesselPDA</span>
                </div>
              </div>

              {/* Rows */}
              {COMPARISON_ROWS.map((row, i) => (
                <div
                  key={row.label}
                  className={`grid grid-cols-3 border-b border-slate-700/20 last:border-b-0 ${i % 2 === 0 ? "bg-slate-800/20" : ""}`}
                >
                  <div className="px-5 py-3.5 text-sm text-slate-300 font-medium flex items-center">{row.label}</div>
                  <div className="px-5 py-3.5 border-l border-slate-700/20 flex items-center">
                    <span className="text-sm text-red-400/80">{row.manual}</span>
                  </div>
                  <div className="px-5 py-3.5 border-l border-slate-700/20 bg-sky-500/3 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-emerald-400 font-medium">{row.vessel}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-10" data-animate>
              <p className="text-slate-400 mb-4">Ready to switch?</p>
              <a href="/register">
                <button className="h-11 px-8 rounded-xl text-sm font-bold bg-sky-500 hover:bg-sky-400 text-white transition-all duration-200 shadow-lg shadow-sky-500/20 hover:-translate-y-0.5 inline-flex items-center gap-2">
                  Get Started Free <ArrowRight className="w-4 h-4" />
                </button>
              </a>
            </div>
          </div>
        </section>

        {/* ─── HOW IT WORKS ─── */}
        <section id="how-it-works" className="py-24 bg-slate-900/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16 space-y-4" data-animate>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">Get Your Proforma in 4 Simple Steps</h2>
              <p className="text-lg text-slate-400">Calculate and send a professional PDA in under 2 minutes</p>
            </div>
            <div className="relative">
              <div className="hidden md:block absolute top-6 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {STEPS.map((step, i) => (
                  <div key={step.num} className="flex flex-col items-center text-center space-y-4" data-animate data-animate-delay={String(i + 1)} data-testid={`step-${step.num}`}>
                    <div className="w-12 h-12 rounded-full bg-sky-500 text-white font-bold text-xl flex items-center justify-center shadow-lg shadow-sky-500/30">
                      {step.num}
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
              <h2 className="text-3xl sm:text-4xl font-bold text-white">Simple, Transparent Pricing</h2>
              <p className="text-lg text-slate-400">Start free, upgrade when you need more</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* FREE */}
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-8 flex flex-col" data-animate data-animate-delay="1" data-testid="card-plan-free">
                <div className="mb-6">
                  <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">Free</p>
                  <div className="flex items-end gap-1"><span className="text-4xl font-bold text-white">$0</span><span className="text-slate-400 mb-1">/month</span></div>
                  <p className="text-sm text-slate-500 mt-2">Perfect to get started</p>
                </div>
                <ul className="space-y-3 flex-1 mb-8">{PLAN_FREE.map((f) => <PlanFeature key={f} text={f} />)}</ul>
                <a href="/register"><button className="w-full h-11 rounded-xl text-sm font-semibold border border-slate-600/50 text-slate-300 hover:border-slate-500 hover:text-white hover:bg-slate-700/30 transition-all" data-testid="button-plan-free">Get Started</button></a>
              </div>

              {/* STANDARD */}
              <div className="relative bg-sky-950/40 border-2 border-sky-500 rounded-2xl p-8 flex flex-col shadow-xl shadow-sky-500/10" data-animate data-animate-delay="2" data-testid="card-plan-standard">
                <div className="absolute -top-3.5 right-6">
                  <span className="bg-sky-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow-lg">Most Popular</span>
                </div>
                <div className="mb-6">
                  <p className="text-sm font-semibold text-sky-400 uppercase tracking-widest mb-3">Standard</p>
                  <div className="flex items-end gap-1"><span className="text-4xl font-bold text-sky-400">₺49.90</span><span className="text-slate-400 mb-1">/month</span></div>
                  <p className="text-sm text-slate-400 mt-2">For active ship agents</p>
                </div>
                <ul className="space-y-3 flex-1 mb-8">{PLAN_STANDARD.map((f) => <PlanFeature key={f} text={f} />)}</ul>
                <a href="/register"><button className="w-full h-11 rounded-xl text-sm font-bold bg-sky-500 hover:bg-sky-400 text-white transition-all shadow-md shadow-sky-500/20" data-testid="button-plan-standard">Start Free Trial</button></a>
              </div>

              {/* UNLIMITED */}
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-8 flex flex-col" data-animate data-animate-delay="3" data-testid="card-plan-unlimited">
                <div className="mb-6">
                  <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">Unlimited</p>
                  <div className="flex items-end gap-1"><span className="text-4xl font-bold text-white">₺199.90</span><span className="text-slate-400 mb-1">/month</span></div>
                  <p className="text-sm text-slate-500 mt-2">For agencies & fleets</p>
                </div>
                <ul className="space-y-3 flex-1 mb-8">{PLAN_UNLIMITED.map((f) => <PlanFeature key={f} text={f} muted={f.includes("coming soon")} />)}</ul>
                <a href="/contact"><button className="w-full h-11 rounded-xl text-sm font-semibold border border-slate-600/50 text-slate-300 hover:border-slate-500 hover:text-white hover:bg-slate-700/30 transition-all" data-testid="button-plan-unlimited">Contact Sales</button></a>
              </div>
            </div>
          </div>
        </section>

        {/* ─── TESTIMONIALS ─── */}
        <section className="py-20 bg-slate-900/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14 space-y-3" data-animate>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">Trusted by Maritime Professionals</h2>
              <p className="text-slate-400">What our users say about VesselPDA</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {TESTIMONIALS.map((t, i) => (
                <div key={i} className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-6 flex flex-col gap-4" data-animate data-animate-delay={String(i + 1)} data-testid={`card-testimonial-${i}`}>
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

        {/* ─── FAQ ─── */}
        <section id="faq" className="py-20 bg-[#0B1120]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14 space-y-3" data-animate>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">Frequently Asked Questions</h2>
              <p className="text-slate-400">Everything ship agents and shipowners ask before joining</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12" data-animate>
              {[FAQ_ITEMS.slice(0, 5), FAQ_ITEMS.slice(5)].map((col, ci) => (
                <div key={ci} className="divide-y divide-slate-700/40">
                  {col.map((item, i) => {
                    const idx = ci * 5 + i;
                    const isOpen = openFaq === idx;
                    return (
                      <div key={idx} data-testid={`faq-item-${idx}`}>
                        <button
                          className="w-full flex items-center justify-between gap-4 py-4 text-left group"
                          onClick={() => setOpenFaq(isOpen ? null : idx)}
                          data-testid={`faq-question-${idx}`}
                        >
                          <span className={`text-sm font-medium transition-colors ${isOpen ? "text-white" : "text-slate-300 group-hover:text-white"}`}>
                            {item.q}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180 text-sky-400" : ""}`} />
                        </button>
                        <div className={`faq-answer ${isOpen ? "open" : ""}`}>
                          <div>
                            {isOpen && (
                              <p className="text-sm text-slate-400 leading-relaxed pb-4" data-testid={`faq-answer-${idx}`}>
                                {item.a}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── LIVE ACTIVITY ─── */}
        <LiveActivityTicker />

        {/* ─── CTA ─── */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(37,99,235,0.05) 50%, rgba(6,182,212,0.04) 100%)" }} />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-500/20 to-transparent" />
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-8" data-animate>
            <div className="space-y-4">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
                Ready to Modernize Your{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-cyan-400">Maritime Operations?</span>
              </h2>
              <p className="text-lg text-slate-400">Join {userCount}+ professionals already using VesselPDA</p>
            </div>
            <a href="/register">
              <button className="h-14 px-12 rounded-xl text-lg font-bold bg-sky-500 hover:bg-sky-400 text-white transition-all duration-200 shadow-xl shadow-sky-500/25 hover:-translate-y-0.5 inline-flex items-center gap-2" data-testid="button-cta-register">
                Create Free Account <ArrowRight className="w-5 h-5" />
              </button>
            </a>
            <p className="text-sm text-slate-500">Free forever · No credit card needed</p>
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer className="bg-[#080c18] border-t border-slate-700/30 pt-14 pb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
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
                      <a href={l.href} onClick={(e) => handleNavClick(e, l.href)} className="text-sm text-slate-400 hover:text-white transition-colors" data-testid={(l as any).testid}>
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

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
                        <a href={l.href} className="text-sm text-slate-400 hover:text-white transition-colors">{l.label}</a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Legal</p>
                <ul className="space-y-2.5">
                  {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((l) => (
                    <li key={l}><a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">{l}</a></li>
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
