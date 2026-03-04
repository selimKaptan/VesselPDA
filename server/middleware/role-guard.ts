import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

export type AppRole = "ship_agent" | "shipowner" | "ship_broker" | "ship_provider" | "admin";

export function requireRole(...roles: AppRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.claims?.sub || (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "User not found" });

      const userRole = user.userRole as AppRole;

      if (userRole === "admin") return next();

      if (roles.includes(userRole)) return next();

      return res.status(403).json({
        message: "Access denied. This action requires one of these roles: " + roles.join(", "),
        required: roles,
        current: userRole,
      });
    } catch {
      return res.status(500).json({ message: "Role check failed" });
    }
  };
}

export function requireAdmin() {
  return requireRole("admin");
}
