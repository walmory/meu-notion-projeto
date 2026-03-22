import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const useSocket = (docId: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('notion_token') : null;

  useEffect(() => {
    if (!token) return;

    const socketInstance = io(SOCKET_BASE_URL, {
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
