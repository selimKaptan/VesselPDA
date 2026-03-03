import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { pool } from "../db";
import { randomBytes } from "crypto";

const router = Router();

function getUserId(req: any): string {
  return req.user?.claims?.sub || req.user?.id;
}

async function isOrgOwner(orgId: number, userId: string): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT id FROM organizations WHERE id = $1 AND owner_id = $2",
    [orgId, userId]
  );
  return rows.length > 0;
}

async function isOrgMember(orgId: number, userId: string): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND is_active = true",
    [orgId, userId]
  );
  return rows.length > 0;
}

async function isOrgAdmin(orgId: number, userId: string): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND role IN ('admin','owner') AND is_active = true",
    [orgId, userId]
  );
  if (rows.length > 0) return true;
  return isOrgOwner(orgId, userId);
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);
}

// ── POST /api/organizations ── create new org
router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const { name, type, website, phone, email, address, country, taxId, logoUrl } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Organization name is required" });

    const slug = generateSlug(name.trim());
    const { rows } = await pool.query(
      `INSERT INTO organizations (name, slug, type, logo_url, website, phone, email, address, country, tax_id, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [name.trim(), slug, type || "other", logoUrl || null, website || null, phone || null,
       email || null, address || null, country || null, taxId || null, userId]
    );
    const org = rows[0];

    // Auto-add owner as admin member
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role, display_name)
       VALUES ($1,$2,'owner',$3)`,
      [org.id, userId, name.trim()]
    );

    // Set as active organization for the creator
    await pool.query("UPDATE users SET active_organization_id = $1 WHERE id = $2", [org.id, userId]);

    // Auto-create General channel
    await pool.query(
      `INSERT INTO team_channels (organization_id, name, description, channel_type, created_by_user_id)
       VALUES ($1, 'General', 'General team announcements and discussions', 'public', $2)`,
      [org.id, userId]
    );

    res.status(201).json(org);
  } catch (err: any) {
    console.error("[org] create error:", err);
    res.status(500).json({ message: "Failed to create organization" });
  }
});

// ── GET /api/organizations/my ── user's organizations
router.get("/my", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const { rows } = await pool.query(
      `SELECT o.*, om.role AS member_role, om.job_title, om.department
       FROM organizations o
       JOIN organization_members om ON om.organization_id = o.id
       WHERE om.user_id = $1 AND om.is_active = true AND o.is_active = true
       ORDER BY o.name`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch organizations" });
  }
});

// ── GET /api/organizations/invite/:token ── public invite detail
router.get("/invite/:token", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT oi.*, o.name AS org_name, o.type AS org_type, o.logo_url AS org_logo
       FROM organization_invites oi
       JOIN organizations o ON o.id = oi.organization_id
       WHERE oi.token = $1`,
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ message: "Invite not found" });
    const invite = rows[0];
    if (invite.status !== "pending") return res.status(410).json({ message: "Invite is no longer valid" });
    if (new Date(invite.expires_at) < new Date()) {
      await pool.query("UPDATE organization_invites SET status = 'expired' WHERE token = $1", [req.params.token]);
      return res.status(410).json({ message: "Invite has expired" });
    }
    res.json(invite);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch invite" });
  }
});

// ── POST /api/organizations/join/:token ── accept invite
router.post("/join/:token", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const { rows } = await pool.query(
      "SELECT * FROM organization_invites WHERE token = $1",
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ message: "Invite not found" });
    const invite = rows[0];
    if (invite.status !== "pending") return res.status(410).json({ message: "Invite is no longer valid" });
    if (new Date(invite.expires_at) < new Date()) {
      await pool.query("UPDATE organization_invites SET status = 'expired' WHERE token = $1", [req.params.token]);
      return res.status(410).json({ message: "Invite has expired" });
    }

    // Check if already a member
    const { rows: existing } = await pool.query(
      "SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2",
      [invite.organization_id, userId]
    );
    if (existing.length > 0) {
      await pool.query("UPDATE organization_members SET is_active = true WHERE organization_id = $1 AND user_id = $2", [invite.organization_id, userId]);
    } else {
      await pool.query(
        `INSERT INTO organization_members (organization_id, user_id, role, invited_by)
         VALUES ($1,$2,$3,$4)`,
        [invite.organization_id, userId, invite.role, invite.invited_by_user_id]
      );
    }

    await pool.query("UPDATE organization_invites SET status = 'accepted' WHERE token = $1", [req.params.token]);
    await pool.query("UPDATE users SET active_organization_id = $1 WHERE id = $2", [invite.organization_id, userId]);

    const { rows: org } = await pool.query("SELECT * FROM organizations WHERE id = $1", [invite.organization_id]);
    res.json({ success: true, organization: org[0] });
  } catch (err) {
    console.error("[org] join error:", err);
    res.status(500).json({ message: "Failed to join organization" });
  }
});

// ── GET /api/organizations/:id ── org detail
router.get("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const orgId = parseInt(req.params.id);
    const { rows } = await pool.query("SELECT * FROM organizations WHERE id = $1", [orgId]);
    if (!rows.length) return res.status(404).json({ message: "Organization not found" });
    const isMember = await isOrgMember(orgId, userId);
    const isOwner = rows[0].owner_id === userId;
    if (!isMember && !isOwner) return res.status(403).json({ message: "Not a member of this organization" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch organization" });
  }
});

// ── PATCH /api/organizations/:id ── update org
router.patch("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const orgId = parseInt(req.params.id);
    const canEdit = await isOrgAdmin(orgId, userId);
    if (!canEdit) return res.status(403).json({ message: "Only admins can update organization details" });

    const { name, type, website, phone, email, address, country, taxId, logoUrl } = req.body;
    const { rows } = await pool.query(
      `UPDATE organizations SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        website = COALESCE($3, website),
        phone = COALESCE($4, phone),
        email = COALESCE($5, email),
        address = COALESCE($6, address),
        country = COALESCE($7, country),
        tax_id = COALESCE($8, tax_id),
        logo_url = COALESCE($9, logo_url)
       WHERE id = $10 RETURNING *`,
      [name || null, type || null, website ?? null, phone ?? null, email ?? null,
       address ?? null, country ?? null, taxId ?? null, logoUrl ?? null, orgId]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Failed to update organization" });
  }
});

// ── DELETE /api/organizations/:id ── delete org (owner only)
router.delete("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const orgId = parseInt(req.params.id);
    const isOwner = await isOrgOwner(orgId, userId);
    if (!isOwner) return res.status(403).json({ message: "Only the owner can delete the organization" });
    await pool.query("DELETE FROM organizations WHERE id = $1", [orgId]);
    // Clear active org for all members
    await pool.query("UPDATE users SET active_organization_id = NULL WHERE active_organization_id = $1", [orgId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete organization" });
  }
});

// ── GET /api/organizations/:id/members ── member list
router.get("/:id/members", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const orgId = parseInt(req.params.id);
    const isMember = await isOrgMember(orgId, userId);
    const isOwner = await isOrgOwner(orgId, userId);
    if (!isMember && !isOwner) return res.status(403).json({ message: "Not a member" });

    const { rows } = await pool.query(
      `SELECT om.*, u.email, u.first_name, u.last_name, u.profile_image_url
       FROM organization_members om
       JOIN users u ON u.id = om.user_id
       WHERE om.organization_id = $1 AND om.is_active = true
       ORDER BY om.joined_at`,
      [orgId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch members" });
  }
});

// ── POST /api/organizations/:id/invite ── invite member
router.post("/:id/invite", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const orgId = parseInt(req.params.id);
    const canAdmin = await isOrgAdmin(orgId, userId);
    if (!canAdmin) return res.status(403).json({ message: "Only admins can invite members" });

    const { email, role } = req.body;
    if (!email?.trim()) return res.status(400).json({ message: "Email is required" });

    // Check org member limit
    const { rows: org } = await pool.query("SELECT max_members FROM organizations WHERE id = $1", [orgId]);
    const { rows: memberCount } = await pool.query(
      "SELECT COUNT(*) FROM organization_members WHERE organization_id = $1 AND is_active = true",
      [orgId]
    );
    if (parseInt(memberCount[0].count) >= org[0].max_members) {
      return res.status(400).json({ message: `Member limit reached (max ${org[0].max_members})` });
    }

    // Check for existing pending invite
    const { rows: existing } = await pool.query(
      "SELECT id FROM organization_invites WHERE organization_id = $1 AND invited_email = $2 AND status = 'pending'",
      [orgId, email.trim().toLowerCase()]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: "A pending invite already exists for this email" });
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { rows } = await pool.query(
      `INSERT INTO organization_invites (organization_id, invited_email, invited_by_user_id, role, token, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [orgId, email.trim().toLowerCase(), userId, role || "member", token, expiresAt]
    );

    // Send invite email (non-blocking)
    const { rows: orgRow } = await pool.query("SELECT name FROM organizations WHERE id = $1", [orgId]);
    const { rows: inviterRow } = await pool.query("SELECT first_name, last_name FROM users WHERE id = $1", [userId]);
    const inviterName = `${inviterRow[0]?.first_name || ""} ${inviterRow[0]?.last_name || ""}`.trim() || "A team member";
    const { sendOrganizationInviteEmail } = await import("../email");
    sendOrganizationInviteEmail({
      to: email.trim().toLowerCase(),
      orgName: orgRow[0]?.name || "the organization",
      inviterName,
      inviteToken: token,
      role: role || "member",
    }).catch((e: any) => console.error("[org] invite email failed:", e));

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("[org] invite error:", err);
    res.status(500).json({ message: "Failed to send invite" });
  }
});

// ── DELETE /api/organizations/:id/members/:userId ── remove member
router.delete("/:id/members/:memberId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const orgId = parseInt(req.params.id);
    const targetUserId = req.params.memberId;

    // Can remove self, or admin can remove others
    if (userId !== targetUserId) {
      const canAdmin = await isOrgAdmin(orgId, userId);
      if (!canAdmin) return res.status(403).json({ message: "Only admins can remove members" });
    }
    // Cannot remove owner
    const { rows: org } = await pool.query("SELECT owner_id FROM organizations WHERE id = $1", [orgId]);
    if (org[0]?.owner_id === targetUserId) return res.status(400).json({ message: "Cannot remove the organization owner" });

    await pool.query(
      "UPDATE organization_members SET is_active = false WHERE organization_id = $1 AND user_id = $2",
      [orgId, targetUserId]
    );
    // Clear active org if leaving
    await pool.query(
      "UPDATE users SET active_organization_id = NULL WHERE id = $1 AND active_organization_id = $2",
      [targetUserId, orgId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove member" });
  }
});

// ── PATCH /api/organizations/:id/members/:memberId ── update member role
router.patch("/:id/members/:memberId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const orgId = parseInt(req.params.id);
    const canAdmin = await isOrgAdmin(orgId, userId);
    if (!canAdmin) return res.status(403).json({ message: "Only admins can change member roles" });

    const { role, department, jobTitle, displayName } = req.body;
    await pool.query(
      `UPDATE organization_members SET
        role = COALESCE($1, role),
        department = COALESCE($2, department),
        job_title = COALESCE($3, job_title),
        display_name = COALESCE($4, display_name)
       WHERE organization_id = $5 AND user_id = $6`,
      [role || null, department ?? null, jobTitle ?? null, displayName ?? null, orgId, req.params.memberId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to update member" });
  }
});

// ── GET /api/organizations/:id/invites ── pending invites
router.get("/:id/invites", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const orgId = parseInt(req.params.id);
    const canAdmin = await isOrgAdmin(orgId, userId);
    if (!canAdmin) return res.status(403).json({ message: "Only admins can view invites" });

    const { rows } = await pool.query(
      `SELECT oi.*, u.first_name, u.last_name FROM organization_invites oi
       LEFT JOIN users u ON u.id = oi.invited_by_user_id
       WHERE oi.organization_id = $1 AND oi.status = 'pending'
       ORDER BY oi.created_at DESC`,
      [orgId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch invites" });
  }
});

// ── DELETE /api/organizations/:id/invites/:inviteId ── cancel invite
router.delete("/:id/invites/:inviteId", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const orgId = parseInt(req.params.id);
    const canAdmin = await isOrgAdmin(orgId, userId);
    if (!canAdmin) return res.status(403).json({ message: "Only admins can cancel invites" });
    await pool.query("UPDATE organization_invites SET status = 'cancelled' WHERE id = $1 AND organization_id = $2", [req.params.inviteId, orgId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to cancel invite" });
  }
});

// ── POST /api/organizations/switch/:id ── switch active org
router.post("/switch/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const orgId = parseInt(req.params.id);
    const isMember = await isOrgMember(orgId, userId);
    const isOwner = await isOrgOwner(orgId, userId);
    if (!isMember && !isOwner) return res.status(403).json({ message: "Not a member of this organization" });
    await pool.query("UPDATE users SET active_organization_id = $1 WHERE id = $2", [orgId, userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to switch organization" });
  }
});

// ── GET /api/organizations/:id/activity ── activity feed
router.get("/:id/activity", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const orgId = parseInt(req.params.id);
    const isMember = await isOrgMember(orgId, userId);
    const isOwner = await isOrgOwner(orgId, userId);
    if (!isMember && !isOwner) return res.status(403).json({ message: "Not a member" });
    const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);
    const { getOrgActivityFeed } = await import("../utils/orgActivity");
    const feed = await getOrgActivityFeed(orgId, limit);
    res.json(feed);
  } catch (err) {
    console.error("[org] activity feed error:", err);
    res.status(500).json({ message: "Failed to fetch activity feed" });
  }
});

export default router;
