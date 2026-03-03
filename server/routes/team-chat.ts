import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { pool } from "../db";
import { getSocketServer } from "../socket";

const router = Router();

function getUserId(req: any): string {
  return req.user?.claims?.sub || req.user?.id;
}

async function isOrgMember(orgId: number, userId: string): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND is_active = true",
    [orgId, userId]
  );
  if (rows.length > 0) return true;
  const { rows: own } = await pool.query("SELECT id FROM organizations WHERE id = $1 AND owner_id = $2", [orgId, userId]);
  return own.length > 0;
}

async function isOrgAdmin(orgId: number, userId: string): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND role IN ('admin','owner') AND is_active = true",
    [orgId, userId]
  );
  if (rows.length > 0) return true;
  const { rows: own } = await pool.query("SELECT id FROM organizations WHERE id = $1 AND owner_id = $2", [orgId, userId]);
  return own.length > 0;
}

async function canAccessChannel(channelId: number, userId: string): Promise<boolean> {
  const { rows } = await pool.query("SELECT * FROM team_channels WHERE id = $1", [channelId]);
  if (!rows.length) return false;
  const ch = rows[0];
  const member = await isOrgMember(ch.organization_id, userId);
  if (!member) return false;
  if (ch.channel_type === "public") return true;
  const { rows: cm } = await pool.query(
    "SELECT 1 FROM team_channel_members WHERE channel_id = $1 AND user_id = $2",
    [channelId, userId]
  );
  return cm.length > 0;
}

// ── GET /api/organizations/:orgId/channels
router.get("/:orgId/channels", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const orgId = parseInt(req.params.orgId);
    if (!(await isOrgMember(orgId, userId))) return res.status(403).json({ message: "Not a member" });

    const { rows } = await pool.query(
      `SELECT tc.*, u.first_name, u.last_name,
        (SELECT COUNT(*) FROM team_messages tm WHERE tm.channel_id = tc.id) AS message_count,
        (SELECT COUNT(*) FROM team_channel_members tcm WHERE tcm.channel_id = tc.id) AS member_count
       FROM team_channels tc
       LEFT JOIN users u ON u.id = tc.created_by_user_id
       WHERE tc.organization_id = $1
         AND (tc.channel_type = 'public' OR EXISTS (
           SELECT 1 FROM team_channel_members tcm2 WHERE tcm2.channel_id = tc.id AND tcm2.user_id = $2
         ))
       ORDER BY tc.created_at ASC`,
      [orgId, userId]
    );
    res.json(rows);
  } catch (e) {
    console.error("GET channels error:", e);
    res.status(500).json({ message: "Failed to get channels" });
  }
});

// ── POST /api/organizations/:orgId/channels
router.post("/:orgId/channels", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const orgId = parseInt(req.params.orgId);
    if (!(await isOrgMember(orgId, userId))) return res.status(403).json({ message: "Not a member" });

    const { name, description, channelType } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "name required" });

    const { rows } = await pool.query(
      `INSERT INTO team_channels (organization_id, name, description, channel_type, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [orgId, name.trim(), description || null, channelType || "public", userId]
    );
    const channel = rows[0];

    if (channel.channel_type === "private") {
      await pool.query(
        "INSERT INTO team_channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [channel.id, userId]
      );
    }

    const io = getSocketServer();
    if (io) io.to(`org:${orgId}`).emit("channel_created", channel);

    res.status(201).json(channel);
  } catch (e) {
    console.error("POST channel error:", e);
    res.status(500).json({ message: "Failed to create channel" });
  }
});

// ── PATCH /api/organizations/:orgId/channels/:channelId
router.patch("/:orgId/channels/:channelId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const orgId = parseInt(req.params.orgId);
    const channelId = parseInt(req.params.channelId);
    if (!(await isOrgAdmin(orgId, userId))) return res.status(403).json({ message: "Admin only" });

    const { name, description } = req.body;
    const { rows } = await pool.query(
      `UPDATE team_channels SET name = COALESCE($1, name), description = COALESCE($2, description)
       WHERE id = $3 AND organization_id = $4 RETURNING *`,
      [name || null, description !== undefined ? description : null, channelId, orgId]
    );
    if (!rows.length) return res.status(404).json({ message: "Channel not found" });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ message: "Failed to update channel" });
  }
});

// ── DELETE /api/organizations/:orgId/channels/:channelId
router.delete("/:orgId/channels/:channelId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const orgId = parseInt(req.params.orgId);
    const channelId = parseInt(req.params.channelId);
    if (!(await isOrgAdmin(orgId, userId))) return res.status(403).json({ message: "Admin only" });

    const { rows } = await pool.query(
      "SELECT name FROM team_channels WHERE id = $1 AND organization_id = $2",
      [channelId, orgId]
    );
    if (!rows.length) return res.status(404).json({ message: "Channel not found" });
    if (rows[0].name === "General") return res.status(400).json({ message: "Cannot delete General channel" });

    await pool.query("DELETE FROM team_channels WHERE id = $1", [channelId]);
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ message: "Failed to delete channel" });
  }
});

// ── GET /api/organizations/:orgId/channels/:channelId/messages
router.get("/:orgId/channels/:channelId/messages", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const channelId = parseInt(req.params.channelId);
    if (!(await canAccessChannel(channelId, userId))) return res.status(403).json({ message: "Access denied" });

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(
      `SELECT tm.*, 
        u.first_name, u.last_name, u.profile_image_url,
        r.content AS reply_content,
        ru.first_name AS reply_first_name, ru.last_name AS reply_last_name
       FROM team_messages tm
       JOIN users u ON u.id = tm.sender_id
       LEFT JOIN team_messages r ON r.id = tm.reply_to_id
       LEFT JOIN users ru ON ru.id = r.sender_id
       WHERE tm.channel_id = $1
       ORDER BY tm.created_at ASC
       LIMIT $2 OFFSET $3`,
      [channelId, limit, offset]
    );
    res.json(rows);
  } catch (e) {
    console.error("GET messages error:", e);
    res.status(500).json({ message: "Failed to get messages" });
  }
});

// ── POST /api/organizations/:orgId/channels/:channelId/messages
router.post("/:orgId/channels/:channelId/messages", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const channelId = parseInt(req.params.channelId);
    if (!(await canAccessChannel(channelId, userId))) return res.status(403).json({ message: "Access denied" });

    const { content, messageType, replyToId, fileUrl, fileName } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: "content required" });

    const { rows } = await pool.query(
      `INSERT INTO team_messages (channel_id, sender_id, content, message_type, reply_to_id, file_url, file_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [channelId, userId, content.trim(), messageType || "text", replyToId || null, fileUrl || null, fileName || null]
    );
    const msg = rows[0];

    const { rows: userRows } = await pool.query(
      "SELECT first_name, last_name, profile_image_url FROM users WHERE id = $1",
      [userId]
    );
    const u = userRows[0];
    const fullMsg = { ...msg, first_name: u?.first_name, last_name: u?.last_name, profile_image_url: u?.profile_image_url };

    const io = getSocketServer();
    if (io) io.to(`channel:${channelId}`).emit("team_message", fullMsg);

    res.status(201).json(fullMsg);
  } catch (e) {
    console.error("POST message error:", e);
    res.status(500).json({ message: "Failed to send message" });
  }
});


// ── POST /api/organizations/:orgId/channels/:channelId/members
router.post("/:orgId/channels/:channelId/members", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const orgId = parseInt(req.params.orgId);
    const channelId = parseInt(req.params.channelId);
    if (!(await isOrgAdmin(orgId, userId))) return res.status(403).json({ message: "Admin only" });

    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ message: "targetUserId required" });

    await pool.query(
      "INSERT INTO team_channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [channelId, targetUserId]
    );
    res.status(201).json({ message: "Added" });
  } catch (e) {
    res.status(500).json({ message: "Failed to add member" });
  }
});

// ── DELETE /api/organizations/:orgId/channels/:channelId/members/:userId
router.delete("/:orgId/channels/:channelId/members/:targetUserId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const orgId = parseInt(req.params.orgId);
    const channelId = parseInt(req.params.channelId);
    if (!(await isOrgAdmin(orgId, userId))) return res.status(403).json({ message: "Admin only" });

    await pool.query(
      "DELETE FROM team_channel_members WHERE channel_id = $1 AND user_id = $2",
      [channelId, req.params.targetUserId]
    );
    res.json({ message: "Removed" });
  } catch (e) {
    res.status(500).json({ message: "Failed to remove member" });
  }
});

export default router;
