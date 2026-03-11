import type { Express } from "express";
import { db } from "./db";
import { proformas, proformaApprovalLogs } from "@shared/schema";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { isAuthenticated } from "./replit_integrations/auth";

const VALID_APPROVAL_STATUSES = ["draft", "sent", "under_review", "revision_requested", "approved", "rejected"];

async function createApprovalLog(
  proformaId: number,
  userId: string,
  action: string,
  previousStatus: string,
  newStatus: string,
  note?: string
) {
  await db.insert(proformaApprovalLogs).values({
    proformaId,
    userId,
    action,
    note: note || null,
    previousStatus,
    newStatus,
  });
}

export function registerProformaApprovalRoutes(app: Express) {
  app.get("/api/proformas/pending-approval", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const user = await pool.query("SELECT user_role FROM users WHERE id = $1", [userId]);
      const role = user.rows[0]?.user_role;

      if (!["shipowner", "admin"].includes(role)) {
        return res.status(403).json({ message: "Only shipowners and admins can view pending approvals" });
      }

      const { rows } = await pool.query(`
        SELECT
          p.id, p.reference_number, p.to_company, p.total_usd, p.sent_at,
          p.approval_status, p.created_at, p.purpose_of_call,
          v.name AS vessel_name, v.flag AS vessel_flag,
          po.name AS port_name,
          u.first_name || ' ' || COALESCE(u.last_name, '') AS agent_name,
          u.email AS agent_email
        FROM proformas p
        LEFT JOIN vessels v ON v.id = p.vessel_id
        LEFT JOIN ports po ON po.id = p.port_id
        LEFT JOIN users u ON u.id = p.user_id
        WHERE p.approval_status IN ('sent', 'under_review')
        ORDER BY p.sent_at ASC NULLS LAST
      `);

      return res.json(rows);
    } catch (err) {
      console.error("[proforma-approval] pending-approval error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/proformas/:id/send", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const proformaId = parseInt(req.params.id);

      const [proforma] = await db.select().from(proformas).where(eq(proformas.id, proformaId));
      if (!proforma) return res.status(404).json({ message: "Proforma not found" });
      if (proforma.userId !== userId) return res.status(403).json({ message: "Only the proforma owner can send it for approval" });

      const allowedFromStatuses = ["draft", "revision_requested"];
      if (!allowedFromStatuses.includes(proforma.approvalStatus)) {
        return res.status(400).json({ message: `Cannot send a proforma with status: ${proforma.approvalStatus}` });
      }

      const previousStatus = proforma.approvalStatus;
      const [updated] = await db
        .update(proformas)
        .set({ approvalStatus: "sent", sentAt: new Date() })
        .where(eq(proformas.id, proformaId))
        .returning();

      await createApprovalLog(proformaId, userId, "sent", previousStatus, "sent");

      return res.json(updated);
    } catch (err) {
      console.error("[proforma-approval] send error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/proformas/:id/review", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const proformaId = parseInt(req.params.id);
      const { action, note } = req.body;

      if (!["approve", "reject", "request_revision"].includes(action)) {
        return res.status(400).json({ message: "Invalid action. Use: approve | reject | request_revision" });
      }

      const user = await pool.query("SELECT user_role FROM users WHERE id = $1", [userId]);
      const role = user.rows[0]?.user_role;
      if (!["shipowner", "admin"].includes(role)) {
        return res.status(403).json({ message: "Only shipowners and admins can review proformas" });
      }

      const [proforma] = await db.select().from(proformas).where(eq(proformas.id, proformaId));
      if (!proforma) return res.status(404).json({ message: "Proforma not found" });

      const allowedFromStatuses = ["sent", "under_review"];
      if (!allowedFromStatuses.includes(proforma.approvalStatus)) {
        return res.status(400).json({ message: `Proforma must be in 'sent' or 'under_review' status to review (current: ${proforma.approvalStatus})` });
      }

      const previousStatus = proforma.approvalStatus;
      let newStatus: string;
      let updateFields: Record<string, any> = { reviewedAt: new Date(), reviewedBy: userId };

      if (action === "approve") {
        newStatus = "approved";
        updateFields.approvalNote = note || null;
      } else if (action === "reject") {
        newStatus = "rejected";
        updateFields.approvalNote = note || null;
      } else {
        newStatus = "revision_requested";
        updateFields.revisionNote = note || null;
      }
      updateFields.approvalStatus = newStatus;

      const [updated] = await db
        .update(proformas)
        .set(updateFields)
        .where(eq(proformas.id, proformaId))
        .returning();

      await createApprovalLog(proformaId, userId, action, previousStatus, newStatus, note);

      return res.json(updated);
    } catch (err) {
      console.error("[proforma-approval] review error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/proformas/:id/approval-history", isAuthenticated, async (req: any, res) => {
    try {
      const proformaId = parseInt(req.params.id);
      const userId = req.user?.claims?.sub;

      const [proforma] = await db.select({ id: proformas.id, userId: proformas.userId })
        .from(proformas).where(eq(proformas.id, proformaId));
      if (!proforma) return res.status(404).json({ message: "Proforma not found" });

      const user = await pool.query("SELECT user_role FROM users WHERE id = $1", [userId]);
      const role = user.rows[0]?.user_role;
      const canView = proforma.userId === userId || ["shipowner", "admin"].includes(role);
      if (!canView) return res.status(403).json({ message: "Access denied" });

      const { rows } = await pool.query(`
        SELECT
          pal.id, pal.action, pal.note, pal.previous_status, pal.new_status, pal.created_at,
          u.first_name || ' ' || COALESCE(u.last_name, '') AS user_name,
          u.user_role
        FROM proforma_approval_logs pal
        LEFT JOIN users u ON u.id = pal.user_id
        WHERE pal.proforma_id = $1
        ORDER BY pal.created_at ASC
      `, [proformaId]);

      return res.json(rows);
    } catch (err) {
      console.error("[proforma-approval] history error:", err);
      return res.status(500).json({ message: "Server error" });
    }
  });
}
