import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { db } from "../db";
import { cargoOperations, portCalls, voyages, vessels } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { insertCargoOperationSchema } from "@shared/schema";

const router = Router();

// GET /api/cargo-operations
router.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { portCallId, voyageId, status } = req.query;

    let results = await db.select().from(cargoOperations)
      .where(eq(cargoOperations.userId, userId))
      .orderBy(desc(cargoOperations.createdAt));

    if (portCallId) results = results.filter(c => c.portCallId === parseInt(portCallId));
    if (voyageId) results = results.filter(c => c.voyageId === parseInt(voyageId));
    if (status) results = results.filter(c => c.status === status);

    res.json(results);
  } catch (err: any) {
    console.error("[cargo-ops:GET] error:", err?.message);
    res.status(500).json({ message: "Failed to fetch cargo operations" });
  }
});

// POST /api/cargo-operations
router.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const parsed = insertCargoOperationSchema.safeParse({ ...req.body, userId });
    if (!parsed.success) return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });

    const [created] = await db.insert(cargoOperations).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (err: any) {
    console.error("[cargo-ops:POST] error:", err?.message);
    res.status(500).json({ message: "Failed to create cargo operation" });
  }
});

// PATCH /api/cargo-operations/:id
router.patch("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const id = parseInt(req.params.id);

    const [existing] = await db.select().from(cargoOperations).where(and(eq(cargoOperations.id, id), eq(cargoOperations.userId, userId)));
    if (!existing) return res.status(404).json({ message: "Not found" });

    const [updated] = await db.update(cargoOperations).set(req.body).where(eq(cargoOperations.id, id)).returning();
    res.json(updated);
  } catch (err: any) {
    console.error("[cargo-ops:PATCH] error:", err?.message);
    res.status(500).json({ message: "Failed to update cargo operation" });
  }
});

// DELETE /api/cargo-operations/:id
router.delete("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const id = parseInt(req.params.id);

    const [existing] = await db.select().from(cargoOperations).where(and(eq(cargoOperations.id, id), eq(cargoOperations.userId, userId)));
    if (!existing) return res.status(404).json({ message: "Not found" });

    await db.delete(cargoOperations).where(eq(cargoOperations.id, id));
    res.json({ success: true });
  } catch (err: any) {
    console.error("[cargo-ops:DELETE] error:", err?.message);
    res.status(500).json({ message: "Failed to delete cargo operation" });
  }
});

export default router;
