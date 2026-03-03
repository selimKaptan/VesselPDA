import { pool } from "../db";
import type { Request, Response, NextFunction } from "express";
import type { OrgPermissions } from "@shared/schema";

function getUserId(req: any): string | null {
  return req.user?.claims?.sub || req.user?.id || null;
}

/**
 * checkPermission(module, action)
 *
 * Checks if the authenticated user has the required permission
 * within their active organization's assigned role.
 *
 * - If user has no active organization → passes through (individual user, old system)
 * - If user is org owner → always allowed
 * - If user has a roleId → checks the role's permissions jsonb
 * - If user has no roleId but is org member → falls back to built-in role string check
 */
export function checkPermission(module: keyof OrgPermissions, action: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = getUserId(req);
    if (!userId) { res.status(401).json({ message: "Unauthorized" }); return; }

    try {
      // Get user's active organization
      const { rows: userRows } = await pool.query(
        "SELECT active_organization_id FROM users WHERE id = $1",
        [userId]
      );
      const activeOrgId = userRows[0]?.active_organization_id;

      // No active org → individual user, pass through
      if (!activeOrgId) { next(); return; }

      // Check if org owner (always allowed)
      const { rows: orgRows } = await pool.query(
        "SELECT owner_id FROM organizations WHERE id = $1",
        [activeOrgId]
      );
      if (orgRows[0]?.owner_id === userId) { next(); return; }

      // Get membership
      const { rows: memberRows } = await pool.query(
        "SELECT role, role_id FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND is_active = true",
        [activeOrgId, userId]
      );
      if (!memberRows.length) {
        res.status(403).json({ message: "Not a member of the active organization" });
        return;
      }

      const { role, role_id } = memberRows[0];

      // Owner/admin roles always pass
      if (role === "owner" || role === "admin") { next(); return; }

      // If has custom roleId, check permissions jsonb
      if (role_id) {
        const { rows: roleRows } = await pool.query(
          "SELECT permissions, is_owner_role FROM organization_roles WHERE id = $1",
          [role_id]
        );
        if (!roleRows.length) { res.status(403).json({ message: "Role not found" }); return; }
        if (roleRows[0].is_owner_role) { next(); return; }

        const perms: any = roleRows[0].permissions || {};
        const modulePerms = perms[module];
        if (!modulePerms || !modulePerms[action]) {
          res.status(403).json({
            message: `Permission denied: ${module}.${action}`,
            module,
            action,
          });
          return;
        }
        next();
        return;
      }

      // Fallback: viewer role → only "view" actions allowed
      if (role === "viewer" && action !== "view") {
        res.status(403).json({ message: `Permission denied: ${module}.${action}` });
        return;
      }

      next();
    } catch (err) {
      console.error("[permissions] checkPermission error:", err);
      next(); // fail-open on error to avoid breaking existing flows
    }
  };
}
