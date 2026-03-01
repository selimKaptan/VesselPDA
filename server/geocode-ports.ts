import { db } from "./db";
import { ports } from "@shared/schema";
import { isNull, eq } from "drizzle-orm";

interface GeocodeStats {
  total: number;
  processed: number;
  found: number;
  notFound: number;
  running: boolean;
  startedAt: Date | null;
}

export const geocodeStats: GeocodeStats = {
  total: 0,
  processed: 0,
  found: 0,
  notFound: 0,
  running: false,
  startedAt: null,
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function nominatimSearch(name: string, countryCode: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const params = new URLSearchParams({
      q: name,
      format: "json",
      limit: "1",
      addressdetails: "0",
    });
    if (countryCode && countryCode.length === 2) {
      params.set("countrycodes", countryCode.toLowerCase());
    }
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "VesselPDA Maritime Platform (contact@vesselpda.com)",
        "Accept-Language": "en",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    if (isNaN(lat) || isNaN(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

export async function geocodeMissingPorts(): Promise<void> {
  if (geocodeStats.running) {
    console.log("Geocoding already running, skipping.");
    return;
  }

  const missingPorts = await db.select({
    id: ports.id,
    name: ports.name,
    country: ports.country,
    code: ports.code,
  }).from(ports).where(isNull(ports.latitude));

  if (missingPorts.length === 0) {
    console.log("All ports have coordinates. No geocoding needed.");
    return;
  }

  geocodeStats.total = missingPorts.length;
  geocodeStats.processed = 0;
  geocodeStats.found = 0;
  geocodeStats.notFound = 0;
  geocodeStats.running = true;
  geocodeStats.startedAt = new Date();

  console.log(`Starting background geocoding for ${missingPorts.length} ports without coordinates...`);

  (async () => {
    for (const port of missingPorts) {
      if (!geocodeStats.running) break;

      const countryCode = port.country?.length === 2 ? port.country : "";
      const result = await nominatimSearch(port.name, countryCode);

      if (result) {
        try {
          await db.update(ports)
            .set({ latitude: result.lat, longitude: result.lon })
            .where(eq(ports.id, port.id));
          geocodeStats.found++;
        } catch {
          geocodeStats.notFound++;
        }
      } else {
        geocodeStats.notFound++;
      }

      geocodeStats.processed++;

      if (geocodeStats.processed % 100 === 0) {
        console.log(`Geocoding progress: ${geocodeStats.processed}/${geocodeStats.total} — found: ${geocodeStats.found}`);
      }

      await sleep(1200);
    }

    geocodeStats.running = false;
    console.log(`Geocoding complete: ${geocodeStats.found}/${geocodeStats.total} ports geocoded.`);
  })();
}
