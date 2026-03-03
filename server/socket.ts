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

    socket.on("disconnect", () => {});
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

export function getSocketServer(): SocketServer | null {
  return io;
}
