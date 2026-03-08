import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { db } from "../db";
import { portCallChecklists } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

const DEFAULT_ARRIVAL_ITEMS = [
  "PDA hazırlandı ve gönderildi",
  "Gemi particularları alındı",
  "Mürettebat listesi alındı",
  "Sağlık beyannamesi hazırlandı",
  "Gümrük girişi tamamlandı",
  "Polis/Sınır giriş bildirimi yapıldı",
  "Pilot ayarlandı",
  "Rıhtım/İskele yeri teyit edildi",
  "Römorkör ayarlandı",
  "Sigorta belgesi doğrulandı",
  "Liman sağlığı bildirimi yapıldı",
  "Acente yetki belgesi sunuldu",
  "Husbandry talepleri alındı",
  "Mağaza / Stok siparişleri alındı",
];

const DEFAULT_DEPARTURE_ITEMS = [
  "SOF (Olaylar Beyanı) tamamlandı",
  "NOR kaydedildi ve imzalandı",
  "Taslak sörvey tamamlandı",
  "Kargo sörvey raporu alındı",
  "Liman ücretleri ödendi",
  "Gümrük çıkış işlemleri tamamlandı",
  "Mürettebat çıkış belgesi hazırlandı",
  "Mağaza teslim alındı ve imzalandı",
  "Tüm liman harçları ödendi",
  "Yakıt ikmal faturası alındı",
  "FDA süreci başlatıldı",
  "Acente raporu hazırlandı",
  "Faturalar düzenlendi",
];

// GET /api/port-call-checklists/:portCallId
router.get("/:portCallId", isAuthenticated, async (req: any, res) => {
  try {
    const portCallId = parseInt(req.params.portCallId);
    const items = await db.select().from(portCallChecklists)
      .where(eq(portCallChecklists.portCallId, portCallId))
      .orderBy(portCallChecklists.sortOrder);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch checklist" });
  }
});

// POST /api/port-call-checklists/:portCallId/init — initialize default items
router.post("/:portCallId/init", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const portCallId = parseInt(req.params.portCallId);

    const existing = await db.select().from(portCallChecklists)
      .where(eq(portCallChecklists.portCallId, portCallId));

    if (existing.length > 0) return res.json(existing);

    const arrivalItems = DEFAULT_ARRIVAL_ITEMS.map((item, i) => ({
      portCallId, userId, category: "arrival", item, sortOrder: i, isCompleted: false,
    }));
    const departureItems = DEFAULT_DEPARTURE_ITEMS.map((item, i) => ({
      portCallId, userId, category: "departure", item, sortOrder: i, isCompleted: false,
    }));

    const created = await db.insert(portCallChecklists).values([...arrivalItems, ...departureItems]).returning();
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to initialize checklist" });
  }
});

// PATCH /api/port-call-checklists/item/:id — toggle or update
router.patch("/item/:id", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = { ...req.body };
    if (req.body.isCompleted === true) updates.completedAt = new Date();
    if (req.body.isCompleted === false) updates.completedAt = null;

    const [updated] = await db.update(portCallChecklists).set(updates).where(eq(portCallChecklists.id, id)).returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to update checklist item" });
  }
});

// POST /api/port-call-checklists/:portCallId/item — add custom item
router.post("/:portCallId/item", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const portCallId = parseInt(req.params.portCallId);
    const { item, category = "arrival" } = req.body;
    if (!item) return res.status(400).json({ message: "item is required" });

    const [created] = await db.insert(portCallChecklists).values({
      portCallId, userId, category, item, sortOrder: 999, isCompleted: false,
    }).returning();
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to add checklist item" });
  }
});

// DELETE /api/port-call-checklists/item/:id
router.delete("/item/:id", isAuthenticated, async (req: any, res) => {
  try {
    await db.delete(portCallChecklists).where(eq(portCallChecklists.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to delete checklist item" });
  }
});

export default router;
