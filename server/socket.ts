import { Server as SocketServer } from "socket.io";
import type { Server as HttpServer } from "http";

let io: SocketServer | null = null;

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/ws/socket.io",
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth?.userId as string | undefined;
    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on("join", (uid: string) => {
      if (uid) socket.join(`user:${uid}`);
    });

    socket.on("join_conversation", (convId: number | string) => {
      if (convId) socket.join(`conv:${convId}`);
    });

    socket.on("leave_conversation", (convId: number | string) => {
      if (convId) socket.leave(`conv:${convId}`);
    });

    socket.on("join_org", (orgId: number | string) => {
      if (orgId) socket.join(`org:${orgId}`);
    });

    socket.on("leave_org", (orgId: number | string) => {
      if (orgId) socket.leave(`org:${orgId}`);
    });

    socket.on("join_channel", (channelId: number | string) => {
      if (channelId) socket.join(`channel:${channelId}`);
    });

    socket.on("leave_channel", (channelId: number | string) => {
      if (channelId) socket.leave(`channel:${channelId}`);
    });

    const typingTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
    socket.on("team_typing", (data: { channelId: number | string; userId: string; userName: string }) => {
      const key = `${data.channelId}:${data.userId}`;
      socket.to(`channel:${data.channelId}`).emit("team_typing", data);
      const existing = typingTimers.get(key);
      if (existing) clearTimeout(existing);
      typingTimers.set(
        key,
        setTimeout(() => {
          socket.to(`channel:${data.channelId}`).emit("team_typing_stop", data);
          typingTimers.delete(key);
        }, 3000)
      );
    });

    socket.on("disconnect", () => {
      typingTimers.forEach((t) => clearTimeout(t));
      typingTimers.clear();
    });
  });

  return io;
}

export function emitToUser(userId: string, event: string, data: unknown): void {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, data);
}

export function emitToConversation(convId: number | string, event: string, data: unknown): void {
  if (!io) return;
  io.to(`conv:${convId}`).emit(event, data);
}

export function emitToChannel(channelId: number | string, event: string, data: unknown): void {
  if (!io) return;
  io.to(`channel:${channelId}`).emit(event, data);
}

export function getSocketServer(): SocketServer | null {
  return io;
}
