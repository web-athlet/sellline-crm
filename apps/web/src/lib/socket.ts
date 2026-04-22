'use client';

import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(accessToken?: string): Socket {
  if (socket?.connected) return socket;
  const url = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001';
  socket = io(url, {
    ...(accessToken ? { auth: { token: accessToken } } : {}),
    transports: ['websocket'],
    reconnection: true,
  });
  return socket;
}
