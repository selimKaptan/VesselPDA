import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin } from "./shared";
import { cached } from "../cache";
import * as datalastic from "../datalastic";
import type { Request, Response } from "express";

const router = Router();

function notConfigured(res: any) {
  return res.status(503).json({ error: "Datalastic API not configured" });
}

// ─── VESSEL INFO ─────────────────────────────────────────────────────────────

router.get("/api/datalastic/vessel-info/:imo", isAuthenticated, async (req, res, next) => {
  try {
    if (!datalastic.isDatalasticConfigured()) return notConfigured(res);
    const { imo } = req.params;
    const data = await cached(`vessel_info:${imo}`, "daily", () => datalastic.getVesselInfo({ imo }));
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  } catch (e) { next(e); }
});

router.get("/api/datalastic/vessel-pro/:identifier", isAuthenticated, async (req, res, next) => {
  try {
    if (!datalastic.isDatalasticConfigured()) return notConfigured(res);
    const id = req.params.identifier;
    const params = id.length === 9 ? { mmsi: id } : { imo: id };
    const data = await cached(`vessel_pro:${id}`, "short", () => datalastic.getVesselPositionPro(params));
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  } catch (e) { next(e); }
});

router.get("/api/datalastic/vessel-find", isAuthenticated, async (req, res, next) => {
  try {
    if (!datalastic.isDatalasticConfigured()) return notConfigured(res);
    const { name, type, country } = req.query as Record<string, string>;
    const results = await datalastic.findVessels({ name, type, country_iso: country });
    res.json(results.slice(0, 50));
  } catch (e) { next(e); }
});

router.get("/api/datalastic/vessel-engine/:imo", isAuthenticated, async (req, res, next) => {
  try {
    if (!datalastic.isDatalasticConfigured()) return notConfigured(res);
    const { imo } = req.params;
    const data = await cached(`vessel_engine:${imo}`, "daily", () => datalastic.getVesselEngine({ imo }));
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  } catch (e) { next(e); }
});

router.get("/api/datalastic/vessel-ownership/:imo", isAuthenticated, async (req, res, next) => {
  try {
    if (!datalastic.isDatalasticConfigured()) return notConfigured(res);
    const { imo } = req.params;
    const data = await cached(`vessel_ownership:${imo}`, "daily", () => datalastic.getVesselOwnership({ imo }));
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  } catch (e) { next(e); }
});

// ─── CERTIFICATES & SAFETY ───────────────────────────────────────────────────

router.get("/api/datalastic/inspections/:imo", isAuthenticated, async (req, res, next) => {
  try {
    if (!datalastic.isDatalasticConfigured()) return notConfigured(res);
    const { imo } = req.params;
    const data = await cached(`inspections:${imo}`, "long", () => datalastic.getVesselInspections({ imo }));
    res.json(data ?? []);
  } catch (e) { next(e); }
});

router.get("/api/datalastic/classification/:imo", isAuthenticated, async (req, res, next) => {
  try {
    if (!datalastic.isDatalasticConfigured()) return notConfigured(res);
    const { imo } = req.params;
    const data = await cached(`classification:${imo}`, "daily", () => datalastic.getClassificationData({ imo }));
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  } catch (e) { next(e); }
});

router.get("/api/datalastic/drydock/:imo", isAuthenticated, async (req, res, next) => {
  try {
    if (!datalastic.isDatalasticConfigured()) return notConfigured(res);
    const { imo } = req.params;
    const data = await cached(`drydock:${imo}`, "long", () => datalastic.getDryDockDates({ imo }));
    res.json(data ?? []);
  } catch (e) { next(e); }
});

router.get("/api/datalastic/casualties/:imo", isAuthenticated, async (req, res, next) => {
  try {
    if (!datalastic.isDatalasticConfigured()) return notConfigured(res);
    const { imo } = req.params;
    const data = await cached(`casualties:${imo}`, "daily", () => datalastic.getShipCasualties({ imo }));
    res.json(data ?? []);
  } catch (e) { next(e); }
});

router.get("/api/datalastic/demolitions/:imo", isAuthenticated, async (req, res, next) => {
  try {
    if (!datalastic.isDatalasticConfigured()) return notConfigured(res);
    const { imo } = req.params;
    const data = await cached(`demolitions:${imo}`, "daily", () => datalastic.getShipDemolitions({ imo }));
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  } catch (e) { next(e); }
});

// ─── PORT & COMPANY ──────────────────────────────────────────────────────────

router.get("/api/datalastic/port-find", isAuthenticated, async (req, res, next) => {
  try {
    if (!datalastic.isDatalasticConfigured()) return notConfigured(res);
    const { name, country } = req.query as Record<string, string>;
    const cacheKey = `port_find:${name ?? ""}:${country ?? ""}`;
    const results = await cached(cacheKey, "long", () => datalastic.findPorts({ name, country_iso: country }));
    res.json(results ?? []);
  } catch (e) { next(e); }
});

router.get("/api/datalastic/company", isAuthenticated, async (req, res, next) => {
  try {
    if (!datalastic.isDatalasticConfigured()) return notConfigured(res);
    const { imo, name } = req.query as Record<string, string>;
    const data = await datalastic.getMaritimeCompany({ imo, name });
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  } catch (e) { next(e); }
});

router.get("/api/datalastic/route", isAuthenticated, async (req, res, next) => {
  try {
    if (!datalastic.isDatalasticConfigured()) return notConfigured(res);
    const { from_port, to_port, from_lat, from_lon, to_lat, to_lon } = req.query as Record<string, string>;
    const cacheKey = `route:${from_port ?? ""}:${to_port ?? ""}:${from_lat ?? ""}:${from_lon ?? ""}:${to_lat ?? ""}:${to_lon ?? ""}`;
    const data = await cached(cacheKey, "daily", () =>
      datalastic.getRoute({
        from_port: from_port || undefined,
        to_port: to_port || undefined,
        from_lat: from_lat ? parseFloat(from_lat) : undefined,
        from_lon: from_lon ? parseFloat(from_lon) : undefined,
        to_lat: to_lat ? parseFloat(to_lat) : undefined,
        to_lon: to_lon ? parseFloat(to_lon) : undefined,
      })
    );
    if (!data) return res.status(404).json({ error: "Route not found" });
    res.json(data);
  } catch (e) { next(e); }
});

// ─── ADMIN ───────────────────────────────────────────────────────────────────

router.get("/api/admin/datalastic-usage", isAuthenticated, async (req: Request, res: Response) => {
  if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
  res.json(await datalastic.getDatalasticUsage());
});

export default router;
