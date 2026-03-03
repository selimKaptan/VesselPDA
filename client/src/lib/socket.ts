import { io, type Socket } from "socket.io-client";
import { useEffect, useRef, useState } from "react";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: "/ws/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: false,
      withCredentials: true,
    });
  }
  return socket;
}

export function connectSocket(userId: string): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.auth = { userId };
    s.connect();
  }
  s.emit("join", userId);
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function useSocket(userId?: string) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!userId) return;
    const s = connectSocket(userId);
    socketRef.current = s;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    if (s.connected) setConnected(true);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
    };
  }, [userId]);

  return { socket: socketRef.current ?? getSocket(), connected };
}
