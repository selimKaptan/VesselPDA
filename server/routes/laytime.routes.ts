import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const voyageId = req.query.voyageId ? parseInt(req.query.voyageId as string) : undefined;
    const sheets = voyageId
      ? await storage.getLaytimeSheetsByVoyage(voyageId)
      : await storage.getLaytimeSheetsByUser(userId);
    res.json(sheets);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch laytime sheets" });
  }
});

router.get("/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const sheet = await storage.getLaytimeSheet(parseInt(req.params.id));
    if (!sheet) return res.status(404).json({ message: "Not found" });
    res.json(sheet);
  } catch {
    res.status(500).json({ message: "Failed to fetch laytime sheet" });
  }
});

router.post("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const sheet = await storage.createLaytimeSheet({ ...req.body, userId });
    res.status(201).json(sheet);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to create laytime sheet", error: err?.message });
  }
});

router.patch("/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const sheet = await storage.updateLaytimeSheet(parseInt(req.params.id), req.body);
    res.json(sheet);
  } catch {
    res.status(500).json({ message: "Failed to update laytime sheet" });
  }
});

router.delete("/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    await storage.deleteLaytimeSheet(parseInt(req.params.id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete laytime sheet" });
  }
});

export default router;
