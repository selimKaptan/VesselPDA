import { Router } from "express";
import { db } from "../db";
import { passagePlans, passageWaypoints } from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { isAuthenticated } from "../replit_integrations/auth";
import * as datalastic from "../datalastic";

const router = Router();

function pd(val: any): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function uid(req: any): string {
  return req.user?.claims?.sub ?? req.user?.id ?? "";
}

const STRAITS_AND_CANALS = [
  { name: "Bosphorus (Istanbul Strait)", lat: 41.12, lon: 29.05, radiusNm: 15, transitHours: 2, type: "strait" },
  { name: "Dardanelles (Çanakkale)", lat: 40.20, lon: 26.40, radiusNm: 20, transitHours: 3, type: "strait" },
  { name: "Suez Canal", lat: 30.45, lon: 32.35, radiusNm: 30, transitHours: 14, type: "canal" },
  { name: "Panama Canal", lat: 9.08, lon: -79.68, radiusNm: 20, transitHours: 10, type: "canal" },
  { name: "Strait of Gibraltar", lat: 35.97, lon: -5.50, radiusNm: 15, transitHours: 1.5, type: "strait" },
  { name: "Strait of Hormuz", lat: 26.56, lon: 56.25, radiusNm: 20, transitHours: 2, type: "strait" },
  { name: "Strait of Malacca", lat: 2.50, lon: 101.50, radiusNm: 60, transitHours: 12, type: "strait" },
  { name: "Strait of Messina", lat: 38.20, lon: 15.63, radiusNm: 8, transitHours: 1, type: "strait" },
  { name: "English Channel (Dover)", lat: 51.00, lon: 1.30, radiusNm: 30, transitHours: 6, type: "strait" },
  { name: "Kiel Canal", lat: 54.15, lon: 9.70, radiusNm: 20, transitHours: 8, type: "canal" },
  { name: "Strait of Bonifacio", lat: 41.25, lon: 9.15, radiusNm: 10, transitHours: 1, type: "strait" },
  { name: "Strait of Sicily", lat: 37.00, lon: 11.50, radiusNm: 30, transitHours: 3, type: "strait" },
  { name: "Bab el-Mandeb", lat: 12.58, lon: 43.33, radiusNm: 15, transitHours: 2, type: "strait" },
  { name: "Danish Straits (Øresund)", lat: 55.90, lon: 12.70, radiusNm: 15, transitHours: 2, type: "strait" },
  { name: "Cape of Good Hope", lat: -34.35, lon: 18.50, radiusNm: 30, transitHours: 0, type: "cape" },
  { name: "Singapore Strait", lat: 1.25, lon: 103.80, radiusNm: 15, transitHours: 3, type: "strait" },
];

const ECA_ZONES = [
  { name: "Baltic Sea ECA", latMin: 53, latMax: 66, lonMin: 10, lonMax: 30 },
  { name: "North Sea ECA", latMin: 48, latMax: 62, lonMin: -5, lonMax: 10 },
  { name: "North America ECA", latMin: 25, latMax: 50, lonMin: -130, lonMax: -60 },
  { name: "Mediterranean SECA", latMin: 30, latMax: 46, lonMin: -6, lonMax: 36 },
];

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const toDeg = (r: number) => r * 180 / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// ─── PRE-DEFINED SEA WAYPOINTS — kıtaların etrafından dolaşan deniz rotası ───
const SEA_WAYPOINTS: Record<string, { lat: number; lon: number; connections: string[] }> = {
  "gibraltar_w": { lat: 36.00, lon: -5.60, connections: ["gibraltar_e", "atlantic_canary", "atlantic_biscay"] },
  "gibraltar_e": { lat: 36.10, lon: -5.20, connections: ["gibraltar_w", "med_alboran", "atlantic_portugal"] },
  "med_alboran": { lat: 36.30, lon: -3.00, connections: ["gibraltar_e", "med_balearic"] },
  "med_balearic": { lat: 38.50, lon: 2.00, connections: ["med_alboran", "med_sardinia", "med_marseille"] },
  "med_marseille": { lat: 43.00, lon: 5.00, connections: ["med_balearic", "med_genoa"] },
  "med_genoa": { lat: 43.50, lon: 9.00, connections: ["med_marseille", "med_sardinia", "med_naples"] },
  "med_sardinia": { lat: 39.50, lon: 9.50, connections: ["med_balearic", "med_genoa", "med_sicily", "med_tunisia"] },
  "med_tunisia": { lat: 37.50, lon: 10.50, connections: ["med_sardinia", "med_sicily", "med_malta"] },
  "med_sicily": { lat: 37.50, lon: 15.50, connections: ["med_sardinia", "med_tunisia", "med_malta", "med_naples"] },
  "med_naples": { lat: 40.50, lon: 14.00, connections: ["med_genoa", "med_sicily", "med_adriatic"] },
  "med_adriatic": { lat: 42.00, lon: 17.00, connections: ["med_naples", "med_greece_w"] },
  "med_malta": { lat: 35.90, lon: 14.50, connections: ["med_sicily", "med_tunisia", "med_crete", "med_libya"] },
  "med_libya": { lat: 33.50, lon: 15.00, connections: ["med_malta", "med_egypt"] },
  "med_greece_w": { lat: 38.00, lon: 20.50, connections: ["med_adriatic", "med_greece_e", "med_crete"] },
  "med_crete": { lat: 35.50, lon: 24.00, connections: ["med_malta", "med_greece_w", "med_greece_e", "med_egypt"] },
  "med_greece_e": { lat: 38.00, lon: 25.50, connections: ["med_greece_w", "med_crete", "aegean_s"] },
  "med_egypt": { lat: 31.50, lon: 30.00, connections: ["med_crete", "med_libya", "suez_n"] },
  "aegean_s": { lat: 37.50, lon: 26.00, connections: ["med_greece_e", "aegean_n", "med_crete", "aegean_izmir"] },
  "aegean_izmir": { lat: 38.30, lon: 26.60, connections: ["aegean_s", "aegean_lesbos", "dardanelles_w"] },
  "aegean_lesbos": { lat: 39.10, lon: 26.40, connections: ["aegean_izmir", "aegean_n", "dardanelles_w"] },
  "aegean_n": { lat: 39.50, lon: 26.00, connections: ["aegean_s", "aegean_lesbos", "dardanelles_w"] },
  "dardanelles_w": { lat: 40.00, lon: 26.20, connections: ["aegean_n", "aegean_lesbos", "dardanelles_e"] },
  "dardanelles_e": { lat: 40.20, lon: 26.70, connections: ["dardanelles_w", "marmara"] },
  "marmara": { lat: 40.70, lon: 28.80, connections: ["dardanelles_e", "bosphorus_s"] },
  "bosphorus_s": { lat: 41.00, lon: 29.00, connections: ["marmara", "bosphorus_n"] },
  "bosphorus_n": { lat: 41.20, lon: 29.10, connections: ["bosphorus_s", "blacksea_w"] },
  "blacksea_w": { lat: 42.00, lon: 30.00, connections: ["bosphorus_n", "blacksea_e"] },
  "blacksea_e": { lat: 42.50, lon: 37.00, connections: ["blacksea_w", "blacksea_ne"] },
  "blacksea_ne": { lat: 44.00, lon: 37.50, connections: ["blacksea_e"] },
  "turkish_s_coast": { lat: 36.50, lon: 30.00, connections: ["aegean_s", "aegean_izmir", "iskenderun"] },
  "iskenderun": { lat: 36.60, lon: 35.80, connections: ["turkish_s_coast", "suez_approach"] },
  "suez_n": { lat: 31.25, lon: 32.30, connections: ["med_egypt", "suez_s"] },
  "suez_s": { lat: 29.95, lon: 32.55, connections: ["suez_n", "red_sea_n"] },
  "suez_approach": { lat: 31.00, lon: 33.00, connections: ["iskenderun", "suez_n", "med_egypt"] },
  "red_sea_n": { lat: 27.00, lon: 34.50, connections: ["suez_s", "red_sea_mid"] },
  "red_sea_mid": { lat: 21.00, lon: 38.00, connections: ["red_sea_n", "bab_el_mandeb"] },
  "bab_el_mandeb": { lat: 12.60, lon: 43.30, connections: ["red_sea_mid", "gulf_aden"] },
  "gulf_aden": { lat: 12.50, lon: 47.00, connections: ["bab_el_mandeb", "arabian_sea"] },
  "arabian_sea": { lat: 15.00, lon: 60.00, connections: ["gulf_aden", "hormuz_approach", "india_w"] },
  "hormuz_approach": { lat: 25.50, lon: 57.00, connections: ["arabian_sea", "hormuz"] },
  "hormuz": { lat: 26.50, lon: 56.30, connections: ["hormuz_approach", "persian_gulf"] },
  "persian_gulf": { lat: 27.00, lon: 50.00, connections: ["hormuz"] },
  "india_w": { lat: 15.00, lon: 73.00, connections: ["arabian_sea", "india_s"] },
  "india_s": { lat: 7.00, lon: 77.00, connections: ["india_w", "malacca_w"] },
  "malacca_w": { lat: 5.00, lon: 95.00, connections: ["india_s", "malacca_e"] },
  "malacca_e": { lat: 1.30, lon: 103.80, connections: ["malacca_w", "south_china_sea"] },
  "south_china_sea": { lat: 10.00, lon: 110.00, connections: ["malacca_e", "taiwan_strait"] },
  "taiwan_strait": { lat: 24.00, lon: 119.00, connections: ["south_china_sea", "east_china_sea"] },
  "east_china_sea": { lat: 30.00, lon: 125.00, connections: ["taiwan_strait"] },
  "atlantic_portugal": { lat: 38.50, lon: -9.50, connections: ["gibraltar_e", "atlantic_biscay", "atlantic_canary"] },
  "atlantic_canary": { lat: 28.00, lon: -15.50, connections: ["gibraltar_w", "atlantic_portugal", "atlantic_cape_verde"] },
  "atlantic_cape_verde": { lat: 16.00, lon: -23.00, connections: ["atlantic_canary", "atlantic_brazil", "cape_good_hope_w"] },
  "atlantic_biscay": { lat: 45.00, lon: -5.00, connections: ["atlantic_portugal", "english_channel_w", "gibraltar_w"] },
  "english_channel_w": { lat: 49.50, lon: -5.00, connections: ["atlantic_biscay", "english_channel_e"] },
  "english_channel_e": { lat: 51.00, lon: 1.50, connections: ["english_channel_w", "north_sea_s"] },
  "north_sea_s": { lat: 52.00, lon: 3.50, connections: ["english_channel_e", "north_sea_n", "kiel_w"] },
  "north_sea_n": { lat: 57.00, lon: 5.00, connections: ["north_sea_s", "norway_s", "skagerrak"] },
  "skagerrak": { lat: 57.50, lon: 9.50, connections: ["north_sea_n", "kattegat"] },
  "kattegat": { lat: 56.50, lon: 11.50, connections: ["skagerrak", "oresund"] },
  "oresund": { lat: 55.90, lon: 12.70, connections: ["kattegat", "baltic_w"] },
  "kiel_w": { lat: 54.00, lon: 9.20, connections: ["north_sea_s", "kiel_e"] },
  "kiel_e": { lat: 54.30, lon: 10.20, connections: ["kiel_w", "baltic_w"] },
  "baltic_w": { lat: 55.00, lon: 14.00, connections: ["oresund", "kiel_e", "baltic_e"] },
  "baltic_e": { lat: 59.50, lon: 24.00, connections: ["baltic_w"] },
  "norway_s": { lat: 58.50, lon: 5.50, connections: ["north_sea_n", "norway_n"] },
  "norway_n": { lat: 65.00, lon: 10.00, connections: ["norway_s"] },
  "cape_good_hope_w": { lat: -33.00, lon: 15.00, connections: ["atlantic_cape_verde", "cape_good_hope"] },
  "cape_good_hope": { lat: -34.35, lon: 18.50, connections: ["cape_good_hope_w", "cape_good_hope_e"] },
  "cape_good_hope_e": { lat: -33.00, lon: 28.00, connections: ["cape_good_hope", "mozambique"] },
  "mozambique": { lat: -20.00, lon: 38.00, connections: ["cape_good_hope_e", "gulf_aden"] },
  "atlantic_brazil": { lat: -5.00, lon: -35.00, connections: ["atlantic_cape_verde", "panama_e_atlantic"] },
  "us_east": { lat: 37.00, lon: -74.00, connections: ["english_channel_w", "panama_e_atlantic"] },
  "panama_e_atlantic": { lat: 9.50, lon: -79.50, connections: ["us_east", "atlantic_brazil", "panama_canal"] },
  "panama_canal": { lat: 9.00, lon: -79.60, connections: ["panama_e_atlantic", "panama_w_pacific"] },
  "panama_w_pacific": { lat: 8.50, lon: -79.70, connections: ["panama_canal", "us_west"] },
  "us_west": { lat: 34.00, lon: -118.50, connections: ["panama_w_pacific"] },
};

function findSeaRoute(startLat: number, startLon: number, endLat: number, endLon: number): { waypoints: { name: string; lat: number; lon: number }[]; totalDistanceNm: number } {
  function nearestWp(lat: number, lon: number): string {
    let best = "", bestDist = Infinity;
    for (const [name, wp] of Object.entries(SEA_WAYPOINTS)) {
      const d = haversineNm(lat, lon, wp.lat, wp.lon);
      if (d < bestDist) { bestDist = d; best = name; }
    }
    return best;
  }

  const startWp = nearestWp(startLat, startLon);
  const endWp = nearestWp(endLat, endLon);

  if (startWp === endWp) {
    return { waypoints: [], totalDistanceNm: Math.round(haversineNm(startLat, startLon, endLat, endLon) * 10) / 10 };
  }

  // A* pathfinding
  const openSet = new Set<string>([startWp]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  gScore.set(startWp, 0);
  fScore.set(startWp, haversineNm(SEA_WAYPOINTS[startWp].lat, SEA_WAYPOINTS[startWp].lon, SEA_WAYPOINTS[endWp].lat, SEA_WAYPOINTS[endWp].lon));

  let iterations = 0;
  while (openSet.size > 0 && iterations++ < 500) {
    let current = "";
    let minF = Infinity;
    for (const n of openSet) {
      const f = fScore.get(n) ?? Infinity;
      if (f < minF) { minF = f; current = n; }
    }

    if (current === endWp) {
      const path: string[] = [current];
      let c = current;
      while (cameFrom.has(c)) { c = cameFrom.get(c)!; path.unshift(c); }

      let totalDist = haversineNm(startLat, startLon, SEA_WAYPOINTS[path[0]].lat, SEA_WAYPOINTS[path[0]].lon);
      const routeWps: { name: string; lat: number; lon: number }[] = [];
      for (let i = 0; i < path.length; i++) {
        const wp = SEA_WAYPOINTS[path[i]];
        routeWps.push({ name: path[i], lat: wp.lat, lon: wp.lon });
        if (i < path.length - 1) totalDist += haversineNm(wp.lat, wp.lon, SEA_WAYPOINTS[path[i + 1]].lat, SEA_WAYPOINTS[path[i + 1]].lon);
      }
      totalDist += haversineNm(SEA_WAYPOINTS[path[path.length - 1]].lat, SEA_WAYPOINTS[path[path.length - 1]].lon, endLat, endLon);
      return { waypoints: routeWps, totalDistanceNm: Math.round(totalDist * 10) / 10 };
    }

    openSet.delete(current);
    const currentWp = SEA_WAYPOINTS[current];
    if (!currentWp) continue;

    for (const neighbor of currentWp.connections) {
      const neighborWp = SEA_WAYPOINTS[neighbor];
      if (!neighborWp) continue;
      const tentativeG = (gScore.get(current) ?? Infinity) + haversineNm(currentWp.lat, currentWp.lon, neighborWp.lat, neighborWp.lon);
      if (tentativeG < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeG);
        fScore.set(neighbor, tentativeG + haversineNm(neighborWp.lat, neighborWp.lon, SEA_WAYPOINTS[endWp].lat, SEA_WAYPOINTS[endWp].lon));
        openSet.add(neighbor);
      }
    }
  }

  // Yol bulunamazsa fallback
  return { waypoints: [], totalDistanceNm: Math.round(haversineNm(startLat, startLon, endLat, endLon) * 1.2 * 10) / 10 };
}

router.post("/calculate-route", isAuthenticated, async (req: any, res) => {
  try {
    const { departureLat, departureLon, destinationLat, destinationLon, departurePort, destinationPort, intermediatePorts, plannedSpeed, departureDate } = req.body;
    const speed = parseFloat(plannedSpeed) || 12;

    const allPoints = [
      { name: departurePort, lat: parseFloat(departureLat), lon: parseFloat(departureLon), isPort: true, portStayHours: 0 },
      ...(Array.isArray(intermediatePorts) ? intermediatePorts.map((p: any) => ({
        name: p.name, lat: parseFloat(p.lat), lon: parseFloat(p.lon), isPort: true, portStayHours: parseFloat(p.portStayHours) || 0,
      })) : []),
      { name: destinationPort, lat: parseFloat(destinationLat), lon: parseFloat(destinationLon), isPort: true, portStayHours: 0 },
    ];

    const waypoints: any[] = [];
    let totalDistanceNm = 0;
    let totalHours = 0;
    let routeGeometry: number[][] = [];
    const passedStraits: any[] = [];
    let ecaHours = 0;
    let seq = 0;

    for (let i = 0; i < allPoints.length; i++) {
      const pt = allPoints[i];
      waypoints.push({
        sequence: seq++, name: pt.name, latitude: pt.lat, longitude: pt.lon,
        waypointType: "port", isPort: true, portStayHours: pt.portStayHours,
        speedKnots: 0, distanceToNextNm: 0, courseToNext: 0, legTimeHours: 0,
      });

      if (i < allPoints.length - 1) {
        const next = allPoints[i + 1];

        let legDistanceNm = 0;
        let legRoutePoints: number[][] = [];

        // Önce Datalastic'i dene (varsa)
        try {
          const routeData = await datalastic.getRoute({
            from_lat: pt.lat, from_lon: pt.lon,
            to_lat: next.lat, to_lon: next.lon,
          });
          if (routeData && routeData.distance_nm) {
            legDistanceNm = routeData.distance_nm;
            if (routeData.route && Array.isArray(routeData.route))
              legRoutePoints = routeData.route.map((p: any) => [p.lat ?? p[0], p.lon ?? p[1]]);
            else if (routeData.geometry && Array.isArray(routeData.geometry))
              legRoutePoints = routeData.geometry;
            console.log(`[passage] Datalastic route ${pt.name} → ${next.name}: ${legDistanceNm} NM`);
          }
        } catch {}

        // Datalastic başarısız veya yoksa → A* deniz waypoint rotası kullan
        if (legDistanceNm === 0) {
          const seaRoute = findSeaRoute(pt.lat, pt.lon, next.lat, next.lon);
          legDistanceNm = seaRoute.totalDistanceNm;
          legRoutePoints = [
            [pt.lat, pt.lon],
            ...seaRoute.waypoints.map(wp => [wp.lat, wp.lon]),
            [next.lat, next.lon],
          ];
          console.log(`[passage] Sea waypoint route ${pt.name} → ${next.name}: ${legDistanceNm} NM (${seaRoute.waypoints.length} WPs)`);
        }

        if (legRoutePoints.length > 0) routeGeometry.push(...legRoutePoints);

        // Bu leg için geçilen boğaz/kanalları bul ve rota boyunca konumlarına göre sırala
        const legStraits: { strait: typeof STRAITS_AND_CANALS[0]; routeIdx: number }[] = [];
        for (const strait of STRAITS_AND_CANALS) {
          if (passedStraits.find((s: any) => s.name === strait.name)) continue;
          const isOnRoute = legRoutePoints.some(([lat, lon]) =>
            haversineNm(lat, lon, strait.lat, strait.lon) < strait.radiusNm
          );
          const directCheck = haversineNm(pt.lat, pt.lon, strait.lat, strait.lon) + haversineNm(strait.lat, strait.lon, next.lat, next.lon) < legDistanceNm * 1.3;
          if (isOnRoute || directCheck) {
            // Rotadaki en yakın noktanın indexini bul (sıralama için)
            let minDist = Infinity, minIdx = 0;
            legRoutePoints.forEach(([lat, lon], idx) => {
              const d = haversineNm(lat, lon, strait.lat, strait.lon);
              if (d < minDist) { minDist = d; minIdx = idx; }
            });
            legStraits.push({ strait, routeIdx: minIdx });
          }
        }
        // Rota boyunca geçiş sırasına göre sırala
        legStraits.sort((a, b) => a.routeIdx - b.routeIdx);
        for (const { strait } of legStraits) {
          passedStraits.push(strait);
          waypoints.push({
            sequence: seq++, name: strait.name, latitude: strait.lat, longitude: strait.lon,
            waypointType: strait.type, isStrait: strait.type === "strait", isCanal: strait.type === "canal",
            isPort: false, speedKnots: strait.type === "canal" ? 8 : speed,
            distanceToNextNm: 0, courseToNext: 0, legTimeHours: strait.transitHours,
            notes: `Transit: ~${strait.transitHours}h`,
          });
          totalHours += strait.transitHours;
        }

        const legTimeHours = legDistanceNm / speed;
        totalDistanceNm += legDistanceNm;
        totalHours += legTimeHours;

        const prevWp = [...waypoints].reverse().find((w: any) => w.name === pt.name && w.isPort);
        if (prevWp) {
          prevWp.distanceToNextNm = Math.round(legDistanceNm * 10) / 10;
          prevWp.courseToNext = Math.round(bearingDeg(pt.lat, pt.lon, next.lat, next.lon) * 10) / 10;
          prevWp.speedKnots = speed;
          prevWp.legTimeHours = Math.round(legTimeHours * 10) / 10;
        }

        if (pt.portStayHours > 0) totalHours += pt.portStayHours;

        for (const eca of ECA_ZONES) {
          const midLat = (pt.lat + next.lat) / 2;
          const midLon = (pt.lon + next.lon) / 2;
          if (midLat >= eca.latMin && midLat <= eca.latMax && midLon >= eca.lonMin && midLon <= eca.lonMax) {
            ecaHours += legTimeHours;
            break;
          }
        }
      }
    }

    waypoints.sort((a: any, b: any) => a.sequence - b.sequence);
    const depTime = departureDate ? new Date(departureDate) : new Date();
    let currentTime = new Date(depTime);
    for (const wp of waypoints) {
      wp.eta = new Date(currentTime);
      currentTime = new Date(currentTime.getTime() + ((wp.legTimeHours || 0) + (wp.portStayHours || 0)) * 3600000);
      wp.etd = new Date(currentTime);
    }

    const totalDays = Math.round((totalHours / 24) * 10) / 10;

    res.json({
      waypoints,
      routeGeometry,
      summary: {
        totalDistanceNm: Math.round(totalDistanceNm * 10) / 10,
        totalHours: Math.round(totalHours * 10) / 10,
        totalDays,
        plannedSpeed: speed,
        departureDate: depTime.toISOString(),
        arrivalDate: waypoints[waypoints.length - 1]?.etd?.toISOString() || null,
        straitsAndCanals: passedStraits.map((s: any) => ({ name: s.name, type: s.type, transitHours: s.transitHours })),
        ecaZoneDays: Math.round((ecaHours / 24) * 10) / 10,
      },
    });
  } catch (e: any) {
    console.error("[passage-plan] Calculate route error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

router.post("/calculate-fuel", isAuthenticated, async (req: any, res) => {
  try {
    const { totalDays, ecaZoneDays, plannedSpeed, deadweight } = req.body;
    const dwt = parseFloat(deadweight) || 50000;
    const spd = parseFloat(plannedSpeed) || 12;

    let dailyHfo: number, dailyMgo: number;
    if (dwt < 10000)       { dailyHfo = 8 + (spd - 10) * 1.5;  dailyMgo = 1.5; }
    else if (dwt < 30000)  { dailyHfo = 15 + (spd - 12) * 2.5; dailyMgo = 2.5; }
    else if (dwt < 60000)  { dailyHfo = 25 + (spd - 13) * 3.5; dailyMgo = 3.5; }
    else if (dwt < 120000) { dailyHfo = 40 + (spd - 13) * 5;   dailyMgo = 4; }
    else                   { dailyHfo = 55 + (spd - 14) * 7;   dailyMgo = 5; }
    dailyHfo = Math.max(dailyHfo, 5);
    dailyMgo = Math.max(dailyMgo, 1);

    const nonEcaDays = Math.max((totalDays || 0) - (ecaZoneDays || 0), 0);
    const ecaDays = ecaZoneDays || 0;
    const totalHfo = Math.round(nonEcaDays * dailyHfo * 10) / 10;
    const totalMgo = Math.round((nonEcaDays * dailyMgo + ecaDays * (dailyHfo + dailyMgo)) * 10) / 10;

    const hfoPrice = 450, mgoPrice = 750;
    res.json({
      dailyHfoConsumption: Math.round(dailyHfo * 10) / 10,
      dailyMgoConsumption: Math.round(dailyMgo * 10) / 10,
      totalHfoConsumption: totalHfo,
      totalMgoConsumption: totalMgo,
      totalFuelConsumption: Math.round((totalHfo + totalMgo) * 10) / 10,
      ecaZoneDays: ecaDays,
      estimatedFuelCost: Math.round(totalHfo * hfoPrice + totalMgo * mgoPrice),
      fuelPrices: { hfo: hfoPrice, mgo: mgoPrice, unit: "USD/ton" },
    });
  } catch (e: any) {
    console.error("[passage-plan] Fuel calc error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = uid(req);
    const rows = await db.select().from(passagePlans).where(eq(passagePlans.userId, userId)).orderBy(desc(passagePlans.createdAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = uid(req);
    const [plan] = await db.select().from(passagePlans).where(and(eq(passagePlans.id, parseInt(req.params.id)), eq(passagePlans.userId, userId)));
    if (!plan) return res.status(404).json({ message: "Not found" });
    const wps = await db.select().from(passageWaypoints).where(eq(passageWaypoints.planId, plan.id)).orderBy(asc(passageWaypoints.sequence));
    res.json({ ...plan, waypoints: wps });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = uid(req);
    const { waypoints: wpData, ...planData } = req.body;
    delete planData.id; delete planData.createdAt; delete planData.updatedAt;
    const [plan] = await db.insert(passagePlans).values({
      ...planData,
      userId,
      title: planData.title || `${planData.departurePort || "?"} → ${planData.destinationPort || "?"}`,
      departureDate: pd(planData.departureDate),
      arrivalDate: pd(planData.arrivalDate),
    }).returning();

    if (Array.isArray(wpData) && wpData.length > 0) {
      await db.insert(passageWaypoints).values(wpData.map((wp: any, i: number) => ({
        planId: plan.id,
        sequence: wp.sequence ?? i,
        name: wp.name,
        waypointType: wp.waypointType || "waypoint",
        latitude: wp.latitude,
        longitude: wp.longitude,
        courseToNext: wp.courseToNext,
        distanceToNextNm: wp.distanceToNextNm,
        speedKnots: wp.speedKnots,
        legTimeHours: wp.legTimeHours,
        eta: pd(wp.eta),
        etd: pd(wp.etd),
        isStrait: wp.isStrait || false,
        isCanal: wp.isCanal || false,
        isEcaZone: wp.isEcaZone || false,
        isPort: wp.isPort || false,
        portStayHours: wp.portStayHours,
        notes: wp.notes,
      })));
    }
    const wps = await db.select().from(passageWaypoints).where(eq(passageWaypoints.planId, plan.id)).orderBy(asc(passageWaypoints.sequence));
    res.status(201).json({ ...plan, waypoints: wps });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = uid(req);
    const { waypoints: wpData, ...planData } = req.body;
    delete planData.id; delete planData.userId; delete planData.createdAt;
    planData.updatedAt = new Date();
    if (planData.departureDate) planData.departureDate = pd(planData.departureDate);
    if (planData.arrivalDate) planData.arrivalDate = pd(planData.arrivalDate);
    const [plan] = await db.update(passagePlans).set(planData)
      .where(and(eq(passagePlans.id, parseInt(req.params.id)), eq(passagePlans.userId, userId))).returning();
    if (!plan) return res.status(404).json({ message: "Not found" });
    if (Array.isArray(wpData)) {
      await db.delete(passageWaypoints).where(eq(passageWaypoints.planId, plan.id));
      if (wpData.length > 0) {
        await db.insert(passageWaypoints).values(wpData.map((wp: any, i: number) => ({
          planId: plan.id,
          sequence: wp.sequence ?? i,
          name: wp.name,
          waypointType: wp.waypointType || "waypoint",
          latitude: wp.latitude,
          longitude: wp.longitude,
          courseToNext: wp.courseToNext,
          distanceToNextNm: wp.distanceToNextNm,
          speedKnots: wp.speedKnots,
          legTimeHours: wp.legTimeHours,
          eta: pd(wp.eta),
          etd: pd(wp.etd),
          isStrait: wp.isStrait || false,
          isCanal: wp.isCanal || false,
          isEcaZone: wp.isEcaZone || false,
          isPort: wp.isPort || false,
          portStayHours: wp.portStayHours,
          notes: wp.notes,
        })));
      }
    }
    const wps = await db.select().from(passageWaypoints).where(eq(passageWaypoints.planId, plan.id)).orderBy(asc(passageWaypoints.sequence));
    res.json({ ...plan, waypoints: wps });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = uid(req);
    const id = parseInt(req.params.id);
    await db.delete(passageWaypoints).where(eq(passageWaypoints.planId, id));
    await db.delete(passagePlans).where(and(eq(passagePlans.id, id), eq(passagePlans.userId, userId)));
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/:id/duplicate", isAuthenticated, async (req: any, res) => {
  try {
    const userId = uid(req);
    const [orig] = await db.select().from(passagePlans).where(and(eq(passagePlans.id, parseInt(req.params.id)), eq(passagePlans.userId, userId)));
    if (!orig) return res.status(404).json({ message: "Not found" });
    const { id, createdAt, updatedAt, ...data } = orig;
    const [copy] = await db.insert(passagePlans).values({ ...data, title: `${orig.title} (Copy)`, status: "draft" }).returning();
    const wps = await db.select().from(passageWaypoints).where(eq(passageWaypoints.planId, orig.id));
    if (wps.length > 0) {
      await db.insert(passageWaypoints).values(wps.map(({ id: _, ...wp }) => ({ ...wp, planId: copy.id })));
    }
    res.status(201).json(copy);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
