import WebSocket from "ws";

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
let wsInstance: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 5000;
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
    "271": "Turkey", "212": "Cyprus", "229": "Malta", "239": "Greece",
    "255": "Portugal", "248": "Malta", "229": "Malta",
    "236": "Gibraltar", "244": "Netherlands", "247": "Italy",
    "257": "Norway", "265": "Sweden", "230": "Finland",
    "232": "United Kingdom", "233": "United Kingdom", "235": "United Kingdom",
    "240": "Greece", "241": "Greece", "242": "Greece",
    "338": "United States", "370": "Panama", "372": "Panama",
    "373": "Panama", "374": "Panama", "376": "Panama",
    "378": "Panama", "351": "Panama", "352": "Panama",
    "353": "Panama", "354": "Panama", "355": "Panama",
    "356": "Panama", "357": "Panama",
    "432": "Japan", "440": "South Korea", "441": "South Korea",
    "477": "Hong Kong", "525": "Indonesia", "538": "Marshall Islands",
    "548": "Philippines", "563": "Singapore", "566": "Singapore",
    "574": "Vietnam", "636": "Liberia", "667": "Sierra Leone",
    "710": "Brazil",
  };
  return flagMap[mid] || "Unknown";
}

function vesselTypeCodeToString(code: number): string {
  if (code >= 70 && code < 80) return "General Cargo";
  if (code === 70) return "General Cargo";
  if (code === 71) return "General Cargo";
  if (code === 72) return "General Cargo";
  if (code === 73) return "General Cargo";
  if (code === 74) return "General Cargo";
  if (code >= 80 && code < 90) return "Tanker";
  if (code === 80) return "Tanker";
  if (code === 84) return "LPG Carrier";
  if (code === 85) return "LNG Carrier";
  if (code === 89) return "Chemical Tanker";
  if (code >= 60 && code < 70) return "Passenger";
  if (code === 69) return "Passenger";
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
  if (code >= 90) return "General Cargo";
  return "General Cargo";
}

function trimCache() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  let removed = 0;
  for (const [mmsi, pos] of vesselCache.entries()) {
    if (pos.lastUpdated < cutoff) {
      vesselCache.delete(mmsi);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`AISStream: trimmed ${removed} stale vessel(s), ${vesselCache.size} remaining`);
  }
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
      vesselCache.set(mmsi, {
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
      });
    } else if (type === "ShipStaticData") {
      const data = msg.Message?.ShipStaticData || {};
      const existing = vesselCache.get(mmsi);
      if (existing) {
        existing.name = (data.Name || meta.ShipName || existing.name || "").trim() || existing.name;
        existing.destination = (data.Destination || existing.destination || "").trim();
        if (data.ImoNumber) existing.imo = String(data.ImoNumber);
        if (data.TypeOfShipAndCargoType) {
          existing.vesselType = vesselTypeCodeToString(data.TypeOfShipAndCargoType);
        }
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
  const ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
  wsInstance = ws;

  ws.on("open", () => {
    wsConnected = true;
    reconnectDelay = 5000;
    console.log(`AISStream: connected ✓`);
    const subscribeMsg = {
      APIKey: apiKey,
      BoundingBoxes: TURKEY_BBOX,
    };
    console.log("AISStream: sending subscribe:", JSON.stringify(subscribeMsg));
    ws.send(JSON.stringify(subscribeMsg));

    // Ping/pong heartbeat — keeps the connection alive and detects zombie connections
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
        pongTimeout = setTimeout(() => {
          console.log("AISStream: pong timeout — terminating dead connection");
          ws.terminate();
        }, 10000);
      }
    }, 30000);
  });

  ws.on("pong", () => {
    if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
  });

  ws.on("message", (data) => {
    const raw = data.toString();
    try {
      const parsed = JSON.parse(raw);
      if (parsed.Error) {
        console.error("AISStream server error:", parsed.Error);
        return;
      }
    } catch { }
    handleMessage(raw);
  });

  ws.on("error", (err) => {
    console.error("AISStream error:", err.message);
  });

  ws.on("close", (code, reason) => {
    wsConnected = false;
    wsInstance = null;
    if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
    if (pongTimeout) { clearTimeout(pongTimeout); pongTimeout = null; }
    const reasonStr = reason?.toString() || "";
    console.log(`AISStream: disconnected (code ${code}${reasonStr ? `, reason: ${reasonStr}` : ""}). Reconnecting in ${reconnectDelay / 1000}s...`);
    reconnectTimeout = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, 60000);
      connect(apiKey);
    }, reconnectDelay);
  });

  setInterval(trimCache, 5 * 60 * 1000);
}

export function startAISStream() {
  const apiKey = process.env.AIS_STREAM_API_KEY;
  if (!apiKey) {
    console.log("AISStream: AIS_STREAM_API_KEY not set — running in demo mode (mock data)");
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

export function getCacheSize(): number {
  return vesselCache.size;
}
