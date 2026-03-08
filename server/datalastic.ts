const BASE = "https://app.datalastic.com/api/v0";

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

async function datalasticFetch(path: string): Promise<any> {
  const key = apiKey();
  if (!key) throw new Error("DATALASTIC_API_KEY not configured");

  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Datalastic API error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

export async function findVessel(
  query: string,
  type: "name" | "imo" | "mmsi" = "name"
): Promise<DatalasticVessel[]> {
  const json = await datalasticFetch(`/vessel?${type}=${encodeURIComponent(query)}`);
  const data = json?.data ?? json?.vessel ?? [];
  return Array.isArray(data) ? data : [data].filter(Boolean);
}

export async function getVesselByUuid(uuid: string): Promise<DatalasticVessel | null> {
  const json = await datalasticFetch(`/vessel_uuid/${uuid}`);
  return json?.data ?? json?.vessel ?? null;
}

export async function getCurrentPosition(uuid: string): Promise<DatalasticPosition | null> {
  const json = await datalasticFetch(`/vessel_current_data/${uuid}`);
  return json?.data ?? null;
}

export async function getHistoricalTrack(uuid: string): Promise<DatalasticTrackPoint[]> {
  const json = await datalasticFetch(`/vessel_track/${uuid}`);
  const data = json?.data ?? json?.track ?? [];
  return Array.isArray(data) ? data : [];
}

export async function getPortCalls(uuid: string): Promise<DatalasticPortCall[]> {
  const json = await datalasticFetch(`/port_call/${uuid}`);
  const data = json?.data ?? json?.port_calls ?? [];
  return Array.isArray(data) ? data : [];
}

export async function getInspections(uuid: string): Promise<DatalasticInspection[]> {
  const json = await datalasticFetch(`/inspections/${uuid}`);
  const data = json?.data ?? json?.inspections ?? [];
  return Array.isArray(data) ? data : [];
}

export async function findPort(name: string): Promise<DatalasticPort[]> {
  const json = await datalasticFetch(`/port?name=${encodeURIComponent(name)}`);
  const data = json?.data ?? json?.ports ?? [];
  return Array.isArray(data) ? data : [data].filter(Boolean);
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
