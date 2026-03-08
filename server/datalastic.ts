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

  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Authorization": `Bearer ${key}` },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Datalastic API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  if (json?.meta?.success === false) {
    throw new Error(`Datalastic API: ${json?.meta?.message || "Unknown error"}`);
  }
  return json;
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
  const json = await datalasticFetch(`/vessel_uuid/${uuid}`);
  const raw = json?.data ?? json?.vessel ?? null;
  return raw ? normalizeVessel(raw) : null;
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
