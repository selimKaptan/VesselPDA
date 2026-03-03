import { sendForumReplyEmail } from "../email";
import { parsePaginationParams, buildPaginationMeta } from "../utils/pagination";
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

router.get("/forum/categories", async (_req, res) => {
  try {
    const categories = await storage.getForumCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch forum categories" });
  }
});

router.get("/forum/topics", async (req, res) => {
  try {
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
    const sort = (req.query.sort as string) || "latest";
    const { page, limit } = parsePaginationParams(req.query);
    const offset = req.query.offset ? parseInt(req.query.offset as string) : (page - 1) * limit;

    const topics = await storage.getForumTopics({ categoryId, sort, limit, offset });

    const topicsWithParticipants = await Promise.all(
      topics.map(async (t: any) => {
        const participants = await storage.getTopicParticipants(t.id, 5);
        return { ...t, participants };
      })
    );

    const allTopics = await storage.getForumTopics({ categoryId, sort, limit: 9999, offset: 0 });
    const total = allTopics.length;

    res.json({
      data: topicsWithParticipants,
      pagination: buildPaginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error("Forum topics error:", error);
    res.status(500).json({ message: "Failed to fetch forum topics" });
  }
});

router.get("/forum/topics/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const topic = await storage.getForumTopic(id);
    if (!topic) return res.status(404).json({ message: "Topic not found" });

    const replies = await storage.getForumReplies(id);
    const participants = await storage.getTopicParticipants(id, 10);

    res.json({ ...topic, replies, participants });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch topic" });
  }
});

router.post("/forum/topics", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { title, content, categoryId, isAnonymous } = req.body;

    if (!title || !content || !categoryId) {
      return res.status(400).json({ message: "title, content, and categoryId are required" });
    }

    if (title.trim().length < 3) {
      return res.status(400).json({ message: "Title must be at least 3 characters" });
    }

    if (content.trim().length < 10) {
      return res.status(400).json({ message: "Content must be at least 10 characters" });
    }

    const topic = await storage.createForumTopic({
      userId,
      title: title.trim(),
      content: content.trim(),
      categoryId: Number(categoryId),
      isAnonymous: isAnonymous === true,
    });

    res.json(topic);
  } catch (error) {
    console.error("Create topic error:", error);
    res.status(500).json({ message: "Failed to create topic" });
  }
});

router.delete("/forum/topics/:id", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const topicId = parseInt(req.params.id);
    const topic = await storage.getForumTopic(topicId);
    if (!topic) return res.status(404).json({ message: "Topic not found" });
    const user = await storage.getUser(userId);
    const isAdmin = user?.userRole === "admin";
    if (topic.userId !== userId && !isAdmin) {
      return res.status(403).json({ message: "Not authorized to delete this topic" });
    }
    await storage.deleteForumTopic(topicId);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete topic error:", error);
    res.status(500).json({ message: "Failed to delete topic" });
  }
});

router.post("/forum/topics/:id/replies", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const topicId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content || content.trim().length < 1) {
      return res.status(400).json({ message: "Content is required" });
    }

    const topic = await storage.getForumTopic(topicId);
    if (!topic) return res.status(404).json({ message: "Topic not found" });

    if (topic.isLocked) {
      return res.status(403).json({ message: "This topic is locked" });
    }

    const reply = await storage.createForumReply({
      topicId,
      userId,
      content: content.trim(),
    });

    res.json(reply);

    // Notify topic author if different from replier
    try {
      if (topic.userId && topic.userId !== userId) {
        const [replier, topicAuthor] = await Promise.all([
          storage.getUser(userId),
          storage.getUser(topic.userId),
        ]);
        const replierName = replier ? `${replier.firstName || ""} ${replier.lastName || ""}`.trim() || replier.email || "Someone" : "Someone";
        await storage.createNotification({
          userId: topic.userId,
          type: "forum_reply",
          title: "New Reply on Your Topic",
          message: `${replierName} replied to "${topic.title}"`,
          link: `/forum/${topicId}`,
        });
        // Send email notification to topic author
        if (topicAuthor?.email) {
          const preview = content.trim().slice(0, 200) + (content.trim().length > 200 ? "..." : "");
          sendForumReplyEmail({
            toEmail: topicAuthor.email,
            topicTitle: topic.title,
            topicId,
            replyAuthor: replierName,
            replyPreview: preview,
          }).catch(() => {});
        }
      }
    } catch (e) { /* non-critical */ }
  } catch (error) {
    console.error("Create reply error:", error);
    res.status(500).json({ message: "Failed to create reply" });
  }
});

// Like/unlike forum topics
router.post("/forum/topics/:id/like", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const topicId = parseInt(req.params.id);
    if (!topicId) return res.status(400).json({ message: "Invalid topic ID" });
    const result = await storage.toggleTopicLike(userId, topicId);
    res.json(result);
  } catch (error) {
    console.error("Toggle topic like error:", error);
    res.status(500).json({ message: "Failed to toggle like" });
  }
});

// Like/unlike forum replies
router.post("/forum/replies/:id/like", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const replyId = parseInt(req.params.id);
    if (!replyId) return res.status(400).json({ message: "Invalid reply ID" });
    const result = await storage.toggleReplyLike(userId, replyId);
    res.json(result);
  } catch (error) {
    console.error("Toggle reply like error:", error);
    res.status(500).json({ message: "Failed to toggle like" });
  }
});

// Get current user's liked topic IDs and reply IDs (+ dislikes)
router.get("/forum/my-likes", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const [topicIds, replyIds, dislikedTopicIds, dislikedReplyIds] = await Promise.all([
      storage.getUserTopicLikes(userId),
      storage.getUserReplyLikes(userId),
      storage.getUserTopicDislikes(userId),
      storage.getUserReplyDislikes(userId),
    ]);
    res.json({ topicIds, replyIds, dislikedTopicIds, dislikedReplyIds });
  } catch (error) {
    console.error("Get user likes error:", error);
    res.status(500).json({ message: "Failed to get likes" });
  }
});

// Dislike/undislike forum topics
router.post("/forum/topics/:id/dislike", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const topicId = parseInt(req.params.id);
    if (!topicId) return res.status(400).json({ message: "Invalid topic ID" });
    const result = await storage.toggleTopicDislike(userId, topicId);
    res.json(result);
  } catch (error) {
    console.error("Toggle topic dislike error:", error);
    res.status(500).json({ message: "Failed to toggle dislike" });
  }
});

// Dislike/undislike forum replies
router.post("/forum/replies/:id/dislike", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const replyId = parseInt(req.params.id);
    if (!replyId) return res.status(400).json({ message: "Invalid reply ID" });
    const result = await storage.toggleReplyDislike(userId, replyId);
    res.json(result);
  } catch (error) {
    console.error("Toggle reply dislike error:", error);
    res.status(500).json({ message: "Failed to toggle dislike" });
  }
});


export default router;
