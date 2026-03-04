import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { pool } from "../db";
import { createCheckoutForm, retrieveCheckoutResult, IYZICO_CONFIGURED } from "../payment";
import { emitToUser } from "../socket";
import { logAction, getClientIp } from "../audit";

const router = Router();

router.post("/api/subscription/upgrade", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { plan } = req.body;

    const planLimits: Record<string, number> = {
      free: 1,
      standard: 10,
      unlimited: 999999,
    };

    if (!plan || !planLimits[plan]) {
      return res.status(400).json({ message: "Invalid plan. Choose: free, standard, or unlimited" });
    }

    // DEPRECATED — direct DB upgrade without payment.
    // New flow: POST /api/payment/checkout
    const updated = await storage.updateSubscription(userId, plan, planLimits[plan]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to upgrade subscription" });
  }
});


router.get("/api/payment/status", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    res.json({
      plan: user?.subscriptionPlan || "free",
      proformaLimit: user?.proformaLimit ?? 1,
      proformaCount: user?.proformaCount ?? 0,
      iyzicoEnabled: IYZICO_CONFIGURED,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch payment status" });
  }
});


router.post("/api/payment/checkout", isAuthenticated, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { plan } = req.body;
    if (!["standard", "unlimited"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan. Must be 'standard' or 'unlimited'" });
    }

    if (!IYZICO_CONFIGURED) {
      return res.status(503).json({
        error: "Payment gateway not configured. Contact support to upgrade your plan.",
        iyzicoEnabled: false,
      });
    }

    const result = await createCheckoutForm({
      userId,
      email: user.email || "",
      firstName: user.firstName || "User",
      lastName: user.lastName || "",
      plan: plan as "standard" | "unlimited",
      ip: req.ip || "127.0.0.1",
    });

    if (result.status === "success") {
      res.json({
        checkoutFormContent: result.checkoutFormContent,
        token: result.token,
        iyzicoEnabled: true,
      });
    } else {
      res.status(400).json({
        error: result.errorMessage || "Payment initialization failed",
        errorCode: result.errorCode,
      });
    }
  } catch (error: any) {
    console.error("[payment/checkout] error:", error.message);
    next(error);
  }
});


router.post("/api/payment/callback", async (req: any, res: any) => {
  try {
    const { token } = req.body;
    if (!token) return res.redirect("/pricing?status=error");

    const result = await retrieveCheckoutResult(token);

    if (result.status === "success" && result.paymentStatus === "SUCCESS") {
      const conversationId: string = result.conversationId || "";
      const parts = conversationId.split("_");
      const userId = parts[1];
      if (!userId) return res.redirect("/pricing?status=error");

      const basketItem = result.basketItems?.[0];
      const planFromBasket = basketItem?.id?.includes("unlimited") ? "unlimited" : "standard";
      const planLimits: Record<string, number> = { standard: 10, unlimited: 999999 };
      const limit = planLimits[planFromBasket] || 10;

      await storage.updateSubscription(userId, planFromBasket, limit);

      logAction(userId, "pay", "user", null, {
        plan: planFromBasket,
        paymentId: result.paymentId,
        conversationId,
        userId,
      }, req.ip || "");

      res.redirect(`/pricing?status=success&plan=${planFromBasket}`);
    } else {
      res.redirect("/pricing?status=failed");
    }
  } catch (error) {
    console.error("[payment/callback] error:", error);
    res.redirect("/pricing?status=error");
  }
});


export default router;
