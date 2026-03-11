const BASE = "https://api.datalastic.com/api/v0";

function apiKey() {
  return process.env.DATALASTIC_API_KEY || "";
}

export interface DatalasticVessel {
  uuid: string;
  name: string;
  imo: string;
  mmsi: string;
  flag: string;
  vessel_type: string;
  year_built: number | null;
  dwt: number | null;
  grt: number | null;
  nrt: number | null;
  loa: number | null;
  beam: number | null;
  call_sign: string | null;
  status: string | null;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  course: number | null;
  heading: number | null;
  destination: string | null;
  eta: string | null;
  engine_power: number | null;
  engine_type: string | null;
  classification_society: string | null;
}

export interface DatalasticPosition {
  uuid: string;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  heading: number;
  destination: string | null;
  eta: string | null;
  navigation_status: string | null;
  timestamp: string;
  port_name: string | null;
  country: string | null;
}

export interface DatalasticTrackPoint {
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  timestamp: string;
}

export interface DatalasticPortCall {
  port_name: string;
  country: string;
  locode: string | null;
  arrival: string | null;
  departure: string | null;
  terminal: string | null;
}

export interface DatalasticInspection {
  inspection_date: string;
  authority: string;
  port: string;
  country: string;
  result: string;
  detained: boolean;
  deficiencies_count: number;
  deficiencies: { code: string; text: string; action: string }[];
}

export interface DatalasticPort {
  uuid: string;
  name: string;
  country: string;
  locode: string | null;
  latitude: number | null;
  longitude: number | null;
}

function normalizeVessel(d: any): DatalasticVessel {
  return {
    uuid: d.uuid ?? "",
    name: d.name ?? "",
    imo: d.imo ? String(d.imo) : "",
    mmsi: d.mmsi ? String(d.mmsi) : "",
    flag: d.flag ?? d.country_iso ?? d.country ?? "",
    vessel_type: d.vessel_type ?? d.type ?? d.type_specific ?? "",
    year_built: d.year_built ?? d.built ?? null,
    dwt: d.dwt ?? d.deadweight ?? null,
    grt: d.grt ?? d.gross_tonnage ?? null,
    nrt: d.nrt ?? d.net_tonnage ?? null,
    loa: d.loa ?? d.length ?? null,
    beam: d.beam ?? d.width ?? null,
    call_sign: d.call_sign ?? d.callsign ?? null,
    status: d.navigation_status ?? d.status ?? null,
    latitude: d.latitude ?? d.lat ?? null,
    longitude: d.longitude ?? d.lon ?? null,
    speed: d.speed ?? null,
    course: d.course ?? null,
    heading: d.heading ?? null,
    destination: d.destination ?? null,
    eta: d.eta_UTC ?? d.eta ?? null,
    engine_power: d.engine_power ?? null,
    engine_type: d.engine_type ?? null,
    classification_society: d.classification_society ?? null,
  };
}

async function datalasticFetch(path: string): Promise<any> {
  const key = apiKey();
  if (!key) throw new Error("DATALASTIC_API_KEY not configured");

  try {
    const { pool } = await import("./db");
    await pool.query(
      "INSERT INTO audit_logs (action, entity_type, details) VALUES ('api_call', 'datalastic', $1)",
      [JSON.stringify({ path })]
    );
  } catch {}

  const separator = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${separator}api-key=${key}`;

  console.log(`[datalastic] Fetching: ${BASE}${path} (key hidden)`);

  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "VesselPDA/1.0",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[datalastic] API error ${res.status}: ${text.slice(0, 300)}`);
    throw new Error(`Datalastic API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  if (json?.meta?.success === false) {
    console.error(`[datalastic] API returned error: ${json?.meta?.message}`);
    throw new Error(`Datalastic API: ${json?.meta?.message || "Unknown error"}`);
  }
  return json;
}

export async function getDatalasticUsage() {
  try {
    const { pool } = await import("./db");
    const result = await pool.query(
      "SELECT COUNT(*)::int as cnt FROM audit_logs WHERE entity_type = 'datalastic' AND created_at > date_trunc('month', NOW())"
    );
    const monthlyUsage = result.rows[0]?.cnt ?? 0;
    return { monthlyUsage, limit: 20000, remaining: Math.max(0, 20000 - monthlyUsage) };
  } catch {
    return { monthlyUsage: 0, limit: 20000, remaining: 20000 };
  }
}

export async function findVessel(
  query: string,
  type: "name" | "imo" | "mmsi" = "name"
): Promise<DatalasticVessel[]> {
  const json = await datalasticFetch(`/vessel?${type}=${encodeURIComponent(query)}`);
  const raw = json?.data ?? json?.vessel ?? [];
  const arr = Array.isArray(raw) ? raw : [raw].filter(Boolean);
  return arr.map(normalizeVessel);
}

export async function getVesselByUuid(uuid: string): Promise<DatalasticVessel | null> {
  const json = await datalasticFetch(`/vessel_info?uuid=${encodeURIComponent(uuid)}`);
  const raw = json?.data ?? json?.vessel ?? null;
  return raw ? normalizeVessel(raw) : null;
}

export async function getCurrentPosition(
  identifier: string,
  type: "uuid" | "imo" | "mmsi" = "uuid"
): Promise<DatalasticPosition | null> {
  try {
    const json = await datalasticFetch(`/vessel_pro?${type}=${encodeURIComponent(identifier)}`);
    const d = json?.data;
    if (!d) return null;
    // vessel_pro alanlarını DatalasticPosition alanlarına normalize et
    return {
      uuid:              d.uuid              ?? "",
      latitude:          d.latitude          ?? d.lat        ?? 0,
      longitude:         d.longitude         ?? d.lon        ?? 0,
      speed:             d.speed             ?? 0,
      course:            d.course            ?? 0,
      heading:           d.heading           ?? 0,
      destination:       d.destination       ?? null,
      eta:               d.eta_UTC           ?? d.eta        ?? null,
      navigation_status: d.navigation_status ?? d.status     ?? null,
      timestamp:         d.last_position_UTC ?? d.timestamp  ?? new Date().toISOString(),
      port_name:         d.port_name         ?? d.dep_port   ?? null,
      country:           d.country_name      ?? d.country    ?? null,
    };
  } catch (err: any) {
    console.warn("[datalastic] getCurrentPosition error:", err?.message);
    return null;
  }
}

export async function getHistoricalTrack(
  identifier: string,
  type: "uuid" | "imo" | "mmsi" = "uuid",
  days: number = 7
): Promise<DatalasticTrackPoint[]> {
  try {
    const json = await datalasticFetch(`/vessel_history?${type}=${encodeURIComponent(identifier)}&days=${days}`);
    const data = json?.data ?? json?.track ?? [];
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.warn("[datalastic] getHistoricalTrack error:", err?.message);
    return [];
  }
}

export async function getPortCalls(
  identifier: string,
  type: "uuid" | "imo" | "mmsi" = "uuid"
): Promise<DatalasticPortCall[]> {
  try {
    const json = await datalasticFetch(`/port_call?${type}=${encodeURIComponent(identifier)}`);
    const data = json?.data ?? json?.port_calls ?? [];
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.warn("[datalastic] getPortCalls error:", err?.message);
    return [];
  }
}

export async function getInspections(
  identifier: string,
  type: "uuid" | "imo" = "uuid"
): Promise<DatalasticInspection[]> {
  try {
    const json = await datalasticFetch(`/vessel_inspections?${type}=${encodeURIComponent(identifier)}`);
    const data = json?.data ?? json?.inspections ?? [];
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.warn("[datalastic] getInspections error:", err?.message);
    return [];
  }
}

export async function findPort(name: string): Promise<DatalasticPort[]> {
  try {
    const json = await datalasticFetch(`/port_find?name=${encodeURIComponent(name)}`);
    const data = json?.data ?? json?.ports ?? [];
    return Array.isArray(data) ? data : [data].filter(Boolean);
  } catch (err: any) {
    console.warn("[datalastic] findPort error:", err?.message);
    return [];
  }
}

export async function resolveUuid(
  imo?: string | null,
  mmsi?: string | null,
  name?: string | null
): Promise<string | null> {
  if (imo) {
    const results = await findVessel(imo, "imo");
    if (results.length > 0) return results[0].uuid;
  }
  if (mmsi) {
    const results = await findVessel(mmsi, "mmsi");
    if (results.length > 0) return results[0].uuid;
  }
  if (name) {
    const results = await findVessel(name, "name");
    if (results.length > 0) return results[0].uuid;
  }
  return null;
}

export function isDatalasticConfigured(): boolean {
  return !!process.env.DATALASTIC_API_KEY;
}

export async function getVesselPosition(
  params: { imo?: string; mmsi?: string }
): Promise<DatalasticVessel | null> {
  try {
    if (params.imo) {
      const results = await findVessel(params.imo, "imo");
      return results[0] ?? null;
    }
    if (params.mmsi) {
      const results = await findVessel(params.mmsi, "mmsi");
      return results[0] ?? null;
    }
    return null;
  } catch (err: any) {
    console.error("Datalastic getVesselPosition error:", err?.message);
    return null;
  }
}

export async function getVesselBulk(imoList: string[]): Promise<DatalasticVessel[]> {
  if (!apiKey()) return [];
  if (imoList.length === 0) return [];
  try {
    const joined = imoList.slice(0, 100).join(",");
    const json = await datalasticFetch(`/vessel_bulk?imo=${encodeURIComponent(joined)}`);
    const raw = json?.data ?? json?.vessels ?? [];
    const arr = Array.isArray(raw) ? raw : [raw].filter(Boolean);
    return arr.map(normalizeVessel);
  } catch (error: any) {
    console.error("Datalastic bulk error:", error.message);
    return [];
  }
}

export interface DatalasticPortVessel {
  uuid: string;
  name: string;
  imo: string;
  mmsi: string;
  flag: string;
  vessel_type: string;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  course: number | null;
  destination: string | null;
  navigation_status: string | null;
}

// ─── NEW ENDPOINT FUNCTIONS ───────────────────────────────────────────────────

export async function getVesselPositionPro(
  params: { imo?: string; mmsi?: string }
): Promise<any | null> {
  try {
    const q = params.imo ? `imo=${encodeURIComponent(params.imo)}` : params.mmsi ? `mmsi=${encodeURIComponent(params.mmsi)}` : null;
    if (!q) return null;
    const json = await datalasticFetch(`/vessel_pro?${q}`);
    return json?.data ?? null;
  } catch (err: any) { console.error("Datalastic vessel_pro error:", err?.message); return null; }
}

export async function getVesselInfo(
  params: { imo?: string; mmsi?: string }
): Promise<any | null> {
  try {
    const q = params.imo ? `imo=${encodeURIComponent(params.imo)}` : params.mmsi ? `mmsi=${encodeURIComponent(params.mmsi)}` : null;
    if (!q) return null;
    const json = await datalasticFetch(`/vessel_info?${q}`);
    return json?.data ?? null;
  } catch (err: any) { console.error("Datalastic vessel_info error:", err?.message); return null; }
}

export async function findVessels(
  params: { name?: string; type?: string; country_iso?: string }
): Promise<any[]> {
  try {
    const parts: string[] = [];
    if (params.name) parts.push(`name=${encodeURIComponent(params.name)}`);
    if (params.type) parts.push(`type=${encodeURIComponent(params.type)}`);
    if (params.country_iso) parts.push(`country_iso=${encodeURIComponent(params.country_iso)}`);
    if (!parts.length) return [];
    const json = await datalasticFetch(`/vessel_find?${parts.join("&")}`);
    const raw = json?.data ?? json?.results ?? [];
    return Array.isArray(raw) ? raw : [raw].filter(Boolean);
  } catch (err: any) { console.error("Datalastic vessel_find error:", err?.message); return []; }
}

export async function getVesselHistory(
  params: { imo?: string; mmsi?: string; days?: number }
): Promise<any[]> {
  try {
    const parts: string[] = [];
    if (params.imo) parts.push(`imo=${encodeURIComponent(params.imo)}`);
    if (params.mmsi) parts.push(`mmsi=${encodeURIComponent(params.mmsi)}`);
    if (params.days) parts.push(`days=${params.days}`);
    if (!params.imo && !params.mmsi) return [];
    const json = await datalasticFetch(`/vessel_history?${parts.join("&")}`);
    const raw = json?.data ?? json?.history ?? [];
    return Array.isArray(raw) ? raw : [];
  } catch (err: any) { console.error("Datalastic vessel_history error:", err?.message); return []; }
}

export async function getVesselsInRadius(params: {
  port_unlocode?: string; lat?: number; lon?: number; radius?: number;
}): Promise<DatalasticPortVessel[]> {
  return getVesselsInPort({
    portUnlocode: params.port_unlocode,
    lat: params.lat, lon: params.lon,
    radius: params.radius ?? 5,
  });
}

export async function findPorts(
  params: { name?: string; country_iso?: string }
): Promise<any[]> {
  try {
    const parts: string[] = [];
    if (params.name) parts.push(`name=${encodeURIComponent(params.name)}`);
    if (params.country_iso) parts.push(`country_iso=${encodeURIComponent(params.country_iso)}`);
    if (!parts.length) return [];
    const json = await datalasticFetch(`/port_find?${parts.join("&")}`);
    const raw = json?.data ?? json?.ports ?? [];
    return Array.isArray(raw) ? raw : [raw].filter(Boolean);
  } catch (err: any) { console.error("Datalastic port_find error:", err?.message); return []; }
}

export async function getVesselOwnership(params: { imo: string }): Promise<any | null> {
  try {
    const json = await datalasticFetch(`/vessel_ownership?imo=${encodeURIComponent(params.imo)}`);
    return json?.data ?? null;
  } catch (err: any) { console.error("Datalastic vessel_ownership error:", err?.message); return null; }
}

export async function getVesselInspections(params: { imo: string }): Promise<any[]> {
  try {
    const json = await datalasticFetch(`/vessel_inspections?imo=${encodeURIComponent(params.imo)}`);
    const raw = json?.data ?? json?.inspections ?? [];
    return Array.isArray(raw) ? raw : [raw].filter(Boolean);
  } catch (err: any) { console.error("Datalastic vessel_inspections error:", err?.message); return []; }
}

export async function getDryDockDates(params: { imo: string }): Promise<any[]> {
  try {
    const json = await datalasticFetch(`/drydock_dates?imo=${encodeURIComponent(params.imo)}`);
    const raw = json?.data ?? json?.drydocks ?? [];
    return Array.isArray(raw) ? raw : [raw].filter(Boolean);
  } catch (err: any) { console.error("Datalastic drydock_dates error:", err?.message); return []; }
}

export async function getClassificationData(params: { imo: string }): Promise<any | null> {
  try {
    const json = await datalasticFetch(`/classification_society?imo=${encodeURIComponent(params.imo)}`);
    return json?.data ?? null;
  } catch (err: any) { console.error("Datalastic classification_society error:", err?.message); return null; }
}

export async function getVesselEngine(params: { imo: string }): Promise<any | null> {
  try {
    const json = await datalasticFetch(`/vessel_engine?imo=${encodeURIComponent(params.imo)}`);
    return json?.data ?? null;
  } catch (err: any) { console.error("Datalastic vessel_engine error:", err?.message); return null; }
}

export async function getMaritimeCompany(
  params: { imo?: string; name?: string }
): Promise<any | null> {
  try {
    const parts: string[] = [];
    if (params.imo) parts.push(`imo=${encodeURIComponent(params.imo)}`);
    if (params.name) parts.push(`name=${encodeURIComponent(params.name)}`);
    if (!parts.length) return null;
    const json = await datalasticFetch(`/maritime_companies?${parts.join("&")}`);
    return json?.data ?? null;
  } catch (err: any) { console.error("Datalastic maritime_companies error:", err?.message); return null; }
}

export async function getShipCasualties(params: { imo: string }): Promise<any[]> {
  try {
    const json = await datalasticFetch(`/ship_casualties?imo=${encodeURIComponent(params.imo)}`);
    const raw = json?.data ?? json?.casualties ?? [];
    return Array.isArray(raw) ? raw : [raw].filter(Boolean);
  } catch (err: any) { console.error("Datalastic ship_casualties error:", err?.message); return []; }
}

export async function getRoute(params: {
  from_port?: string; to_port?: string;
  from_lat?: number; from_lon?: number; to_lat?: number; to_lon?: number;
}): Promise<any | null> {
  try {
    const key = apiKey();
    if (!key) throw new Error("DATALASTIC_API_KEY not configured");
    const parts: string[] = [`api-key=${key}`];
    if (params.from_port) parts.push(`from_port=${encodeURIComponent(params.from_port)}`);
    if (params.to_port) parts.push(`to_port=${encodeURIComponent(params.to_port)}`);
    if (params.from_lat !== undefined) parts.push(`lat_from=${params.from_lat}`);
    if (params.from_lon !== undefined) parts.push(`lon_from=${params.from_lon}`);
    if (params.to_lat !== undefined) parts.push(`lat_to=${params.to_lat}`);
    if (params.to_lon !== undefined) parts.push(`lon_to=${params.to_lon}`);
    if (parts.length <= 1) return null;
    const url = `https://api.datalastic.com/api/ext/route?${parts.join("&")}`;
    console.log(`[datalastic] Fetching route: https://api.datalastic.com/api/ext/route (key hidden)`);
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "VesselPDA/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[datalastic] Route API error ${res.status}: ${text.slice(0, 300)}`);
      throw new Error(`Datalastic route API error ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    return json?.data ?? null;
  } catch (err: any) { console.error("Datalastic route error:", err?.message); return null; }
}

export async function getShipDemolitions(params: { imo: string }): Promise<any | null> {
  try {
    const json = await datalasticFetch(`/ship_demolitions?imo=${encodeURIComponent(params.imo)}`);
    return json?.data ?? null;
  } catch (err: any) { console.error("Datalastic ship_demolitions error:", err?.message); return null; }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function getVesselsInPort(params: {
  portUnlocode?: string;
  lat?: number;
  lon?: number;
  radius?: number;
}): Promise<DatalasticPortVessel[]> {
  if (!apiKey()) return [];
  try {
    const radius = params.radius ?? 5;
    let path: string;
    if (params.portUnlocode) {
      path = `/vessel_inradius?port_unlocode=${encodeURIComponent(params.portUnlocode)}&radius=${radius}`;
    } else if (params.lat !== undefined && params.lon !== undefined) {
      path = `/vessel_inradius?lat=${params.lat}&lon=${params.lon}&radius=${radius}`;
    } else {
      throw new Error("portUnlocode veya lat/lon gerekli");
    }
    const json = await datalasticFetch(path);
    const raw = json?.data ?? json?.vessels ?? [];
    const arr = Array.isArray(raw) ? raw : [raw].filter(Boolean);
    return arr
      .filter((d: any) => d && (d.name || d.imo || d.mmsi))
      .map((d: any): DatalasticPortVessel => ({
        uuid: d.uuid ?? "",
        name: d.name ?? "",
        imo: d.imo ? String(d.imo) : "",
        mmsi: d.mmsi ? String(d.mmsi) : "",
        flag: d.flag ?? d.country_iso ?? "",
        vessel_type: d.vessel_type ?? d.type ?? d.type_specific ?? "",
        latitude: d.latitude ?? d.lat ?? null,
        longitude: d.longitude ?? d.lon ?? null,
        speed: d.speed ?? null,
        course: d.course ?? null,
        destination: d.destination ?? null,
        navigation_status: d.navigation_status ?? d.status ?? null,
      }));
  } catch (error: any) {
    console.error("Datalastic port vessels error:", error.message);
    return [];
  }
}
