'use client';

import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';

import { disconnectSocket, getSocket } from '../socket';
import { useAuthStore } from '../store/auth-store';

export function useSocket(): Socket | null {
  const token = useAuthStore((s) => s.accessToken);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      return;
    }
    const next = getSocket(token);
    setSocket(next);
    return () => {
      disconnectSocket();
    };
  }, [token]);

  return socket;
}
