import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { seedDemoData } from "../demo-seed";
import { db } from "../db";
import { users } from "../../shared/models/auth";
import { eq } from "drizzle-orm";

const demoRouter = Router();

demoRouter.post("/api/user/seed-demo", isAuthenticated, async (req: any, res: any) => {
  const userId = req.user?.claims?.sub || req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.demoSeeded) return res.json({ success: true, alreadySeeded: true });

    const summary = await seedDemoData(userId, user.userRole);
    return res.json({ success: true, summary });
  } catch (err: any) {
    console.error("[demo-seed route] Failed:", err?.message);
    return res.status(500).json({ error: "Seed failed", detail: err?.message });
  }
});

export default demoRouter;
