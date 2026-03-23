import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const getSocketUrl = () => {
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost) {
      // Força apontar para o domínio do backend correto (Alemanha) ao invés do Vercel
      return 'https://apinotion.andrekehrer.com';
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'https://apinotion.andrekehrer.com';
};

export const useSocket = (docId: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('notion_token') : null;

  useEffect(() => {
    if (!token) return;

    const socketUrl = getSocketUrl();
    const socketInstance = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      const workspaceId = localStorage.getItem('activeWorkspaceId');
      if (workspaceId) {
        socketInstance.emit('join-workspace', workspaceId);
      }
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('connect_error', () => {
      setIsConnected(false);
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (!socket || !docId) {
      return;
    }
    socket.emit('join-document', docId);
  }, [docId, socket]);

  return { socket, isConnected };
};
