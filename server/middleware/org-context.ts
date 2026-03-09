import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { organizationMembers } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export async function attachOrgContext(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).user?.claims?.sub || (req as any).user?.id;
  if (!userId) return next();

  try {
    const [membership] = await db.select()
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.isActive, true)
      ))
      .limit(1);

    if (membership) {
      (req as any).organizationId = membership.organizationId;
      (req as any).orgRole = membership.role;
      (req as any).orgPermissions = membership.permissions;
    }
  } catch {}

  next();
}
