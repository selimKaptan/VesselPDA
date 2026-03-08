import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { db } from "../db";
import { portCallParticipants, insertPortCallParticipantSchema } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const portCallId = req.query.portCallId ? parseInt(req.query.portCallId as string) : undefined;
    if (!portCallId) {
      return res.status(400).json({ message: "portCallId is required" });
    }
    const participants = await db.select().from(portCallParticipants)
      .where(eq(portCallParticipants.portCallId, portCallId))
      .orderBy(portCallParticipants.createdAt);
    res.json(participants);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const parsed = insertPortCallParticipantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
    }
    const [participant] = await db.insert(portCallParticipants).values(parsed.data).returning();
    res.status(201).json(participant);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db.update(portCallParticipants)
      .set(req.body)
      .where(eq(portCallParticipants.id, id))
      .returning();
    if (!updated) return res.status(404).json({ message: "Participant not found" });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(portCallParticipants).where(eq(portCallParticipants.id, id));
    res.sendStatus(204);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
