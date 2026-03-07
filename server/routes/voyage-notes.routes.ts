import { Router } from "express";
import { db } from "../db";
import { voyageNotes, users } from "@shared/schema";
import { eq, and, desc, or, sql } from "drizzle-orm";
import { isAuthenticated } from "../replit_integrations/auth";

const router = Router();

router.get("/api/voyages/:id/notes", isAuthenticated, async (req, res) => {
  const voyageId = parseInt(req.params.id);
  try {
    const notes = await db.select({
      id: voyageNotes.id,
      voyageId: voyageNotes.voyageId,
      authorId: voyageNotes.authorId,
      content: voyageNotes.content,
      noteType: voyageNotes.noteType,
      isPrivate: voyageNotes.isPrivate,
      linkedEntityType: voyageNotes.linkedEntityType,
      linkedEntityId: voyageNotes.linkedEntityId,
      mentions: voyageNotes.mentions,
      createdAt: voyageNotes.createdAt,
      updatedAt: voyageNotes.updatedAt,
      authorName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
    })
    .from(voyageNotes)
    .innerJoin(users, eq(voyageNotes.authorId, users.id))
    .where(and(
      eq(voyageNotes.voyageId, voyageId),
      or(
        eq(voyageNotes.isPrivate, false),
        eq(voyageNotes.authorId, req.user.claims.sub)
      )
    ))
    .orderBy(desc(voyageNotes.createdAt));
    
    res.json(notes);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/api/voyages/:id/notes", isAuthenticated, async (req, res) => {
  const voyageId = parseInt(req.params.id);
  const { content, noteType, isPrivate, linkedEntityType, linkedEntityId, mentions } = req.body;

  try {
    const [note] = await db.insert(voyageNotes).values({
      voyageId,
      authorId: req.user.claims.sub,
      content,
      noteType,
      isPrivate,
      linkedEntityType,
      linkedEntityId,
      mentions,
    }).returning();

    res.json(note);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.patch("/api/voyage-notes/:id", isAuthenticated, async (req, res) => {
  const id = parseInt(req.params.id);
  const { content, noteType, isPrivate } = req.body;

  try {
    const [updated] = await db.update(voyageNotes)
      .set({ content, noteType, isPrivate, updatedAt: new Date() })
      .where(and(
        eq(voyageNotes.id, id),
        eq(voyageNotes.authorId, req.user.claims.sub)
      ))
      .returning();

    if (!updated) return res.status(404).json({ message: "Note not found or unauthorized" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/api/voyage-notes/:id", isAuthenticated, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [deleted] = await db.delete(voyageNotes)
      .where(and(
        eq(voyageNotes.id, id),
        eq(voyageNotes.authorId, req.user.claims.sub)
      ))
      .returning();
    
    if (!deleted) return res.status(404).json({ message: "Note not found or unauthorized" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
