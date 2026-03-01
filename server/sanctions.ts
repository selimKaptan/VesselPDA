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

export async function loadSanctionsList(): Promise<void> {
  if (cache.loadedAt && Date.now() - cache.loadedAt.getTime() < CACHE_TTL_MS) {
    return;
  }

  try {
    console.log("[sanctions] Fetching OFAC SDN list...");
    const res = await fetch(
      "https://ofac.treasury.gov/system/files/sdnlist.json",
      { signal: AbortSignal.timeout(30000) }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const raw = await res.json() as any;
    const sdnList: SanctionEntry[] = [];

    if (raw?.sdnList?.sdnEntry) {
      const entries = Array.isArray(raw.sdnList.sdnEntry)
        ? raw.sdnList.sdnEntry
        : [raw.sdnList.sdnEntry];

      for (const entry of entries) {
        const lastName = entry.lastName ?? "";
        const firstName = entry.firstName ?? "";
        const fullName = firstName ? `${firstName} ${lastName}`.trim() : lastName;
        const sdnType = entry.sdnType ?? "";
        const programList = entry.programList?.program;
        const programs: string[] = Array.isArray(programList)
          ? programList
          : programList ? [programList] : [];

        if (fullName) {
          sdnList.push({ name: fullName.toUpperCase(), type: sdnType, programs });
        }

        const akas = entry.akaList?.aka;
        const akaArr = Array.isArray(akas) ? akas : akas ? [akas] : [];
        for (const aka of akaArr) {
          const akaName = [aka.firstName, aka.lastName].filter(Boolean).join(" ");
          if (akaName) {
            sdnList.push({ name: akaName.toUpperCase(), type: sdnType, programs });
          }
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
  matches: { name: string; type: string; programs: string[] }[];
}

export function checkSanctions(name: string, imoNumber?: string): SanctionResult {
  const upper = name.toUpperCase().trim();

  if (cache.entries.length === 0) {
    return { clear: true, matches: [] };
  }

  const matches: { name: string; type: string; programs: string[] }[] = [];

  for (const entry of cache.entries) {
    if (entry.name === upper || entry.name.includes(upper) || upper.includes(entry.name)) {
      if (entry.name.length >= 4 && upper.length >= 4) {
        matches.push({ name: entry.name, type: entry.type, programs: entry.programs });
        if (matches.length >= 5) break;
      }
    }
  }

  return { clear: matches.length === 0, matches };
}

export function getSanctionsStatus() {
  return {
    loaded: cache.loadedAt !== null,
    entryCount: cache.entries.length,
    loadedAt: cache.loadedAt,
  };
}
