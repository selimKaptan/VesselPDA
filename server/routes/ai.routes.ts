import { Router } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { handleAiChat } from "../anthropic";
import { calculateLimiter } from "./shared";

const router = Router();

router.post("/chat", isAuthenticated, calculateLimiter, async (req: any, res) => {
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
    res.status(500).json({ message: "Failed to connect to AI service" });
  }
});


export default router;
