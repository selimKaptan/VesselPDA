import { db, eq, and, or, asc, desc, isNull, sql, cached } from "./base";
import {
  forumCategories, forumTopics, forumReplies,
  forumLikes, forumDislikes,
  users,
  type ForumCategory, type InsertForumCategory,
  type ForumTopic, type InsertForumTopic,
  type ForumReply, type InsertForumReply,
} from "@shared/schema";

async function getForumCategories(): Promise<ForumCategory[]> {
  return cached("forum:categories", "long", () =>
    db.select().from(forumCategories).orderBy(asc(forumCategories.name))
  );
}

async function getForumTopics(options?: { categoryId?: number; sort?: string; limit?: number; offset?: number }): Promise<any[]> {
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  let query = db
    .select({
      id: forumTopics.id,
      title: forumTopics.title,
      content: forumTopics.content,
      isAnonymous: forumTopics.isAnonymous,
      viewCount: forumTopics.viewCount,
      replyCount: forumTopics.replyCount,
      likeCount: forumTopics.likeCount,
      isPinned: forumTopics.isPinned,
      isLocked: forumTopics.isLocked,
      lastActivityAt: forumTopics.lastActivityAt,
      createdAt: forumTopics.createdAt,
      categoryId: forumTopics.categoryId,
      userId: forumTopics.userId,
      categoryName: forumCategories.name,
      categorySlug: forumCategories.slug,
      categoryColor: forumCategories.color,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorImage: users.profileImageUrl,
    })
    .from(forumTopics)
    .innerJoin(forumCategories, eq(forumTopics.categoryId, forumCategories.id))
    .innerJoin(users, eq(forumTopics.userId, users.id))
    .$dynamic();

  if (options?.categoryId) {
    query = query.where(eq(forumTopics.categoryId, options.categoryId));
  }

  if (options?.sort === "popular") {
    query = query.orderBy(desc(forumTopics.isPinned), desc(forumTopics.likeCount), desc(forumTopics.viewCount));
  } else {
    query = query.orderBy(desc(forumTopics.isPinned), desc(forumTopics.lastActivityAt));
  }

  return query.limit(limit).offset(offset);
}

async function getForumTopic(id: number): Promise<any | undefined> {
  const [topic] = await db
    .select({
      id: forumTopics.id,
      title: forumTopics.title,
      content: forumTopics.content,
      isAnonymous: forumTopics.isAnonymous,
      viewCount: forumTopics.viewCount,
      replyCount: forumTopics.replyCount,
      likeCount: forumTopics.likeCount,
      isPinned: forumTopics.isPinned,
      isLocked: forumTopics.isLocked,
      lastActivityAt: forumTopics.lastActivityAt,
      createdAt: forumTopics.createdAt,
      categoryId: forumTopics.categoryId,
      userId: forumTopics.userId,
      categoryName: forumCategories.name,
      categorySlug: forumCategories.slug,
      categoryColor: forumCategories.color,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorImage: users.profileImageUrl,
    })
    .from(forumTopics)
    .innerJoin(forumCategories, eq(forumTopics.categoryId, forumCategories.id))
    .innerJoin(users, eq(forumTopics.userId, users.id))
    .where(eq(forumTopics.id, id));

  if (!topic) return undefined;

  await db.update(forumTopics)
    .set({ viewCount: sql`${forumTopics.viewCount} + 1` })
    .where(eq(forumTopics.id, id));

  return topic;
}

async function createForumTopic(topic: InsertForumTopic): Promise<ForumTopic> {
  const [created] = await db.insert(forumTopics).values(topic).returning();
  await db.update(forumCategories)
    .set({ topicCount: sql`${forumCategories.topicCount} + 1` })
    .where(eq(forumCategories.id, topic.categoryId));
  return created;
}

async function deleteForumTopic(id: number): Promise<void> {
  const [topic] = await db.select().from(forumTopics).where(eq(forumTopics.id, id));
  if (topic) {
    await db.delete(forumReplies).where(eq(forumReplies.topicId, id));
    await db.delete(forumTopics).where(eq(forumTopics.id, id));
    await db.update(forumCategories)
      .set({ topicCount: sql`GREATEST(${forumCategories.topicCount} - 1, 0)` })
      .where(eq(forumCategories.id, topic.categoryId));
  }
}

async function getForumReplies(topicId: number): Promise<any[]> {
  return db
    .select({
      id: forumReplies.id,
      content: forumReplies.content,
      likeCount: forumReplies.likeCount,
      createdAt: forumReplies.createdAt,
      topicId: forumReplies.topicId,
      userId: forumReplies.userId,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorImage: users.profileImageUrl,
    })
    .from(forumReplies)
    .innerJoin(users, eq(forumReplies.userId, users.id))
    .where(eq(forumReplies.topicId, topicId))
    .orderBy(asc(forumReplies.createdAt));
}

async function createForumReply(reply: InsertForumReply): Promise<ForumReply> {
  const [created] = await db.insert(forumReplies).values(reply).returning();
  await db.update(forumTopics)
    .set({
      replyCount: sql`${forumTopics.replyCount} + 1`,
      lastActivityAt: new Date(),
    })
    .where(eq(forumTopics.id, reply.topicId));
  return created;
}

async function getTopicParticipants(topicId: number, limit: number = 5): Promise<any[]> {
  const replies = await db
    .select({
      userId: forumReplies.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      profileImageUrl: users.profileImageUrl,
    })
    .from(forumReplies)
    .innerJoin(users, eq(forumReplies.userId, users.id))
    .where(eq(forumReplies.topicId, topicId))
    .orderBy(desc(forumReplies.createdAt));

  const seen = new Set<string>();
  const unique: any[] = [];
  for (const r of replies) {
    if (!seen.has(r.userId)) {
      seen.add(r.userId);
      unique.push(r);
      if (unique.length >= limit) break;
    }
  }
  return unique;
}

async function getUserTopicLikes(userId: string): Promise<number[]> {
  const likes = await db.select({ topicId: forumLikes.topicId })
    .from(forumLikes)
    .where(and(eq(forumLikes.userId, userId), isNull(forumLikes.replyId)));
  return likes.map(l => l.topicId!).filter(Boolean);
}

async function getUserReplyLikes(userId: string): Promise<number[]> {
  const likes = await db.select({ replyId: forumLikes.replyId })
    .from(forumLikes)
    .where(and(eq(forumLikes.userId, userId), isNull(forumLikes.topicId)));
  return likes.map(l => l.replyId!).filter(Boolean);
}

async function toggleTopicLike(userId: string, topicId: number): Promise<{ liked: boolean; likeCount: number }> {
  return db.transaction(async (tx) => {
    const existing = await tx.select()
      .from(forumLikes)
      .where(and(eq(forumLikes.userId, userId), eq(forumLikes.topicId, topicId), isNull(forumLikes.replyId)))
      .limit(1);
    if (existing.length > 0) {
      await tx.delete(forumLikes).where(eq(forumLikes.id, existing[0].id));
      const [updated] = await tx.update(forumTopics)
        .set({ likeCount: sql`GREATEST(${forumTopics.likeCount} - 1, 0)` })
        .where(eq(forumTopics.id, topicId))
        .returning({ likeCount: forumTopics.likeCount });
      return { liked: false, likeCount: updated?.likeCount ?? 0 };
    } else {
      await tx.insert(forumLikes).values({ userId, topicId });
      const [updated] = await tx.update(forumTopics)
        .set({ likeCount: sql`${forumTopics.likeCount} + 1` })
        .where(eq(forumTopics.id, topicId))
        .returning({ likeCount: forumTopics.likeCount });
      return { liked: true, likeCount: updated?.likeCount ?? 1 };
    }
  });
}

async function toggleReplyLike(userId: string, replyId: number): Promise<{ liked: boolean; likeCount: number }> {
  return db.transaction(async (tx) => {
    const existing = await tx.select()
      .from(forumLikes)
      .where(and(eq(forumLikes.userId, userId), eq(forumLikes.replyId, replyId), isNull(forumLikes.topicId)))
      .limit(1);
    if (existing.length > 0) {
      await tx.delete(forumLikes).where(eq(forumLikes.id, existing[0].id));
      const [updated] = await tx.update(forumReplies)
        .set({ likeCount: sql`GREATEST(${forumReplies.likeCount} - 1, 0)` })
        .where(eq(forumReplies.id, replyId))
        .returning({ likeCount: forumReplies.likeCount });
      return { liked: false, likeCount: updated?.likeCount ?? 0 };
    } else {
      await tx.insert(forumLikes).values({ userId, replyId });
      const [updated] = await tx.update(forumReplies)
        .set({ likeCount: sql`${forumReplies.likeCount} + 1` })
        .where(eq(forumReplies.id, replyId))
        .returning({ likeCount: forumReplies.likeCount });
      return { liked: true, likeCount: updated?.likeCount ?? 1 };
    }
  });
}

async function getUserTopicDislikes(userId: string): Promise<number[]> {
  const rows = await db.select({ topicId: forumDislikes.topicId })
    .from(forumDislikes)
    .where(and(eq(forumDislikes.userId, userId), isNull(forumDislikes.replyId)));
  return rows.map(r => r.topicId!).filter(Boolean);
}

async function getUserReplyDislikes(userId: string): Promise<number[]> {
  const rows = await db.select({ replyId: forumDislikes.replyId })
    .from(forumDislikes)
    .where(and(eq(forumDislikes.userId, userId), isNull(forumDislikes.topicId)));
  return rows.map(r => r.replyId!).filter(Boolean);
}

async function toggleTopicDislike(userId: string, topicId: number): Promise<{ disliked: boolean; dislikeCount: number }> {
  return db.transaction(async (tx) => {
    const existing = await tx.select()
      .from(forumDislikes)
      .where(and(eq(forumDislikes.userId, userId), eq(forumDislikes.topicId, topicId), isNull(forumDislikes.replyId)))
      .limit(1);
    if (existing.length > 0) {
      await tx.delete(forumDislikes).where(eq(forumDislikes.id, existing[0].id));
      const [updated] = await tx.update(forumTopics)
        .set({ dislikeCount: sql`GREATEST(${forumTopics.dislikeCount} - 1, 0)` })
        .where(eq(forumTopics.id, topicId))
        .returning({ dislikeCount: forumTopics.dislikeCount });
      return { disliked: false, dislikeCount: updated?.dislikeCount ?? 0 };
    } else {
      await tx.insert(forumDislikes).values({ userId, topicId });
      const [updated] = await tx.update(forumTopics)
        .set({ dislikeCount: sql`${forumTopics.dislikeCount} + 1` })
        .where(eq(forumTopics.id, topicId))
        .returning({ dislikeCount: forumTopics.dislikeCount });
      return { disliked: true, dislikeCount: updated?.dislikeCount ?? 1 };
    }
  });
}

async function toggleReplyDislike(userId: string, replyId: number): Promise<{ disliked: boolean; dislikeCount: number }> {
  return db.transaction(async (tx) => {
    const existing = await tx.select()
      .from(forumDislikes)
      .where(and(eq(forumDislikes.userId, userId), eq(forumDislikes.replyId, replyId), isNull(forumDislikes.topicId)))
      .limit(1);
    if (existing.length > 0) {
      await tx.delete(forumDislikes).where(eq(forumDislikes.id, existing[0].id));
      const [updated] = await tx.update(forumReplies)
        .set({ dislikeCount: sql`GREATEST(${forumReplies.dislikeCount} - 1, 0)` })
        .where(eq(forumReplies.id, replyId))
        .returning({ dislikeCount: forumReplies.dislikeCount });
      return { disliked: false, dislikeCount: updated?.dislikeCount ?? 0 };
    } else {
      await tx.insert(forumDislikes).values({ userId, replyId });
      const [updated] = await tx.update(forumReplies)
        .set({ dislikeCount: sql`${forumReplies.dislikeCount} + 1` })
        .where(eq(forumReplies.id, replyId))
        .returning({ dislikeCount: forumReplies.dislikeCount });
      return { disliked: true, dislikeCount: updated?.dislikeCount ?? 1 };
    }
  });
}

export const forumStorage = {
  getForumCategories,
  getForumTopics,
  getForumTopic,
  createForumTopic,
  deleteForumTopic,
  getForumReplies,
  createForumReply,
  getTopicParticipants,
  getUserTopicLikes,
  getUserReplyLikes,
  toggleTopicLike,
  toggleReplyLike,
  getUserTopicDislikes,
  getUserReplyDislikes,
  toggleTopicDislike,
  toggleReplyDislike,
};
