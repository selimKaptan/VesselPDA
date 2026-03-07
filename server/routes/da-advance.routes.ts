import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { sendDaAdvanceRequestEmail } from "../email";

const router = Router();

router.get("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const voyageId = req.query.voyageId ? parseInt(req.query.voyageId as string) : undefined;
    const advances = voyageId
      ? await storage.getDaAdvancesByVoyage(voyageId)
      : await storage.getDaAdvancesByUser(userId);
    res.json(advances);
  } catch {
    res.status(500).json({ message: "Failed to fetch DA advances" });
  }
});

router.post("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const body = { ...req.body };
    if (!body.dueDate) body.dueDate = null;
    if (!body.voyageId) body.voyageId = null;
    if (!body.proformaId) body.proformaId = null;
    const advance = await storage.createDaAdvance({ ...body, userId });

    if (advance.recipientEmail) {
      const user = await storage.getUser(userId);
      sendDaAdvanceRequestEmail({
        toEmail: advance.recipientEmail,
        toName: advance.principalName || advance.recipientEmail,
        agentName: user ? `${user.firstName || ""} ${(user as any).lastName || ""}`.trim() : "Agent",
        vesselName: req.body.vesselName || "Vessel",
        amount: advance.requestedAmount,
        currency: advance.currency,
        dueDate: advance.dueDate ? new Date(advance.dueDate).toLocaleDateString("en-GB") : undefined,
        bankDetails: advance.bankDetails || undefined,
        notes: advance.notes || undefined,
        title: advance.title,
      }).catch((e: any) => console.error("[email] DA advance email failed:", e));
    }

    res.status(201).json(advance);
  } catch (err: any) {
    res.status(500).json({ message: "Failed to create DA advance", error: err?.message });
  }
});

router.patch("/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const advance = await storage.updateDaAdvance(parseInt(req.params.id), req.body);
    res.json(advance);
  } catch {
    res.status(500).json({ message: "Failed to update DA advance" });
  }
});

router.post("/:id/record-payment", isAuthenticated, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const { amount } = req.body;
    const existing = await storage.getDaAdvance(id);
    if (!existing) return res.status(404).json({ message: "Not found" });

    const newReceived = (existing.receivedAmount || 0) + parseFloat(amount);
    let status = "partially_received";
    if (newReceived >= existing.requestedAmount) status = "fully_received";

    const updated = await storage.updateDaAdvance(id, {
      receivedAmount: newReceived,
      status,
    });
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to record payment" });
  }
});

router.delete("/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    await storage.deleteDaAdvance(parseInt(req.params.id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete DA advance" });
  }
});

export default router;
