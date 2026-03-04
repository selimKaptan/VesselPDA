import { Server as SocketServer, Socket } from "socket.io";
import type { Server as HttpServer } from "http";

let io: SocketServer | null = null;

interface OnlineUser {
  userId: string;
  socketId: string;
  role: string;
}

const onlineUsers = new Map<string, OnlineUser>();

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === "production"
        ? ["https://vesselpda.com", "https://www.vesselpda.com", /\.replit\.dev$/, /\.repl\.co$/]
        : "*",
      credentials: true,
      methods: ["GET", "POST"],
    },
    path: "/ws/socket.io",
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on("connection", (socket: Socket) => {
    // If auth userId was passed in handshake, join personal room immediately
    const authUserId = socket.handshake.auth?.userId as string | undefined;
    if (authUserId) {
      socket.join(`user:${authUserId}`);
      onlineUsers.set(authUserId, { userId: authUserId, socketId: socket.id, role: "" });
    }

    // User comes online — sent by frontend hook right after connect
    socket.on("user:online", (data: { userId: string; role: string }) => {
      if (!data?.userId) return;
      onlineUsers.set(data.userId, { userId: data.userId, socketId: socket.id, role: data.role || "" });
      socket.join(`user:${data.userId}`);
    });

    // Legacy join helper
    socket.on("join", (uid: string) => {
      if (uid) socket.join(`user:${uid}`);
    });

    // Direct-message conversation rooms
    socket.on("conversation:join", (conversationId: string | number) => {
      if (conversationId != null) socket.join(`conversation:${conversationId}`);
    });
    socket.on("conversation:leave", (conversationId: string | number) => {
      if (conversationId != null) socket.leave(`conversation:${conversationId}`);
    });

    // Legacy room names kept for backward compat
    socket.on("join_conversation", (convId: number | string) => {
      if (convId != null) socket.join(`conversation:${convId}`);
    });
    socket.on("leave_conversation", (convId: number | string) => {
      if (convId != null) socket.leave(`conversation:${convId}`);
    });

    // Voyage chat rooms
    socket.on("voyage:join", (voyageId: string | number) => {
      if (voyageId != null) socket.join(`voyage:${voyageId}`);
    });
    socket.on("voyage:leave", (voyageId: string | number) => {
      if (voyageId != null) socket.leave(`voyage:${voyageId}`);
    });

    // Typing indicators for direct messages
    socket.on("typing:start", (data: { conversationId: string | number; userId: string; userName: string }) => {
      if (!data?.conversationId) return;
      socket.to(`conversation:${data.conversationId}`).emit("typing:start", {
        userId: data.userId,
        userName: data.userName,
      });
    });
    socket.on("typing:stop", (data: { conversationId: string | number; userId: string }) => {
      if (!data?.conversationId) return;
      socket.to(`conversation:${data.conversationId}`).emit("typing:stop", {
        userId: data.userId,
      });
    });

    socket.on("disconnect", () => {
      for (const [userId, user] of Array.from(onlineUsers)) {
        if (user.socketId === socket.id) {
          onlineUsers.delete(userId);
          break;
        }
      }
    });
  });

  console.log("WebSocket server initialized");
  return io;
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  if (!io || !userId) return;
  try { io.to(`user:${userId}`).emit(event, data); } catch { }
}

export function emitToConversation(convId: number | string, event: string, data: unknown): void {
  if (!io || convId == null) return;
  try { io.to(`conversation:${convId}`).emit(event, data); } catch { }
}

export function emitToVoyage(voyageId: number | string, event: string, data: unknown): void {
  if (!io || voyageId == null) return;
  try { io.to(`voyage:${voyageId}`).emit(event, data); } catch { }
}

export function getSocketServer(): SocketServer | null {
  return io;
}

export function getOnlineCount(): number {
  return onlineUsers.size;
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}
