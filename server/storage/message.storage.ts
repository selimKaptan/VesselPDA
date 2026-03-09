import { db, eq, and, or, desc, sql } from "./base";
import {
  conversations, messages, users,
  type Conversation,
  type Message, type InsertMessage,
} from "@shared/schema";

async function getOrCreateConversation(user1Id: string, user2Id: string, voyageId?: number, serviceRequestId?: number): Promise<Conversation> {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(
      or(
        and(eq(conversations.user1Id, user1Id), eq(conversations.user2Id, user2Id)),
        and(eq(conversations.user1Id, user2Id), eq(conversations.user2Id, user1Id))
      )
    )
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(conversations).values({
    user1Id,
    user2Id,
    voyageId: voyageId ?? null,
    serviceRequestId: serviceRequestId ?? null,
  }).returning();
  return created;
}

async function getConversationsByUser(userId: string): Promise<any[]> {
  const convRows = await db.execute(sql`
    SELECT id, user1_id, user2_id, voyage_id, service_request_id, last_message_at, created_at,
           external_email, external_email_name, external_email_forward
    FROM conversations
    WHERE user1_id = ${userId} OR user2_id = ${userId}
    ORDER BY last_message_at DESC NULLS LAST
  `);
  const rows: any[] = convRows.rows ?? (convRows as any);
  const result = await Promise.all(rows.map(async (conv: any) => {
    const convId = conv.id;
    const otherId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
    const ouRows = await db.execute(sql`SELECT id, first_name, last_name, email FROM users WHERE id = ${otherId} LIMIT 1`);
    const ouArr: any[] = ouRows.rows ?? (ouRows as any);
    const otherUser = ouArr[0];
    const lastMsgRows = await db.execute(sql`
      SELECT content, created_at, sender_id, message_type, file_name
      FROM messages WHERE conversation_id = ${convId}
      ORDER BY created_at DESC LIMIT 1
    `);
    const lastMsgArr: any[] = lastMsgRows.rows ?? (lastMsgRows as any);
    const lastMsg = lastMsgArr[0];
    const unreadRows = await db.execute(sql`
      SELECT COUNT(*)::int as cnt FROM messages
      WHERE conversation_id = ${convId} AND is_read = false AND sender_id != ${userId}
    `);
    const unreadArr: any[] = unreadRows.rows ?? (unreadRows as any);
    const unreadCount = Number(unreadArr[0]?.cnt ?? 0);
    return {
      id: conv.id,
      user1Id: conv.user1_id,
      user2Id: conv.user2_id,
      voyageId: conv.voyage_id,
      serviceRequestId: conv.service_request_id,
      lastMessageAt: conv.last_message_at,
      createdAt: conv.created_at,
      externalEmail: conv.external_email,
      externalEmailName: conv.external_email_name,
      externalEmailForward: conv.external_email_forward,
      otherUserId: otherId,
      otherUserName: otherUser ? ([otherUser.first_name, otherUser.last_name].filter(Boolean).join(" ") || otherUser.email) : "Kullanıcı",
      lastMessage: lastMsg?.content ?? null,
      lastMessageType: lastMsg?.message_type ?? "text",
      lastMessageFileName: lastMsg?.file_name ?? null,
      lastMessageTime: lastMsg?.created_at ?? conv.created_at,
      unreadCount,
    };
  }));
  return result;
}

async function getConversationById(id: number, userId: string): Promise<any | undefined> {
  const convRows = await db.execute(sql`
    SELECT id, user1_id, user2_id, voyage_id, service_request_id, last_message_at, created_at,
           external_email, external_email_name, external_email_forward
    FROM conversations
    WHERE id = ${id} AND (user1_id = ${userId} OR user2_id = ${userId})
    LIMIT 1
  `);
  const convArr: any[] = convRows.rows ?? (convRows as any);
  const conv = convArr[0];
  if (!conv) return undefined;
  const otherId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
  const ouRows = await db.execute(sql`SELECT id, first_name, last_name, email FROM users WHERE id = ${otherId} LIMIT 1`);
  const ouArr: any[] = ouRows.rows ?? (ouRows as any);
  const ouRaw = ouArr[0];
  const otherUser = ouRaw ? {
    id: ouRaw.id,
    name: [ouRaw.first_name, ouRaw.last_name].filter(Boolean).join(" ") || ouRaw.email,
    email: ouRaw.email,
  } : undefined;
  const msgRows = await db.execute(sql`
    SELECT id, conversation_id, sender_id, content, is_read, created_at,
           message_type, file_url, file_name, file_size, read_at, mentions
    FROM messages WHERE conversation_id = ${id} ORDER BY created_at ASC
  `);
  const msgArr: any[] = msgRows.rows ?? (msgRows as any);
  const msgs = msgArr.map((m: any) => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    content: m.content,
    isRead: m.is_read,
    createdAt: m.created_at,
    messageType: m.message_type ?? "text",
    fileUrl: m.file_url,
    fileName: m.file_name,
    fileSize: m.file_size,
    readAt: m.read_at,
    mentions: m.mentions ? JSON.parse(m.mentions) : null,
  }));
  return {
    id: conv.id,
    user1Id: conv.user1_id,
    user2Id: conv.user2_id,
    voyageId: conv.voyage_id,
    serviceRequestId: conv.service_request_id,
    lastMessageAt: conv.last_message_at,
    createdAt: conv.created_at,
    externalEmail: conv.external_email,
    externalEmailName: conv.external_email_name,
    externalEmailForward: conv.external_email_forward,
    otherUser,
    messages: msgs,
  };
}

async function createMessage(data: InsertMessage): Promise<Message> {
  const [msg] = await db.insert(messages).values(data).returning();
  await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, data.conversationId));
  return msg;
}

async function markConversationRead(conversationId: number, userId: string): Promise<void> {
  await db.update(messages)
    .set({ isRead: true, readAt: new Date() })
    .where(and(
      eq(messages.conversationId, conversationId),
      sql`${messages.senderId} != ${userId}`,
      sql`${messages.readAt} IS NULL`
    ));
}

async function updateConversationExternalEmail(convId: number, email: string | null, name: string | null, forward: boolean): Promise<void> {
  await db.update(conversations)
    .set({ externalEmail: email, externalEmailName: name, externalEmailForward: forward })
    .where(eq(conversations.id, convId));
}

async function getUnreadMessageCount(userId: string): Promise<number> {
  const rows = await db.execute(sql`
    SELECT COUNT(*)::int as cnt FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE (c.user1_id = ${userId} OR c.user2_id = ${userId})
      AND m.is_read = false
      AND m.sender_id != ${userId}
  `);
  const arr: any[] = rows.rows ?? (rows as any);
  return Number(arr[0]?.cnt ?? 0);
}

export const messageStorage = {
  getOrCreateConversation,
  getConversationsByUser,
  getConversationById,
  createMessage,
  markConversationRead,
  updateConversationExternalEmail,
  getUnreadMessageCount,
};
