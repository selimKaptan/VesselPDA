import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin } from "./shared";
import { insertFixtureSchema, insertCargoPositionSchema } from "@shared/schema";
import { logAction, getClientIp } from "../audit";
import { db, pool } from "../db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/api/fixtures", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const isAdminUser = req.user.userRole === "admin" || req.user.activeRole === "admin";
    const page = req.query.page ? parseInt(req.query.page as string) : null;
    if (page && !isNaN(page) && page > 0) {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;
      const whereClause = isAdminUser ? "" : "WHERE user_id = $3";
      const params: any[] = isAdminUser ? [limit, offset] : [limit, offset, userId];
      const [dataRes, countRes] = await Promise.all([
        pool.query(`SELECT * FROM fixtures ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, params),
        pool.query(`SELECT COUNT(*) as total FROM fixtures${isAdminUser ? "" : " WHERE user_id = $1"}`, isAdminUser ? [] : [userId]),
      ]);
      const total = parseInt(countRes.rows[0].total) || 0;
      return res.json({ data: dataRes.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    }
    const result = isAdminUser ? await storage.getAllFixtures() : await storage.getFixtures(userId);
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch fixtures" });
  }
});


router.post("/api/fixtures", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const fixtureParsed = insertFixtureSchema.partial().safeParse(req.body);
    if (!fixtureParsed.success) return res.status(400).json({ error: "Invalid input", details: fixtureParsed.error.errors });
    const fixture = await storage.createFixture({ ...req.body, userId });
    res.status(201).json(fixture);
  } catch {
    res.status(500).json({ message: "Failed to create fixture" });
  }
});


router.get("/api/fixtures/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const fixture = await storage.getFixture(id);
    if (!fixture) return res.status(404).json({ message: "Fixture not found" });
    const isAdmin = req.user.userRole === "admin" || req.user.activeRole === "admin";
    if (fixture.userId !== req.user.claims.sub && !isAdmin) return res.status(403).json({ message: "Forbidden" });
    res.json(fixture);
  } catch {
    res.status(500).json({ message: "Failed to fetch fixture" });
  }
});


router.patch("/api/fixtures/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const fixture = await storage.getFixture(id);
    if (!fixture) return res.status(404).json({ message: "Fixture not found" });
    const isAdmin = req.user.userRole === "admin" || req.user.activeRole === "admin";
    if (fixture.userId !== req.user.claims.sub && !isAdmin) return res.status(403).json({ message: "Forbidden" });
    const updated = await storage.updateFixture(id, req.body);
    res.json(updated);

    // Fixture "fixed" olduğunda otomatik voyage oluştur
    if (updated && (req.body.status === "fixed" || updated.status === "fixed") && fixture.status !== "fixed") {
      try {
        const userId = req.user.claims.sub;
        const loadingPort = updated.loadingPort || (updated as any).load_port;
        if (loadingPort) {
          const matchedPorts = await storage.searchPorts(loadingPort);
          const portId = matchedPorts[0]?.id;
          if (portId) {
            const voyage = await storage.createVoyage({
              userId,
              portId,
              vesselName: updated.vesselName || updated.vessel || "",
              imoNumber: updated.imoNumber || null,
              status: "planned",
              purposeOfCall: "Loading",
              cargoType: updated.cargoType || null,
              cargoQuantity: updated.cargoQuantity || null,
              eta: updated.laycanFrom ? new Date(updated.laycanFrom) : null,
              etd: updated.laycanTo ? new Date(updated.laycanTo) : null,
              notes: `Auto-created from Fixture #${updated.id}${updated.charterer ? ` — ${updated.charterer}` : ""}`,
              vesselId: null,
            } as any);
            console.log(`[fixture] Auto-created voyage #${voyage.id} from fixture #${updated.id}`);
            await storage.createNotification({
              userId,
              type: "voyage_created",
              title: "Voyage Created from Fixture",
              message: `Fixture #${updated.id} fixed — Voyage #${voyage.id} created for ${updated.vesselName || "vessel"}.`,
              link: `/voyages/${voyage.id}`,
            });
          }
        }
      } catch (voyageErr) {
        console.error("[fixture] Auto-voyage creation failed (non-blocking):", voyageErr);
      }
    }
  } catch {
    res.status(500).json({ message: "Failed to update fixture" });
  }
});


router.delete("/api/fixtures/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const fixture = await storage.getFixture(id);
    if (!fixture) return res.status(404).json({ message: "Fixture not found" });
    const isAdmin = req.user.userRole === "admin" || req.user.activeRole === "admin";
    if (fixture.userId !== req.user.claims.sub && !isAdmin) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteFixture(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete fixture" });
  }
});

router.post("/api/fixtures/:id/restore", isAuthenticated, async (req: any, res) => {
  try {
    const isAdmin = req.user.userRole === "admin" || req.user.activeRole === "admin";
    if (!isAdmin) return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
    const restored = await storage.restoreFixture(id);
    if (!restored) return res.status(404).json({ message: "Fixture not found" });
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to restore fixture" });
  }
});


router.get("/api/fixtures/:id/laytime", isAuthenticated, async (req: any, res) => {
  try {
    const fixtureId = parseInt(req.params.id);
    const { rows } = await pool.query(
      "SELECT * FROM laytime_calculations WHERE fixture_id = $1 ORDER BY created_at ASC",
      [fixtureId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Failed to fetch laytime calculations" });
  }
});


router.post("/api/fixtures/:id/laytime", isAuthenticated, async (req: any, res) => {
  try {
    const fixtureId = parseInt(req.params.id);
    const { calculateLaytime } = await import("../laytime-calculator");
    const {
      portCallType = "loading",
      portName,
      allowedLaytimeHours = 0,
      norStartedAt,
      berthingAt,
      loadingStartedAt,
      loadingCompletedAt,
      departedAt,
      demurrageRate = 0,
      despatchRate = 0,
      currency = "USD",
      deductions = [],
      notes,
    } = req.body;

    const calc = calculateLaytime({
      allowedLaytimeHours: Number(allowedLaytimeHours),
      norStartedAt,
      berthingAt,
      loadingStartedAt,
      loadingCompletedAt,
      departedAt,
      demurrageRate: Number(demurrageRate),
      despatchRate: Number(despatchRate),
      deductions,
    });

    const { rows } = await pool.query(
      `INSERT INTO laytime_calculations
        (fixture_id, port_call_type, port_name, allowed_laytime_hours,
         nor_started_at, berthing_at, loading_started_at, loading_completed_at, departed_at,
         time_used_hours, demurrage_rate, despatch_rate, demurrage_amount, despatch_amount,
         currency, deductions, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        fixtureId, portCallType, portName || null, allowedLaytimeHours,
        norStartedAt || null, berthingAt || null, loadingStartedAt || null,
        loadingCompletedAt || null, departedAt || null,
        calc.timeUsedHours, demurrageRate, despatchRate,
        calc.demurrageAmount, calc.despatchAmount,
        currency, JSON.stringify(deductions), notes || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ message: "Failed to create laytime calculation", error: e.message });
  }
});


router.put("/api/laytime/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { calculateLaytime } = await import("../laytime-calculator");
    const {
      portCallType,
      portName,
      allowedLaytimeHours,
      norStartedAt,
      berthingAt,
      loadingStartedAt,
      loadingCompletedAt,
      departedAt,
      demurrageRate,
      despatchRate,
      currency,
      deductions,
      notes,
    } = req.body;

    const calc = calculateLaytime({
      allowedLaytimeHours: Number(allowedLaytimeHours || 0),
      norStartedAt,
      berthingAt,
      loadingStartedAt,
      loadingCompletedAt,
      departedAt,
      demurrageRate: Number(demurrageRate || 0),
      despatchRate: Number(despatchRate || 0),
      deductions: deductions || [],
    });

    const { rows } = await pool.query(
      `UPDATE laytime_calculations SET
        port_call_type = $2, port_name = $3, allowed_laytime_hours = $4,
        nor_started_at = $5, berthing_at = $6, loading_started_at = $7,
        loading_completed_at = $8, departed_at = $9,
        time_used_hours = $10, demurrage_rate = $11, despatch_rate = $12,
        demurrage_amount = $13, despatch_amount = $14,
        currency = $15, deductions = $16, notes = $17
       WHERE id = $1 RETURNING *`,
      [
        id, portCallType, portName || null, allowedLaytimeHours || 0,
        norStartedAt || null, berthingAt || null, loadingStartedAt || null,
        loadingCompletedAt || null, departedAt || null,
        calc.timeUsedHours, demurrageRate || 0, despatchRate || 0,
        calc.demurrageAmount, calc.despatchAmount,
        currency || "USD", JSON.stringify(deductions || []), notes || null,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Not found" });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ message: "Failed to update laytime calculation", error: e.message });
  }
});


router.delete("/api/laytime/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await pool.query("DELETE FROM laytime_calculations WHERE id = $1", [id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete laytime calculation" });
  }
});


router.get("/api/cargo-positions", isAuthenticated, async (req: any, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string) : null;
    if (page && !isNaN(page) && page > 0) {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;
      const [dataRes, countRes] = await Promise.all([
        pool.query(`SELECT * FROM cargo_positions ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]),
        pool.query(`SELECT COUNT(*) as total FROM cargo_positions`),
      ]);
      const total = parseInt(countRes.rows[0].total) || 0;
      return res.json({ data: dataRes.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    }
    const positions = await storage.getCargoPositions();
    res.json(positions);
  } catch {
    res.status(500).json({ message: "Failed to fetch cargo positions" });
  }
});


router.get("/api/cargo-positions/mine", isAuthenticated, async (req: any, res) => {
  try {
    const positions = await storage.getMyCargoPositions(req.user.claims.sub);
    res.json(positions);
  } catch {
    res.status(500).json({ message: "Failed to fetch my cargo positions" });
  }
});


router.post("/api/cargo-positions", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const cargoParsed = insertCargoPositionSchema.partial().safeParse(req.body);
    if (!cargoParsed.success) return res.status(400).json({ error: "Invalid input", details: cargoParsed.error.errors });
    const pos = await storage.createCargoPosition({ ...req.body, userId });
    res.status(201).json(pos);

    if (pos.positionType === "cargo") {
      const allVessels = await storage.getAllVessels();
      const notifiedOwners = new Set<string>();
      for (const vessel of allVessels) {
        if (!vessel.userId || notifiedOwners.has(vessel.userId) || vessel.userId === userId) continue;
        notifiedOwners.add(vessel.userId);
        await storage.createNotification({
          userId: vessel.userId,
          type: "cargo_match",
          title: "New Cargo Listing",
          message: `${pos.cargoType || "Cargo"} listing: ${pos.loadingPort} → ${pos.dischargePort}`,
          link: "/cargo-positions",
        });
      }
    }
  } catch {
    res.status(500).json({ message: "Failed to create cargo position" });
  }
});


router.patch("/api/cargo-positions/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateCargoPosition(id, req.body);
    if (!updated) return res.status(404).json({ message: "Position not found" });
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to update cargo position" });
  }
});


router.delete("/api/cargo-positions/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteCargoPosition(id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete cargo position" });
  }
});


export default router;
