import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin, authLimiter } from "./shared";
import { insertFeedbackSchema } from "@shared/schema";
import { sendContactEmail } from "../email";
import { logAction } from "../audit";

const router = Router();

router.post("/api/contact", authLimiter, async (req: any, res: any, next: any) => {
  try {
    const { name, email, subject, message } = req.body || {};
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ ok: false, error: "All fields are required" });
    }
    if (typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "Invalid email address" });
    }
    sendContactEmail({ name: String(name), email: String(email), subject: String(subject), message: String(message) });
    return res.json({ ok: true });
  } catch (error) {
    console.error("[contact:POST] send failed:", error);
    next(error);
  }
});


router.get("/api/notifications", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const items = await storage.getNotifications(userId);
    const unreadCount = await storage.getUnreadNotificationCount(userId);
    res.json({ notifications: items, unreadCount });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});


router.post("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    await storage.markAllNotificationsRead(userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark all read" });
  }
});


router.post("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const id = parseInt(req.params.id);
    await storage.markNotificationRead(id, userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark read" });
  }
});


router.post("/api/feedback", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const feedbackParsed = insertFeedbackSchema.partial().safeParse(req.body);
    if (!feedbackParsed.success) return res.status(400).json({ error: "Invalid input", details: feedbackParsed.error.errors });
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


router.get("/api/admin/feedback", isAuthenticated, async (req: any, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ message: "Admin access required" });
    const items = await storage.getAllFeedbacks();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch feedback" });
  }
});


export default router;
