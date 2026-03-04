import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../replit_integrations/auth";
import { isAdmin } from "./shared";
import { emitToUser, emitToConversation } from "../socket";

const router = Router();

router.get("/api/messages/unread-count", isAuthenticated, async (req: any, res) => {
  try {
    const cnt = await storage.getUnreadMessageCount(req.user.claims.sub);
    res.json({ count: cnt });
  } catch (error) {
    res.status(500).json({ message: "Failed to get unread count" });
  }
});


router.get("/api/messages", isAuthenticated, async (req: any, res) => {
  try {
    const convs = await storage.getConversationsByUser(req.user.claims.sub);
    res.json(convs);
  } catch (error) {
    console.error("[messages] getConversationsByUser error:", error);
    res.status(500).json({ message: "Failed to get conversations" });
  }
});


router.post("/api/messages/start", isAuthenticated, async (req: any, res) => {
  try {
    const { targetUserId, voyageId, serviceRequestId, message } = req.body;
    if (!targetUserId || !message) return res.status(400).json({ message: "targetUserId and message required" });
    if (targetUserId === req.user.claims.sub) return res.status(400).json({ message: "Cannot message yourself" });
    const conv = await storage.getOrCreateConversation(
      req.user.claims.sub,
      targetUserId,
      voyageId ? parseInt(voyageId) : undefined,
      serviceRequestId ? parseInt(serviceRequestId) : undefined
    );
    const msg = await storage.createMessage({ conversationId: conv.id, senderId: req.user.claims.sub, content: message });
    await storage.createNotification({
      userId: targetUserId,
      type: "message",
      title: "New Message",
      message: message.length > 60 ? message.slice(0, 60) + "..." : message,
      link: `/messages/${conv.id}`,
    });
    res.status(201).json({ conversationId: conv.id, message: msg });
  } catch (error) {
    res.status(500).json({ message: "Failed to start conversation" });
  }
});


router.get("/api/messages/:conversationId", isAuthenticated, async (req: any, res) => {
  try {
    const id = parseInt(req.params.conversationId);
    const conv = await storage.getConversationById(id, req.user.claims.sub);
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    res.json(conv);
  } catch (error) {
    res.status(500).json({ message: "Failed to get conversation" });
  }
});


router.post("/api/messages/:conversationId/send", isAuthenticated, async (req: any, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId);
    const { content, messageType, fileUrl, fileName, fileSize, mentions } = req.body;
    if (!content?.trim() && !fileUrl) return res.status(400).json({ message: "content or file required" });
    if (fileSize && fileSize > 8 * 1024 * 1024) return res.status(400).json({ message: "File too large (max 8MB)" });
    const conv = await storage.getConversationById(conversationId, req.user.claims.sub);
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    const msg = await storage.createMessage({
      conversationId,
      senderId: req.user.claims.sub,
      content: content || (fileName ? `[Dosya: ${fileName}]` : ""),
      messageType: messageType || "text",
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileSize: fileSize || null,
      mentions: mentions && Array.isArray(mentions) && mentions.length > 0 ? JSON.stringify(mentions) : null,
    });
    const receiverId = conv.user1Id === req.user.claims.sub ? conv.user2Id : conv.user1Id;
    const notifMessage = fileUrl
      ? `📎 ${fileName || "File shared"}`
      : (content.length > 60 ? content.slice(0, 60) + "..." : content);
    await storage.createNotification({
      userId: receiverId,
      type: "message",
      title: "New Message",
      message: notifMessage,
      link: `/messages/${conversationId}`,
    });
    // @mention notifications
    if (Array.isArray(mentions) && mentions.length > 0) {
      const senderUser = await storage.getUser(req.user.claims.sub);
      for (const mentionedId of mentions) {
        if (mentionedId !== req.user.claims.sub) {
          await storage.createNotification({
            userId: mentionedId,
            type: "mention",
            title: "You Were Mentioned",
            message: `${[senderUser?.firstName, senderUser?.lastName].filter(Boolean).join(" ") || "A user"} mentioned you in a message`,
            link: `/messages/${conversationId}`,
          });
        }
      }
    }
    // Real-time delivery
    emitToConversation(conversationId, "message:new", {
      id: msg.id,
      conversationId,
      senderId: req.user.claims.sub,
      content: msg.content,
      createdAt: msg.createdAt,
      messageType: msg.messageType,
      fileUrl: msg.fileUrl,
      fileName: msg.fileName,
    });
    emitToUser(receiverId, "notification:new", {
      type: "message",
      title: "New Message",
      message: notifMessage,
      link: `/messages/${conversationId}`,
    });

    // E-posta bridge: auto-forward if enabled
    if (conv.externalEmailForward && conv.externalEmail) {
      const { sendMessageBridgeEmail } = await import("../email");
      const senderUser = await storage.getUser(req.user.claims.sub);
      sendMessageBridgeEmail(
        conv.externalEmail,
        conv.externalEmailName || conv.externalEmail,
        [senderUser?.firstName, senderUser?.lastName].filter(Boolean).join(" ") || "VesselPDA User",
        content || "",
        fileName || undefined
      ).catch((e: any) => console.error("[bridge] email failed:", e));
    }
    res.status(201).json(msg);
  } catch (error) {
    console.error("Failed to send message:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
});


router.patch("/api/messages/:conversationId/read", isAuthenticated, async (req: any, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId);
    await storage.markConversationRead(conversationId, req.user.claims.sub);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark as read" });
  }
});


router.patch("/api/conversations/:convId/external-email", isAuthenticated, async (req: any, res) => {
  try {
    const convId = parseInt(req.params.convId);
    const { email, name, forward } = req.body;
    const conv = await storage.getConversationById(convId, req.user.claims.sub);
    if (!conv) return res.status(404).json({ message: "Conversation not found" });
    await storage.updateConversationExternalEmail(convId, email || null, name || null, !!forward);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to update external email" });
  }
});


export default router;
