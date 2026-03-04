import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ship, FileText, Navigation, ShieldCheck, BarChart3,
  ArrowRight, ChevronRight, X, Check, Anchor, Activity,
  Package, Zap, DollarSign, Clock, Target,
  TrendingDown, TrendingUp, RotateCcw, MessageSquare,
  Bell, Map, Users, Briefcase, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useDemo } from "@/contexts/demo-context";
import { DemoBanner } from "@/components/demo-banner";
import {
  DEMO_VESSELS, DEMO_VOYAGES, DEMO_PROFORMAS, DEMO_TENDERS,
  DEMO_STATS, DEMO_COMPLIANCE, DEMO_BUNKER, DEMO_SOF_EVENTS,
  DEMO_FINAL_DA, DEMO_MESSAGES, DEMO_FIXTURES, DEMO_CARGO_POSITIONS,
  DEMO_VOYAGE_EXPENSES, DEMO_REMINDERS, DEMO_USERS, ROLE_FEATURES, TOUR_STEPS,
  type DemoRole,
} from "@/lib/demo-data";

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-700", sent: "bg-blue-100 text-blue-700",
    draft: "bg-gray-100 text-gray-600", open: "bg-green-100 text-green-700",
    awarded: "bg-purple-100 text-purple-700", closed: "bg-gray-100 text-gray-500",
    in_progress: "bg-blue-100 text-blue-700", planned: "bg-amber-100 text-amber-700",
    completed: "bg-emerald-100 text-emerald-700", in_port: "bg-emerald-100 text-emerald-700",
    at_sea: "bg-blue-100 text-blue-700", at_anchor: "bg-amber-100 text-amber-700",
    approaching: "bg-orange-100 text-orange-700", fixed: "bg-emerald-100 text-emerald-700",
    negotiating: "bg-amber-100 text-amber-700", reconciled: "bg-emerald-100 text-emerald-700",
    berthed: "bg-blue-100 text-blue-700",
  };
  const labels: Record<string, string> = {
    approved: "Approved", sent: "Sent", draft: "Draft", open: "Open", awarded: "Awarded",
    closed: "Closed", in_progress: "In Progress", planned: "Planned", completed: "Completed",
    in_port: "In Port", at_sea: "At Sea", at_anchor: "At Anchor", approaching: "Approaching",
    fixed: "Fixed", negotiating: "Negotiating", reconciled: "Reconciled", berthed: "Berthed",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${cls[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ── Role config ────────────────────────────────────────────────────────────────
const ROLE_ICONS: Record<DemoRole, typeof Anchor> = {
  ship_agent:    FileText,
  shipowner:     Ship,
  ship_broker:   Briefcase,
  ship_provider: Settings,
};

const ROLE_GRADIENT_TW: Record<DemoRole, string> = {
  ship_agent:    "from-blue-600 to-cyan-500",
  shipowner:     "from-green-600 to-emerald-500",
  ship_broker:   "from-orange-500 to-amber-400",
  ship_provider: "from-violet-600 to-purple-500",
};

const ROLE_ACCENT: Record<DemoRole, string> = {
  ship_agent:    "text-blue-600 bg-blue-50",
  shipowner:     "text-green-600 bg-green-50",
  ship_broker:   "text-orange-600 bg-orange-50",
  ship_provider: "text-violet-600 bg-violet-50",
};

// ── Guided Tour ────────────────────────────────────────────────────────────────
function GuidedTour({ role, onClose }: { role: DemoRole; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const steps = TOUR_STEPS[role];
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const accent = ROLE_ACCENT[role];

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="w-full max-w-md bg-background border rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="h-1.5 bg-muted">
          <div
            className={`h-full bg-gradient-to-r ${ROLE_GRADIENT_TW[role]} transition-all duration-500`}
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${accent.split(" ")[1]}`}>
              <Target className={`w-6 h-6 ${accent.split(" ")[0]}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">
                  Adım {step + 1} / {steps.length}
                </span>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="button-tour-close">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h3 className="text-lg font-semibold mt-1">{current.title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{current.desc}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground text-xs">
              Atla
            </Button>
            <div className="flex items-center gap-1.5">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === step ? `bg-gradient-to-r ${ROLE_GRADIENT_TW[role]}` : "bg-muted"}`}
                />
              ))}
            </div>
            <Button
              size="sm"
              className={`gap-1.5 bg-gradient-to-r ${ROLE_GRADIENT_TW[role]} text-white border-0 hover:opacity-90`}
              onClick={() => isLast ? onClose() : setStep(s => s + 1)}
              data-testid="button-tour-next"
            >
              {isLast ? "Bitir" : "Sonraki"}
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Role Selection Screen ──────────────────────────────────────────────────────
function RoleSelectionScreen({ onSelect }: { onSelect: (role: DemoRole) => void }) {
  const [loading, setLoading] = useState<DemoRole | null>(null);

  const handleSelect = async (role: DemoRole) => {
    setLoading(role);
    await onSelect(role);
    setLoading(null);
  };

  const roles: DemoRole[] = ["ship_agent", "shipowner", "ship_broker", "ship_provider"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl text-center mb-10"
      >
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
          <Target className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Demo Mod — Kayıt Gerekmez</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold font-serif mb-4">
          VesselPDA'yı 2 Dakikada Keşfedin
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Rolünüzü seçin ve platformu gerçekçi verilerle deneyin. Hiçbir bilgi girmenize gerek yok.
        </p>
      </motion.div>

      <div className="w-full max-w-4xl grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {roles.map((role, i) => {
          const { title, subtitle, description, features } = ROLE_FEATURES[role];
          const Icon = ROLE_ICONS[role];
          const gradient = ROLE_GRADIENT_TW[role];

          return (
            <motion.div
              key={role}
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.45 }}
            >
              <div
                className="group cursor-pointer border rounded-2xl p-5 bg-card hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg transition-all duration-300 h-full flex flex-col"
                onClick={() => handleSelect(role)}
                data-testid={`card-demo-role-${role}`}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 shadow-md`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-base font-bold mb-0.5">{title}</h3>
                <p className="text-xs font-medium text-muted-foreground mb-3">{subtitle}</p>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed hidden sm:block">{description}</p>

                <ul className="space-y-1.5 flex-1 mb-4">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs">
                      <Check className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full gap-2 bg-gradient-to-r ${gradient} text-white border-0 hover:opacity-90 text-xs h-9`}
                  disabled={loading !== null}
                  data-testid={`button-try-${role}`}
                >
                  {loading === role ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Başlatılıyor...
                    </span>
                  ) : (
                    <>Bu rolü dene <ArrowRight className="w-3 h-3" /></>
                  )}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-8 text-sm text-muted-foreground text-center">
        Her rolü deneyebilirsiniz — demo içinde istediğiniz zaman geçiş yapabilirsiniz.
        {" "}
        <Link href="/login" className="text-blue-600 hover:underline font-medium">Giriş yap</Link>
        {" ya da "}
        <Link href="/register" className="text-blue-600 hover:underline font-medium">kayıt ol</Link>
      </p>
    </div>
  );
}

// ── Demo Dashboard ─────────────────────────────────────────────────────────────
function DemoDashboard({ role }: { role: DemoRole }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showTour, setShowTour] = useState(true);
  const user = DEMO_USERS[role];
  const gradient = ROLE_GRADIENT_TW[role];
  const accent = ROLE_ACCENT[role];

  const TABS: { id: string; label: string; icon: typeof Anchor; roles: DemoRole[] }[] = [
    { id: "dashboard",  label: "Dashboard",  icon: Activity,   roles: ["ship_agent", "shipowner", "ship_broker", "ship_provider"] },
    { id: "voyages",    label: "Voyages",    icon: Navigation,  roles: ["ship_agent", "shipowner"] },
    { id: "proformas",  label: "Proformas",  icon: FileText,    roles: ["ship_agent", "ship_broker"] },
    { id: "tenders",    label: "Tenders",    icon: Zap,         roles: ["ship_agent", "shipowner", "ship_provider"] },
    { id: "vessels",    label: "Fleet",      icon: Ship,        roles: ["ship_agent", "shipowner", "ship_broker"] },
    { id: "fixtures",   label: "Fixtures",   icon: Briefcase,   roles: ["shipowner", "ship_broker"] },
    { id: "sof",        label: "SOF",        icon: Clock,       roles: ["ship_agent"] },
    { id: "finalda",    label: "Final DA",   icon: DollarSign,  roles: ["ship_agent", "shipowner"] },
    { id: "compliance", label: "Compliance", icon: ShieldCheck, roles: ["shipowner"] },
    { id: "bunker",     label: "Bunker",     icon: Package,     roles: ["shipowner", "ship_broker"] },
    { id: "cargo",      label: "Cargo",      icon: BarChart3,   roles: ["ship_broker"] },
  ];

  const visibleTabs = TABS.filter(t => t.roles.includes(role));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 h-[52px] border-b"
        style={{ background: "#0F172A" }}
      >
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
          <Anchor className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-bold text-sm font-serif hidden sm:inline">VesselPDA</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button className="relative p-2 text-slate-400 hover:text-white">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
          </button>
          <button className="relative p-2 text-slate-400 hover:text-white">
            <MessageSquare className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-400 rounded-full" />
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-bold`}>
              {user.name.charAt(0)}
            </div>
            <div className="hidden sm:block">
              <div className="text-white text-xs font-medium leading-tight">{user.name}</div>
              <div className="text-slate-400 text-[10px]">{user.title}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Module tabs */}
      <div
        className="flex-shrink-0 flex items-center px-3 gap-1 h-[40px] border-b overflow-x-auto"
        style={{ background: "#0B1120" }}
      >
        {visibleTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 h-full text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "text-white border-blue-500"
                  : "text-slate-400 border-transparent hover:text-slate-200"
              }`}
              data-testid={`demo-tab-${tab.id}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "dashboard"  && <DashboardTab  role={role} accent={accent} gradient={gradient} />}
            {activeTab === "voyages"    && <VoyagesTab />}
            {activeTab === "proformas"  && <ProformasTab role={role} />}
            {activeTab === "tenders"    && <TendersTab role={role} />}
            {activeTab === "vessels"    && <VesselsTab />}
            {activeTab === "fixtures"   && <FixturesTab />}
            {activeTab === "sof"        && <SofTab />}
            {activeTab === "finalda"    && <FinalDATab />}
            {activeTab === "compliance" && <ComplianceTab />}
            {activeTab === "bunker"     && <BunkerTab />}
            {activeTab === "cargo"      && <CargoTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      {showTour && (
        <GuidedTour role={role} onClose={() => setShowTour(false)} />
      )}
    </div>
  );
}

// ── Tab: Dashboard ─────────────────────────────────────────────────────────────
function DashboardTab({ role, accent, gradient }: { role: DemoRole; accent: string; gradient: string }) {
  const voyage = DEMO_VOYAGES[0];
  const reminder = DEMO_REMINDERS[0];

  const stats = [
    { label: "Fleet Size",     value: DEMO_STATS.totalVessels,   icon: Ship,       color: "text-blue-600",   bg: "bg-blue-50"   },
    { label: "Active Voyages", value: DEMO_STATS.activeVoyages,  icon: Navigation, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Open Tenders",   value: DEMO_STATS.openTenders,    icon: Zap,        color: "text-green-600",  bg: "bg-green-50"  },
    { label: "Proformas",      value: DEMO_STATS.totalProformas, icon: FileText,   color: "text-amber-600",  bg: "bg-amber-50"  },
  ];

  const roleWidgets: Record<DemoRole, { label: string; value: string; icon: typeof Anchor }[]> = {
    ship_agent:    [{ label: "Pending Proformas", value: "2 pending", icon: FileText }, { label: "Open Tenders", value: "2 open", icon: Zap }],
    shipowner:     [{ label: "Fleet DWT", value: `${fmt(DEMO_STATS.fleetDwt)} MT`, icon: Ship }, { label: "Next ETA", value: "6 hours", icon: Clock }],
    ship_broker:   [{ label: "Active Fixtures", value: "2 active", icon: Briefcase }, { label: "Cargo Positions", value: "2 open", icon: Package }],
    ship_provider: [{ label: "Pending Tenders", value: "2 awaiting bids", icon: Zap }, { label: "Won This Month", value: "1 awarded", icon: Check }],
  };

  return (
    <div className="space-y-5" data-testid="stats-cards">
      {/* Reminder banner */}
      <div className="flex items-center gap-3 p-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-800">
        <Bell className="w-4 h-4 text-orange-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-orange-800 dark:text-orange-300">{reminder.title}</span>
        </div>
        <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px]">Urgent</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Role-specific widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {roleWidgets[role].map(w => {
          const Icon = w.icon;
          return (
            <Card key={w.label} className="border">
              <CardContent className="py-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{w.label}</div>
                  <div className="font-semibold text-sm">{w.value}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Active Voyage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Navigation className="w-4 h-4 text-blue-600" />
            Active Voyage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold text-sm">{voyage.voyageNumber} — {voyage.vesselName}</div>
              <div className="text-xs text-muted-foreground">{voyage.cargoType} · {fmt(voyage.cargoQuantity)} {voyage.cargoUnit} · {voyage.charterer}</div>
            </div>
            <StatusBadge status={voyage.status} />
          </div>
          <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
            {voyage.portCalls.map((pc, i) => (
              <div key={pc.id} className="flex items-center gap-2 flex-shrink-0">
                <div className="text-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-1 ${
                    pc.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                    pc.status === "berthed" || pc.status === "approaching" ? "bg-blue-100 text-blue-700" :
                    "bg-muted text-muted-foreground"
                  }`}>{i + 1}</div>
                  <div className="text-[10px] text-muted-foreground max-w-[60px] truncate">{pc.portName.split(" ")[0]}</div>
                  <StatusBadge status={pc.status} />
                </div>
                {i < voyage.portCalls.length - 1 && <div className="w-8 h-px bg-border flex-shrink-0" />}
              </div>
            ))}
          </div>

          {/* Expense bar */}
          <div className="mt-4 pt-3 border-t">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Voyage Expenses</span>
              <span className="font-medium">${fmt(voyage.expenses.actual)} / ${fmt(voyage.expenses.budget)}</span>
            </div>
            <Progress value={(voyage.expenses.actual / voyage.expenses.budget) * 100} className="h-1.5" />
            <div className="flex justify-between text-[10px] mt-1">
              <span className="text-emerald-600">Under budget by ${fmt(voyage.expenses.budget - voyage.expenses.actual)}</span>
              <span className="text-muted-foreground">{Math.round((voyage.expenses.actual / voyage.expenses.budget) * 100)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Messages preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            Recent Messages
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {DEMO_MESSAGES.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold bg-gradient-to-br ${ROLE_GRADIENT_TW.ship_agent} text-white`}>
                  {m.subject.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{m.subject}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{m.lastMessage}</div>
                </div>
                <div className="text-[10px] text-muted-foreground flex-shrink-0">{m.time}</div>
                {m.unread > 0 && (
                  <span className="w-4 h-4 bg-blue-600 rounded-full text-white text-[9px] flex items-center justify-center flex-shrink-0">{m.unread}</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab: Voyages ───────────────────────────────────────────────────────────────
function VoyagesTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold font-serif">Voyages</h2>
      {DEMO_VOYAGES.map(v => (
        <Card key={v.id}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold">{v.voyageNumber} — {v.vesselName}</div>
                <div className="text-sm text-muted-foreground">{v.cargoType} · {fmt(v.cargoQuantity)} {v.cargoUnit}</div>
                <div className="text-xs text-muted-foreground">Charterer: {v.charterer}</div>
              </div>
              <StatusBadge status={v.status} />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {v.portCalls.map((pc, i) => (
                <div key={pc.id} className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold mx-auto mb-1 ${
                      pc.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                      pc.status === "berthed" ? "bg-blue-100 text-blue-700" :
                      pc.status === "approaching" ? "bg-orange-100 text-orange-700" :
                      "bg-muted text-muted-foreground"
                    }`}>{i + 1}</div>
                    <div className="text-[10px] text-muted-foreground max-w-[55px] truncate">{pc.portName.split("(")[0].trim()}</div>
                    <div className="text-[9px] text-muted-foreground">{pc.purpose}</div>
                    <StatusBadge status={pc.status} />
                  </div>
                  {i < v.portCalls.length - 1 && <div className="w-6 h-px bg-border" />}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs mt-3 pt-3 border-t">
              <span className="text-muted-foreground">Budget: ${fmt(v.expenses.budget)}</span>
              <span className="font-medium">{v.expenses.actual > 0 ? `Actual: $${fmt(v.expenses.actual)}` : "No actuals yet"}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Tab: Proformas ────────────────────────────────────────────────────────────
function ProformasTab({ role }: { role: DemoRole }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-serif">Proforma DAs</h2>
        <Button size="sm" className="gap-1.5 text-xs" data-testid="button-new-proforma">
          <Zap className="w-3 h-3" /> Quick Estimate
        </Button>
      </div>
      <div className="space-y-2">
        {DEMO_PROFORMAS.map(p => (
          <Card key={p.id}>
            <CardContent className="py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{p.referenceNumber}</div>
                <div className="text-xs text-muted-foreground">{p.vesselName} · {p.portName} · {p.days} days · {p.purpose}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-semibold text-sm">${fmt(p.totalAmount)}</div>
                <StatusBadge status={p.status} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Tenders ──────────────────────────────────────────────────────────────
function TendersTab({ role }: { role: DemoRole }) {
  const labels: Record<DemoRole, string> = {
    ship_agent: "Submit Bid", shipowner: "View Bids",
    ship_broker: "View Bids", ship_provider: "Submit Bid",
  };
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold font-serif">Port Call Tenders</h2>
      {DEMO_TENDERS.map(t => (
        <Card key={t.id}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-semibold text-sm">{t.title}</div>
                <div className="text-xs text-muted-foreground">{t.vesselName} · {t.portName} · ETA: {t.eta}</div>
              </div>
              <StatusBadge status={t.status} />
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-muted-foreground">
                Budget: ${fmt(t.budget)} · {t.bidsCount} {t.bidsCount === 1 ? "bid" : "bids"} received
              </div>
              {t.status === "open" && (
                <Button size="sm" className="text-xs h-7 gap-1" data-testid={`button-tender-action-${t.id}`}>
                  {labels[role]} <ArrowRight className="w-3 h-3" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Tab: Fleet (Vessels) ──────────────────────────────────────────────────────
function VesselsTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold font-serif">Fleet — {DEMO_VESSELS.length} Vessels</h2>
      <div className="space-y-2">
        {DEMO_VESSELS.map(v => (
          <Card key={v.id}>
            <CardContent className="py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Ship className="w-4 h-4 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{v.name}</div>
                <div className="text-xs text-muted-foreground">{v.type} · {v.flag} · IMO {v.imoNumber}</div>
                <div className="text-xs text-muted-foreground">DWT: {fmt(v.dwt)} MT · GRT: {fmt(v.grt)}</div>
              </div>
              <StatusBadge status={v.status} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Fixtures ─────────────────────────────────────────────────────────────
function FixturesTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold font-serif">Fixtures</h2>
      {DEMO_FIXTURES.map(f => (
        <Card key={f.id}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-sm">{f.referenceNumber}</div>
                <div className="text-xs text-muted-foreground">{f.vesselName} · {f.charterType}</div>
                <div className="text-xs text-muted-foreground">Route: {f.route}</div>
                <div className="text-xs text-muted-foreground">Cargo: {f.cargo} · {f.freightRate}</div>
                <div className="text-xs text-muted-foreground">Charterer: {f.charterer}</div>
              </div>
              <StatusBadge status={f.status} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Tab: SOF ──────────────────────────────────────────────────────────────────
function SofTab() {
  const voyage = DEMO_VOYAGES[0];
  const portCall = voyage.portCalls[0];
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold font-serif">Statement of Facts</h2>
        <p className="text-sm text-muted-foreground">
          {voyage.voyageNumber} — {portCall.portName} (Port Call 1, {portCall.purpose})
        </p>
      </div>
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-2">
            {DEMO_SOF_EVENTS.map((e, i) => (
              <div key={e.id} className={`flex items-start gap-3 py-2 ${i < DEMO_SOF_EVENTS.length - 1 ? "border-b" : ""}`}>
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${e.isKeyEvent ? "bg-blue-500" : "bg-muted-foreground/40"}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium ${e.isKeyEvent ? "text-foreground" : "text-muted-foreground"}`}>
                    {e.eventType.replace(/_/g, " ")}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{e.description}</div>
                </div>
                <div className="text-[10px] text-muted-foreground flex-shrink-0">
                  {new Date(e.eventTime).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab: Final DA ─────────────────────────────────────────────────────────────
function FinalDATab() {
  const fda = DEMO_FINAL_DA;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold font-serif">Final Disbursement Account</h2>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{fda.referenceNumber}</CardTitle>
              <p className="text-sm text-muted-foreground">{fda.vesselName} · {fda.portName}</p>
            </div>
            <StatusBadge status={fda.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-1">Proforma</div>
              <div className="font-bold">${fmt(fda.proformaAmount)}</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-1">Actual</div>
              <div className="font-bold">${fmt(fda.actualAmount)}</div>
            </div>
            <div className={`text-center p-3 rounded-lg ${fda.variance < 0 ? "bg-emerald-50" : "bg-red-50"}`}>
              <div className="text-xs text-muted-foreground mb-1">Variance</div>
              <div className={`font-bold flex items-center justify-center gap-1 ${fda.variance < 0 ? "text-emerald-600" : "text-red-600"}`}>
                {fda.variance < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                {fda.variancePct}%
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-3 text-[10px] font-semibold text-muted-foreground uppercase pb-1 border-b">
              <span>Item</span><span className="text-right">Proforma</span><span className="text-right">Actual</span>
            </div>
            {fda.items.map(item => (
              <div key={item.description} className="grid grid-cols-3 text-xs py-1.5 border-b last:border-0">
                <span>{item.description}</span>
                <span className="text-right">${fmt(item.proforma)}</span>
                <span className={`text-right font-medium ${item.variance < 0 ? "text-emerald-600" : item.variance > 0 ? "text-red-600" : ""}`}>
                  ${fmt(item.actual)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab: Compliance ───────────────────────────────────────────────────────────
function ComplianceTab() {
  const c = DEMO_COMPLIANCE;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold font-serif">Compliance</h2>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-semibold">{c.vesselName} — {c.standardCode}</div>
              <div className="text-xs text-muted-foreground">Auditor: {c.auditorName}</div>
            </div>
            <StatusBadge status={c.status} />
          </div>
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Overall Completion</span>
              <span className="font-semibold">{c.compliancePct}%</span>
            </div>
            <Progress value={c.compliancePct} className="h-2" />
            <div className="text-xs text-muted-foreground mt-1">{c.completedItems} of {c.totalItems} items complete</div>
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Open Findings</div>
            {c.openFindings.map(f => (
              <div key={f.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium">{f.finding}</div>
                  <div className="text-[10px] text-muted-foreground">{f.section} · Due: {f.dueDate}</div>
                </div>
                <Badge className="bg-amber-100 text-amber-700 border-0 text-[9px]">{f.type.replace("_", " ")}</Badge>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>Last audit: {c.lastAuditDate}</span>
            <span>Next audit: {c.nextAuditDate}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab: Bunker ───────────────────────────────────────────────────────────────
function BunkerTab() {
  const { rob, lastBunkering, consumption, records } = DEMO_BUNKER;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold font-serif">Bunker Management</h2>
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(rob).map(([fuel, qty]) => (
          <Card key={fuel}>
            <CardContent className="pt-3 pb-3 text-center">
              <div className="text-[10px] text-muted-foreground uppercase">{fuel}</div>
              <div className="text-xl font-bold">{fmt(qty)}</div>
              <div className="text-[10px] text-muted-foreground">MT ROB</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Last Bunkering</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Port: </span>{lastBunkering.port}</div>
            <div><span className="text-muted-foreground">Date: </span>{lastBunkering.date}</div>
            <div><span className="text-muted-foreground">Fuel: </span>{lastBunkering.fuelType}</div>
            <div><span className="text-muted-foreground">Qty: </span>{lastBunkering.quantity} MT</div>
            <div><span className="text-muted-foreground">Price: </span>${lastBunkering.pricePerMt}/MT</div>
            <div><span className="text-muted-foreground">Cost: </span>${fmt(lastBunkering.totalCost)}</div>
          </div>
          <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Sea consumption: </span>{consumption.seagoing} MT/day</div>
            <div><span className="text-muted-foreground">Port consumption: </span>{consumption.inPort} MT/day</div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {records.map(r => (
          <Card key={r.id}>
            <CardContent className="py-2.5 flex items-center gap-3">
              <Package className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{r.vesselName} · {r.port}</div>
                <div className="text-[10px] text-muted-foreground">{r.fuelType} · {r.quantity} MT · ${r.pricePerMt}/MT</div>
              </div>
              <div className="text-xs font-semibold">${fmt(r.totalCost)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Cargo Positions ──────────────────────────────────────────────────────
function CargoTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold font-serif">Cargo Positions</h2>
      {DEMO_CARGO_POSITIONS.map(c => (
        <Card key={c.id}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-sm">{c.cargoType}</div>
                <div className="text-xs text-muted-foreground">Quantity: {c.quantity}</div>
                <div className="text-xs text-muted-foreground">Route: {c.route}</div>
                <div className="text-xs text-muted-foreground">Laycan: {c.laycan}</div>
                <div className="text-xs text-muted-foreground">Contact: {c.contact}</div>
              </div>
              <StatusBadge status={c.status} />
            </div>
            <Button size="sm" className="mt-3 text-xs h-7 gap-1" data-testid={`button-cargo-offer-${c.id}`}>
              Make Offer <ArrowRight className="w-3 h-3" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main Demo Page ─────────────────────────────────────────────────────────────
export default function DemoPage() {
  const { isDemoMode, demoRole, startDemo } = useDemo();
  const [, navigate] = useLocation();

  const handleRoleSelect = async (role: DemoRole) => {
    await startDemo(role);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <DemoBanner />

      {!isDemoMode ? (
        <div className="flex-1 overflow-y-auto">
          <RoleSelectionScreen onSelect={handleRoleSelect} />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <DemoDashboard role={demoRole} />
        </div>
      )}
    </div>
  );
}
