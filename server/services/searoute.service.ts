import { seaRoute } from 'searoute-ts';

export interface SeaRouteResult {
  distanceNm: number;
  geometry: number[][];
}

function makePoint(lon: number, lat: number) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Point' as const, coordinates: [lon, lat] },
  };
}

export function calculateSeaRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): SeaRouteResult {
  const from = makePoint(fromLon, fromLat);
  const to = makePoint(toLon, toLat);

  // searoute-ts kütüphanesindeki console.log(nearestLineIndex) spam'ini engelle
  const origLog = console.log;
  console.log = () => {};
  let result: any;
  try {
    result = seaRoute(from, to, 'nauticalmiles') as any;
  } finally {
    console.log = origLog;
  }

  const coords: [number, number][] = result?.geometry?.coordinates ?? [];
  const geometry = coords.map(([lon, lat]) => [lat, lon] as [number, number]);

  const distanceNm = Math.round((result?.properties?.length ?? 0) * 10) / 10;

  return { distanceNm, geometry };
}
