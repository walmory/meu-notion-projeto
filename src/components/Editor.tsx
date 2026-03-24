'use client';

import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core';
import '@blocknote/mantine/style.css';
import { Document } from '@/hooks/useDocuments';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { DragEvent } from 'react';
import { api } from '@/lib/api';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { Image as ImageIcon, Smile, X, Maximize, Minimize } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { usePresence } from '@/hooks/usePresence';
import { RemoteCursor } from './Editor/RemoteCursor';
import TextareaAutosize from 'react-textarea-autosize';
import { CustomCodeBlock } from './CustomCodeBlock';
import { motion, useAnimation } from 'framer-motion';
import { Mention } from './Mention';
import { SuggestionMenuController, getDefaultReactSlashMenuItems, DefaultReactSuggestionItem } from '@blocknote/react';
import { getAuthHeaders, getUserFromToken } from '@/lib/api';
import { useSWRConfig } from 'swr';

function debounce<T extends (...args: Parameters<T>) => void>(func: T, wait: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

const getBlocksFromContent = (content: unknown) => {
  if (!content) return undefined;
  if (Array.isArray(content) && content.length > 0) return content;
  if (typeof content === 'string') {
    try {
      const parsedContent = JSON.parse(content);
      if (Array.isArray(parsedContent) && parsedContent.length > 0) {
        return parsedContent;
      }
    } catch (e) {
      console.error('Error parsing blocknote content', e);
    }
  }
  return undefined;
};

const normalizeEditorTitle = (value: string | null | undefined) => {
  if (!value) return '';
  return value.trim().toLowerCase() === 'untitled' ? '' : value;
};

interface EditorProps {
  document: Document | null;
  onUpdate: () => void;
  onUpdateDocument?: (id: string, updates: Partial<Document>) => void;
  hideHeader?: boolean;
}

interface MentionSearchDocument {
  id: string;
  title?: string | null;
  icon?: string | null;
}

export function Editor({ document, onUpdate, onUpdateDocument, hideHeader = false }: EditorProps) {
  const user = getUserFromToken();
  const defaultTitle = document ? normalizeEditorTitle(document.title) : `Bem-vindo ao Workspace de ${user?.name || 'User'}`;
  const defaultContent = document ? document.content : '';
  const documentIcon = document?.icon ?? null;

  const [title, setTitle] = useState(defaultTitle || '');
  const [coverLoadError, setCoverLoadError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const { socket, isConnected } = useSocket(document?.id || '');
  const isUpdatingContent = useRef(false);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const [isFullWidth, setIsFullWidth] = useState(false);
  const { mutate: mutateGlobal } = useSWRConfig();
  const titleRef = useRef(title);
  // Atomic Sequence: seq increments every keystroke; lastSentSeq / lastAckedSeq
  // track sync state without race conditions.
  const seqRef = useRef(0);
  const lastSentSeqRef = useRef(0);
  const lastAckedSeqRef = useRef(0);
  const activeDocumentIdRef = useRef<string | null>(document?.id ?? null);
  const lastSentPayloadKeyRef = useRef<string>('');
  const mentionSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mentionSearchResolveRef = useRef<((value: DefaultReactSuggestionItem[]) => void) | null>(null);

  const prevDocId = useRef(document?.id);
  const controls = useAnimation();
  const { activeUsers, typingUsers, handleEditorClick, handleEditorKeyUp } = usePresence(
    socket,
    document?.id,
    editorContainerRef
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialBlocks = getBlocksFromContent(defaultContent) as any[] | undefined;
  const initialBlocksRef = useRef(initialBlocks);

  const handleUpload = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    if (document?.workspace_id) {
      formData.append('workspace_id', String(document.workspace_id));
    }

    try {
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.url;
    } catch (error) {
      console.error('Upload failed:', error);
      return '';
    }
  }, [document?.workspace_id]);

  const schema = useMemo(() => BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      codeBlock: CustomCodeBlock(),
    },
    inlineContentSpecs: {
      ...defaultInlineContentSpecs,
      mention: Mention,
    },
  }), []);

  const editor = useCreateBlockNote({
    schema,
    initialContent: initialBlocksRef.current,
    uploadFile: handleUpload,
  });

  useEffect(() => {
    if (!document) return;

    if (document.id !== prevDocId.current) {
      // Document changed: Animate out and replace content
      controls.set({ opacity: 0, y: 10 });
      
      setTitle(normalizeEditorTitle(document.title));
      
      const blocks = getBlocksFromContent(document.content);

      isUpdatingContent.current = true;
      if (blocks && Array.isArray(blocks) && blocks.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.replaceBlocks(editor.document, blocks as any);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.replaceBlocks(editor.document, [{ type: "paragraph", content: "" }] as any);
      }
      setTimeout(() => {
        isUpdatingContent.current = false;
      }, 50);
      
      prevDocId.current = document.id;
      activeDocumentIdRef.current = document.id;
      seqRef.current = 0;
      lastSentSeqRef.current = 0;
      lastAckedSeqRef.current = 0;
      lastSentPayloadKeyRef.current = '';
    } else {
      const normalizedDocumentTitle = normalizeEditorTitle(document.title);
      if (normalizedDocumentTitle !== titleRef.current) {
        setTitle(normalizedDocumentTitle);
      }
    }
    
    // Always animate in on mount or after change
    controls.start({ opacity: 1, y: 0, transition: { duration: 0.2 } });
  }, [document, editor, controls]);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  const syncSharedTitle = useCallback((docId: string, nextTitle: string) => {
    titleRef.current = nextTitle;
    setTitle(nextTitle);
    mutateGlobal(
      '/documents',
      (current: Document[] | undefined) => {
        const list = Array.isArray(current) ? current : [];
        return list.map((doc) => String(doc.id) === String(docId) ? { ...doc, title: nextTitle } : doc);
      },
      false
    );
    const activeWorkspaceId = typeof window !== 'undefined' ? localStorage.getItem('activeWorkspaceId') : null;
    const recentKey = activeWorkspaceId ? `/documents/recent?workspace_id=${activeWorkspaceId}` : '/documents/recent';
    mutateGlobal(
      recentKey,
      (current: Array<{ id: string; title: string; icon?: string; updated_at?: string; is_trash?: boolean | 0 | 1 }> | undefined) => {
        const list = Array.isArray(current) ? current : [];
        return list.map((doc) => String(doc.id) === String(docId) ? { ...doc, title: nextTitle } : doc);
      },
      false
    );
    mutateGlobal(
      `/documents/${docId}`,
      (current: Document | null | undefined) => current ? { ...current, title: nextTitle } : current,
      false
    );
  }, [mutateGlobal]);

  const syncSharedVisual = useCallback((docId: string, updates: Pick<Document, 'icon' | 'cover'>) => {
    if (updates.cover !== undefined) {
      setCoverLoadError(null);
    }
    mutateGlobal(
      '/documents',
      (current: Document[] | undefined) => {
        const list = Array.isArray(current) ? current : [];
        return list.map((doc) => String(doc.id) === String(docId) ? { ...doc, ...updates } : doc);
      },
      false
    );
    const activeWorkspaceId = typeof window !== 'undefined' ? localStorage.getItem('activeWorkspaceId') : null;
    const recentKey = activeWorkspaceId ? `/documents/recent?workspace_id=${activeWorkspaceId}` : '/documents/recent';
    const recentIconUpdate = updates.icon !== undefined ? { icon: updates.icon ?? undefined } : {};
    mutateGlobal(
      recentKey,
      (current: Array<{ id: string; title: string; icon?: string; updated_at?: string; is_trash?: boolean | 0 | 1 }> | undefined) => {
        const list = Array.isArray(current) ? current : [];
        return list.map((doc) => String(doc.id) === String(docId) ? { ...doc, ...recentIconUpdate } : doc);
      },
      false
    );
    mutateGlobal(
      `/documents/${docId}`,
      (current: Document | null | undefined) => current ? { ...current, ...updates } : current,
      false
    );
  }, [mutateGlobal]);

  useEffect(() => {
    const currentDocumentId = document?.id;
    if (!socket || !currentDocumentId) return;

    socket.on('title-change', (payload: { senderId?: string; docId?: string; title?: string }) => {
      if (!payload?.docId || String(payload.docId) !== String(currentDocumentId)) return;
      if (payload.senderId && socket.id && payload.senderId === socket.id) return;
      if (typeof payload.title !== 'string') return;
      if (payload.title === titleRef.current) return;
      syncSharedTitle(currentDocumentId, payload.title);
    });

    socket.on('document:update-title', (payload: { senderId?: string; docId?: string; newTitle?: string }) => {
      if (!payload?.docId || String(payload.docId) !== String(currentDocumentId)) return;
      if (payload.senderId && socket.id && payload.senderId === socket.id) return;
      if (typeof payload.newTitle !== 'string') return;
      if (payload.newTitle === titleRef.current) return;
      syncSharedTitle(currentDocumentId, payload.newTitle);
    });

    socket.on('icon-change', (payload: { senderId?: string; docId?: string; icon?: string | null }) => {
      if (!payload?.docId || String(payload.docId) !== String(currentDocumentId)) return;
      if (payload.senderId && socket.id && payload.senderId === socket.id) return;
      if (payload.icon === undefined) return;
      syncSharedVisual(currentDocumentId, { icon: payload.icon, cover: undefined });
    });

    socket.on('cover-change', (payload: { senderId?: string; docId?: string; cover?: string | null }) => {
      if (!payload?.docId || String(payload.docId) !== String(currentDocumentId)) return;
      if (payload.senderId && socket.id && payload.senderId === socket.id) return;
      if (payload.cover === undefined) return;
      syncSharedVisual(currentDocumentId, { icon: undefined, cover: payload.cover });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on('content-update', (payload: { senderId?: string; content?: any[]; contentVersion?: number; title?: string; icon?: string | null; cover?: string | null } | any[]) => {
      if (socket.id && typeof payload === 'object' && payload !== null && 'senderId' in payload) {
        if (payload.senderId === socket.id) {
          return;
        }
      }

      // Ensure we don't revert to an older version if we have version info
      if (payload && typeof payload === 'object' && 'contentVersion' in payload) {
        const incomingVersion = payload.contentVersion;
        const localVersion = localContentVersionRef.current;
        if (incomingVersion !== undefined && incomingVersion <= localVersion) {
          return;
        }
      }

      const incomingTitle = !Array.isArray(payload) && typeof payload?.title === 'string'
        ? payload.title
        : null;
      if (incomingTitle !== null && incomingTitle !== titleRef.current) {
        syncSharedTitle(currentDocumentId, incomingTitle);
      }
      const incomingIcon = !Array.isArray(payload) && payload?.icon !== undefined ? payload.icon : undefined;
      const incomingCover = !Array.isArray(payload) && payload?.cover !== undefined ? payload.cover : undefined;
      if (incomingIcon !== undefined || incomingCover !== undefined) {
        syncSharedVisual(currentDocumentId, { icon: incomingIcon, cover: incomingCover });
      }

      const nextContent = Array.isArray(payload) ? payload : payload?.content;
      if (!Array.isArray(nextContent)) {
        return;
      }
      
      const currentBlocks = editor.document;
      if (!currentBlocks || currentBlocks.length === 0) {
        isUpdatingContent.current = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editor.replaceBlocks(editor.document, nextContent as any);
        setTimeout(() => { isUpdatingContent.current = false; }, 50);
        return;
      }

      const currentMap = new Map(currentBlocks.map((b: any) => [b.id, b]));
      const incomingMap = new Map(nextContent.map((b: any) => [b.id, b]));

      isUpdatingContent.current = true;

      // 1. Remove deleted blocks
      const blocksToRemove = currentBlocks.filter((b: any) => !incomingMap.has(b.id));
      if (blocksToRemove.length > 0) {
        if (blocksToRemove.length === currentBlocks.length) {
          // If everything is deleted, just replace all
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          editor.replaceBlocks(currentBlocks, nextContent as any);
          setTimeout(() => { isUpdatingContent.current = false; }, 50);
          return;
        }
        for (const block of blocksToRemove) {
          editor.removeBlocks([block.id]);
        }
      }

      // 2. Insert or update blocks
      for (let i = 0; i < nextContent.length; i++) {
        const inBlock = nextContent[i];
        const curBlock = currentMap.get(inBlock.id);

        if (!curBlock) {
          // Insert new block
          if (i === 0) {
            const first = editor.document[0];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (first) editor.insertBlocks([inBlock as any], first.id, "before");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            else editor.replaceBlocks(editor.document, [inBlock as any]);
          } else {
            const prevInBlock = nextContent[i - 1];
            const prevExists = editor.document.find((b: any) => b.id === prevInBlock.id);
            if (prevExists) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              editor.insertBlocks([inBlock as any], prevExists.id, "after");
            } else {
              const last = editor.document[editor.document.length - 1];
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if (last) editor.insertBlocks([inBlock as any], last.id, "after");
            }
          }
        } else {
          // Update existing block if changed
          if (JSON.stringify(inBlock) !== JSON.stringify(curBlock)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            editor.updateBlock(curBlock.id, inBlock as any);
          }
        }
      }

      // 3. Fallback for ordering issues
      const finalBlocks = editor.document;
      if (finalBlocks.length === nextContent.length) {
        const outOfOrder = finalBlocks.some((b: any, idx: number) => b.id !== nextContent[idx].id);
        if (outOfOrder) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          editor.replaceBlocks(editor.document, nextContent as any);
        }
      }

      setTimeout(() => {
        isUpdatingContent.current = false;
      }, 50);
    });

    // content-ack: server confirmed a seq was persisted
    socket.on('content-ack', (payload: { docId?: string; seq?: number }) => {
      if (!payload?.docId || String(payload.docId) !== String(currentDocumentId)) return;
      if (typeof payload.seq !== 'number') return;
      lastAckedSeqRef.current = Math.max(lastAckedSeqRef.current, payload.seq);
    });

    socket.on('save-error', (payload: { docId?: string; seq?: number }) => {
      if (!payload?.docId || String(payload.docId) !== String(currentDocumentId)) return;
    });

    // Version conflict: another session saved a newer version.
    // Force a refetch so the user doesn't keep editing a ghost version.
    socket.on('save-version-conflict', (payload: { docId?: string }) => {
      if (!payload?.docId || String(payload.docId) !== String(currentDocumentId)) return;
      onUpdateRef.current();
    });

    return () => {
      socket.off('title-change');
      socket.off('document:update-title');
      socket.off('icon-change');
      socket.off('cover-change');
      socket.off('content-update');
      socket.off('content-ack');
      socket.off('save-error');
      socket.off('save-version-conflict');
    };
  }, [socket, editor, document?.id, syncSharedTitle, syncSharedVisual]);

  useEffect(() => {
    const currentDocumentId = document?.id;
    if (!currentDocumentId) {
      return;
    }
    const handleLiveTitleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ docId?: string; title?: string }>).detail;
      if (!detail?.docId || String(detail.docId) !== String(currentDocumentId)) return;
      if (typeof detail.title !== 'string') return;
      if (detail.title === titleRef.current) return;
      syncSharedTitle(currentDocumentId, detail.title);
    };
    window.addEventListener('live-title-update', handleLiveTitleUpdate);
    return () => {
      window.removeEventListener('live-title-update', handleLiveTitleUpdate);
    };
  }, [document?.id, syncSharedTitle]);

  useEffect(
    () => () => {
      if (mentionSearchTimeoutRef.current) {
        clearTimeout(mentionSearchTimeoutRef.current);
      }
      if (mentionSearchResolveRef.current) {
        mentionSearchResolveRef.current([]);
      }
    },
    []
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    titleRef.current = newTitle;
    const titleForPersistence = newTitle;
    if (document) {
      queueLocalTitleSync(document.id, newTitle);
      if (socket && isConnected && !isUpdatingContent.current) {
        emitLiveTitleViaSocket(document.id, titleForPersistence);
        seqRef.current += 1;
        emitContentViaSocketInstant(document.id, editor.document, titleForPersistence, seqRef.current);
        saveContentDebounced(document.id, editor.document, titleForPersistence);
      } else {
        if (onUpdateDocument) {
          onUpdateDocument(document.id, { title: titleForPersistence });
        } else {
          saveContentDebounced(document.id, editor.document, titleForPersistence);
        }
      }
    }
  };

  const queueLocalTitleSync = useMemo(
    () =>
      debounce((id: string, nextTitle: string) => {
        mutateGlobal(
          '/documents',
          (current: Document[] | undefined) => {
            const list = Array.isArray(current) ? current : [];
            return list.map((doc) => String(doc.id) === String(id) ? { ...doc, title: nextTitle } : doc);
          },
          false
        );

        const activeWorkspaceId = typeof window !== 'undefined' ? localStorage.getItem('activeWorkspaceId') : null;
        const recentKey = activeWorkspaceId ? `/documents/recent?workspace_id=${activeWorkspaceId}` : '/documents/recent';
        mutateGlobal(
          recentKey,
          (current: Array<{ id: string; title: string; icon?: string; updated_at?: string; is_trash?: boolean | 0 | 1 }> | undefined) => {
            const list = Array.isArray(current) ? current : [];
            return list.map((doc) => String(doc.id) === String(id) ? { ...doc, title: nextTitle } : doc);
          },
          false
        );
      }, 600),
    [mutateGlobal]
  );

  // Monotonically increasing content version — used by the DB guard
  // (AND content_version < ?) to reject stale writes automatically.
  const localContentVersionRef = useRef(Date.now());

  // Envia via Socket.io INSTANTANEAMENTE (evento de Typing para todos verem na hora)
  const emitContentViaSocketInstant = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (id: string, blocks: any[], nextTitle: string, seq: number) => {
        if (!socket) return;
        if (activeDocumentIdRef.current && String(activeDocumentIdRef.current) !== String(id)) {
          return;
        }
        const serializedContent = JSON.stringify(blocks);
        const payloadTitle = nextTitle;
        const payloadKey = `${id}:${payloadTitle}:${serializedContent}`;
        if (payloadKey === lastSentPayloadKeyRef.current) {
          return;
        }
        lastSentPayloadKeyRef.current = payloadKey;
        localContentVersionRef.current = Date.now();
        lastSentSeqRef.current = seq;
        socket.emit('update-content', {
          docId: id,
          content: serializedContent,
          title: payloadTitle,
          icon: documentIcon,
          cover: document?.cover,
          seq,
          contentVersion: localContentVersionRef.current,
        });
      },
    [socket, documentIcon, document?.cover]
  );

  // Debounced emit: salva de verdade no Banco/API apenas quando para de digitar (600ms)
  const saveContentDebounced = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      debounce(async (id: string, blocks: any[], nextTitle: string) => {
        const jsonContent = JSON.stringify(blocks);
        try {
          await api.patch(`/documents/${id}`, { content: jsonContent, title: nextTitle });
        } catch (error) {
          console.error('Failed to save document:', error);
        }
      }, 600),
    []
  );

  const emitLiveTitleViaSocket = useMemo(
    () =>
      debounce((id: string, nextTitle: string) => {
        if (!socket) return;
        if (activeDocumentIdRef.current && String(activeDocumentIdRef.current) !== String(id)) {
          return;
        }
        const workspaceId = (document?.workspace_id ? String(document.workspace_id) : null) || localStorage.getItem('activeWorkspaceId');
        if (!workspaceId) {
          return;
        }
        try {
          socket.emit('document:update-title', {
            docId: id,
            newTitle: nextTitle,
            workspaceId,
          });
        } catch (error) {
          console.error('[Sincronia Victor] Falha ao emitir atualização de título', error);
        }
      }, 500),
    [socket, document?.workspace_id]
  );

  const emitLiveIconViaSocket = useMemo(
    () =>
      debounce((id: string, nextIcon: string | null) => {
        if (!socket) return;
        if (activeDocumentIdRef.current && String(activeDocumentIdRef.current) !== String(id)) {
          return;
        }
        socket.emit('icon-change', {
          docId: id,
          icon: nextIcon,
        });
      }, 300),
    [socket]
  );

  const emitLiveCoverViaSocket = useMemo(
    () =>
      debounce((id: string, nextCover: string | null) => {
        if (!socket) return;
        if (activeDocumentIdRef.current && String(activeDocumentIdRef.current) !== String(id)) {
          return;
        }
        socket.emit('cover-change', {
          docId: id,
          cover: nextCover,
        });
      }, 300),
    [socket]
  );

  const handleEditorChangeDebounced = useMemo(
    () => debounce(() => {
      if (!document || isUpdatingContent.current) {
        return;
      }
      if (socket && isConnected) {
        seqRef.current += 1;
        emitContentViaSocketInstant(document.id, editor.document, titleRef.current, seqRef.current);
        saveContentDebounced(document.id, editor.document, titleRef.current);
      } else {
        saveContentDebounced(document.id, editor.document, titleRef.current);
      }
    }, 50), // Baixamos para 50ms para capturar o "Typing" rápido e deixar a responsabilidade de "aguardar para salvar" no saveContentDebounced
    [document, socket, isConnected, emitContentViaSocketInstant, editor, saveContentDebounced]
  );

  const handleEditorChange = useCallback(() => {
    handleEditorChangeDebounced();
  }, [handleEditorChangeDebounced]);

  const insertDocumentMention = useCallback((doc: MentionSearchDocument) => {
    const documentTitle = doc.title || 'Untitled';
    const documentIcon = doc.icon || '📄';
    editor.insertInlineContent([
      {
        type: 'mention',
        props: {
          userId: 'unknown',
          userName: 'User',
          documentId: String(doc.id),
          documentTitle,
          documentIcon,
        },
      },
      ' ',
    ]);
  }, [editor]);

  const getDocumentMentionItems = useCallback((query: string): Promise<DefaultReactSuggestionItem[]> => {
    const trimmedQuery = query.trim();
    const workspaceIdFromDocument = document?.workspace_id ? String(document.workspace_id) : undefined;
    if (trimmedQuery.length < 1) {
      if (mentionSearchTimeoutRef.current) {
        clearTimeout(mentionSearchTimeoutRef.current);
        mentionSearchTimeoutRef.current = null;
      }
      if (mentionSearchResolveRef.current) {
        mentionSearchResolveRef.current([]);
        mentionSearchResolveRef.current = null;
      }
      return Promise.resolve([]);
    }

    if (mentionSearchTimeoutRef.current) {
      clearTimeout(mentionSearchTimeoutRef.current);
      mentionSearchTimeoutRef.current = null;
    }
    if (mentionSearchResolveRef.current) {
      mentionSearchResolveRef.current([]);
      mentionSearchResolveRef.current = null;
    }

    return new Promise((resolve) => {
      mentionSearchResolveRef.current = resolve;
      mentionSearchTimeoutRef.current = setTimeout(async () => {
        mentionSearchTimeoutRef.current = null;
        try {
          const res = await api.get('/documents/search', {
            headers: getAuthHeaders(),
            params: {
              q: trimmedQuery,
              ...(workspaceIdFromDocument ? { workspace_id: workspaceIdFromDocument } : {}),
            },
          });
          const docs: MentionSearchDocument[] = Array.isArray(res.data) ? res.data : [];
          const items = docs.map((doc) => ({
            id: `doc-${String(doc.id)}`,
            title: `${doc.icon || '📄'} ${doc.title || 'Untitled'}`,
            subtext: 'Documento',
            onItemClick: () => {
              insertDocumentMention(doc);
            },
          }));
          resolve(items);
        } catch (error) {
          console.error('Failed to search documents for mentions', error);
          resolve([]);
        } finally {
          mentionSearchResolveRef.current = null;
        }
      }, 150);
    });
  }, [document?.workspace_id, insertDocumentMention]);

  const applyVisualUpdate = useCallback((updates: Partial<Document>) => {
    if (!document) {
      return;
    }
    mutateGlobal(
      (key) => typeof key === 'string' && key.startsWith('/documents'),
      (current: unknown) => {
        if (!Array.isArray(current)) {
          return current;
        }
        return current.map((doc) => {
          if (!doc || typeof doc !== 'object' || !('id' in doc)) {
            return doc;
          }
          return String((doc as { id: string }).id) === String(document.id)
            ? { ...(doc as object), ...updates }
            : doc;
        });
      },
      false
    );
    if (onUpdateDocument) {
      onUpdateDocument(document.id, updates);
      return;
    }
    onUpdate();
  }, [document, mutateGlobal, onUpdateDocument, onUpdate]);

  const handleEmojiSelect = async (emojiData: { emoji: string }) => {
    setShowEmojiPicker(false);
    if (document) {
      const nextIcon = emojiData.emoji;
      console.log('[emoji][in]', {
        action: 'select',
        documentId: document.id,
        nextIcon
      });
      applyVisualUpdate({ icon: nextIcon });
      if (socket && isConnected) {
        emitLiveIconViaSocket(document.id, nextIcon);
      }
      if (onUpdateDocument) {
        console.log('[emoji][out]', {
          action: 'select',
          mode: 'onUpdateDocument',
          documentId: document.id,
          nextIcon
        });
        return;
      }
      try {
        await api.patch(`/documents/${document.id}`, { icon: nextIcon });
        console.log('[emoji][out]', {
          action: 'select',
          mode: 'api.patch',
          documentId: document.id,
          nextIcon
        });
      } catch (error) {
        console.error('Failed to set icon:', error);
        onUpdate();
      }
    }
  };

  const handleEmojiRemove = async () => {
    if (document) {
      console.log('[emoji][in]', {
        action: 'remove',
        documentId: document.id
      });
      applyVisualUpdate({ icon: null });
      if (socket && isConnected) {
        emitLiveIconViaSocket(document.id, null);
      }
      if (onUpdateDocument) {
        console.log('[emoji][out]', {
          action: 'remove',
          mode: 'onUpdateDocument',
          documentId: document.id
        });
        return;
      }
      try {
        await api.patch(`/documents/${document.id}`, { icon: null });
        console.log('[emoji][out]', {
          action: 'remove',
          mode: 'api.patch',
          documentId: document.id
        });
      } catch (error) {
        console.error('Failed to remove icon:', error);
        onUpdate();
      }
    }
  };

  const handleCoverRemove = async () => {
    if (document) {
      applyVisualUpdate({ cover: null });
      if (socket && isConnected) {
        emitLiveCoverViaSocket(document.id, null);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (onUpdateDocument) {
        return;
      }
      try {
        await api.patch(`/documents/${document.id}`, { cover: null });
      } catch (error) {
        console.error('Failed to remove cover:', error);
        onUpdate();
      }
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && document) {
      const url = await handleUpload(file);
      if (url) {
        setCoverLoadError(null);
        applyVisualUpdate({ cover: url });
        if (socket && isConnected) {
          emitLiveCoverViaSocket(document.id, url);
        }
        if (onUpdateDocument) {
          return;
        }
        try {
          await api.patch(`/documents/${document.id}`, { cover: url });
        } catch (error) {
          console.error('Failed to set cover:', error);
          onUpdate();
        }
      }
    }
  };

  const insertImageFromFile = useCallback(async (file: File) => {
    if (!document) return;
    const url = await handleUpload(file);
    if (!url) return;
    const currentBlock = editor.getTextCursorPosition()?.block || editor.document[editor.document.length - 1];
    if (!currentBlock) return;
    editor.insertBlocks(
      [{
        type: 'image',
        props: { url }
      }],
      currentBlock,
      'after'
    );
  }, [document, editor, handleUpload]);

  const handleEditorDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    const hasImageFile = Array.from(e.dataTransfer.items || []).some((item) => (
      item.kind === 'file' && item.type.startsWith('image/')
    ));
    if (hasImageFile) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleEditorDrop = useCallback(async (e: DragEvent<HTMLElement>) => {
    const imageFiles = Array.from(e.dataTransfer.files || []).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    e.preventDefault();
    for (const file of imageFiles) {
      await insertImageFromFile(file);
    }
  }, [insertImageFromFile]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!editorContainerRef.current?.contains(e.target as Node)) return;

      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;

      const markdownCodeRegex = /^```([a-z]*)\n([\s\S]*?)```$/i;
      const match = text.trim().match(markdownCodeRegex);

      if (match) {
        e.preventDefault();
        e.stopPropagation();
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const language = (match[1] || 'javascript') as any;
        const code = match[2].trim();
        
        const currentBlock = editor.getTextCursorPosition()?.block;
        if (currentBlock) {
          editor.insertBlocks(
            [{
              type: 'codeBlock',
              props: { language, code }
            }],
            currentBlock,
            'after'
          );
        }
        return;
      }

      // Check for VS Code paste
      const vscodeData = e.clipboardData?.getData('vscode-editor-data');
      if (vscodeData) {
        try {
          const data = JSON.parse(vscodeData);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const language = (data.mode || 'javascript') as any;
          
          e.preventDefault();
          e.stopPropagation();
          
          const currentBlock = editor.getTextCursorPosition()?.block;
          if (currentBlock) {
            editor.insertBlocks(
              [{
                type: 'codeBlock',
                props: { language, code: text }
              }],
              currentBlock,
              'after'
            );
          }
        } catch (err) {
          console.error('Failed to parse vscode data', err);
        }
      }
    };

    window.document.addEventListener('paste', handlePaste, true);
    return () => window.document.removeEventListener('paste', handlePaste, true);
  }, [editor]);

  return (
    <>
      <main 
        className={`flex-1 overflow-y-auto relative group ${hideHeader ? 'bg-transparent' : 'bg-[#191919]'}`}
        ref={editorContainerRef}
        onClick={handleEditorClick}
        onKeyUp={handleEditorKeyUp}
        onDragOver={handleEditorDragOver}
        onDrop={handleEditorDrop}
      >
        {activeUsers.map((user) => (
          <RemoteCursor key={user.socketId} user={user} />
        ))}
        {typingUsers.length > 0 && (
          <div className="pointer-events-none absolute top-3 right-4 z-50 rounded-md border border-white/10 bg-[#1a1a1a]/95 px-3 py-1.5 text-xs text-[#d4d4d4] shadow-2xl">
            {typingUsers.join(', ')} está digitando...
          </div>
        )}
        
        <motion.div
          animate={controls}
          initial={{ opacity: 0, y: 10 }}
          className="w-full min-h-full flex flex-col pb-32"
        >
          {!hideHeader && document?.cover && coverLoadError !== document.cover && (
            <div className="w-full h-64 relative group/cover">
              <img
                src={document.cover}
                alt="Cover"
                className="w-full h-full object-cover"
                onError={() => setCoverLoadError(document.cover || null)}
              />
              <div className="absolute top-4 right-4 opacity-0 group-hover/cover:opacity-100 transition flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#2c2c2c] hover:bg-[#3f3f3f] text-white px-3 py-1.5 rounded text-sm flex items-center gap-2"
                >
                  <ImageIcon size={16} />
                  Change cover
                </button>
                <button
                  type="button"
                  onClick={handleCoverRemove}
                  className="bg-[#2c2c2c] hover:bg-[#3f3f3f] text-white px-3 py-1.5 rounded text-sm flex items-center gap-2"
                >
                  <X size={16} />
                  Remove cover
                </button>
              </div>
            </div>
          )}

          <div className={`mx-auto ${isFullWidth ? 'max-w-none' : 'max-w-5xl'} w-full flex-1 flex flex-col relative ${hideHeader ? 'pt-4 px-2' : 'px-4 sm:px-8 md:px-16 lg:px-24 pt-16'}`}>
            {!hideHeader && (
            <div className="absolute top-4 right-4 md:right-8 z-10 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFullWidth(!isFullWidth)}
                className="p-2 text-[#a3a3a3] hover:text-white hover:bg-[#2c2c2c] rounded-md transition-colors"
                title={isFullWidth ? "Centralizar largura" : "Largura total"}
              >
                {isFullWidth ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          )}

          {!hideHeader && document && (
            <div className="mb-4 flex flex-col items-start gap-4">
              {documentIcon ? (
                <div className="relative group/emoji flex items-center gap-2">
                  <button type="button" className="text-6xl cursor-pointer" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                    {documentIcon}
                  </button>
                  <button
                    type="button"
                    onClick={handleEmojiRemove}
                    className="opacity-0 group-hover/emoji:opacity-100 text-[#a3a3a3] hover:bg-[#2c2c2c] p-1.5 rounded transition-opacity"
                    title="Remove icon"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="text-[#a3a3a3] hover:bg-[#2c2c2c] px-2 py-1 rounded flex items-center gap-1 text-sm"
                  >
                    <Smile size={16} />
                    Add icon
                  </button>
                  {(!document.cover || coverLoadError === document.cover) && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[#a3a3a3] hover:bg-[#2c2c2c] px-2 py-1 rounded flex items-center gap-1 text-sm"
                    >
                      <ImageIcon size={16} />
                      Add cover
                    </button>
                  )}
                </div>
              )}
              
              {showEmojiPicker && (
                <div className="absolute z-50 mt-16">
                  <div className="fixed inset-0" aria-hidden="true" onClick={() => setShowEmojiPicker(false)} />
                  <div className="relative">
                    <EmojiPicker onEmojiClick={handleEmojiSelect} theme={Theme.DARK} />
                  </div>
                </div>
              )}
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleCoverUpload} 
                className="hidden" 
                accept="image/*"
              />
            </div>
          )}

          {!hideHeader && (
            !document ? (
              <h1 className="mb-8 w-full bg-transparent text-4xl md:text-5xl font-bold text-white outline-none placeholder-[#3f3f3f]">
                {defaultTitle}
              </h1>
            ) : (
              <TextareaAutosize
                value={title}
                onChange={handleTitleChange}
                placeholder="Untitled"
                autoFocus={!normalizeEditorTitle(document.title).trim()}
                className="mb-8 w-full resize-none appearance-none overflow-hidden bg-transparent text-4xl md:text-5xl font-bold text-white outline-none placeholder-[#3f3f3f]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    // Move focus to editor when enter is pressed
                    editor.focus();
                  }
                }}
              />
            )
          )}
          <div className={`blocknote-dark-theme flex-1 w-full max-w-full overflow-x-hidden ${hideHeader ? '' : 'md:-mx-12'}`}>
              <BlockNoteView
                editor={editor}
                theme="dark"
                onChange={handleEditorChange}
                editable={!!document}
              >
                <SuggestionMenuController
                  triggerCharacter="@"
                  getItems={getDocumentMentionItems}
                />
                <SuggestionMenuController
                  triggerCharacter="[["
                  getItems={async (query): Promise<DefaultReactSuggestionItem[]> => {
                    try {
                      const trimmedQuery = query.trim();
                      if (trimmedQuery.length < 1) {
                        return [];
                      }
                      const workspaceIdFromDocument = document?.workspace_id ? String(document.workspace_id) : undefined;
                      const res = await api.get('/documents/search', {
                        headers: getAuthHeaders(),
                        params: {
                          q: trimmedQuery,
                          ...(workspaceIdFromDocument ? { workspace_id: workspaceIdFromDocument } : {}),
                        },
                      });
                      const docs: MentionSearchDocument[] = Array.isArray(res.data) ? res.data : [];
                      return docs.map((doc) => ({
                        id: String(doc.id),
                        title: `${doc.icon || '📄'} ${doc.title || 'Untitled'}`,
                        subtext: 'Link to document',
                        onItemClick: () => {
                          insertDocumentMention(doc);
                        },
                      }));
                    } catch (error) {
                      console.error('Failed to search documents for mentions', error);
                      return [];
                    }
                  }}
                />
                <SuggestionMenuController
                  triggerCharacter="/"
                  getItems={async (query) => 
                    getDefaultReactSlashMenuItems(editor).filter(item => 
                      item.title.toLowerCase().includes(query.toLowerCase())
                    )
                  }
                />
              </BlockNoteView>
            </div>
          </div>
        </motion.div>
      </main>
    </>
  );
}
