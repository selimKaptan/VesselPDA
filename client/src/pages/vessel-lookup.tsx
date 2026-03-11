import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Ship, Anchor, MapPin, Navigation, Gauge, Ruler, Weight, Calendar,
  Building2, Shield, Fuel, ArrowLeft, Search, ExternalLink,
  Globe, Compass, Clock, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VesselData {
  imo: string;
  mmsi?: string;
  name?: string;
  callSign?: string;
  flag?: string;
  flagCode?: string;
  vesselType?: string;
  vesselTypeCode?: string;
  status?: string;
  grossTonnage?: number;
  netTonnage?: number;
  deadweight?: number;
  displacement?: number;
  length?: number;
  breadth?: number;
  depth?: number;
  draught?: number;
  maxDraught?: number;
  airDraught?: number;
  yearBuilt?: number;
  builder?: string;
  buildCountry?: string;
  yardNumber?: string;
  hullNumber?: string;
  mainEngine?: string;
  enginePower?: number;
  engineRpm?: number;
  propellerType?: string;
  speed?: number;
  fuelConsumption?: number;
  fuelType?: string;
  teu?: number;
  teu14?: number;
  holdCount?: number;
  hatchCount?: number;
  tankCount?: number;
  grainCapacity?: number;
  baleCapacity?: number;
  liquidCapacity?: number;
  gasCapacity?: number;
  reefer?: number;
  craneCount?: number;
  craneCapacity?: number;
  classificationSociety?: string;
  classNotation?: string;
  iceClass?: string;
  pAndIClub?: string;
  owner?: string;
  operator?: string;
  manager?: string;
  managementCompany?: string;
  beneficialOwner?: string;
  registeredOwner?: string;
  technicalManager?: string;
  commercialManager?: string;
  groupOwner?: string;
  insurancer?: string;
  lat?: number;
  lon?: number;
  course?: number;
  heading?: number;
  speedKnots?: number;
  navStatus?: string;
  destination?: string;
  eta?: string;
  lastPositionUpdate?: string;
  currentPort?: string;
  currentPortCountry?: string;
  departurePort?: string;
  departureDate?: string;
  keelLaidDate?: string;
  deliveryDate?: string;
  lastDrydock?: string;
  nextDrydock?: string;
  lastSurvey?: string;
}

type InfoRow = [string, string | number | undefined | null];

function InfoCard({ title, icon: Icon, rows }: { title: string; icon: any; rows: InfoRow[] }) {
  const filtered = rows.filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== 0);
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/30 flex items-center gap-2">
        <Icon className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="divide-y divide-slate-700/20">
        {filtered.length > 0 ? filtered.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/30">
            <span className="text-xs text-slate-500">{label}</span>
            <span className="text-sm text-slate-200 font-medium text-right max-w-[60%] truncate">{String(value)}</span>
          </div>
        )) : (
          <div className="px-4 py-6 text-center text-xs text-slate-600">No data available</div>
        )}
      </div>
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div className="text-center px-3">
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-lg font-bold text-slate-100">{value != null && value !== "" ? (typeof value === "number" ? value.toLocaleString() : value) : "—"}</div>
    </div>
  );
}

const TABS = [
  { key: "overview",       label: "Overview",               icon: Ship },
  { key: "dimensions",     label: "Dimensions & Capacity",  icon: Ruler },
  { key: "engine",         label: "Engine & Performance",   icon: Gauge },
  { key: "ownership",      label: "Ownership",              icon: Building2 },
  { key: "classification", label: "Class & Surveys",        icon: Shield },
  { key: "position",       label: "Position & AIS",         icon: MapPin },
];

export default function VesselLookup() {
  const [, params] = useRoute("/vessel-lookup/:imo");
  const [searchImo, setSearchImo] = useState(params?.imo || "");
  const [activeImo, setActiveImo] = useState(params?.imo || "");
  const [activeTab, setActiveTab] = useState("overview");

  const { data, isLoading, error } = useQuery<{ vessel: VesselData; history: any }>({
    queryKey: ["/api/v1/vessel-lookup", activeImo],
    enabled: !!activeImo && activeImo.length === 7,
  });

  const v = data?.vessel;

  function handleSearch() {
    const cleaned = searchImo.replace(/\D/g, "").slice(0, 7);
    if (cleaned.length === 7) {
      setActiveImo(cleaned);
      window.history.replaceState(null, "", `/vessel-lookup/${cleaned}`);
    }
  }

  const navStatusColor = (s?: string) => {
    if (!s) return "bg-slate-800 text-slate-400 border-slate-700";
    const l = s.toLowerCase();
    if (l.includes("moored") || l.includes("at anchor")) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (l.includes("under way") || l.includes("underway")) return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (l.includes("not under")) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return "bg-slate-800 text-slate-400 border-slate-700";
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Search header */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center gap-3 mb-5">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()} data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            Vessel Intelligence
          </h1>
        </div>

        <div className="flex items-center gap-3 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              data-testid="input-imo"
              value={searchImo}
              onChange={(e) => setSearchImo(e.target.value.replace(/\D/g, "").slice(0, 7))}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="IMO number (7 digits)"
              className="pl-10 h-10"
            />
          </div>
          <Button
            data-testid="button-search-vessel"
            onClick={handleSearch}
            disabled={searchImo.length !== 7}
            className="h-10 px-5"
          >
            Search
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center py-24">
          <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
          <p className="text-sm text-slate-400">Fetching vessel data from Datalastic…</p>
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="max-w-sm mx-auto text-center py-24">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <p className="text-slate-300 font-medium mb-1">Vessel not found</p>
          <p className="text-xs text-slate-500">Check the IMO number and try again</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && !v && !activeImo && (
        <div className="max-w-sm mx-auto text-center py-24">
          <Ship className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium mb-1">Enter an IMO number</p>
          <p className="text-xs text-slate-600">Search any vessel by its 7-digit IMO number</p>
        </div>
      )}

      {/* Vessel profile */}
      {v && (
        <div className="max-w-6xl mx-auto space-y-5">
          {/* Hero */}
          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5">
            <div className="flex flex-col md:flex-row md:items-start gap-5">
              {/* Left: identity */}
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Ship className="w-7 h-7 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-foreground truncate" data-testid="text-vessel-name">
                    {v.name || "Unknown Vessel"}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-muted-foreground">
                    <span>IMO: <span className="text-slate-300 font-medium">{v.imo}</span></span>
                    {v.mmsi && <><span>·</span><span>MMSI: <span className="text-slate-300">{v.mmsi}</span></span></>}
                    {v.callSign && <><span>·</span><span>Call Sign: <span className="text-slate-300">{v.callSign}</span></span></>}
                    {v.flag && <><span>·</span><span>{v.flag}{v.flagCode ? ` (${v.flagCode})` : ""}</span></>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {v.vesselType && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        {v.vesselType}
                      </span>
                    )}
                    {(v.navStatus || v.status) && (
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border", navStatusColor(v.navStatus || v.status))}>
                        {v.navStatus || v.status}
                      </span>
                    )}
                    {v.destination && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Navigation className="w-3 h-3" /> {v.destination}
                      </span>
                    )}
                    {v.currentPort && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {v.currentPort}{v.currentPortCountry ? `, ${v.currentPortCountry}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: key metrics */}
              <div className="flex items-center gap-1 divide-x divide-slate-700/50 border border-slate-700/40 rounded-xl bg-slate-800/40 px-2 py-3 flex-shrink-0">
                <StatBadge label="DWT" value={v.deadweight} />
                <StatBadge label="GT" value={v.grossTonnage} />
                <StatBadge label="LOA (m)" value={v.length} />
                <StatBadge label="Built" value={v.yearBuilt} />
                {v.speed && <StatBadge label="Speed (kn)" value={v.speed} />}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1 border-b border-slate-700/30">
            {TABS.map(tab => (
              <button
                key={tab.key}
                data-testid={`tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors",
                  activeTab === tab.key
                    ? "bg-slate-800/60 text-white border-b-2 border-blue-400"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {activeTab === "overview" && (
              <>
                <InfoCard title="General Information" icon={Ship} rows={[
                  ["IMO Number", v.imo],
                  ["MMSI", v.mmsi],
                  ["Vessel Name", v.name],
                  ["Call Sign", v.callSign],
                  ["Flag", v.flag],
                  ["Flag Code", v.flagCode],
                  ["Vessel Type", v.vesselType],
                  ["Type Code", v.vesselTypeCode],
                  ["Status", v.status],
                  ["Nav Status", v.navStatus],
                ]} />
                <InfoCard title="Construction" icon={Calendar} rows={[
                  ["Year Built", v.yearBuilt],
                  ["Builder", v.builder],
                  ["Build Country", v.buildCountry],
                  ["Yard Number", v.yardNumber],
                  ["Hull Number", v.hullNumber],
                  ["Keel Laid", v.keelLaidDate],
                  ["Delivery Date", v.deliveryDate],
                ]} />
              </>
            )}

            {activeTab === "dimensions" && (
              <>
                <InfoCard title="Tonnage & Dimensions" icon={Ruler} rows={[
                  ["Gross Tonnage (GT)", v.grossTonnage?.toLocaleString()],
                  ["Net Tonnage (NT)", v.netTonnage?.toLocaleString()],
                  ["Deadweight (DWT)", v.deadweight?.toLocaleString()],
                  ["Displacement", v.displacement?.toLocaleString()],
                  ["Length Overall (m)", v.length],
                  ["Breadth (m)", v.breadth],
                  ["Depth (m)", v.depth],
                  ["Draught (m)", v.draught],
                  ["Max Draught (m)", v.maxDraught],
                  ["Air Draught (m)", v.airDraught],
                ]} />
                <InfoCard title="Cargo Capacity" icon={Weight} rows={[
                  ["TEU", v.teu?.toLocaleString()],
                  ["TEU 14t", v.teu14?.toLocaleString()],
                  ["Hold Count", v.holdCount],
                  ["Hatch Count", v.hatchCount],
                  ["Tank Count", v.tankCount],
                  ["Grain Capacity (m³)", v.grainCapacity?.toLocaleString()],
                  ["Bale Capacity (m³)", v.baleCapacity?.toLocaleString()],
                  ["Liquid Capacity (m³)", v.liquidCapacity?.toLocaleString()],
                  ["Gas Capacity (m³)", v.gasCapacity?.toLocaleString()],
                  ["Reefer Plugs", v.reefer],
                  ["Crane Count", v.craneCount],
                  ["Crane Capacity (t)", v.craneCapacity],
                ]} />
              </>
            )}

            {activeTab === "engine" && (
              <>
                <InfoCard title="Main Engine & Propulsion" icon={Gauge} rows={[
                  ["Main Engine", v.mainEngine],
                  ["Engine Power (kW)", v.enginePower?.toLocaleString()],
                  ["Engine RPM", v.engineRpm],
                  ["Propeller Type", v.propellerType],
                  ["Fuel Type", v.fuelType],
                ]} />
                <InfoCard title="Performance" icon={Navigation} rows={[
                  ["Service Speed (kn)", v.speed],
                  ["Current Speed (kn)", v.speedKnots],
                  ["Fuel Consumption (t/day)", v.fuelConsumption],
                ]} />
              </>
            )}

            {activeTab === "ownership" && (
              <>
                <InfoCard title="Ownership" icon={Building2} rows={[
                  ["Registered Owner", v.registeredOwner],
                  ["Beneficial Owner", v.beneficialOwner],
                  ["Group Owner", v.groupOwner],
                  ["Owner", v.owner],
                ]} />
                <InfoCard title="Management" icon={Globe} rows={[
                  ["Operator", v.operator],
                  ["Manager", v.manager],
                  ["Management Company", v.managementCompany],
                  ["Technical Manager", v.technicalManager],
                  ["Commercial Manager", v.commercialManager],
                  ["Insurer", v.insurancer],
                ]} />
              </>
            )}

            {activeTab === "classification" && (
              <>
                <InfoCard title="Classification" icon={Shield} rows={[
                  ["Classification Society", v.classificationSociety],
                  ["Class Notation", v.classNotation],
                  ["Ice Class", v.iceClass],
                  ["P&I Club", v.pAndIClub],
                ]} />
                <InfoCard title="Survey Dates" icon={Clock} rows={[
                  ["Last Survey", v.lastSurvey],
                  ["Last Drydock", v.lastDrydock],
                  ["Next Drydock", v.nextDrydock],
                ]} />
              </>
            )}

            {activeTab === "position" && (
              <>
                <InfoCard title="Current Position" icon={MapPin} rows={[
                  ["Latitude", v.lat],
                  ["Longitude", v.lon],
                  ["Course (°)", v.course],
                  ["Heading (°)", v.heading],
                  ["Speed (kn)", v.speedKnots],
                  ["Last Updated (UTC)", v.lastPositionUpdate],
                ]} />
                <InfoCard title="Voyage Info" icon={Compass} rows={[
                  ["Nav Status", v.navStatus],
                  ["Current Port", v.currentPort],
                  ["Current Port Country", v.currentPortCountry],
                  ["Destination", v.destination],
                  ["ETA", v.eta],
                  ["Departure Port", v.departurePort],
                  ["Departure Date", v.departureDate],
                ]} />
              </>
            )}
          </div>

          {/* Position map link */}
          {activeTab === "position" && v.lat && v.lon && (
            <a
              href={`https://www.marinetraffic.com/en/ais/home/shipid:${v.imo}/zoom:9`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View on MarineTraffic
            </a>
          )}

          {/* Port history (overview tab) */}
          {activeTab === "overview" && data?.history && Array.isArray(data.history) && data.history.length > 0 && (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/30 flex items-center gap-2">
                <Anchor className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold">Port History</h3>
                <span className="text-xs text-slate-600 ml-auto">{data.history.length} records</span>
              </div>
              <div className="divide-y divide-slate-700/20 max-h-64 overflow-y-auto">
                {data.history.slice(0, 20).map((h: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/30">
                    <div>
                      <p className="text-sm text-slate-200 font-medium">{h.port_name || h.port || "—"}</p>
                      <p className="text-xs text-slate-500">{h.country || ""}</p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <p>{h.arrival_date || h.date || ""}</p>
                      {h.departure_date && <p>{h.departure_date}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
