import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Socket } from 'socket.io-client';

const PRESENCE_EMIT_INTERVAL_MS = 60;
const CURSOR_STALE_MS = 3500;
const TYPING_STALE_MS = 2500;

export interface ActivePresenceUser {
  socketId: string;
  userId: string;
  userName: string;
  x: number;
  y: number;
  color: string;
  lastSeen: number;
}

const hashColor = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue} 85% 62%)`;
};

const decodeUserFromToken = () => {
  if (typeof window === 'undefined') {
    return { userId: 'anonymous', userName: 'Usuário' };
  }

  const token = localStorage.getItem('notion_token');
  if (!token) {
    return { userId: 'anonymous', userName: 'Usuário' };
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = String(payload.user_id || payload.id || 'anonymous');
    const name = String(payload.name || '');
    const userName = name || 'Usuário';
    return { userId, userName };
  } catch {
    return { userId: 'anonymous', userName: 'Usuário' };
  }
};

export const usePresence = (
  socket: Socket | null,
  documentId: string | undefined,
  containerRef: RefObject<HTMLElement | null>
) => {
  const [activeUsers, setActiveUsers] = useState<ActivePresenceUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingLastSeenRef = useRef<Record<string, number>>({});
  const lastSelectionPayloadRef = useRef<string>('');
  const selectionEmitRafRef = useRef<number | null>(null);
  const lastPresenceEmitRef = useRef(0);
  const lastTypingEmitRef = useRef(0);

  const localUser = useMemo(() => decodeUserFromToken(), []);

  const emitSelectionChange = useCallback((force = false) => {
    if (!socket || !documentId || !containerRef.current) {
      return;
    }
    const now = Date.now();
    if (now - lastPresenceEmitRef.current < PRESENCE_EMIT_INTERVAL_MS) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      return;
    }

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && rect.x === 0 && rect.y === 0) {
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const x = rect.left - containerRect.left + containerRef.current.scrollLeft;
    const y = rect.top - containerRect.top + containerRef.current.scrollTop;
    const selectionPayloadKey = `${documentId}:${Math.round(x)}:${Math.round(y)}`;

    if (!force && lastSelectionPayloadRef.current === selectionPayloadKey) {
      return;
    }
    lastSelectionPayloadRef.current = selectionPayloadKey;
    lastPresenceEmitRef.current = now;

    socket.emit('selection-change', {
      documentId,
      userId: localUser.userId,
      userName: localUser.userName,
      position: { x, y },
    });
  }, [containerRef, documentId, localUser.userId, localUser.userName, socket]);

  const emitTyping = useCallback(() => {
    if (!socket || !documentId) {
      return;
    }
    const now = Date.now();
    if (now - lastTypingEmitRef.current < 100) {
      return;
    }
    lastTypingEmitRef.current = now;

    socket.emit('user-typing', {
      documentId,
      userId: localUser.userId,
      userName: localUser.userName,
      isTyping: true,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('user-typing', {
        documentId,
        userId: localUser.userId,
        userName: localUser.userName,
        isTyping: false,
      });
    }, 1200);
  }, [documentId, localUser.userId, localUser.userName, socket]);

  const handleEditorClick = useCallback(() => {
    emitSelectionChange(true);
  }, [emitSelectionChange]);

  const handleEditorKeyUp = useCallback(() => {
    emitSelectionChange(true);
    emitTyping();
  }, [emitSelectionChange, emitTyping]);

  useEffect(() => {
    if (!documentId || !containerRef.current) {
      return;
    }

    const onSelectionChange = () => {
      if (selectionEmitRafRef.current !== null) {
        cancelAnimationFrame(selectionEmitRafRef.current);
      }
      selectionEmitRafRef.current = requestAnimationFrame(() => {
        emitSelectionChange();
      });
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!containerRef.current) {
        return;
      }
      const target = event.target as Node | null;
      if (!target || !containerRef.current.contains(target)) {
        return;
      }
      emitSelectionChange(true);
      emitTyping();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!containerRef.current) {
        return;
      }
      const target = event.target as Node | null;
      if (!target || !containerRef.current.contains(target)) {
        return;
      }
      emitSelectionChange(true);
      emitTyping();
    };

    const onInput = (event: Event) => {
      if (!containerRef.current) {
        return;
      }
      const target = event.target as Node | null;
      if (!target || !containerRef.current.contains(target)) {
        return;
      }
      emitSelectionChange(true);
      emitTyping();
    };

    const onClick = (event: MouseEvent) => {
      if (!containerRef.current) {
        return;
      }
      const target = event.target as Node | null;
      if (!target || !containerRef.current.contains(target)) {
        return;
      }
      emitSelectionChange(true);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!containerRef.current) {
        return;
      }
      const target = event.target as Node | null;
      if (!target || !containerRef.current.contains(target)) {
        return;
      }
      emitSelectionChange(true);
    };

    window.document.addEventListener('selectionchange', onSelectionChange);
    window.document.addEventListener('keydown', onKeyDown, true);
    window.document.addEventListener('keyup', onKeyUp, true);
    window.document.addEventListener('input', onInput, true);
    window.document.addEventListener('click', onClick, true);
    window.document.addEventListener('pointerup', onPointerUp, true);

    return () => {
      if (selectionEmitRafRef.current !== null) {
        cancelAnimationFrame(selectionEmitRafRef.current);
        selectionEmitRafRef.current = null;
      }
      window.document.removeEventListener('selectionchange', onSelectionChange);
      window.document.removeEventListener('keydown', onKeyDown, true);
      window.document.removeEventListener('keyup', onKeyUp, true);
      window.document.removeEventListener('input', onInput, true);
      window.document.removeEventListener('click', onClick, true);
      window.document.removeEventListener('pointerup', onPointerUp, true);
    };
  }, [containerRef, documentId, emitSelectionChange, emitTyping]);

  useEffect(() => {
    if (!socket || !documentId) {
      return;
    }

    const onSelectionChange = (payload: { socketId: string; userId: string; userName: string; position: { x: number; y: number } }) => {
      if (!payload?.socketId || !payload?.position) {
        return;
      }
      if (payload.socketId === socket.id) {
        return;
      }

      setActiveUsers((prev) => {
        const existingUser = prev.find((user) => user.socketId === payload.socketId);
        if (
          existingUser
          && existingUser.x === payload.position.x
          && existingUser.y === payload.position.y
          && existingUser.userName === (payload.userName || 'Usuário')
        ) {
          return prev.map((user) => user.socketId === payload.socketId ? { ...user, lastSeen: Date.now() } : user);
        }
        const next = prev.filter((user) => user.socketId !== payload.socketId);
        next.push({
          socketId: payload.socketId,
          userId: String(payload.userId || payload.socketId),
          userName: payload.userName || 'Usuário',
          x: payload.position.x,
          y: payload.position.y,
          color: hashColor(String(payload.userId || payload.socketId)),
          lastSeen: Date.now(),
        });
        return next;
      });
    };

    const onUserTyping = (payload: { socketId: string; userName: string; isTyping: boolean }) => {
      if (!payload?.socketId) {
        return;
      }
      const userName = payload.userName || 'Usuário';

      setTypingUsers((prev) => {
        const withoutCurrent = prev.filter((name) => name !== userName);
        if (payload.isTyping) {
          typingLastSeenRef.current[userName] = Date.now();
          return [...withoutCurrent, userName];
        }
        delete typingLastSeenRef.current[userName];
        return withoutCurrent;
      });
    };

    const onCursorRemove = (socketId: string) => {
      setActiveUsers((prev) => prev.filter((user) => user.socketId !== socketId));
    };

    socket.on('selection-change', onSelectionChange);
    socket.on('user-typing', onUserTyping);
    socket.on('cursor-remove', onCursorRemove);

    return () => {
      socket.off('selection-change', onSelectionChange);
      socket.off('user-typing', onUserTyping);
      socket.off('cursor-remove', onCursorRemove);
    };
  }, [documentId, socket]);

  useEffect(
    () => () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (selectionEmitRafRef.current !== null) {
        cancelAnimationFrame(selectionEmitRafRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = Date.now();
      setActiveUsers((prev) => prev.filter((user) => now - user.lastSeen <= CURSOR_STALE_MS));
      setTypingUsers((prev) => prev.filter((name) => now - (typingLastSeenRef.current[name] || 0) <= TYPING_STALE_MS));
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  return {
    activeUsers,
    typingUsers,
    handleEditorClick,
    handleEditorKeyUp,
  };
};
