import WebSocket from "ws";
import { pool } from "./db";

export interface VesselPosition {
  mmsi: string;
  imo?: string;
  name: string;
  flag: string;
  vesselType: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  destination: string;
  eta: string | null;
  status: "underway" | "anchored" | "moored";
  lastUpdated: Date;
}

const vesselCache = new Map<string, VesselPosition>();
let wsConnected = false;
let dataSource: "live" | "mock" = "mock";
let mockInterval: ReturnType<typeof setInterval> | null = null;

// ── AIS Position Persistence ────────────────────────────────────────────────
const watchlistMmsiSet = new Set<string>();
const lastSavedAt = new Map<string, number>();
const SAVE_INTERVAL_MS = 5 * 60 * 1000;

async function refreshWatchlist() {
  try {
    const res = await pool.query("SELECT mmsi FROM vessel_watchlist WHERE mmsi IS NOT NULL AND mmsi <> ''");
    watchlistMmsiSet.clear();
    for (const row of res.rows) watchlistMmsiSet.add(row.mmsi);
  } catch (err: any) {
    console.error("AISStream: failed to refresh watchlist", err?.message);
  }
}

async function maybeSavePosition(pos: VesselPosition) {
  if (!pos.mmsi || !watchlistMmsiSet.has(pos.mmsi)) return;
  const now = Date.now();
  const last = lastSavedAt.get(pos.mmsi) || 0;
  if (now - last < SAVE_INTERVAL_MS) return;
  lastSavedAt.set(pos.mmsi, now);
  try {
    const watchlistRow = await pool.query(
      "SELECT id FROM vessel_watchlist WHERE mmsi = $1 LIMIT 1",
      [pos.mmsi]
    );
    const watchlistItemId = watchlistRow.rows[0]?.id ?? null;
    await pool.query(
      `INSERT INTO vessel_positions
        (watchlist_item_id, mmsi, imo, vessel_name, latitude, longitude,
         speed, course, heading, navigation_status, destination)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        watchlistItemId,
        pos.mmsi, pos.imo ?? null, pos.name ?? null,
        pos.lat, pos.lng,
        pos.speed ?? null, null, pos.heading ?? null,
        pos.status ?? null, pos.destination ?? null,
      ]
    );
  } catch (err: any) {
    console.error("AISStream: failed to save position for", pos.mmsi, err?.message);
  }
}

// ── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_AIS_DATA: VesselPosition[] = [
  { mmsi: "271000001", name: "BARBAROS BEY",      flag: "Turkey",          vesselType: "General Cargo",  lat: 41.02, lng: 28.97, heading: 45,  speed: 8.2,  destination: "ISTANBUL",   eta: null, status: "underway",  lastUpdated: new Date() },
  { mmsi: "271000002", name: "MARMARA STAR",       flag: "Turkey",          vesselType: "Tanker",          lat: 40.98, lng: 28.84, heading: 270, speed: 6.5,  destination: "IZMIR",      eta: null, status: "underway",  lastUpdated: new Date() },
  { mmsi: "370000001", name: "PACIFIC GLORY",      flag: "Panama",          vesselType: "Bulk Carrier",    lat: 41.15, lng: 29.10, heading: 180, speed: 10.1, destination: "ODESSA",     eta: null, status: "underway",  lastUpdated: new Date() },
  { mmsi: "538000001", name: "MARSHALL PRIDE",     flag: "Marshall Islands",vesselType: "General Cargo",  lat: 40.72, lng: 29.92, heading: 90,  speed: 7.8,  destination: "TEKIRDAG",   eta: null, status: "underway",  lastUpdated: new Date() },
  { mmsi: "239000001", name: "AEGEAN HAWK",        flag: "Greece",          vesselType: "Tanker",          lat: 38.43, lng: 26.83, heading: 315, speed: 9.0,  destination: "PIRAEUS",    eta: null, status: "underway",  lastUpdated: new Date() },
  { mmsi: "271000003", name: "KARADENIZ EXPRESS",  flag: "Turkey",          vesselType: "RoRo",            lat: 41.22, lng: 36.11, heading: 60,  speed: 14.2, destination: "SAMSUN",     eta: null, status: "underway",  lastUpdated: new Date() },
  { mmsi: "248000001", name: "VALLETTA BRIDGE",    flag: "Malta",           vesselType: "Container",       lat: 36.87, lng: 30.63, heading: 200, speed: 11.5, destination: "ANTALYA",    eta: null, status: "underway",  lastUpdated: new Date() },
  { mmsi: "271000004", name: "BOSPHORUS SPIRIT",   flag: "Turkey",          vesselType: "LPG Carrier",     lat: 41.05, lng: 29.02, heading: 0,   speed: 0,    destination: "HAYDARPASA", eta: null, status: "moored",    lastUpdated: new Date() },
  { mmsi: "636000001", name: "LIBERIA VENTURE",    flag: "Liberia",         vesselType: "Bulk Carrier",    lat: 37.02, lng: 27.44, heading: 135, speed: 8.6,  destination: "MARMARIS",   eta: null, status: "underway",  lastUpdated: new Date() },
  { mmsi: "229000001", name: "MALTA MERCHANT",     flag: "Malta",           vesselType: "General Cargo",  lat: 37.88, lng: 27.85, heading: 270, speed: 5.2,  destination: "KUSADASI",   eta: null, status: "anchored",  lastUpdated: new Date() },
  { mmsi: "271000005", name: "EGE DENIZ",          flag: "Turkey",          vesselType: "Chemical Tanker", lat: 38.90, lng: 26.50, heading: 90,  speed: 7.1,  destination: "ALIAGA",     eta: null, status: "underway",  lastUpdated: new Date() },
  { mmsi: "255000001", name: "MADEIRA SUN",        flag: "Portugal",        vesselType: "Tanker",          lat: 41.32, lng: 31.72, heading: 225, speed: 9.4,  destination: "ZONGULDAK",  eta: null, status: "underway",  lastUpdated: new Date() },
  { mmsi: "271000006", name: "TRABZON PEARL",      flag: "Turkey",          vesselType: "Bulk Carrier",    lat: 41.00, lng: 39.72, heading: 45,  speed: 6.8,  destination: "TRABZON",    eta: null, status: "underway",  lastUpdated: new Date() },
  { mmsi: "247000001", name: "ADRIATIC ROSE",      flag: "Italy",           vesselType: "RoRo",            lat: 37.93, lng: 23.63, heading: 90,  speed: 13.0, destination: "ISTANBUL",   eta: null, status: "underway",  lastUpdated: new Date() },
  { mmsi: "212000001", name: "LIMASSOL TRADER",    flag: "Cyprus",          vesselType: "General Cargo",  lat: 36.55, lng: 33.01, heading: 315, speed: 7.5,  destination: "MERSIN",     eta: null, status: "underway",  lastUpdated: new Date() },
];

// Base positions for mock drift calculation (never mutate these)
const MOCK_BASE = MOCK_AIS_DATA.map(v => ({ lat: v.lat, lng: v.lng, speed: v.speed }));

function useMockData() {
  if (mockInterval) return; // already running

  // Seed cache immediately
  MOCK_AIS_DATA.forEach((v, i) => {
    vesselCache.set(v.mmsi, { ...v, lastUpdated: new Date() });
    MOCK_BASE[i] = { lat: v.lat, lng: v.lng, speed: v.speed };
  });
  console.log(`AISStream: demo mode — seeded ${MOCK_AIS_DATA.length} mock vessels`);

  // Drift positions every 30 s so the map shows subtle movement
  mockInterval = setInterval(() => {
    MOCK_AIS_DATA.forEach((vessel, i) => {
      const base = MOCK_BASE[i];
      const existing = vesselCache.get(vessel.mmsi);
      if (!existing) return;

      // Small random drift clamped to Turkish waters box
      const newLat = Math.max(35.0, Math.min(42.5, existing.lat + (Math.random() - 0.5) * 0.008));
      const newLng = Math.max(25.0, Math.min(45.0, existing.lng + (Math.random() - 0.5) * 0.008));
      const newSpeed = existing.status === "moored" || existing.status === "anchored"
        ? 0
        : Math.max(0, Math.min(20, base.speed + (Math.random() - 0.5) * 1.5));

      vesselCache.set(vessel.mmsi, {
        ...existing,
        lat: parseFloat(newLat.toFixed(5)),
        lng: parseFloat(newLng.toFixed(5)),
        speed: parseFloat(newSpeed.toFixed(1)),
        lastUpdated: new Date(),
      });
    });
  }, 30_000);
}

// ── WebSocket helpers ────────────────────────────────────────────────────────
let wsInstance: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;
let reconnectDelay = 5_000;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let pongTimeout: ReturnType<typeof setTimeout> | null = null;

const TURKEY_BBOX = [[[35.0, 25.0], [42.5, 45.0]]];

function navStatusToString(code: number): "underway" | "anchored" | "moored" {
  if (code === 1) return "anchored";
  if (code === 5) return "moored";
  return "underway";
}

function mmsiToFlag(mmsi: string): string {
  const mid = mmsi.substring(0, 3);
  const flagMap: Record<string, string> = {
    "271": "Turkey",   "212": "Cyprus",  "229": "Malta",   "239": "Greece",
    "255": "Portugal", "248": "Malta",   "236": "Gibraltar","244": "Netherlands",
    "247": "Italy",    "257": "Norway",  "265": "Sweden",  "230": "Finland",
    "232": "United Kingdom", "233": "United Kingdom", "235": "United Kingdom",
    "240": "Greece",   "241": "Greece",  "242": "Greece",
    "338": "United States",  "370": "Panama",   "372": "Panama",
    "373": "Panama",   "374": "Panama",  "376": "Panama",  "378": "Panama",
    "351": "Panama",   "352": "Panama",  "353": "Panama",  "354": "Panama",
    "355": "Panama",   "356": "Panama",  "357": "Panama",
    "432": "Japan",    "440": "South Korea", "441": "South Korea",
    "477": "Hong Kong","525": "Indonesia","538": "Marshall Islands",
    "548": "Philippines","563": "Singapore","566": "Singapore",
    "574": "Vietnam",  "636": "Liberia", "667": "Sierra Leone","710": "Brazil",
  };
  return flagMap[mid] || "Unknown";
}

function vesselTypeCodeToString(code: number): string {
  if (code >= 70 && code < 80) return "General Cargo";
  if (code >= 80 && code < 90) return "Tanker";
  if (code === 84) return "LPG Carrier";
  if (code === 85) return "LNG Carrier";
  if (code === 89) return "Chemical Tanker";
  if (code >= 60 && code < 70) return "Passenger";
  if (code >= 30 && code < 40) return "Fishing";
  if (code === 35) return "Military";
  if (code === 36) return "Sailing";
  if (code === 37) return "Pleasure Craft";
  if (code >= 40 && code < 50) return "High Speed";
  if (code === 51) return "SAR";
  if (code === 52) return "Tug";
  if (code === 54) return "Anti-Pollution";
  if (code === 55) return "Law Enforcement";
  if (code === 58) return "Medical";
  if (code === 59) return "RoRo";
  return "General Cargo";
}

function trimCache() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  let removed = 0;
  for (const [mmsi, pos] of Array.from(vesselCache.entries())) {
    if (pos.lastUpdated < cutoff) { vesselCache.delete(mmsi); removed++; }
  }
  if (removed > 0) console.log(`AISStream: trimmed ${removed} stale vessel(s), ${vesselCache.size} remaining`);
}

function handleMessage(raw: string) {
  try {
    const msg = JSON.parse(raw);
    const type: string = msg.MessageType;
    const meta = msg.MetaData || {};
    const mmsi = String(meta.MMSI || "");
    if (!mmsi) return;

    if (type === "PositionReport" || type === "StandardClassBPositionReport" || type === "ExtendedClassBPositionReport") {
      const report = msg.Message?.PositionReport || msg.Message?.StandardClassBPositionReport || msg.Message?.ExtendedClassBPositionReport || {};
      const lat = meta.latitude ?? report.Latitude;
      const lng = meta.longitude ?? report.Longitude;
      if (lat == null || lng == null) return;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return;

      const existing = vesselCache.get(mmsi);
      const updated: VesselPosition = {
        mmsi,
        name: (meta.ShipName || existing?.name || "").trim() || `MMSI ${mmsi}`,
        flag: existing?.flag || mmsiToFlag(mmsi),
        vesselType: existing?.vesselType || "General Cargo",
        lat: parseFloat(lat.toFixed(5)),
        lng: parseFloat(lng.toFixed(5)),
        heading: report.TrueHeading ?? report.Cog ?? existing?.heading ?? 0,
        speed: report.Sog ?? existing?.speed ?? 0,
        destination: existing?.destination || "",
        eta: existing?.eta || null,
        status: navStatusToString(report.NavigationalStatus ?? 0),
        lastUpdated: new Date(),
      };
      vesselCache.set(mmsi, updated);
      maybeSavePosition(updated).catch(() => {});
    } else if (type === "ShipStaticData") {
      const data = msg.Message?.ShipStaticData || {};
      const existing = vesselCache.get(mmsi);
      if (existing) {
        existing.name = (data.Name || meta.ShipName || existing.name || "").trim() || existing.name;
        existing.destination = (data.Destination || existing.destination || "").trim();
        if (data.ImoNumber) existing.imo = String(data.ImoNumber);
        if (data.TypeOfShipAndCargoType) existing.vesselType = vesselTypeCodeToString(data.TypeOfShipAndCargoType);
        if (data.Eta) {
          const { Month, Day, Hour, Minute } = data.Eta;
          if (Month && Day) {
            const year = new Date().getFullYear();
            existing.eta = `${year}-${String(Month).padStart(2, "0")}-${String(Day).padStart(2, "0")}T${String(Hour || 0).padStart(2, "0")}:${String(Minute || 0).padStart(2, "0")}:00Z`;
          }
        }
        existing.lastUpdated = new Date();
      }
    }
  } catch {
    // ignore malformed messages
  }
}

function connect(apiKey: string) {
  if (wsInstance) {
    try { wsInstance.terminate(); } catch { }
    wsInstance = null;
  }

  console.log("AISStream: connecting to wss://stream.aisstream.io/v0/stream ...");

  let ws: WebSocket;
  try {
    ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
  } catch (err: any) {
    console.error("AISStream: failed to create WebSocket:", err.message);
    scheduleReconnect(apiKey);
    return;
  }
  wsInstance = ws;

  // Connection timeout — if open event doesn't fire within 10 s, abort
  const connectTimeout = setTimeout(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      console.log("AISStream: connection timeout (10 s)");
      ws.terminate();
    }
  }, 10_000);

  ws.on("open", () => {
    clearTimeout(connectTimeout);
    wsConnected = true;
    dataSource = "live";
    reconnectAttempts = 0;
    reconnectDelay = 5_000;
    console.log("AISStream: connected ✓");

    ws.send(JSON.stringify({
      APIKey: apiKey,
      BoundingBoxes: TURKEY_BBOX,
    }));

    // Ping/pong heartbeat
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        pongTimeout = setTimeout(() => {
          console.log("AISStream: pong timeout — terminating dead connection");
          ws.terminate();
        }, 10_000);
      }
    }, 30_000);
  });

  ws.on("pong", () => {
    if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
  });

  ws.on("message", (data) => {
    const raw = data.toString();
    try {
      const parsed = JSON.parse(raw);
      if (parsed.Error) { console.error("AISStream server error:", parsed.Error); return; }
    } catch { }
    handleMessage(raw);
  });

  ws.on("error", (err) => {
    console.error("AISStream WebSocket error:", err.message);
    // Don't crash — the close event will handle reconnect
  });

  ws.on("close", (code, reason) => {
    clearTimeout(connectTimeout);
    wsConnected = false;
    wsInstance = null;
    if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
    if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
    const reasonStr = reason?.toString() || "";
    console.log(`AISStream: disconnected (code ${code}${reasonStr ? `, reason: ${reasonStr}` : ""})`);
    scheduleReconnect(apiKey);
  });

  setInterval(trimCache, 5 * 60 * 1_000);
}

function scheduleReconnect(apiKey: string) {
  if (reconnectAttempts >= MAX_RECONNECT) {
    console.log(`AISStream: max reconnects (${MAX_RECONNECT}) reached — falling back to mock data`);
    dataSource = "mock";
    useMockData();
    return;
  }
  reconnectAttempts++;
  console.log(`AISStream: reconnecting (${reconnectAttempts}/${MAX_RECONNECT}) in ${reconnectDelay / 1000}s...`);
  reconnectTimeout = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 60_000);
    connect(apiKey);
  }, reconnectDelay);
}

// ── Public API ───────────────────────────────────────────────────────────────
export function startAISStream() {
  const apiKey = process.env.AIS_STREAM_API_KEY;

  refreshWatchlist();
  setInterval(refreshWatchlist, SAVE_INTERVAL_MS);

  if (!apiKey) {
    console.log("AISStream: AIS_STREAM_API_KEY not set — running in demo mode (mock data)");
    dataSource = "mock";
    useMockData();
    return;
  }
  connect(apiKey);
}

export function getPositions(): VesselPosition[] {
  return Array.from(vesselCache.values()).sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
}

export function searchVessels(q: string): VesselPosition[] {
  if (!q) return [];
  const lower = q.toLowerCase().trim();
  return Array.from(vesselCache.values()).filter(
    (v) =>
      v.name.toLowerCase().includes(lower) ||
      v.mmsi.includes(lower) ||
      (v.imo && v.imo.includes(lower))
  );
}

export function getPositionByMmsi(mmsi: string): VesselPosition | undefined {
  return vesselCache.get(mmsi);
}

export function isConnected(): boolean {
  return wsConnected;
}

export function getDataSource(): "live" | "mock" {
  return dataSource;
}

export function getCacheSize(): number {
  return vesselCache.size;
}
