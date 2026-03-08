import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import {
  ArrowLeft, Ship, MapPin, Calendar, CheckCircle2, Circle, ArrowRight,
  Megaphone, FileCheck, ClipboardList, Calculator, Receipt, CreditCard,
  Users, FolderOpen, MessageCircle, TrendingUp, ExternalLink, Plus,
  Clock, PlayCircle, XCircle, AlertCircle, CheckCheck, ChevronRight,
  Anchor, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageMeta } from "@/components/page-meta";
import { fmtDate } from "@/lib/formatDate";

const STATUS_CFG: Record<string, { label: string; color: string; icon: any }> = {
  planned:         { label: "Planned",         color: "bg-blue-900/40 text-blue-400 border border-blue-500/30",    icon: Clock },
  active:          { label: "Active",          color: "bg-green-900/40 text-green-400 border border-green-500/30", icon: PlayCircle },
  completed:       { label: "Completed",       color: "bg-slate-700/60 text-slate-400 border border-slate-600/30", icon: CheckCircle2 },
  cancelled:       { label: "Cancelled",       color: "bg-red-900/40 text-red-400 border border-red-500/30",       icon: XCircle },
  pending_finance: { label: "Pending Finance", color: "bg-amber-900/40 text-amber-400 border border-amber-500/30", icon: AlertCircle },
  archived:        { label: "Archived",        color: "bg-slate-800/60 text-slate-500 border border-slate-700/30", icon: CheckCircle2 },
};

type StepKey = "tender" | "voyage" | "nor" | "sof" | "pda" | "fda" | "invoice";
type StepStatus = "done" | "active" | "pending";

interface PipelineStep {
  key: StepKey;
  label: string;
  labelTR: string;
  icon: any;
}

const STEPS: PipelineStep[] = [
  { key: "tender",  label: "Tender",  labelTR: "Tender",   icon: Megaphone },
  { key: "voyage",  label: "Voyage",  labelTR: "Sefer",    icon: Ship },
  { key: "nor",     label: "NOR",     labelTR: "NOR",      icon: FileCheck },
  { key: "sof",     label: "SOF",     labelTR: "SOF",      icon: ClipboardList },
  { key: "pda",     label: "PDA",     labelTR: "PDA",      icon: Calculator },
  { key: "fda",     label: "FDA",     labelTR: "FDA",      icon: Receipt },
  { key: "invoice", label: "Invoice", labelTR: "Fatura",   icon: CreditCard },
];

function StepStatusDot({ status }: { status: StepStatus }) {
  if (status === "done")
    return <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30" />;
  if (status === "active")
    return (
      <div className="relative w-2.5 h-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-400" />
      </div>
    );
  return <div className="w-2.5 h-2.5 rounded-full bg-slate-600" />;
}

function StepCard({
  step,
  status,
  isSelected,
  onClick,
}: {
  step: PipelineStep;
  status: StepStatus;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = step.icon;
  const colorMap: Record<StepStatus, string> = {
    done:    "border-emerald-500/40 bg-emerald-900/10 text-emerald-300",
    active:  "border-sky-500/50 bg-sky-900/20 text-sky-300",
    pending: "border-slate-700/40 bg-slate-800/30 text-slate-500",
  };
  const selectedExtra = isSelected
    ? "ring-2 ring-sky-500/50 shadow-lg shadow-sky-500/10"
    : "hover:border-slate-500/60 hover:bg-slate-800/50";

  return (
    <button
      onClick={onClick}
      data-testid={`pipeline-step-${step.key}`}
      className={`relative flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border transition-all duration-150 cursor-pointer min-w-[72px] ${colorMap[status]} ${selectedExtra}`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[11px] font-semibold leading-none">{step.labelTR}</span>
      <div className="flex items-center justify-center">
        <StepStatusDot status={status} />
      </div>
    </button>
  );
}

function ActionCard({
  icon: Icon,
  label,
  href,
  variant = "default",
}: {
  icon: any;
  label: string;
  href: string;
  variant?: "default" | "primary" | "ghost";
}) {
  const variantClass = {
    default: "bg-slate-800/60 border-slate-700/50 hover:bg-slate-700/60 hover:border-slate-600/60 text-slate-200",
    primary: "bg-sky-600/20 border-sky-500/40 hover:bg-sky-600/30 hover:border-sky-500/60 text-sky-300",
    ghost:   "bg-transparent border-slate-700/30 hover:bg-slate-800/40 text-slate-400 hover:text-slate-300",
  }[variant];

  return (
    <Link href={href}>
      <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border cursor-pointer transition-all ${variantClass}`}>
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium">{label}</span>
        <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
      </div>
    </Link>
  );
}

export default function VoyageWorkflow() {
  const params = useParams<{ id: string }>();
  const voyageId = parseInt(params.id, 10);
  const [, navigate] = useLocation();
  const [selectedStep, setSelectedStep] = useState<StepKey>("voyage");

  const { data: voyage, isLoading: voyageLoading } = useQuery<any>({
    queryKey: ["/api/voyages", voyageId],
    queryFn: async () => {
      const r = await fetch(`/api/voyages/${voyageId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Voyage not found");
      return r.json();
    },
    enabled: !!voyageId,
  });

  const { data: norList } = useQuery<any[]>({
    queryKey: ["/api/nor", "voyage", voyageId],
    queryFn: async () => {
      const r = await fetch(`/api/nor?voyageId=${voyageId}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: !!voyageId,
  });

  const { data: sofList } = useQuery<any[]>({
    queryKey: ["/api/sof", "voyage", voyageId],
    queryFn: async () => {
      const r = await fetch(`/api/sof?voyageId=${voyageId}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: !!voyageId,
  });

  const { data: pdaList } = useQuery<any[]>({
    queryKey: ["/api/proformas", "voyage", voyageId],
    queryFn: async () => {
      const r = await fetch(`/api/proformas?voyageId=${voyageId}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: !!voyageId,
  });

  const { data: fdaList } = useQuery<any[]>({
    queryKey: ["/api/fda", "voyage", voyageId],
    queryFn: async () => {
      const r = await fetch(`/api/fda?voyageId=${voyageId}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: !!voyageId,
  });

  const { data: invoiceList } = useQuery<any[]>({
    queryKey: ["/api/invoices", "voyage", voyageId],
    queryFn: async () => {
      const r = await fetch(`/api/invoices?voyageId=${voyageId}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: !!voyageId,
  });

  const hasNor     = (norList?.length     || 0) > 0;
  const hasSof     = (sofList?.length     || 0) > 0;
  const hasPda     = (pdaList?.length     || 0) > 0;
  const hasFda     = (fdaList?.length     || 0) > 0;
  const hasInvoice = (invoiceList?.length || 0) > 0;

  function getStatus(key: StepKey): StepStatus {
    switch (key) {
      case "tender":  return "done";
      case "voyage":  return voyage?.status === "completed" || voyage?.status === "archived" ? "done" : "active";
      case "nor":     return hasNor ? "done" : "pending";
      case "sof":     return hasSof ? "done" : "pending";
      case "pda":     return hasPda ? "done" : "pending";
      case "fda":     return hasFda ? "done" : "pending";
      case "invoice": return hasInvoice ? "done" : "pending";
    }
  }

  const statusCfg = STATUS_CFG[voyage?.status || "planned"] || STATUS_CFG.planned;
  const StatusIcon = statusCfg.icon;

  const norId     = norList?.[0]?.id;
  const sofId     = sofList?.[0]?.id;
  const pdaId     = pdaList?.[0]?.id;
  const fdaId     = fdaList?.[0]?.id;

  const completedCount = STEPS.filter(s => getStatus(s.key) === "done").length;
  const progressPct = Math.round((completedCount / STEPS.length) * 100);

  function renderStepPanel(key: StepKey) {
    switch (key) {
      case "tender":
        return (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 mb-3">
              Tender (ihale) süreci ticari tekliflerin alındığı ilk adımdır. Bu seferle ilişkili teklifleri yönetin.
            </p>
            <ActionCard icon={Megaphone}    label="Tüm Tenderlara Git"     href="/tenders"         variant="primary" />
            <ActionCard icon={Plus}         label="Yeni Tender Oluştur"    href="/tenders"         variant="default" />
          </div>
        );
      case "voyage":
        return (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 mb-3">
              Sefer dosyası tüm operasyonun merkezidir. Mürettebat, dokümanlar, sohbet ve finansal veriler burada yönetilir.
            </p>
            <ActionCard icon={Ship}         label="Sefer Detayı (Genel Bakış)"  href={`/voyages/${voyageId}`}                  variant="primary" />
            <ActionCard icon={Users}        label="Mürettebat Panosu"           href={`/voyages/${voyageId}?tab=operation`}    variant="default" />
            <ActionCard icon={FolderOpen}   label="Dokümanlar"                  href={`/voyages/${voyageId}?tab=documents`}    variant="default" />
            <ActionCard icon={MessageCircle} label="Mesajlar & Sohbet"          href={`/voyages/${voyageId}?tab=comms`}        variant="default" />
            <ActionCard icon={TrendingUp}   label="Finansal Özet (P&L)"         href={`/voyages/${voyageId}?tab=financial`}    variant="default" />
          </div>
        );
      case "nor":
        return (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 mb-3">
              NOR (Notice of Readiness) geminin liman operasyonuna hazır olduğunu bildiren resmi belgedir.
            </p>
            {hasNor ? (
              <ActionCard icon={FileCheck}  label={`NOR Görüntüle / İmzala`}   href={`/nor/${norId}`}             variant="primary" />
            ) : (
              <ActionCard icon={Plus}       label="Yeni NOR Oluştur"            href={`/nor?voyageId=${voyageId}`} variant="primary" />
            )}
            <ActionCard icon={FileCheck}    label="Tüm NOR Listesi"             href={`/nor?voyageId=${voyageId}`} variant="ghost" />
          </div>
        );
      case "sof":
        return (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 mb-3">
              SOF (Statement of Facts) liman operasyonu sırasında gerçekleşen olayların zaman çizelgesidir.
            </p>
            {hasSof ? (
              <ActionCard icon={ClipboardList} label="SOF Timeline'ını Gör"    href={`/sof/${sofId}`}             variant="primary" />
            ) : (
              <ActionCard icon={Plus}          label="Yeni SOF Oluştur"         href={`/sof?voyageId=${voyageId}`} variant="primary" />
            )}
            <ActionCard icon={ClipboardList}   label="Tüm SOF Listesi"          href={`/sof?voyageId=${voyageId}`} variant="ghost" />
          </div>
        );
      case "pda":
        return (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 mb-3">
              PDA (Proforma Disbursement Account) tahmini liman masraflarının hesaplamasıdır.
            </p>
            {hasPda ? (
              <ActionCard icon={Calculator}  label="PDA Görüntüle / Düzenle"    href={`/proformas/${pdaId}`}              variant="primary" />
            ) : (
              <ActionCard icon={Plus}        label="Yeni PDA Oluştur"            href={`/proformas/new?voyageId=${voyageId}`} variant="primary" />
            )}
            <ActionCard icon={Calculator}    label="PDA İnceleme Kuyruğu"        href="/pda-review"                        variant="ghost" />
          </div>
        );
      case "fda":
        return (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 mb-3">
              FDA (Final Disbursement Account) gerçekleşen masrafların kesin hesabıdır. PDA ile karşılaştırılır.
            </p>
            {hasFda ? (
              <ActionCard icon={Receipt}    label="FDA Görüntüle / Karşılaştır" href={`/fda/${fdaId}`}             variant="primary" />
            ) : (
              <ActionCard icon={Plus}       label="Yeni FDA Oluştur"             href={`/fda?voyageId=${voyageId}`} variant="primary" />
            )}
            <ActionCard icon={Receipt}      label="DA Karşılaştırma Raporu"      href="/da-comparison"              variant="ghost" />
          </div>
        );
      case "invoice":
        return (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 mb-3">
              Faturalar masrafların resmi olarak faturalanmasını sağlar. FDA'dan otomatik oluşturulabilir.
            </p>
            {hasInvoice ? (
              <ActionCard icon={CreditCard}  label={`${invoiceList?.length} Fatura Görüntüle`}  href={`/invoices?voyageId=${voyageId}`} variant="primary" />
            ) : (
              <ActionCard icon={Plus}        label="Yeni Fatura Oluştur"                         href={`/invoices?voyageId=${voyageId}`} variant="primary" />
            )}
            <ActionCard icon={CreditCard}    label="Tüm Faturalar"                               href="/invoices"                        variant="ghost" />
          </div>
        );
    }
  }

  if (voyageLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!voyage) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400">Sefer bulunamadı.</p>
        <Button variant="ghost" className="mt-3" onClick={() => navigate("/voyages")}>
          ← Seferlere Dön
        </Button>
      </div>
    );
  }

  const selectedStepObj = STEPS.find(s => s.key === selectedStep)!;
  const SelectedIcon = selectedStepObj.icon;
  const selectedStatus = getStatus(selectedStep);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <PageMeta title={`Workflow — ${voyage.vesselName || "Sefer"} | VesselPDA`} />

      {/* Back */}
      <Link href="/voyages">
        <button className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors" data-testid="btn-back-voyages">
          <ArrowLeft className="w-4 h-4" />
          Seferlere Dön
        </button>
      </Link>

      {/* Voyage Header Card */}
      <Card className="bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-slate-700/50 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
              <Ship className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight" data-testid="voyage-workflow-title">
                {voyage.vesselName || "Vessel TBN"}
              </h1>
              <div className="flex items-center gap-3 mt-0.5">
                {voyage.portName && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{voyage.portName}
                  </span>
                )}
                {voyage.eta && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />ETA: {fmtDate(voyage.eta)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${statusCfg.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />{statusCfg.label}
            </span>
            <Link href={`/voyages/${voyageId}`}>
              <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:text-white text-xs">
                Tam Detay <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-widest text-slate-500">Workflow İlerlemesi</span>
            <span className="text-[10px] font-bold text-slate-400">{completedCount}/{STEPS.length} Adım · %{progressPct}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Pipeline */}
      <Card className="bg-slate-900/80 border-slate-700/50 p-4">
        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">Sefer Akış Adımları</p>
        <div className="flex items-center gap-1 overflow-x-auto pb-1" data-testid="pipeline-banner">
          {STEPS.map((step, idx) => (
            <div key={step.key} className="flex items-center gap-1 flex-shrink-0">
              <StepCard
                step={step}
                status={getStatus(step.key)}
                isSelected={selectedStep === step.key}
                onClick={() => setSelectedStep(step.key)}
              />
              {idx < STEPS.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800/60">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />Tamamlandı
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <div className="w-2 h-2 rounded-full bg-sky-400" />Devam Ediyor
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <div className="w-2 h-2 rounded-full bg-slate-600" />Bekliyor
          </div>
        </div>
      </Card>

      {/* Step Detail Panel */}
      <Card className="bg-slate-900/80 border-slate-700/50 p-5" data-testid="step-detail-panel">
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            selectedStatus === "done"    ? "bg-emerald-900/40 text-emerald-400" :
            selectedStatus === "active"  ? "bg-sky-900/40 text-sky-400" :
                                           "bg-slate-800/60 text-slate-500"
          }`}>
            <SelectedIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{selectedStepObj.labelTR}</h2>
            <span className={`text-[10px] font-semibold ${
              selectedStatus === "done" ? "text-emerald-400" : selectedStatus === "active" ? "text-sky-400" : "text-slate-500"
            }`}>
              {selectedStatus === "done" ? "✓ Tamamlandı" : selectedStatus === "active" ? "● Devam Ediyor" : "○ Henüz Başlanmadı"}
            </span>
          </div>
          {selectedStatus === "done" && (
            <Badge className="ml-auto text-[9px] bg-emerald-900/40 text-emerald-400 border border-emerald-500/30">
              <CheckCheck className="w-2.5 h-2.5 mr-1" />Tamamlandı
            </Badge>
          )}
        </div>
        <div className="space-y-1.5">
          {renderStepPanel(selectedStep)}
        </div>
      </Card>

      {/* Quick Nav: next pending step */}
      {(() => {
        const nextPending = STEPS.find(s => getStatus(s.key) === "pending");
        if (!nextPending) return (
          <div className="text-center py-6">
            <CheckCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-emerald-400">Tüm adımlar tamamlandı!</p>
            <p className="text-xs text-slate-500 mt-1">Bu sefer workflow'u eksiksiz.</p>
          </div>
        );
        const NextIcon = nextPending.icon;
        return (
          <button
            onClick={() => setSelectedStep(nextPending.key)}
            data-testid="btn-next-step"
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-sky-900/20 border border-sky-500/30 hover:bg-sky-900/30 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-sky-600/20 flex items-center justify-center">
                <NextIcon className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="text-left">
                <p className="text-xs text-slate-400">Sonraki Bekleyen Adım</p>
                <p className="text-sm font-semibold text-sky-300">{nextPending.labelTR}</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-sky-400" />
          </button>
        );
      })()}
    </div>
  );
}
