import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight, ChevronLeft, X, FileText, Megaphone, Map, Radio,
  Anchor, CheckCircle2, Compass
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface OnboardingWizardProps {
  user: any;
  onComplete: () => void;
  onSkip: () => void;
}

const TURKISH_PORTS = ["Istanbul", "Izmir", "Mersin", "Gemlik", "Bandirma", "Iskenderun"];
const SERVICE_TYPES_AGENT = ["Agency", "Stevedoring", "Freight Forwarding", "Ship Chandling", "Towage", "Pilotage"];
const NEED_OPTIONS = [
  { id: "pda", label: "Calculate port disbursements (PDA)", testId: "checkbox-need-pda" },
  { id: "agents", label: "Find ship agents / providers", testId: "checkbox-need-agents" },
  { id: "ops", label: "Manage vessel operations", testId: "checkbox-need-ops" },
  { id: "fleet", label: "Track my fleet", testId: "checkbox-need-fleet" },
  { id: "tenders", label: "Post or bid on tenders", testId: "checkbox-need-tenders" },
];

const TOTAL_STEPS = 5;

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i < current
              ? "w-2.5 h-2.5 bg-emerald-500"
              : i === current
              ? "w-3 h-3 bg-sky-500 ring-2 ring-sky-500/30"
              : "w-2.5 h-2.5 bg-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

function ConfettiPiece({ index }: { index: number }) {
  const colors = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316"];
  const color = colors[index % colors.length];
  const left = `${(index * 5.3 + 2) % 100}%`;
  const delay = `${(index * 0.08) % 0.8}s`;
  const size = index % 3 === 0 ? 8 : 6;
  const borderRadius = index % 2 === 0 ? "50%" : "0";
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left,
        top: "-10px",
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius,
        animation: `confettiFall 2s ease-in ${delay} forwards`,
      }}
    />
  );
}

function Confetti() {
  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0%   { top: -10px; opacity: 1; transform: rotate(0deg) translateX(0); }
          50%  { opacity: 1; transform: rotate(180deg) translateX(20px); }
          100% { top: 105%; opacity: 0; transform: rotate(360deg) translateX(-10px); }
        }
      `}</style>
      <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
        {Array.from({ length: 20 }).map((_, i) => (
          <ConfettiPiece key={i} index={i} />
        ))}
      </div>
    </>
  );
}

function Step0({ user, companyName, setCompanyName, needs, setNeeds }: {
  user: any; companyName: string; setCompanyName: (v: string) => void;
  needs: string[]; setNeeds: (v: string[]) => void;
}) {
  const role = (user?.userRole || "user");
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  return (
    <div className="space-y-6" data-testid="onboarding-step-0">
      <div className="text-center space-y-2">
        <div className="text-5xl mb-3">👋</div>
        <h2 className="text-2xl font-bold font-serif">Welcome to VesselPDA!</h2>
        <p className="text-muted-foreground">Let's get you set up in just a few steps.</p>
        <div className="flex justify-center mt-2">
          <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200">
            <Anchor className="w-3 h-3 mr-1" />
            {roleLabel}
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="onboarding-company">Your company name (optional)</Label>
        <Input
          id="onboarding-company"
          placeholder="e.g. Barbaros Shipping Agency"
          value={companyName}
          onChange={e => setCompanyName(e.target.value)}
          data-testid="input-company-name"
        />
      </div>

      <div className="space-y-3">
        <Label>What do you mainly need?</Label>
        <div className="space-y-2">
          {NEED_OPTIONS.map(opt => (
            <label key={opt.id} className="flex items-center gap-3 cursor-pointer group" data-testid={opt.testId}>
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  needs.includes(opt.id)
                    ? "bg-sky-500 border-sky-500"
                    : "border-muted-foreground/50 group-hover:border-sky-400"
                }`}
                onClick={() => setNeeds(needs.includes(opt.id) ? needs.filter(n => n !== opt.id) : [...needs, opt.id])}
              >
                {needs.includes(opt.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
              </div>
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step1({ user, companyName, setCompanyName, servedPorts, setServedPorts, serviceTypes, setServiceTypes,
  fleetSize, setFleetSize, vesselName, setVesselName, vesselImo, setVesselImo, tradingRoutes, setTradingRoutes }: any) {
  const role = user?.userRole || "shipowner";

  if (role === "agent") return (
    <div className="space-y-5" data-testid="onboarding-step-1">
      <div className="text-center space-y-1">
        <div className="text-4xl mb-2">🏢</div>
        <h2 className="text-xl font-bold font-serif">Set Up Your Agent Profile</h2>
        <p className="text-muted-foreground text-sm">Tell shipowners who you are and where you operate.</p>
      </div>
      <div className="space-y-2">
        <Label>Company name</Label>
        <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your agency name" />
      </div>
      <div className="space-y-2">
        <Label>Ports you serve</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TURKISH_PORTS.map(port => (
            <label key={port} className="flex items-center gap-2 cursor-pointer text-sm p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <input type="checkbox" className="accent-sky-500"
                checked={servedPorts.includes(port)}
                onChange={e => setServedPorts(e.target.checked ? [...servedPorts, port] : servedPorts.filter((p: string) => p !== port))}
              />
              {port}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Services you offer</Label>
        <div className="grid grid-cols-2 gap-2">
          {SERVICE_TYPES_AGENT.map(svc => (
            <label key={svc} className="flex items-center gap-2 cursor-pointer text-sm p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <input type="checkbox" className="accent-sky-500"
                checked={serviceTypes.includes(svc)}
                onChange={e => setServiceTypes(e.target.checked ? [...serviceTypes, svc] : serviceTypes.filter((s: string) => s !== svc))}
              />
              {svc}
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  if (role === "shipowner") return (
    <div className="space-y-5" data-testid="onboarding-step-1">
      <div className="text-center space-y-1">
        <div className="text-4xl mb-2">🚢</div>
        <h2 className="text-xl font-bold font-serif">Set Up Your Fleet Profile</h2>
        <p className="text-muted-foreground text-sm">Help agents understand your fleet size and needs.</p>
      </div>
      <div className="space-y-2">
        <Label>Company name</Label>
        <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your company name" />
      </div>
      <div className="space-y-2">
        <Label>Fleet size</Label>
        <Select value={fleetSize} onValueChange={setFleetSize}>
          <SelectTrigger><SelectValue placeholder="Select fleet size" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1-5">1–5 vessels</SelectItem>
            <SelectItem value="5-20">5–20 vessels</SelectItem>
            <SelectItem value="20+">20+ vessels</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-3 p-4 border border-dashed border-border rounded-xl bg-muted/20">
        <Label className="text-muted-foreground text-xs uppercase tracking-wide">Add your first vessel (optional)</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Vessel name</Label>
            <Input value={vesselName} onChange={e => setVesselName(e.target.value)} placeholder="e.g. MV Bosphorus Star" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">IMO number</Label>
            <Input value={vesselImo} onChange={e => setVesselImo(e.target.value)} placeholder="e.g. 9123456" />
          </div>
        </div>
      </div>
    </div>
  );

  if (role === "broker") return (
    <div className="space-y-5" data-testid="onboarding-step-1">
      <div className="text-center space-y-1">
        <div className="text-4xl mb-2">📊</div>
        <h2 className="text-xl font-bold font-serif">Set Up Your Broker Profile</h2>
        <p className="text-muted-foreground text-sm">Tell the market where you operate.</p>
      </div>
      <div className="space-y-2">
        <Label>Company name</Label>
        <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your brokerage name" />
      </div>
      <div className="space-y-2">
        <Label>Trading routes</Label>
        <Input value={tradingRoutes} onChange={e => setTradingRoutes(e.target.value)} placeholder="e.g. Black Sea, Mediterranean, Far East" />
      </div>
    </div>
  );

  return (
    <div className="space-y-5" data-testid="onboarding-step-1">
      <div className="text-center space-y-1">
        <div className="text-4xl mb-2">🔧</div>
        <h2 className="text-xl font-bold font-serif">Set Up Your Service Profile</h2>
        <p className="text-muted-foreground text-sm">Let shipowners and agents find you easily.</p>
      </div>
      <div className="space-y-2">
        <Label>Company name</Label>
        <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your company name" />
      </div>
      <div className="space-y-2">
        <Label>Service type</Label>
        <Input placeholder="e.g. Bunker supplier, Ship chandler..." value={tradingRoutes} onChange={e => setTradingRoutes(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Ports you serve</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TURKISH_PORTS.map(port => (
            <label key={port} className="flex items-center gap-2 cursor-pointer text-sm p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <input type="checkbox" className="accent-sky-500"
                checked={servedPorts.includes(port)}
                onChange={e => setServedPorts(e.target.checked ? [...servedPorts, port] : servedPorts.filter((p: string) => p !== port))}
              />
              {port}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step2() {
  const features = [
    { emoji: "📋", title: "Proformas", desc: "Calculate port costs instantly", href: "/proformas" },
    { emoji: "📢", title: "Tenders", desc: "Find or offer port services", href: "/tenders" },
    { emoji: "🗺️", title: "Voyages", desc: "Manage port calls end-to-end", href: "/voyages" },
    { emoji: "📡", title: "Vessel Tracking", desc: "Monitor live vessel positions", href: "/tracking" },
  ];
  return (
    <div className="space-y-5" data-testid="onboarding-step-2">
      <div className="text-center space-y-1">
        <div className="text-4xl mb-2">🌊</div>
        <h2 className="text-xl font-bold font-serif">Here's what you can do</h2>
        <p className="text-muted-foreground text-sm">VesselPDA brings maritime operations together in one platform.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {features.map(f => (
          <div key={f.href} className="p-4 border border-border rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors space-y-2">
            <div className="text-2xl">{f.emoji}</div>
            <div>
              <p className="font-semibold text-sm">{f.title}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
            <Link href={f.href} className="text-xs text-sky-500 hover:text-sky-600 flex items-center gap-0.5 font-medium">
              Try Now <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step3({ user, onAction }: { user: any; onAction: () => void }) {
  const role = user?.userRole || "shipowner";
  const ctaMap: Record<string, { emoji: string; heading: string; desc: string; label: string; href: string }> = {
    agent: {
      emoji: "🏢", heading: "Create your company profile",
      desc: "Appear in the VesselPDA directory so shipowners can find and contact you.",
      label: "Set Up Profile", href: "/company-profile",
    },
    shipowner: {
      emoji: "📋", heading: "Calculate your first proforma",
      desc: "Get an instant estimate of port disbursement costs for your next port call.",
      label: "Create PDA", href: "/proformas/new",
    },
    broker: {
      emoji: "📦", heading: "Post your first cargo position",
      desc: "Let the market know about your available cargo or vessel positions.",
      label: "Add Position", href: "/cargo-board",
    },
    provider: {
      emoji: "🔧", heading: "Set up your service profile",
      desc: "List your services so ships calling Turkish ports can find you.",
      label: "Create Profile", href: "/company-profile",
    },
    admin: {
      emoji: "⚙️", heading: "Explore your admin dashboard",
      desc: "Manage users, content, and platform settings from the admin panel.",
      label: "Go to Admin", href: "/admin",
    },
  };
  const cta = ctaMap[role] || ctaMap.shipowner;
  return (
    <div className="space-y-5" data-testid="onboarding-step-3">
      <div className="text-center space-y-1">
        <div className="text-4xl mb-2">🎯</div>
        <h2 className="text-xl font-bold font-serif">Your First Action</h2>
        <p className="text-muted-foreground text-sm">We recommend starting here based on your role.</p>
      </div>
      <div className="p-6 border-2 border-sky-500/30 rounded-2xl bg-sky-500/5 space-y-3 text-center">
        <div className="text-4xl">{cta.emoji}</div>
        <h3 className="font-bold text-lg">{cta.heading}</h3>
        <p className="text-sm text-muted-foreground">{cta.desc}</p>
        <Link href={cta.href} onClick={onAction}>
          <Button className="mt-2 gap-2" data-testid="button-first-action">
            {cta.label} <ChevronRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
      <p className="text-xs text-center text-muted-foreground">
        You can always do this later — click <strong>Next</strong> to continue.
      </p>
    </div>
  );
}

function Step4({ onComplete }: { onComplete: () => void }) {
  const quickLinks = [
    { label: "Dashboard", href: "/dashboard", emoji: "🏠" },
    { label: "Create PDA", href: "/proformas/new", emoji: "📋" },
    { label: "Browse Directory", href: "/directory", emoji: "🔍" },
    { label: "Join Forum", href: "/forum", emoji: "💬" },
  ];
  return (
    <div className="space-y-5 relative" data-testid="onboarding-step-4">
      <Confetti />
      <div className="text-center space-y-2 relative z-10">
        <div className="text-5xl mb-2">🎉</div>
        <h2 className="text-2xl font-bold font-serif">You're all set!</h2>
        <p className="text-muted-foreground">Welcome to VesselPDA. Your account is ready.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 relative z-10">
        {quickLinks.map(link => (
          <Link key={link.href} href={link.href} onClick={onComplete}>
            <div className="flex items-center gap-2 p-3 border border-border rounded-xl bg-muted/20 hover:bg-muted/50 transition-colors cursor-pointer">
              <span className="text-xl">{link.emoji}</span>
              <span className="text-sm font-medium">{link.label}</span>
            </div>
          </Link>
        ))}
      </div>
      <div className="relative z-10">
        <Button className="w-full gap-2 h-11" onClick={onComplete} data-testid="button-go-to-dashboard">
          Go to Dashboard <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function OnboardingWizard({ user, onComplete, onSkip }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState("");
  const [needs, setNeeds] = useState<string[]>([]);
  const [servedPorts, setServedPorts] = useState<string[]>([]);
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [fleetSize, setFleetSize] = useState("");
  const [vesselName, setVesselName] = useState("");
  const [vesselImo, setVesselImo] = useState("");
  const [tradingRoutes, setTradingRoutes] = useState("");

  const saveStep = async (newStep: number) => {
    try {
      await apiRequest("PATCH", "/api/user/onboarding-step", { step: newStep });
    } catch {
    }
  };

  const goNext = () => {
    const next = step + 1;
    setStep(next);
    saveStep(next);
  };

  const goBack = () => setStep(s => Math.max(0, s - 1));

  const handleSkip = async () => {
    try {
      await apiRequest("PATCH", "/api/user/onboarding-complete", { companyName: companyName || undefined });
    } catch { }
    onSkip();
  };

  const handleComplete = async () => {
    try {
      await apiRequest("PATCH", "/api/user/onboarding-complete", { companyName: companyName || undefined });
    } catch { }
    onComplete();
  };

  const stepContent = [
    <Step0 key={0} user={user} companyName={companyName} setCompanyName={setCompanyName} needs={needs} setNeeds={setNeeds} />,
    <Step1 key={1} user={user} companyName={companyName} setCompanyName={setCompanyName}
      servedPorts={servedPorts} setServedPorts={setServedPorts}
      serviceTypes={serviceTypes} setServiceTypes={setServiceTypes}
      fleetSize={fleetSize} setFleetSize={setFleetSize}
      vesselName={vesselName} setVesselName={setVesselName}
      vesselImo={vesselImo} setVesselImo={setVesselImo}
      tradingRoutes={tradingRoutes} setTradingRoutes={setTradingRoutes}
    />,
    <Step2 key={2} />,
    <Step3 key={3} user={user} onAction={handleComplete} />,
    <Step4 key={4} onComplete={handleComplete} />,
  ];

  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" data-testid="onboarding-wizard">
      <div className="max-w-2xl w-full bg-card border border-border rounded-2xl shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Step {step + 1} of {TOTAL_STEPS}
          </span>
          <button
            onClick={handleSkip}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50"
            data-testid="button-skip-onboarding"
          >
            <X className="w-3.5 h-3.5" /> Skip
          </button>
        </div>

        {/* Step content */}
        <div className="px-6 py-5">
          <div
            key={step}
            className="animate-in fade-in-0 slide-in-from-right-4 duration-200"
          >
            {stepContent[step]}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 space-y-4">
          <ProgressDots current={step} />
          {!isLastStep && (
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={goBack}
                disabled={step === 0}
                className="gap-1"
                data-testid="button-onboarding-back"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                size="sm"
                onClick={goNext}
                className="gap-1"
                data-testid="button-onboarding-next"
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OnboardingWizard;
