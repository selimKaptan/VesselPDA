import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Link } from "wouter";
import {
  Ship, MapPin, Anchor, Zap, Shield, ClipboardCheck,
  Building2, AlertTriangle, Loader2, ArrowLeft,
  Navigation, Clock, ExternalLink, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageMeta } from "@/components/page-meta";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: any): string {
  if (v == null || v === "" || v === "—") return "—";
  return String(v);
}

function fmtDate(v: any): string {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("tr-TR"); } catch { return fmt(v); }
}

function fmtNum(v: any, suffix = ""): string {
  if (v == null) return "—";
  const n = Number(v);
  if (isNaN(n) || n === 0) return "—";
  return n.toLocaleString("tr-TR") + (suffix ? " " + suffix : "");
}

async function apiFetch(url: string) {
  const r = await fetch(url, { credentials: "include" });
  if (r.status === 404) throw Object.assign(new Error("NOT_FOUND"), { status: 404 });
  if (!r.ok) throw Object.assign(new Error("SERVER_ERROR"), { status: r.status });
  return r.json();
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function ReportCard({
  title, icon, isLoading, error, isEmpty, emptyText, children,
}: {
  title: string; icon: React.ReactNode;
  isLoading?: boolean; error?: Error | null; isEmpty?: boolean; emptyText?: string;
  children?: React.ReactNode;
}) {
  const errorMsg = error
    ? (error.message === "NOT_FOUND"
        ? "Datalastic'te bu gemi için kayıt yok."
        : "Veri alınırken hata oluştu.")
    : null;

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/40 bg-muted/20">
        <span className="text-primary">{icon}</span>
        <h3 className="text-sm font-semibold tracking-wide">{title}</h3>
        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto text-muted-foreground" />}
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse h-3 bg-muted/50 rounded" style={{ width: `${60 + i * 10}%` }} />
            ))}
          </div>
        ) : errorMsg ? (
          <p className="text-xs text-muted-foreground">{errorMsg}</p>
        ) : isEmpty ? (
          <p className="text-xs text-muted-foreground">{emptyText ?? "Veri bulunamadı."}</p>
        ) : children}
      </div>
    </div>
  );
}

function InfoGrid({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">{label}</span>
          <span className={`text-sm font-semibold truncate ${value === "—" ? "text-muted-foreground" : ""}`} title={value}>{value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VesselReport() {
  const [, params] = useRoute("/vessel-report/:imo");
  const imo = params?.imo ?? "";

  // ── Queries ────────────────────────────────────────────────────────────────

  const basicQ = useQuery({
    queryKey: ["/api/vessels/lookup", imo],
    queryFn: () => apiFetch(`/api/vessels/lookup?imo=${encodeURIComponent(imo)}`),
    enabled: !!imo, retry: false,
  });

  const proQ = useQuery({
    queryKey: ["/api/datalastic/vessel-pro", imo],
    queryFn: () => apiFetch(`/api/datalastic/vessel-pro/${encodeURIComponent(imo)}`),
    enabled: !!imo, retry: false,
  });

  const posQ = useQuery({
    queryKey: ["/api/vessels/live-position", imo],
    queryFn: () => apiFetch(`/api/vessels/live-position?imo=${encodeURIComponent(imo)}`),
    enabled: !!imo, retry: false,
  });

  const portCallsQ = useQuery({
    queryKey: ["/api/vessels/port-call-history", imo],
    queryFn: () => apiFetch(`/api/vessels/port-call-history?imo=${encodeURIComponent(imo)}`),
    enabled: !!imo, retry: false,
  });

  const engineQ = useQuery({
    queryKey: ["/api/datalastic/vessel-engine", imo],
    queryFn: () => apiFetch(`/api/datalastic/vessel-engine/${encodeURIComponent(imo)}`),
    enabled: !!imo, retry: false,
  });

  const classQ = useQuery({
    queryKey: ["/api/datalastic/classification", imo],
    queryFn: () => apiFetch(`/api/datalastic/classification/${encodeURIComponent(imo)}`),
    enabled: !!imo, retry: false,
  });

  const ownerQ = useQuery({
    queryKey: ["/api/datalastic/vessel-ownership", imo],
    queryFn: () => apiFetch(`/api/datalastic/vessel-ownership/${encodeURIComponent(imo)}`),
    enabled: !!imo, retry: false,
  });

  const pscQ = useQuery({
    queryKey: ["/api/datalastic/inspections", imo],
    queryFn: () => apiFetch(`/api/datalastic/inspections/${encodeURIComponent(imo)}`),
    enabled: !!imo, retry: false,
  });

  const drydockQ = useQuery({
    queryKey: ["/api/datalastic/drydock", imo],
    queryFn: () => apiFetch(`/api/datalastic/drydock/${encodeURIComponent(imo)}`),
    enabled: !!imo, retry: false,
  });

  const casualtiesQ = useQuery({
    queryKey: ["/api/datalastic/casualties", imo],
    queryFn: () => apiFetch(`/api/datalastic/casualties/${encodeURIComponent(imo)}`),
    enabled: !!imo, retry: false,
  });

  // ── Merged basic + pro data ────────────────────────────────────────────────
  const b = basicQ.data;
  const p = proQ.data;

  const merged = {
    name:       b?.name       ?? p?.vessel_name ?? p?.name,
    vesselType: b?.vesselType ?? p?.vessel_type ?? p?.type,
    flag:       b?.flag       ?? p?.flag        ?? p?.country_iso,
    imoNumber:  b?.imoNumber  ?? imo,
    mmsi:       b?.mmsi       ?? p?.mmsi,
    callSign:   b?.callSign   ?? p?.call_sign   ?? p?.callsign,
    yearBuilt:  b?.yearBuilt  ?? p?.year_built  ?? p?.built,
    grt:  b?.grt  ?? p?.gross_tonnage  ?? p?.grt,
    nrt:  b?.nrt  ?? p?.net_tonnage    ?? p?.nrt,
    dwt:  b?.dwt  ?? p?.deadweight     ?? p?.dwt,
    loa:  b?.loa  ?? p?.length_overall ?? p?.loa ?? p?.length,
    beam: b?.beam ?? p?.beam           ?? p?.breadth,
  };

  const hasBasicData  = !!(b || p);
  const vesselName    = merged.name || `IMO ${imo}`;
  const isAllLoading  = basicQ.isLoading && posQ.isLoading && engineQ.isLoading;

  return (
    <div className="min-h-screen bg-background">
      <PageMeta title={`${vesselName} — Gemi Raporu | VesselPDA`} />

      {/* ── Header ── */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/vessels">
            <Button variant="ghost" size="sm" className="gap-1.5 h-8">
              <ArrowLeft className="w-3.5 h-3.5" /> Gemiler
            </Button>
          </Link>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg">🛰</span>
            <div className="min-w-0">
              <h1 className="font-bold text-base leading-tight truncate">
                {(basicQ.isLoading && proQ.isLoading) ? "Yükleniyor…" : vesselName}
              </h1>
              <p className="text-xs text-muted-foreground">IMO {imo} • Datalastic İstihbarat Raporu</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {merged.vesselType && (
              <Badge variant="secondary" className="text-xs">{merged.vesselType}</Badge>
            )}
            <Link href={`/vessel-track?searchImo=${imo}`}>
              <Button size="sm" variant="outline" className="gap-1.5 h-8 border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
                <Navigation className="w-3.5 h-3.5" /> Haritada Gör
              </Button>
            </Link>
            <Link href="/vessels">
              <Button size="sm" className="gap-1.5 h-8">
                <Ship className="w-3.5 h-3.5" /> Filoya Ekle
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {isAllLoading && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-violet-500/10 border border-violet-500/20 text-sm text-violet-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            Datalastic'ten tüm veriler paralel olarak çekiliyor…
          </div>
        )}

        {/* ── Row 1: Basic Info + Live Position ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <ReportCard
            title="Teknik Özellikler" icon={<Ship className="w-4 h-4" />}
            isLoading={basicQ.isLoading && proQ.isLoading}
            error={hasBasicData ? null : (basicQ.error as Error | null)}
            isEmpty={!hasBasicData && !basicQ.isLoading && !proQ.isLoading}
            emptyText="Teknik bilgi bulunamadı."
          >
            {hasBasicData && (
              <InfoGrid rows={[
                { label: "Gemi Adı",   value: fmt(merged.name) },
                { label: "Tip",        value: fmt(merged.vesselType) },
                { label: "Bayrak",     value: fmt(merged.flag) },
                { label: "IMO",        value: fmt(merged.imoNumber) },
                { label: "MMSI",       value: fmt(merged.mmsi) },
                { label: "Call Sign",  value: fmt(merged.callSign) },
                { label: "GRT",        value: fmtNum(merged.grt,  "GT") },
                { label: "NRT",        value: fmtNum(merged.nrt,  "NT") },
                { label: "DWT",        value: fmtNum(merged.dwt,  "t") },
                { label: "LOA",        value: fmtNum(merged.loa,  "m") },
                { label: "Genişlik",   value: fmtNum(merged.beam, "m") },
                { label: "İnşa Yılı",  value: fmt(merged.yearBuilt) },
              ]} />
            )}
          </ReportCard>

          <ReportCard
            title="Canlı Konum" icon={<MapPin className="w-4 h-4" />}
            isLoading={posQ.isLoading}
            error={posQ.error as Error | null}
            isEmpty={!posQ.data && !posQ.isLoading && !posQ.isError}
            emptyText="Konum verisi bulunamadı."
          >
            {posQ.data && (
              <div className="space-y-3">
                <InfoGrid rows={[
                  { label: "Enlem",        value: posQ.data.latitude?.toFixed(5)  ?? "—" },
                  { label: "Boylam",       value: posQ.data.longitude?.toFixed(5) ?? "—" },
                  { label: "Hız",          value: posQ.data.speed    != null ? `${posQ.data.speed} kn`  : "—" },
                  { label: "Rota",         value: posQ.data.course   != null ? `${posQ.data.course}°`   : "—" },
                  { label: "Baş İstikameti", value: posQ.data.heading != null ? `${posQ.data.heading}°` : "—" },
                  { label: "Durum",        value: fmt(posQ.data.navigation_status) },
                  { label: "Varış Yeri",   value: fmt(posQ.data.destination) },
                  { label: "ETA",          value: fmtDate(posQ.data.eta) },
                ]} />
                {posQ.data.timestamp && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    Güncelleme: {new Date(posQ.data.timestamp).toLocaleString("tr-TR")}
                  </p>
                )}
              </div>
            )}
          </ReportCard>
        </div>

        {/* ── Row 2: Engine + Classification + Ownership ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <ReportCard
            title="Motor Bilgileri" icon={<Zap className="w-4 h-4 text-yellow-400" />}
            isLoading={engineQ.isLoading}
            error={engineQ.error as Error | null}
            isEmpty={!engineQ.data && !engineQ.isLoading && !engineQ.isError}
          >
            {engineQ.data && (
              <InfoGrid rows={[
                { label: "Motor Tipi", value: fmt(engineQ.data.engine_type    ?? engineQ.data.main_engine_type) },
                { label: "Güç (kW)",   value: fmtNum(engineQ.data.power_kw   ?? engineQ.data.engine_power) },
                { label: "Yakıt Tipi", value: fmt(engineQ.data.fuel_type) },
                { label: "Silindir",   value: fmt(engineQ.data.cylinders) },
                { label: "Üretici",    value: fmt(engineQ.data.engine_builder ?? engineQ.data.manufacturer) },
                { label: "Model",      value: fmt(engineQ.data.engine_model   ?? engineQ.data.model) },
                { label: "RPM",        value: fmt(engineQ.data.rpm) },
                { label: "Stroke",     value: fmt(engineQ.data.stroke_type) },
              ]} />
            )}
          </ReportCard>

          <ReportCard
            title="Klas Bilgileri" icon={<Shield className="w-4 h-4 text-blue-400" />}
            isLoading={classQ.isLoading}
            error={classQ.error as Error | null}
            isEmpty={!classQ.data && !classQ.isLoading && !classQ.isError}
          >
            {classQ.data && (
              <InfoGrid rows={[
                { label: "Klas Kuruluşu",   value: fmt(classQ.data.classification_society ?? classQ.data.society) },
                { label: "Notasyon",         value: fmt(classQ.data.class_notation         ?? classQ.data.notation) },
                { label: "Son Sörvey",       value: fmtDate(classQ.data.last_survey_date) },
                { label: "Sonraki Sörvey",   value: fmtDate(classQ.data.next_survey_date) },
                { label: "Sörvey Tipi",      value: fmt(classQ.data.survey_type) },
                { label: "Klas Durumu",      value: fmt(classQ.data.class_status) },
              ]} />
            )}
          </ReportCard>

          <ReportCard
            title="Sahiplik Bilgileri" icon={<Building2 className="w-4 h-4 text-green-400" />}
            isLoading={ownerQ.isLoading}
            error={ownerQ.error as Error | null}
            isEmpty={!ownerQ.data && !ownerQ.isLoading && !ownerQ.isError}
          >
            {ownerQ.data && (
              <InfoGrid rows={[
                { label: "Kayıtlı Sahip",  value: fmt(ownerQ.data.registered_owner  ?? ownerQ.data.owner) },
                { label: "İşletmeci",      value: fmt(ownerQ.data.operator) },
                { label: "Teknik Yönetici",value: fmt(ownerQ.data.technical_manager  ?? ownerQ.data.manager) },
                { label: "Donatan",        value: fmt(ownerQ.data.shipowner          ?? ownerQ.data.beneficial_owner) },
                { label: "Bayrak Devleti", value: fmt(ownerQ.data.flag               ?? ownerQ.data.flag_state) },
                { label: "Kayıt Limanı",   value: fmt(ownerQ.data.port_of_registry   ?? ownerQ.data.home_port) },
              ]} />
            )}
          </ReportCard>
        </div>

        {/* ── Row 3: PSC + Drydock + Port Calls ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <ReportCard
            title="PSC Denetimleri" icon={<ClipboardCheck className="w-4 h-4 text-orange-400" />}
            isLoading={pscQ.isLoading}
            error={pscQ.error as Error | null}
            isEmpty={Array.isArray(pscQ.data) && pscQ.data.length === 0}
            emptyText="PSC denetimi geçmişi yok."
          >
            {Array.isArray(pscQ.data) && pscQ.data.length > 0 && (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {pscQ.data.slice(0, 12).map((insp: any, i: number) => (
                  <div key={i} className="flex items-start justify-between gap-2 pb-2 border-b border-border/40 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{insp.port_name ?? insp.port ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{insp.inspection_type ?? insp.authority ?? ""}</p>
                      {insp.deficiencies != null && (
                        <span className={`text-[10px] font-medium ${insp.deficiencies > 0 ? "text-red-400" : "text-green-400"}`}>
                          {insp.deficiencies > 0 ? `⚠ ${insp.deficiencies} eksiklik` : "✓ Temiz"}
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground">{fmtDate(insp.inspection_date)}</p>
                      {insp.detained && <span className="text-[10px] text-red-400 font-bold">GÖZALTI</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ReportCard>

          <ReportCard
            title="Havuz Geçmişi" icon={<Anchor className="w-4 h-4 text-cyan-400" />}
            isLoading={drydockQ.isLoading}
            error={drydockQ.error as Error | null}
            isEmpty={Array.isArray(drydockQ.data) && drydockQ.data.length === 0}
            emptyText="Havuz geçmişi bulunamadı."
          >
            {Array.isArray(drydockQ.data) && drydockQ.data.length > 0 && (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {drydockQ.data.map((dd: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-2 pb-2 border-b border-border/40 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{dd.shipyard ?? dd.yard_name ?? `Havuz #${i + 1}`}</p>
                      <p className="text-[10px] text-muted-foreground">{dd.country ?? dd.location ?? ""}</p>
                    </div>
                    <div className="text-right shrink-0 text-[10px] text-muted-foreground">
                      {(dd.in_date  ?? dd.start_date) && <p>▶ {fmtDate(dd.in_date  ?? dd.start_date)}</p>}
                      {(dd.out_date ?? dd.end_date)   && <p>◀ {fmtDate(dd.out_date ?? dd.end_date)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ReportCard>

          <ReportCard
            title="Liman Çağrıları" icon={<MapPin className="w-4 h-4 text-primary" />}
            isLoading={portCallsQ.isLoading}
            error={portCallsQ.error as Error | null}
            isEmpty={Array.isArray(portCallsQ.data) && portCallsQ.data.length === 0}
            emptyText="Liman çağrısı geçmişi yok."
          >
            {Array.isArray(portCallsQ.data) && portCallsQ.data.length > 0 && (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {portCallsQ.data.slice(0, 15).map((call: any, i: number) => (
                  <div key={i} className="flex items-start justify-between gap-2 pb-2 border-b border-border/40 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{call.port_name ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {call.country ?? ""}
                        {call.locode ? ` (${call.locode})` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0 text-[10px]">
                      {call.arrival   && <p className="text-green-400">▶ {fmtDate(call.arrival)}</p>}
                      {call.departure && <p className="text-red-400">◀ {fmtDate(call.departure)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ReportCard>
        </div>

        {/* ── Row 4: Casualties (full width) ── */}
        <ReportCard
          title="Kaza Geçmişi" icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
          isLoading={casualtiesQ.isLoading}
          error={casualtiesQ.error as Error | null}
          isEmpty={Array.isArray(casualtiesQ.data) && casualtiesQ.data.length === 0}
          emptyText="Kayıtlı kaza geçmişi bulunamadı."
        >
          {Array.isArray(casualtiesQ.data) && casualtiesQ.data.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {casualtiesQ.data.map((cas: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/15">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-red-300 truncate">{cas.casualty_type ?? cas.type ?? `Kaza #${i + 1}`}</p>
                      {cas.severity && (
                        <span className={`text-[10px] font-medium shrink-0 ${cas.severity === "Very Serious" || cas.severity === "Total Loss" ? "text-red-400" : "text-orange-400"}`}>
                          {cas.severity}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{cas.location ?? cas.area ?? ""} {cas.date ? `• ${fmtDate(cas.date)}` : ""}</p>
                    {cas.description && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{cas.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ReportCard>

        {/* ── Row 5: External Sources ── */}
        <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/40 bg-muted/20">
            <Globe className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-wide">Harici Kaynaklar</h3>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Datalastic'te bulunamayan bilgiler için aşağıdaki kaynaklara başvurabilirsiniz.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: "MarineTraffic",
                  href: `https://www.marinetraffic.com/en/ais/details/ships/imo:${imo}`,
                  color: "border-blue-500/30 text-blue-400 hover:bg-blue-500/10",
                },
                {
                  label: "VesselFinder",
                  href: `https://www.vesselfinder.com/?imo=${imo}`,
                  color: "border-green-500/30 text-green-400 hover:bg-green-500/10",
                },
                {
                  label: "Equasis (PSC)",
                  href: `https://www.equasis.org/EquasisWeb/restricted/Search?P_PAGE=ShipResult&P_IMO=${imo}`,
                  color: "border-orange-500/30 text-orange-400 hover:bg-orange-500/10",
                },
                {
                  label: "ITF Seafarers",
                  href: `https://www.itfglobal.org/en/sector/seafarers/flags-of-convenience/`,
                  color: "border-violet-500/30 text-violet-400 hover:bg-violet-500/10",
                },
                {
                  label: "Lloyd's List",
                  href: `https://lloydslist.maritimeintelligence.informa.com/ship/${imo}`,
                  color: "border-slate-500/30 text-slate-400 hover:bg-slate-500/10",
                },
              ].map(({ label, href, color }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${color}`}
                  data-testid={`link-external-${label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <ExternalLink className="w-3 h-3" />
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/30">
          <span>Veriler Datalastic Maritime API'den alınmaktadır.</span>
          <span className="flex items-center gap-1"><ExternalLink className="w-3 h-3" /> IMO {imo}</span>
        </div>
      </div>
    </div>
  );
}
