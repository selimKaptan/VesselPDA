import { useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";

// Module-level singleton so the socket survives re-renders
let socket: Socket | null = null;

export function useSocket() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const listenersAttached = useRef(false);

  useEffect(() => {
    if (!user) return;

    // Create socket once
    if (!socket) {
      try {
        socket = io(window.location.origin, {
          path: "/ws/socket.io",
          withCredentials: true,
          transports: ["websocket", "polling"],
          reconnectionAttempts: 10,
          reconnectionDelay: 2000,
        });
      } catch (err) {
        console.warn("Socket.io: failed to initialise, continuing without real-time.", err);
        return;
      }
    }

    if (listenersAttached.current) return;
    listenersAttached.current = true;

    socket.on("connect", () => {
      socket?.emit("user:online", {
        userId: (user as any).id,
        role: (user as any).userRole,
      });
    });

    // Emit immediately if already connected
    if (socket.connected) {
      socket.emit("user:online", {
        userId: (user as any).id,
        role: (user as any).userRole,
      });
    }

    socket.on("message:new", (msg: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      if (msg?.conversationId) {
        queryClient.invalidateQueries({ queryKey: [`/api/messages/${msg.conversationId}`] });
      }
    });

    socket.on("voyage:chat:new", (msg: any) => {
      if (msg?.voyageId) {
        queryClient.invalidateQueries({ queryKey: ["/api/voyages", msg.voyageId, "chat"] });
      }
    });

    socket.on("notification:new", (notification: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
      if (notification?.title) {
        toast({
          title: notification.title,
          description: notification.message || "",
        });
      }
    });

    socket.on("notification:unread-count", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
    });

    socket.on("disconnect", () => {
      // No crash — socket.io auto-reconnects
    });

    socket.on("connect_error", (err) => {
      console.warn("Socket.io connect error (non-fatal):", err.message);
    });

    // No cleanup — socket is app-global and should stay connected
  }, [user]);

  const joinConversation = useCallback((conversationId: string | number) => {
    socket?.emit("conversation:join", String(conversationId));
  }, []);

  const leaveConversation = useCallback((conversationId: string | number) => {
    socket?.emit("conversation:leave", String(conversationId));
  }, []);

  const joinVoyage = useCallback((voyageId: string | number) => {
    socket?.emit("voyage:join", String(voyageId));
  }, []);

  const leaveVoyage = useCallback((voyageId: string | number) => {
    socket?.emit("voyage:leave", String(voyageId));
  }, []);

  const emitTyping = useCallback((conversationId: string | number, userName: string) => {
    socket?.emit("typing:start", {
      conversationId: String(conversationId),
      userId: (user as any)?.id,
      userName,
    });
  }, [user]);

  const stopTyping = useCallback((conversationId: string | number) => {
    socket?.emit("typing:stop", {
      conversationId: String(conversationId),
      userId: (user as any)?.id,
    });
  }, [user]);

  return {
    socket,
    joinConversation,
    leaveConversation,
    joinVoyage,
    leaveVoyage,
    emitTyping,
    stopTyping,
  };
}
