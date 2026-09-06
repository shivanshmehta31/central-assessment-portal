import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './auth-store';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  const token = useAuthStore.getState().accessToken;
  if (socket && socket.connected) return socket;

  socket = io(`${WS_URL}/realtime`, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
