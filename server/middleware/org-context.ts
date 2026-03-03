import { pool } from "../db";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      organizationId?: number | null;
    }
  }
}

function getUserId(req: any): string | null {
  return req.user?.claims?.sub || req.user?.id || null;
}

/**
 * attachOrgContext
 *
 * Resolves the authenticated user's active organization and attaches it to req.
 * - req.organizationId = organizationId if user is in an active org, else null
 * - Runs as middleware; always calls next() (non-blocking on error)
 */
export async function attachOrgContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = getUserId(req as any);
  if (!userId) { req.organizationId = null; next(); return; }
  try {
    const { rows } = await pool.query(
      "SELECT active_organization_id FROM users WHERE id = $1",
      [userId]
    );
    req.organizationId = rows[0]?.active_organization_id ?? null;
  } catch {
    req.organizationId = null;
  }
  next();
}
