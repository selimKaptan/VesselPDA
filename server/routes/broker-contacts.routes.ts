import { Router } from "express";
import { db } from "../db";
import { brokerContacts } from "../../shared/schema";
import { eq, and, desc, ilike, or } from "drizzle-orm";

const router = Router();

router.get("/", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const q = req.query.q as string | undefined;
    
    let query = db.select().from(brokerContacts).where(eq(brokerContacts.userId, userId));
    
    if (q) {
      query = db.select().from(brokerContacts).where(
        and(
          eq(brokerContacts.userId, userId), 
          or(
            ilike(brokerContacts.companyName, `%${q}%`), 
            ilike(brokerContacts.contactName, `%${q}%`)
          )
        )
      );
    }
    
    const rows = await query.orderBy(desc(brokerContacts.createdAt));
    res.json(rows);
  } catch (e) { 
    res.status(500).json({ error: String(e) }); 
  }
});

router.get("/search", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const q = req.query.q as string;
    if (!q) return res.json([]);

    const rows = await db.select().from(brokerContacts)
      .where(and(
        eq(brokerContacts.userId, userId),
        or(
          ilike(brokerContacts.companyName, `%${q}%`),
          ilike(brokerContacts.contactName, `%${q}%`)
        )
      ))
      .limit(10);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const [row] = await db.insert(brokerContacts).values({ ...req.body, userId }).returning();
    res.json(row);
  } catch (e) { 
    res.status(500).json({ error: String(e) }); 
  }
});

router.patch("/:id", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    const [row] = await db.update(brokerContacts)
      .set(req.body)
      .where(and(eq(brokerContacts.id, id), eq(brokerContacts.userId, userId)))
      .returning();
    res.json(row);
  } catch (e) { 
    res.status(500).json({ error: String(e) }); 
  }
});

router.delete("/:id", async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    await db.delete(brokerContacts)
      .where(and(eq(brokerContacts.id, id), eq(brokerContacts.userId, userId)));
    res.json({ ok: true });
  } catch (e) { 
    res.status(500).json({ error: String(e) }); 
  }
});

export default router;
