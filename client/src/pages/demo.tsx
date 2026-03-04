import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ship, FileText, Navigation, Users, ShieldCheck, BarChart3,
  ArrowRight, Play, ChevronRight, X, Check, Anchor, Activity,
  MapPin, Package, Zap, Crown, DollarSign, Calendar, AlertTriangle,
  TrendingDown, TrendingUp, Clock, Globe, Star, Eye, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useDemo } from "@/contexts/demo-context";
import {
  DEMO_VESSELS, DEMO_VOYAGES, DEMO_PROFORMAS, DEMO_TENDERS,
  DEMO_STATS, DEMO_COMPLIANCE, DEMO_BUNKER_RECORDS, DEMO_SOF_EVENTS,
  DEMO_FINAL_DA, DEMO_MESSAGES, DEMO_ORG, ROLE_FEATURES,
  type DemoRole,
} from "@/lib/demo-data";

const ROLE_ICONS: Record<DemoRole, typeof Anchor> = {
  agent: FileText,
  shipowner: Ship,
  admin: Crown,
};

const ROLE_COLORS: Record<DemoRole, string> = {
  agent: "from-blue-600 to-cyan-500",
  shipowner: "from-indigo-600 to-violet-500",
  admin: "from-amber-500 to-orange-500",
};

const TOUR_STEPS = [
  {
    title: "Dashboard",
    desc: "Filonuzu, aktif seferlerinizi ve açık ihale tekliflerinizi tek yerden takip edin.",
    icon: Activity,
    highlight: "stats",
  },
  {
    title: "Filonuzu Yönetin",
    desc: "Gemilerinizi, sertifika durumlarını ve bunkerleme geçmişini kolayca görüntüleyin.",
    icon: Ship,
    highlight: "vessels",
  },
  {
    title: "Proforma DA Oluşturun",
    desc: "2026 resmi Türk liman tarifeleri ile anında proforma DA hesaplayın ve gönderin.",
    icon: FileText,
    highlight: "proformas",
  },
  {
    title: "Seferler & Ekip",
    desc: "Çok limanlı seferleri planlayın, ekibinizle paylaşın ve masrafları takip edin.",
    icon: Navigation,
    highlight: "voyages",
  },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    open: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    awarded: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    planned: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    in_port: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    at_sea: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    at_anchor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  };
  const label: Record<string, string> = {
    approved: "Approved", sent: "Sent", draft: "Draft",
    open: "Open", awarded: "Awarded", closed: "Closed",
    in_progress: "In Progress", planned: "Planned", completed: "Completed",
    in_port: "In Port", at_sea: "At Sea", at_anchor: "At Anchor",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${map[status] || "bg-gray-100 text-gray-600"}`}>
      {label[status] || status}
    </span>
  );
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── Guided Tour Overlay ───────────────────────────────────────────────────────
function GuidedTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = TOUR_STEPS[step];
  const Icon = current.icon;
  const isLast = step === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="w-full max-w-md bg-background border rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">
                  Adım {step + 1} / {TOUR_STEPS.length}
                </span>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h3 className="text-lg font-semibold mt-1">{current.title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5">{current.desc}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
              Atla
            </Button>
            <div className="flex items-center gap-2">
              {TOUR_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === step ? "bg-blue-500" : "bg-muted"}`}
                />
              ))}
            </div>
            <Button size="sm" onClick={() => isLast ? onClose() : setStep(s => s + 1)} className="gap-1.5">
              {isLast ? "Bitir" : "Sonraki"}
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Role Selection Screen ─────────────────────────────────────────────────────
function RoleSelectionScreen({ onSelect }: { onSelect: (role: DemoRole) => void }) {
  const [loading, setLoading] = useState<DemoRole | null>(null);

  const handleSelect = async (role: DemoRole) => {
    setLoading(role);
    await onSelect(role);
    setLoading(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-3xl text-center mb-12"
      >
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
          <Target className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Demo Mod — Kayıt Gerekmez</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold font-serif mb-4">
          VesselPDA'yı 2 Dakikada Keşfedin
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Rolünüzü seçin ve platformu gerçekçi verilerle deneyin.
          Hiçbir bilgi girmenize gerek yok.
        </p>
      </motion.div>

      <div className="w-full max-w-3xl grid sm:grid-cols-3 gap-5">
        {(["agent", "shipowner", "admin"] as DemoRole[]).map((role, i) => {
          const { title, description, features } = ROLE_FEATURES[role];
          const Icon = ROLE_ICONS[role];
          const gradient = ROLE_COLORS[role];

          return (
            <motion.div
              key={role}
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.5 }}
            >
              <div
                className="group cursor-pointer border rounded-2xl p-6 bg-card hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg transition-all duration-300 h-full flex flex-col"
                onClick={() => handleSelect(role)}
                data-testid={`card-demo-role-${role}`}
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-5 shadow-lg`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>

                <h3 className="text-lg font-bold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{description}</p>

                <ul className="space-y-2 flex-1 mb-5">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full gap-2 bg-gradient-to-r ${gradient} text-white border-0 hover:opacity-90`}
                  disabled={loading !== null}
                  data-testid={`button-try-${role}`}
                >
                  {loading === role ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Başlatılıyor...
                    </span>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      {title} olarak dene
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-8 text-sm text-muted-foreground text-center">
        Zaten hesabınız var mı?{" "}
        <Link href="/login" className="text-blue-600 hover:underline font-medium">Giriş yapın</Link>
        {" — "}
        <Link href="/register" className="text-blue-600 hover:underline font-medium">Kayıt olun</Link>
      </p>
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab({ role }: { role: DemoRole }) {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" data-testid="stats-cards">
        {[
          { label: "Fleet Size", value: DEMO_STATS.totalVessels, icon: Ship, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "Active Voyages", value: DEMO_STATS.activeVoyages, icon: Navigation, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/20" },
          { label: "Open Tenders", value: DEMO_STATS.openTenders, icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
          { label: "Proformas", value: DEMO_STATS.totalProformas, icon: FileText, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
        ].map(s => (
          <Card key={s.label} className="border">
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

      {/* Active Voyage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Navigation className="w-4 h-4 text-blue-600" />
            Active Voyage
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const v = DEMO_VOYAGES[0];
            return (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-semibold">{v.voyageNumber} — {v.vesselName}</div>
                    <div className="text-sm text-muted-foreground">{v.cargoType} · {fmt(v.cargoQuantity)} {v.cargoUnit} · {v.charterer}</div>
                  </div>
                  <StatusBadge status={v.status} />
                </div>
                <div className="flex gap-2 mt-4">
                  {v.portCalls.map((pc, i) => (
                    <div key={pc.id} className="flex items-center gap-2">
                      <div className="text-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-1 ${
                          pc.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                          pc.status === "berthed" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"
                        }`}>
                          {i + 1}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{pc.portName.split(" ")[0]}</div>
                        <StatusBadge status={pc.status} />
                      </div>
                      {i < v.portCalls.length - 1 && (
                        <div className="flex-1 h-px bg-border mb-5 w-6" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Recent Proformas + Tenders */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Recent Proformas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {DEMO_PROFORMAS.slice(0, 3).map(p => (
                <div key={p.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div>
                    <div className="text-sm font-medium">{p.referenceNumber}</div>
                    <div className="text-xs text-muted-foreground">{p.portName} · {p.days}d</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">${fmt(p.totalAmount)}</div>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              Open Tenders
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {DEMO_TENDERS.map(t => (
                <div key={t.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.vesselName}</div>
                    <div className="text-xs text-muted-foreground">{t.portName} · {t.bidsCount} bids</div>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Vessels Tab ───────────────────────────────────────────────────────────────
function VesselsTab() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Ship className="w-4 h-4 text-blue-600" />
          Fleet ({DEMO_VESSELS.length} vessels)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vessel</TableHead>
                <TableHead>IMO</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Flag</TableHead>
                <TableHead className="text-right">DWT</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DEMO_VESSELS.map(v => (
                <TableRow key={v.id} data-testid={`row-vessel-${v.id}`}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell className="text-muted-foreground">{v.imoNumber}</TableCell>
                  <TableCell className="capitalize">{v.type.replace("_", " ")}</TableCell>
                  <TableCell>{v.flag}</TableCell>
                  <TableCell className="text-right">{fmt(v.dwt)}</TableCell>
                  <TableCell><StatusBadge status={v.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Proformas Tab ─────────────────────────────────────────────────────────────
function ProformasTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Proforma DAs
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DEMO_PROFORMAS.map(p => (
                  <TableRow key={p.id} data-testid={`row-proforma-${p.id}`}>
                    <TableCell className="font-medium font-mono text-xs">{p.referenceNumber}</TableCell>
                    <TableCell>{p.vesselName}</TableCell>
                    <TableCell>{p.portName}</TableCell>
                    <TableCell>{p.purpose}</TableCell>
                    <TableCell className="text-right font-semibold">${fmt(p.totalAmount)}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Final DA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            Final DA — {DEMO_FINAL_DA.vesselName} @ {DEMO_FINAL_DA.portName}
            <StatusBadge status={DEMO_FINAL_DA.status} />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-4 mb-4">
            {[
              { label: "Proforma", value: DEMO_FINAL_DA.proformaAmount, color: "text-foreground" },
              { label: "Actual", value: DEMO_FINAL_DA.actualAmount, color: "text-foreground" },
              { label: "Variance", value: DEMO_FINAL_DA.variance, color: "text-emerald-600" },
            ].map(item => (
              <div key={item.label} className="flex-1 p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                <div className={`text-lg font-bold ${item.color}`}>
                  {item.value < 0 ? "-" : ""}${fmt(Math.abs(item.value))}
                </div>
              </div>
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Proforma</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DEMO_FINAL_DA.items.map(item => (
                <TableRow key={item.description}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">${fmt(item.proforma)}</TableCell>
                  <TableCell className="text-right">${fmt(item.actual)}</TableCell>
                  <TableCell className={`text-right font-medium ${item.variance < 0 ? "text-emerald-600" : item.variance > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                    {item.variance === 0 ? "—" : `${item.variance < 0 ? "-" : "+"}$${fmt(Math.abs(item.variance))}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Voyages Tab ───────────────────────────────────────────────────────────────
function VoyagesTab() {
  return (
    <div className="space-y-4">
      {DEMO_VOYAGES.map(v => (
        <Card key={v.id} data-testid={`card-voyage-${v.id}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">{v.voyageNumber} — {v.vesselName}</CardTitle>
              <StatusBadge status={v.status} />
            </div>
            <div className="text-xs text-muted-foreground">{v.cargoType} · {fmt(v.cargoQuantity)} {v.cargoUnit} · {v.charterer}</div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1 mb-4">
              {v.portCalls.map(pc => (
                <div key={pc.id} className="flex items-center gap-3 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium w-32">{pc.portName}</span>
                  <span className="text-muted-foreground text-xs">{pc.purpose}</span>
                  <span className="text-muted-foreground text-xs ml-auto">{pc.eta}</span>
                  <StatusBadge status={pc.status} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Expenses vs Budget</span>
                  <span>${fmt(v.totalExpenses)} / ${fmt(v.budgetExpenses)}</span>
                </div>
                <Progress value={v.budgetExpenses > 0 ? (v.totalExpenses / v.budgetExpenses) * 100 : 0} className="h-1.5" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* SOF Events */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Statement of Facts — VOY-2026-001 @ Istanbul
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {DEMO_SOF_EVENTS.slice(0, 6).map((e, i) => (
              <div key={e.id} className="flex gap-3 text-sm py-1.5 border-b last:border-0">
                <div className="w-36 flex-shrink-0 text-xs text-muted-foreground">
                  {new Date(e.eventTime).toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className={`font-medium flex-1 ${e.isKeyEvent ? "text-blue-700 dark:text-blue-400" : ""}`}>
                  {e.eventType}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Compliance Tab ────────────────────────────────────────────────────────────
function ComplianceTab() {
  const c = DEMO_COMPLIANCE;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              ISM Code Compliance — {c.vesselName}
            </CardTitle>
            <Badge variant={c.compliancePct >= 80 ? "outline" : "destructive"} className="text-xs">
              {c.compliancePct}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Compliance Progress</span>
                <span>{c.completedItems} / {c.totalItems} items</span>
              </div>
              <Progress value={c.compliancePct} className="h-2" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Findings", value: c.findings, color: "text-red-500" },
                { label: "Last Audit", value: c.lastAuditDate, color: "text-foreground" },
                { label: "Next Audit", value: c.nextAuditDate, color: "text-amber-600" },
              ].map(item => (
                <div key={item.label} className="bg-muted p-3 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                  <div className={`text-sm font-semibold ${item.color}`}>{item.value}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">Auditor: {c.auditorName}</div>
          </div>
        </CardContent>
      </Card>

      {/* Bunker Records */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-600" />
            Bunker Records
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vessel</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>Fuel</TableHead>
                <TableHead className="text-right">Qty (MT)</TableHead>
                <TableHead className="text-right">Price/MT</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DEMO_BUNKER_RECORDS.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{DEMO_VESSELS.find(v => v.id === b.vesselId)?.name?.replace("MV ", "")?.replace("MT ", "") || b.vesselId}</TableCell>
                  <TableCell>{b.port}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{b.fuelType}</Badge></TableCell>
                  <TableCell className="text-right">{b.quantity}</TableCell>
                  <TableCell className="text-right">${b.pricePerMt}</TableCell>
                  <TableCell className="text-right font-semibold">${fmt(b.totalCost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Admin Tab ─────────────────────────────────────────────────────────────────
function AdminTab() {
  const kpis = [
    { label: "Total Users", value: "234", trend: "+12 this week", up: true },
    { label: "Active Subscriptions", value: "89", trend: "+5 this week", up: true },
    { label: "Proformas Generated", value: "1,248", trend: "+41 today", up: true },
    { label: "Avg. DA Value", value: "$48,320", trend: "-2.1% vs last month", up: false },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold mb-1">{k.value}</div>
              <div className="text-xs text-muted-foreground mb-2">{k.label}</div>
              <div className={`flex items-center gap-1 text-xs ${k.up ? "text-emerald-600" : "text-red-500"}`}>
                {k.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {k.trend}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Recent Users</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { name: "Ahmet Kaya", role: "Ship Agent", plan: "Standard", date: "2026-02-28" },
                { name: "Maria Santos", role: "Shipowner", plan: "Free", date: "2026-02-27" },
                { name: "James Okoye", role: "Ship Agent", plan: "Standard", date: "2026-02-26" },
                { name: "Yuki Tanaka", role: "Provider", plan: "Standard", date: "2026-02-25" },
              ].map((u, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{u.role}</Badge></TableCell>
                  <TableCell>{u.plan}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{u.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Demo Dashboard ────────────────────────────────────────────────────────────
function DemoDashboard({ role }: { role: DemoRole }) {
  const [showTour, setShowTour] = useState(true);
  const { switchRole, exitDemo } = useDemo();
  const [, navigate] = useLocation();

  const handleSwitch = async (r: DemoRole) => {
    await switchRole(r);
  };

  return (
    <div className="min-h-screen bg-background">
      {showTour && <GuidedTour onClose={() => setShowTour(false)} />}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Anchor className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-lg font-serif">VesselPDA</span>
              <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0 text-xs">DEMO</Badge>
            </div>
            <div className="text-sm text-muted-foreground">{DEMO_ORG.name} — {ROLE_FEATURES[role].title}</div>
          </div>

          <div className="flex items-center gap-2">
            {/* Role switcher */}
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              {(["agent", "shipowner", "admin"] as DemoRole[]).map(r => (
                <button
                  key={r}
                  onClick={() => handleSwitch(r)}
                  className={`text-xs px-3 py-1.5 rounded-md transition-colors font-medium ${
                    role === r ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`button-switch-role-${r}`}
                >
                  {ROLE_FEATURES[r].title.split(" ")[0]}
                </button>
              ))}
            </div>
            <Link href="/register">
              <Button size="sm" className="gap-1.5 text-xs" data-testid="button-demo-signup">
                Kayıt Ol <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="dashboard">
          <TabsList className="mb-6 flex-wrap gap-1 h-auto">
            <TabsTrigger value="dashboard" className="gap-1.5 text-xs">
              <Activity className="w-3.5 h-3.5" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="vessels" className="gap-1.5 text-xs">
              <Ship className="w-3.5 h-3.5" /> Vessels
            </TabsTrigger>
            <TabsTrigger value="proformas" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" /> Proformas & DA
            </TabsTrigger>
            <TabsTrigger value="voyages" className="gap-1.5 text-xs">
              <Navigation className="w-3.5 h-3.5" /> Voyages & SOF
            </TabsTrigger>
            {role === "admin" && (
              <TabsTrigger value="admin" className="gap-1.5 text-xs">
                <Crown className="w-3.5 h-3.5" /> Admin Panel
              </TabsTrigger>
            )}
            <TabsTrigger value="compliance" className="gap-1.5 text-xs">
              <ShieldCheck className="w-3.5 h-3.5" /> Compliance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><DashboardTab role={role} /></TabsContent>
          <TabsContent value="vessels"><VesselsTab /></TabsContent>
          <TabsContent value="proformas"><ProformasTab /></TabsContent>
          <TabsContent value="voyages"><VoyagesTab /></TabsContent>
          <TabsContent value="compliance"><ComplianceTab /></TabsContent>
          {role === "admin" && <TabsContent value="admin"><AdminTab /></TabsContent>}
        </Tabs>

        {/* Bottom CTA */}
        <div className="mt-10 rounded-2xl border bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 p-6 text-center">
          <h3 className="text-lg font-bold font-serif mb-2">Bu platformu gerçekten kullanmaya hazır mısınız?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Ücretsiz hesabınızı oluşturun. Kredi kartı gerekmez.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/register">
              <Button className="gap-2" data-testid="button-bottom-register">
                Ücretsiz Kayıt Ol <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Button variant="outline" onClick={() => { exitDemo(); navigate("/"); }}>
              Ana Sayfaya Dön
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function DemoPage() {
  const { isDemoMode, demoRole, startDemo } = useDemo();
  const [started, setStarted] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isDemoMode) setStarted(true);
  }, [isDemoMode]);

  const handleSelect = async (role: DemoRole) => {
    await startDemo(role);
    setStarted(true);
  };

  if (started && isDemoMode) {
    return <DemoDashboard role={demoRole} />;
  }

  return <RoleSelectionScreen onSelect={handleSelect} />;
}
