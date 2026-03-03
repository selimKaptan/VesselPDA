import { handleAiChat } from "../anthropic";
import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { db, pool } from "../db";
import { sql as drizzleSql } from "drizzle-orm";
import { logAction, getClientIp } from "../audit";

async function isAdmin(req: any): Promise<boolean> {
  const userId = req.user?.claims?.sub;
  if (!userId) return false;
  const user = await storage.getUser(userId);
  return user?.userRole === "admin";
}

const router = Router();

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

router.get("/notifications", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const items = await storage.getNotifications(userId);
    const unreadCount = await storage.getUnreadNotificationCount(userId);
    res.json({ notifications: items, unreadCount });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

router.post("/notifications/read-all", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    await storage.markAllNotificationsRead(userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark all read" });
  }
});

router.post("/notifications/:id/read", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    await storage.markNotificationRead(id, userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark read" });
  }
});

router.post("/feedback", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { category, message, pageUrl } = req.body;
    if (!category || !message?.trim()) {
      return res.status(400).json({ message: "Category and message are required" });
    }
    const feedback = await storage.createFeedback({ userId, category, message: message.trim(), pageUrl });
    res.json(feedback);
  } catch (error) {
    res.status(500).json({ message: "Failed to submit feedback" });
  }
});

// ─── PORT ALERTS ─────────────────────────────────────────────────────────────

router.get("/port-alerts", async (req, res) => {
  try {
    const portId = req.query.portId ? parseInt(req.query.portId as string) : undefined;
    const portName = req.query.portName as string | undefined;
    const alerts = await storage.getPortAlerts(portId, portName);
    res.json(alerts);
  } catch {
    res.status(500).json({ message: "Failed to get port alerts" });
  }
});

router.post("/ai/chat", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub || req.user?.id;
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "messages array required" });
    }
    const validMessages = messages.filter(
      (m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    );
    if (validMessages.length === 0) {
      return res.status(400).json({ message: "No valid messages" });
    }
    const result = await handleAiChat(userId, validMessages);
    res.json(result);
  } catch (err: any) {
    console.error("AI chat error:", err);
    res.status(500).json({ message: "AI servisine bağlanılamadı" });
  }
});


export default router;
