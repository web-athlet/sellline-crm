'use client';

import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;
let cachedToken: string | undefined;

export function getSocket(accessToken?: string): Socket {
  if (socket && cachedToken === accessToken) return socket;

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  const url = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001';
  socket = io(url, {
    ...(accessToken ? { auth: { token: accessToken } } : {}),
    transports: ['websocket'],
    reconnection: true,
  });
  cachedToken = accessToken;
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    cachedToken = undefined;
  }
}
