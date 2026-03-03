import { checkSanctions, getSanctionsStatus } from "../sanctions";
import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { db, pool } from "../db";
import { sql as drizzleSql } from "drizzle-orm";
import { logAction, getClientIp } from "../audit";

async function isAdmin(req: any): Promise<boolean> {
  const userId = req.user?.claims?.sub;
  if (!userId) return false;
  const user = await storage.getUser(userId);
  return user?.userRole === "admin";
}

const router = Router();

// ─── FLEETS ───────────────────────────────────────────────────────────────

router.get("/fleets", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const result = await pool.query(
      `SELECT f.*,
              COUNT(fv.vessel_id)::int AS vessel_count,
              COALESCE(ARRAY_AGG(fv.vessel_id) FILTER (WHERE fv.vessel_id IS NOT NULL), '{}') AS vessel_ids,
              COALESCE(ARRAY_AGG(v.mmsi) FILTER (WHERE v.mmsi IS NOT NULL AND v.mmsi <> ''), '{}') AS vessel_mmsis
       FROM fleets f
       LEFT JOIN fleet_vessels fv ON fv.fleet_id = f.id
       LEFT JOIN vessels v ON v.id = fv.vessel_id
       WHERE f.user_id = $1 AND f.is_active = true
       GROUP BY f.id
       ORDER BY f.created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch fleets" });
  }
});

router.post("/fleets", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { name, description, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Fleet name is required" });
    const result = await pool.query(
      `INSERT INTO fleets (user_id, name, description, color) VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, name.trim(), description?.trim() || null, color || "#2563EB"]
    );
    res.json({ ...result.rows[0], vessel_count: 0, vessel_ids: [], vessel_mmsis: [] });
  } catch (error) {
    res.status(500).json({ message: "Failed to create fleet" });
  }
});

router.put("/fleets/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { name, description, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Fleet name is required" });
    const result = await pool.query(
      `UPDATE fleets SET name = $1, description = $2, color = $3 WHERE id = $4 AND user_id = $5 RETURNING *`,
      [name.trim(), description?.trim() || null, color || "#2563EB", req.params.id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Fleet not found" });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Failed to update fleet" });
  }
});

router.delete("/fleets/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const result = await pool.query(
      `DELETE FROM fleets WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );
    if ((result.rowCount ?? 0) === 0) return res.status(404).json({ message: "Fleet not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete fleet" });
  }
});

router.post("/fleets/:id/vessels", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { vesselId } = req.body;
    if (!vesselId) return res.status(400).json({ message: "vesselId is required" });
    const fleet = await pool.query("SELECT id FROM fleets WHERE id = $1 AND user_id = $2", [req.params.id, userId]);
    if (fleet.rows.length === 0) return res.status(404).json({ message: "Fleet not found" });
    await pool.query(
      `INSERT INTO fleet_vessels (fleet_id, vessel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.params.id, vesselId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to add vessel to fleet" });
  }
});

router.delete("/fleets/:id/vessels/:vesselId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const fleet = await pool.query("SELECT id FROM fleets WHERE id = $1 AND user_id = $2", [req.params.id, userId]);
    if (fleet.rows.length === 0) return res.status(404).json({ message: "Fleet not found" });
    await pool.query(
      `DELETE FROM fleet_vessels WHERE fleet_id = $1 AND vessel_id = $2`,
      [req.params.id, req.params.vesselId]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove vessel from fleet" });
  }
});

// ─── SANCTIONS ────────────────────────────────────────────────────────────

router.get("/sanctions/check", isAuthenticated, async (req: any, res) => {
  try {
    const name = req.query.name as string;
    const imo = req.query.imo as string | undefined;
    if (!name) return res.status(400).json({ message: "name is required" });
    const result = checkSanctions(name, imo);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to check sanctions" });
  }
});

router.get("/sanctions/status", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    res.json(getSanctionsStatus());
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch sanctions status" });
  }
});

export default router;
