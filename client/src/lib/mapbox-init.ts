import mapboxgl from "mapbox-gl";

let tokenReady = false;
let tokenPromise: Promise<string> | null = null;

export async function ensureMapboxToken(): Promise<string> {
  if (tokenReady && mapboxgl.accessToken) return mapboxgl.accessToken;

  if (tokenPromise) return tokenPromise;

  const envToken = (import.meta.env.VITE_MAPBOX_TOKEN as string) || "";
  if (envToken && envToken.length > 10) {
    mapboxgl.accessToken = envToken;
    tokenReady = true;
    return envToken;
  }

  tokenPromise = fetch("/api/config/mapbox", { credentials: "include" })
    .then((r) => r.json())
    .then((data: { token: string }) => {
      if (data.token && data.token.length > 10) {
        mapboxgl.accessToken = data.token;
        tokenReady = true;
        return data.token;
      }
      return "";
    })
    .catch((err) => {
      console.error("Mapbox token yüklenemedi:", err);
      tokenPromise = null;
      return "";
    });

  return tokenPromise;
}
