import { XMLParser } from "fast-xml-parser";

interface SanctionEntry {
  name: string;
  type: string;
  programs: string[];
  remarks?: string;
}

interface SanctionsCache {
  entries: SanctionEntry[];
  loadedAt: Date | null;
}

const cache: SanctionsCache = {
  entries: [],
  loadedAt: null,
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const SDN_XML_URL = "https://www.treasury.gov/ofac/downloads/sdn.xml";

export async function loadSanctionsList(): Promise<void> {
  if (cache.loadedAt && Date.now() - cache.loadedAt.getTime() < CACHE_TTL_MS) {
    return;
  }

  try {
    console.log("[sanctions] Fetching OFAC SDN list from treasury.gov...");
    const res = await fetch(SDN_XML_URL, {
      signal: AbortSignal.timeout(60000),
      headers: { "Accept": "application/xml, text/xml, */*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const xmlText = await res.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      isArray: (tagName) => ["sdnEntry", "aka", "program"].includes(tagName),
    });

    const raw = parser.parse(xmlText) as any;
    const sdnList: SanctionEntry[] = [];

    const entries: any[] = raw?.sdnList?.sdnEntry ?? [];

    for (const entry of entries) {
      const lastName = entry.lastName ?? "";
      const firstName = entry.firstName ?? "";
      const fullName = firstName ? `${firstName} ${lastName}`.trim() : String(lastName).trim();
      const sdnType = entry.sdnType ?? "";
      const remarks = entry.remarks ?? undefined;

      const programList = entry.programList?.program;
      const programs: string[] = Array.isArray(programList)
        ? programList.map(String)
        : programList ? [String(programList)] : [];

      if (fullName.length >= 2) {
        sdnList.push({ name: fullName.toUpperCase(), type: sdnType, programs, remarks });
      }

      const akas: any[] = entry.akaList?.aka ?? [];
      for (const aka of akas) {
        const akaName = [aka.firstName, aka.lastName].filter(Boolean).join(" ").trim();
        if (akaName.length >= 2) {
          sdnList.push({ name: akaName.toUpperCase(), type: sdnType, programs });
        }
      }
    }

    cache.entries = sdnList;
    cache.loadedAt = new Date();
    console.log(`[sanctions] Loaded ${sdnList.length} SDN entries.`);
  } catch (err) {
    console.error("[sanctions] Failed to load OFAC SDN list:", err);
  }
}

export interface SanctionResult {
  clear: boolean;
  query: string;
  matches: { name: string; type: string; programs: string[]; remarks?: string }[];
}

export function checkSanctions(name: string): SanctionResult {
  const upper = name.toUpperCase().trim();

  if (cache.entries.length === 0) {
    return { clear: true, query: name, matches: [] };
  }

  const matches: { name: string; type: string; programs: string[]; remarks?: string }[] = [];

  for (const entry of cache.entries) {
    if (
      entry.name === upper ||
      entry.name.includes(upper) ||
      upper.includes(entry.name)
    ) {
      if (entry.name.length >= 4 && upper.length >= 4) {
        matches.push({
          name: entry.name,
          type: entry.type,
          programs: entry.programs,
          remarks: entry.remarks,
        });
        if (matches.length >= 5) break;
      }
    }
  }

  return { clear: matches.length === 0, query: name, matches };
}

export function getSanctionsStatus() {
  return {
    loaded: cache.loadedAt !== null,
    entryCount: cache.entries.length,
    loadedAt: cache.loadedAt,
  };
}
