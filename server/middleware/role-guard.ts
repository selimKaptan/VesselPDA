import { Response, NextFunction } from "express";
import { storage } from "../storage";

export function requireRole(...roles: string[]) {
  return async (req: any, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const user = await storage.getUser(String(userId));
      if (!user || !roles.includes((user as any).userRole)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      next();
    } catch {
      return res.status(403).json({ error: "Access denied" });
    }
  };
}
