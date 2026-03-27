'use client';

import { 
  Search, 
  Home, 
  CalendarCheck, 
  Inbox, 
  Users, 
  Plus, 
  FileText,
  Folder,
  Database,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  MoreHorizontal,
  Trash,
  Sparkles,
  Book,
  ChevronsUpDown,
  Copy,
  Link,
  Edit2,
  Settings,
  PenSquare,
  UserPlus,
  MonitorSmartphone,
  Briefcase
} from 'lucide-react';
import { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { Document } from '@/hooks/useDocuments';
import { 
  DndContext, 
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useRouter, usePathname } from 'next/navigation';
import { TrashModal } from './TrashModal';
import { TeamspaceContextMenu } from './TeamspaceContextMenu';
import { TeamspaceSettingsModal } from './TeamspaceSettingsModal';
import useSWR, { useSWRConfig } from 'swr';
import { api, clearAuthSession, getAuthHeaders, getAuthToken, getUserFromToken } from '@/lib/api';
import * as LucideIcons from 'lucide-react';
import { toast } from 'sonner';
import { io } from 'socket.io-client';

interface Teamspace {
  id: string;
  name: string;
  created_by: string;
  invite_code: string;
  description: string;
  icon: string;
  member_count: number;
  workspace_id: string;
  is_trash?: boolean | 0 | 1;
}

interface Project {
  id: string;
  name: string;
  owner_id: string;
  teamspace_id?: string;
  color: string;
}

interface Workspace {
  id: string;
  name: string;
  owner: string;
  plan: string;
  member_count: number;
}

const fetcher = async (url: string) => {
  const headers = getAuthHeaders();
  if (!headers.Authorization) {
    return [];
  }
  try {
    const res = await api.get(url, { headers, suppressGlobalErrorLog: true } as { headers: Record<string, string>; suppressGlobalErrorLog: boolean });
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
};

const hasVisibleTitle = (title: string | null | undefined) => {
  if (!title) return false;
  const normalized = title.trim().toLowerCase();
  return normalized !== '' && normalized !== 'untitled';
};

interface SidebarProps {
  documents: Document[];
  onSelectDocument: (doc: Document | null) => void;
  selectedDocId?: string;
  onCreateDocument: (
    isShared: boolean,
    parentId?: string | null,
    teamspaceId?: string | null,
    options?: { title?: string; type?: 'page' | 'database'; skipNavigation?: boolean }
  ) => Promise<Document | undefined>;
  onDeleteDocument: (id: string) => void;
  onUpdateDocument: (id: string, updates: Partial<Document>) => void;
  onToggleFavorite: (id: string) => void;
  onDuplicateDocument: (id: string) => void;
}

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { WorkspaceInviteModal } from './WorkspaceInviteModal';
import { WorkspaceSettingsModal } from './WorkspaceSettingsModal';
import { WorkspaceCreateModal } from './WorkspaceCreateModal';
import { useUser } from '@/contexts/UserContext';
import { useTabs } from '@/contexts/TabsContext';

export function Sidebar({ 
  documents, 
  onSelectDocument, 
  selectedDocId, 
  onCreateDocument,
  onDeleteDocument,
  onUpdateDocument,
  onToggleFavorite,
  onDuplicateDocument
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { addTab } = useTabs();
  const { mutate: globalMutate } = useSWRConfig();
  const [favoritesExpanded, setFavoritesExpanded] = useState(true);
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [teamspacesExpanded, setTeamspacesExpanded] = useState(true);
  const [sharedExpanded, setSharedExpanded] = useState(true);
  const [privateExpanded, setPrivateExpanded] = useState(true);
  
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [settingsTeamspace, setSettingsTeamspace] = useState<Teamspace | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('activeWorkspaceId');
  });
  
  // Modals state for Workspace
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isWorkspaceSettingsOpen, setIsWorkspaceSettingsOpen] = useState(false);
  const [isWorkspaceInviteOpen, setIsWorkspaceInviteOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [isCreateTeamspaceOpen, setIsCreateTeamspaceOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [autoRenameDocId, setAutoRenameDocId] = useState<string | null>(null);

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const [newTeamspaceName, setNewTeamspaceName] = useState('');
  const [isCreatingTeamspace, setIsCreatingTeamspace] = useState(false);

  const { data: workspacesData, isLoading: isWorkspacesLoading, mutate: mutateWorkspaces } = useSWR<Workspace[]>('/workspaces', fetcher);
  const workspaces = useMemo(() => workspacesData || [], [workspacesData]);
  const hasValidSelectedWorkspace = selectedWorkspaceId ? workspaces.some((workspace) => workspace.id === selectedWorkspaceId) : false;
  const activeWorkspaceId = hasValidSelectedWorkspace ? selectedWorkspaceId : (workspaces.length > 0 ? workspaces[0].id : null);
  const selectedWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
  const { user, setUser } = useUser();
  const rawWorkspaceName = selectedWorkspace?.name || `${user?.name || 'User'}'s Workspace`;
  const workspaceDisplayName = isWorkspacesLoading ? 'Loading...' : rawWorkspaceName;
  const workspaceInitial = workspaceDisplayName.charAt(0).toUpperCase();
  const { data: pendingInvites } = useSWR<{ count: number }>(
    activeWorkspaceId ? '/workspaces/invitations/pending-count' : null,
    async (url: string) => {
      const response = await api.get(url, { headers: getAuthHeaders() });
      return response.data;
    }
  );
  const hasPendingInvites = Number(pendingInvites?.count || 0) > 0;

  useEffect(() => {
    if (isWorkspacesLoading || workspaces.length === 0 || hasValidSelectedWorkspace) {
      return;
    }
    setSelectedWorkspaceId(workspaces[0].id);
  }, [isWorkspacesLoading, workspaces, hasValidSelectedWorkspace]);

  useEffect(() => {
    if (activeWorkspaceId) {
      const oldId = localStorage.getItem('activeWorkspaceId');
      if (oldId !== activeWorkspaceId) {
        localStorage.setItem('activeWorkspaceId', activeWorkspaceId);
        window.dispatchEvent(new CustomEvent('mutate-documents'));
      }
    }
  }, [activeWorkspaceId]);

  const { data: teamspacesData, mutate: mutateTeamspaces } = useSWR<Teamspace[]>(activeWorkspaceId ? `/teamspaces?workspace_id=${activeWorkspaceId}` : null, fetcher);

  const teamspaces = useMemo(
    () => (
      Array.isArray(teamspacesData)
        ? teamspacesData.filter((teamspace) => Boolean(teamspace?.id) && teamspace.is_trash !== true && teamspace.is_trash !== 1)
        : []
    ),
    [teamspacesData]
  );
  const documentsRef = useRef<Document[]>(documents);

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  const persistActiveWorkspace = async (id: string) => {
    try {
      await api.post(
        '/workspaces/active',
        { workspace_id: id },
        { headers: getAuthHeaders(), suppressGlobalErrorLog: true } as { headers: Record<string, string>; suppressGlobalErrorLog: boolean }
      );
    } catch {
      return;
    }
  };

  const handleWorkspaceSwitch = (id: string) => {
    const clearAppState = () => {
      globalMutate(
        (key) => typeof key === 'string' && !key.startsWith('/workspaces'),
        undefined,
        { revalidate: false }
      );
    };

    clearAppState();
    setSelectedWorkspaceId(id);
    localStorage.setItem('activeWorkspaceId', id);
    void persistActiveWorkspace(id);
    router.push(`/workspace/${id}`);
  };

  const applyLiveTitleSync = useCallback((documentId: string, nextTitle: string) => {
    const currentDocument = documentsRef.current.find((doc) => String(doc.id) === String(documentId));
    if (!currentDocument || currentDocument.title === nextTitle) {
      return;
    }

    globalMutate(
      '/documents',
      (current: Document[] | undefined) => {
        if (!Array.isArray(current)) {
          return current;
        }
        const targetIndex = current.findIndex((doc) => String(doc.id) === String(documentId));
        if (targetIndex === -1 || current[targetIndex].title === nextTitle) {
          return current;
        }
        const next = [...current];
        next[targetIndex] = { ...next[targetIndex], title: nextTitle };
        return next;
      },
      false
    );

    const workspaceId = activeWorkspaceId || localStorage.getItem('activeWorkspaceId');
    const recentKey = workspaceId ? `/documents/recent?workspace_id=${workspaceId}` : '/documents/recent';
    globalMutate(
      recentKey,
      (current: Array<{ id: string; title: string; icon?: string; updated_at?: string; is_trash?: boolean | 0 | 1 }> | undefined) => {
        if (!Array.isArray(current)) {
          return current;
        }
        const targetIndex = current.findIndex((doc) => String(doc.id) === String(documentId));
        if (targetIndex === -1 || current[targetIndex].title === nextTitle) {
          return current;
        }
        const next = [...current];
        next[targetIndex] = { ...next[targetIndex], title: nextTitle };
        return next;
      },
      false
    );

    globalMutate(
      `/documents/${documentId}`,
      (current: Document | null | undefined) => {
        if (!current || current.title === nextTitle) {
          return current;
        }
        return { ...current, title: nextTitle };
      },
      false
    );

    window.dispatchEvent(new CustomEvent('live-title-update', { detail: { docId: documentId, title: nextTitle } }));
  }, [globalMutate, activeWorkspaceId]);

  const handleDocumentUpdate = useCallback((documentId: string, updates: Partial<Document>) => {
    onUpdateDocument(documentId, updates);
    if (typeof updates.title !== 'string') {
      return;
    }
    applyLiveTitleSync(documentId, updates.title);
    const workspaceId = activeWorkspaceId || localStorage.getItem('activeWorkspaceId');
    try {
      if (socketRef.current && workspaceId) {
        socketRef.current.emit('document:update-title', {
          docId: documentId,
          newTitle: updates.title,
          workspaceId,
        });
      }
    } catch (error) {
      console.error('[UX-Sync] Failed to emit title update', error);
    }
  }, [onUpdateDocument, activeWorkspaceId, applyLiveTitleSync]);

  const handleCreatePage = useCallback(async (isShared: boolean, teamspaceId?: string | null, parentId?: string | null) => {
    try {
      const newDoc = await onCreateDocument(isShared, parentId ?? null, teamspaceId ?? null, { 
        title: '', // Título vazio, que será tratado como 'Untitled' no backend/frontend
        type: 'page'
      });
      
      // Expande a pasta pai automaticamente se existir
      if (parentId) {
        setExpandedFolders((prev) => {
          const next = new Set(prev);
          next.add(parentId);
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to create document', error);
      toast.error('Failed to create item');
    }
  }, [onCreateDocument]);

  const handleWorkspaceDeleted = async (deletedWorkspaceId: string) => {
    // 3. Limpeza de Cache de Documentos para evitar rastro fantasma
    globalMutate(
      (key) => typeof key === 'string' && key.startsWith('/documents'),
      undefined,
      { revalidate: false }
    );

    const remaining = workspaces.filter((workspace) => workspace.id !== deletedWorkspaceId);
    const wasActiveWorkspaceDeleted = activeWorkspaceId === deletedWorkspaceId;

    if (!wasActiveWorkspaceDeleted) {
      // Forçar revalidação do cache caso tenha sido um workspace inativo
      mutateWorkspaces();
      return;
    }

    if (remaining.length > 0) {
      handleWorkspaceSwitch(remaining[0].id);
      // Somente após o redirecionamento, forçar uma revalidação do cache de workspaces
      setTimeout(() => {
        mutateWorkspaces();
      }, 100);
      return;
    }

    setSelectedWorkspaceId(null);
    localStorage.removeItem('activeWorkspaceId');
    router.push('/setup-inicial');
  };

  const handleLogout = () => {
    clearAuthSession();
    setUser(null); // Limpa o estado global
    globalMutate(
      () => true, // Invalida TODAS as chaves do SWR
      undefined,
      { revalidate: false }
    );
    router.push('/login');
  };

  // Socket instance para PRESENCE
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const socketRef = useRef<any>(null);
  const refetchRecentDocuments = useCallback(() => {
    void globalMutate((key) => typeof key === 'string' && key.startsWith('/documents/recent'));
    if (activeWorkspaceId) {
      void globalMutate(`/documents/recent?workspace_id=${activeWorkspaceId}`);
    }
  }, [activeWorkspaceId, globalMutate]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token || !activeWorkspaceId) {
      return;
    }

    const getSocketUrl = () => {
      if (typeof window !== 'undefined') {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (!isLocalhost) {
          return 'https://apinotion.andrekehrer.com';
        }
      }
      return process.env.NEXT_PUBLIC_API_URL || 'https://apinotion.andrekehrer.com';
    };

    const socketUrl = getSocketUrl();
    const socket = io(socketUrl, { auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-workspace', activeWorkspaceId);
    });

    // Escutando eventos de título e conteúdo para atualizar a Sidebar (AAA)
    socket.on('document:update-title', (payload: { docId?: string; newTitle?: string }) => {
      if (payload?.docId && payload?.newTitle) {
        applyLiveTitleSync(payload.docId, payload.newTitle);
      }
    });

    socket.on('document_moved', () => {
      refetchRecentDocuments();
      window.dispatchEvent(new CustomEvent('mutate-documents'));
    });
    socket.on('document-updated', () => {
      refetchRecentDocuments();
      window.dispatchEvent(new CustomEvent('mutate-documents'));
    });
    socket.on('document_updated', () => {
      refetchRecentDocuments();
      window.dispatchEvent(new CustomEvent('mutate-documents'));
    });
    socket.on('document_deleted', refetchRecentDocuments);
    socket.on('document_removed', refetchRecentDocuments);
    socket.on('teamspace:update', (payload: Teamspace) => {
      if (!payload?.id) {
        return;
      }
      mutateTeamspaces((current) => {
        const list = Array.isArray(current) ? current : [];
        const exists = list.some((teamspace) => String(teamspace.id) === String(payload.id));
        if (!exists) {
          return list;
        }
        return list.map((teamspace) =>
          String(teamspace.id) === String(payload.id)
            ? { ...teamspace, ...payload }
            : teamspace
        );
      }, { revalidate: false });
    });

    window.addEventListener('recent-documents-invalidated', refetchRecentDocuments);

    return () => {
      socket.off('document:update-title');
      socket.off('document_moved');
      socket.off('document-updated');
      socket.off('document_updated');
      socket.off('document_deleted', refetchRecentDocuments);
      socket.off('document_removed', refetchRecentDocuments);
      socket.off('teamspace:update');
      window.removeEventListener('recent-documents-invalidated', refetchRecentDocuments);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeWorkspaceId, applyLiveTitleSync, mutateTeamspaces, refetchRecentDocuments]);

  // Resizing state
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Timeout para evitar setState síncrono no primeiro render
    const t = setTimeout(() => {
      setMounted(true);
      if (typeof window !== 'undefined') {
        const savedWidth = localStorage.getItem('sidebarWidth');
        if (savedWidth) {
          setSidebarWidth(Number(savedWidth));
        }
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      if (timeoutId) return; // Throttle: already waiting

      timeoutId = setTimeout(() => {
        let newWidth = e.clientX;
        if (newWidth < 200) newWidth = 200;
        if (newWidth > 450) newWidth = 450;
        
        setSidebarWidth(newWidth);
        timeoutId = null;
      }, 16); // ~60fps
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Save width to local storage when it changes
  useEffect(() => {
    if (!isResizing) {
      localStorage.setItem('sidebarWidth', sidebarWidth.toString());
    }
  }, [sidebarWidth, isResizing]);

  const isActiveDoc = useCallback((doc: Document) => doc.is_trash !== true && doc.is_trash !== 1, []);

  const visibleDocuments = useMemo(() => documents.filter((doc) => doc.is_trash !== true && doc.is_trash !== 1), [documents]);
  const privateDocs = useMemo(
    () => visibleDocuments.filter((doc) => !doc.teamspace_id && !doc.is_shared_with_me),
    [visibleDocuments]
  );
  const favoriteDocs = useMemo(
    () => visibleDocuments.filter((doc) => doc.is_favorite),
    [visibleDocuments]
  );
  const sharedWithMeDocs = useMemo(
    () => visibleDocuments.filter((doc) => doc.is_shared_with_me),
    [visibleDocuments]
  );
  const documentsByTeamspace = useMemo(() => {
    const grouped = new Map<string, Document[]>();
    visibleDocuments.forEach((doc) => {
      if (!doc.teamspace_id || doc.is_shared_with_me) {
        return;
      }
      const key = String(doc.teamspace_id);
      const existing = grouped.get(key);
      if (existing) {
        existing.push(doc);
      } else {
        grouped.set(key, [doc]);
      }
    });
    return grouped;
  }, [visibleDocuments]);
  type RecentDocument = Pick<Document, 'id' | 'title' | 'icon' | 'updated_at' | 'is_trash'>;

  const recentFallback = useMemo<RecentDocument[]>(() => {
    return [...visibleDocuments]
      .filter((doc) => isActiveDoc(doc))
      .sort((a, b) => {
        const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 5)
      .map((doc) => ({
        id: doc.id,
        title: doc.title,
        icon: doc.icon,
        updated_at: doc.updated_at,
        is_trash: doc.is_trash
      }));
  }, [visibleDocuments, isActiveDoc]);

  const recentKey = activeWorkspaceId ? `/documents/recent?workspace_id=${activeWorkspaceId}` : null;
  const recentFetcher = useCallback(async (url: string) => {
    try {
      const data = await fetcher(url);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }, []);
  const { data: recentDocsData } = useSWR<RecentDocument[]>(
    recentKey,
    recentFetcher,
    {
      fallbackData: recentFallback,
      revalidateOnFocus: true,
      revalidateIfStale: true,
      revalidateOnReconnect: true,
      refreshInterval: 15000,
      dedupingInterval: 1000
    }
  );
  const recentDocs = useMemo(() => {
    const source = recentDocsData || recentFallback;
    const activeDocumentIds = new Set(visibleDocuments.map((doc) => String(doc.id)));
    return source
      .filter((doc) => activeDocumentIds.has(String(doc.id)))
      .filter((doc) => doc.is_trash !== true && doc.is_trash !== 1)
      .slice(0, 5);
  }, [recentDocsData, recentFallback, visibleDocuments]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px of movement before dragging starts
      },
    })
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [pendingTeamspaceDropDocId, setPendingTeamspaceDropDocId] = useState<string | null>(null);
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null);
  const activeDoc = documents.find(d => d.id === activeId);
  const teamspaceIdSet = useMemo(() => new Set(teamspaces.map((teamspace) => String(teamspace.id))), [teamspaces]);
  const hasTeamspaces = teamspaces.length > 0;
  const isDraggingPrivateDoc = useMemo(() => {
    if (!activeDoc) {
      return false;
    }
    return !activeDoc.teamspace_id && !activeDoc.is_shared_with_me;
  }, [activeDoc]);
  const isHoveringTeamspaceSection = overId === 'teamspace-section-drop' || overId === 'section-teamspaces';
  const showTeamspaceSuggestionTooltip = isHoveringTeamspaceSection && isDraggingPrivateDoc && hasTeamspaces;
  const showEmptyTeamspaceDropCard = isHoveringTeamspaceSection && isDraggingPrivateDoc && !hasTeamspaces;
  const pendingTeamspaceDropDoc = documents.find((doc) => String(doc.id) === String(pendingTeamspaceDropDocId));

  useEffect(() => {
    if (!activeId) {
      setDragPointer(null);
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      setDragPointer({ x: event.clientX, y: event.clientY });
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [activeId]);

  const handleDeleteTeamspace = async (id: string) => {
    // Otimistic UI para exclusão de teamspace
    const previousTeamspaces = teamspacesData || [];
    const nextTeamspaces = previousTeamspaces.filter((ts) => String(ts.id) !== String(id));
    
    // Atualiza cache local instantaneamente
    mutateTeamspaces(nextTeamspaces, { revalidate: false });
    
    try {
      console.log('Tentando deletar Teamspace ID:', id);
      await api.delete(`/teamspaces/${id}`, { headers: getAuthHeaders() });
      mutateTeamspaces(); // Revalida no background
      // Trigger event to clear teamspace documents
      window.dispatchEvent(new CustomEvent('mutate-documents'));
    } catch (error) {
      console.error('Failed to delete teamspace', error);
      alert('Failed to delete teamspace');
      mutateTeamspaces(previousTeamspaces, { revalidate: false }); // Rollback se der erro
    }
  };

  const handleCreateTeamspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamspaceName.trim() || !activeWorkspaceId) return;

    setIsCreatingTeamspace(true);
    
    // Otimistic UI para criação de teamspace
    const tempId = `temp-${Date.now()}`;
    const newTs: Teamspace = {
      id: tempId,
      name: newTeamspaceName,
      created_by: 'me',
      invite_code: '',
      description: '',
      icon: 'Users',
      member_count: 1,
      workspace_id: activeWorkspaceId,
      is_trash: 0
    };
    
    const previousTeamspaces = teamspacesData || [];
    mutateTeamspaces([...previousTeamspaces, newTs], { revalidate: false });
    
    setIsCreateTeamspaceOpen(false);
    const nameToCreate = newTeamspaceName;
    setNewTeamspaceName('');

    try {
      const response = await api.post(
        '/teamspaces',
        { name: nameToCreate, workspace_id: activeWorkspaceId },
        { headers: getAuthHeaders() }
      );
      const createdTeamspaceId = response.data?.id ? String(response.data.id) : null;
      if (pendingTeamspaceDropDocId && createdTeamspaceId) {
        handleDocumentUpdate(pendingTeamspaceDropDocId, {
          teamspace_id: createdTeamspaceId,
          parent_id: null,
          is_private: false
        });
        setPendingTeamspaceDropDocId(null);
      }
      mutateTeamspaces(); // Revalida buscando o ID real do banco
    } catch (error) {
      console.error('Error creating teamspace:', error);
      mutateTeamspaces(previousTeamspaces, { revalidate: false }); // Rollback
    } finally {
      setIsCreatingTeamspace(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    const activatorEvent = event.activatorEvent;
    if (
      activatorEvent &&
      'clientX' in activatorEvent &&
      'clientY' in activatorEvent &&
      typeof activatorEvent.clientX === 'number' &&
      typeof activatorEvent.clientY === 'number'
    ) {
      setDragPointer({ x: activatorEvent.clientX, y: activatorEvent.clientY });
    }
    if (socketRef.current && activeWorkspaceId) {
      socketRef.current.emit('document-moving', {
        workspaceId: activeWorkspaceId,
        documentId: event.active.id
      });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string || null);
  };

  const handleToggleFavorite = async (documentId: string) => {
    await onToggleFavorite(documentId);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);
    setDragPointer(null);
    const { active, over } = event;
    if (!over) return;

    const documentId = active.id as string;
    const dropTargetId = over.id as string;

    const doc = documents.find(d => d.id === documentId);
    if (!doc) return;
    const isDraggedFromPrivate = !doc.teamspace_id && !doc.is_shared_with_me;

    if (dropTargetId === 'teamspace-section-drop' || dropTargetId === 'section-teamspaces') {
      if (isDraggedFromPrivate && teamspaces.length === 0) {
        setPendingTeamspaceDropDocId(documentId);
        setIsCreateTeamspaceOpen(true);
      }
      return;
    }

    const isTeamspaceDropTarget = over.data.current?.type === 'teamspace' || teamspaceIdSet.has(String(dropTargetId));
    
    // Dropped onto Teamspace
    if (isTeamspaceDropTarget) {
      const targetTeamspaceId = String(dropTargetId);
      if (doc.teamspace_id !== targetTeamspaceId || doc.parent_id !== null || doc.is_shared_with_me) {
        handleDocumentUpdate(documentId, { 
          teamspace_id: targetTeamspaceId, 
          parent_id: null,
          is_private: false
        });
      }
      return;
    }

    // Dropped into Private section
    if (dropTargetId === 'section-private') {
      if (doc.teamspace_id || doc.parent_id !== null) {
        handleDocumentUpdate(documentId, { 
          teamspace_id: null, 
          parent_id: null,
          is_private: true
        });
      }
      return;
    }

    // Dropped onto another document
    if (dropTargetId !== documentId) {
      const targetDoc = documents.find(d => d.id === dropTargetId);
      if (targetDoc) {
        // Only allow dropping into folders
        if (targetDoc.type === 'folder') {
          // Prevent cyclic drops (dropping a parent into its own child)
          let currentParentId = targetDoc.parent_id;
          let isCyclic = false;
          while (currentParentId) {
            if (currentParentId === documentId) {
              isCyclic = true;
              break;
            }
            const parentDoc = documents.find(d => d.id === currentParentId);
            currentParentId = parentDoc?.parent_id || null;
          }

          if (!isCyclic) {
            handleDocumentUpdate(documentId, { 
              parent_id: targetDoc.id,
              teamspace_id: targetDoc.teamspace_id,
              is_private: targetDoc.teamspace_id ? false : true
            });
            
            // Expand the target folder automatically
            setExpandedFolders(prev => {
              const next = new Set(prev);
              next.add(targetDoc.id);
              return next;
            });
          } else {
            toast.error("Cannot move a folder into its own subfolder.");
          }
        } else {
          // If dropped on a page/database, drop it alongside (same parent)
          handleDocumentUpdate(documentId, { 
            parent_id: targetDoc.parent_id,
            teamspace_id: targetDoc.teamspace_id,
            is_private: targetDoc.teamspace_id ? false : true
          });
        }
      }
    }
  };

  const renderDocs = (
    docs: Document[],
    parentId: string | null = null,
    depth = 0,
    dragMode: 'sortable' | 'draggable' = 'sortable'
  ): React.ReactNode => {
    const currentLevelDocs = documents.filter(d => (d.parent_id || null) === parentId && !d.is_trash && (parentId ? true : docs.some(doc => doc.id === d.id)));
    
    return (
      <SortableContext 
        items={currentLevelDocs.map(d => d.id)} 
        strategy={verticalListSortingStrategy}
      >
        {currentLevelDocs.map(doc => {
          if (!doc.id) {
            console.error('Documento sem id na Sidebar', doc);
            return null;
          }

          const hasChildren = documents.some((childDoc) => (
            (childDoc.parent_id || null) === doc.id && childDoc.is_trash !== true && childDoc.is_trash !== 1
          ));
          const isExpanded = expandedFolders.has(doc.id);

          return (
            <div key={doc.id}>
              <DocumentItem 
                doc={doc} 
                active={doc.id === selectedDocId} 
                isDropTarget={doc.id === overId && doc.id !== activeId}
                onClick={() => {
                  onSelectDocument(doc);
                }}
                onDelete={onDeleteDocument}
                onUpdate={handleDocumentUpdate}
                onToggleFavorite={handleToggleFavorite}
                onDuplicate={onDuplicateDocument}
                depth={depth}
                dragMode={dragMode}
                hasChildren={hasChildren}
                isExpanded={isExpanded}
                onToggleExpand={(e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFolder(doc.id);
                }}
                shouldAutoRename={autoRenameDocId === doc.id}
                onAutoRenameHandled={(handledId: string) => {
                  if (autoRenameDocId === handledId) {
                    setAutoRenameDocId(null);
                  }
                }}
              />
              {hasChildren && (
                <div className={`grid transition-all duration-200 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden">
                    {isExpanded && renderDocs(documents, doc.id, depth + 1, dragMode)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </SortableContext>
    );
  };

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCenter} 
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <aside 
        ref={sidebarRef}
        style={{ width: mounted ? `${sidebarWidth}px` : '256px' }}
        className="flex h-full flex-col bg-[#191919] text-[#a3a3a3] relative group/sidebar transition-[width] duration-0 shrink-0 border-r border-[#2c2c2c]"
      >
        {/* Resize Handle */}
        <button 
          className="absolute -right-[2px] top-0 h-full w-[4px] cursor-col-resize z-50 flex justify-center group/resizer border-none outline-none bg-transparent"
          onMouseDown={() => setIsResizing(true)}
          aria-label="Resize sidebar"
          type="button"
        >
          <div className={`h-full w-[2px] transition-colors ${isResizing ? 'bg-[#4f4f4f]' : 'bg-transparent group-hover/resizer:bg-[#4f4f4f]'}`} />
        </button>
        
        <div className="relative group/switcher m-2 pt-2 pb-5">
          <DropdownMenu.Root open={isWorkspaceMenuOpen} onOpenChange={setIsWorkspaceMenuOpen}>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="flex items-center justify-between p-2 hover:bg-[#2c2c2c] transition outline-none rounded-md cursor-pointer w-full border-none bg-transparent text-left">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-600 text-xs font-semibold shrink-0 text-white">
                    {mounted ? (user?.name ? user.name.charAt(0).toUpperCase() : 'U') : null}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    {mounted ? (
                      <span className="truncate font-semibold text-white text-[13px] leading-tight">
                        {user?.name || 'User'}
                      </span>
                    ) : (
                      <span className="h-3 w-20 rounded bg-[#2c2c2c] inline-block" />
                    )}
                    <span className="truncate text-[11px] text-[#8a8a8a] leading-tight mt-0.5">
                      {workspaceDisplayName}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover/switcher:opacity-100 transition-opacity shrink-0">
                  <div className="w-6 h-6" /> {/* Spacer for Settings button */}
                  <div className="p-1 rounded text-[#8a8a8a] transition-colors cursor-pointer">
                    <ChevronsUpDown size={14} />
                  </div>
                </div>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content 
                className="w-[300px] bg-[#252525] border border-[#191919] rounded-lg shadow-2xl p-0 text-sm text-[#d4d4d4] z-[100] font-sans overflow-hidden" 
                sideOffset={4} 
                align="start"
              >
                {/* Bloco 1: Identidade & Ação */}
                <div className="p-3 pb-2">
                  <div className="flex items-center gap-3 min-w-0 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-600 text-lg font-semibold shrink-0 text-white">
                      {workspaceInitial}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-medium text-white text-sm">
                        {workspaceDisplayName}
                      </span>
                      <span className="truncate text-xs text-[#8a8a8a]">
                        {selectedWorkspace?.plan || 'Plus Plan'} · {selectedWorkspace?.member_count || 3} members
                      </span>
                    </div>
                  </div>

                  <DropdownMenu.Item 
                    className="flex items-center gap-2 p-2 mb-2 w-full text-left rounded-md hover:bg-[#333333] transition-colors outline-none cursor-pointer text-[#d4d4d4]"
                    onClick={() => { addTab({ id: '/connections', title: 'Connections' }); router.push('/connections'); }}
                  >
                    <LucideIcons.Users size={16} className="text-[#a3a3a3]" />
                    <span>Connections</span>
                  </DropdownMenu.Item>
                  
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsWorkspaceMenuOpen(false);
                        setTimeout(() => setIsWorkspaceSettingsOpen(true), 100);
                      }}
                      className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-md bg-[#2c2c2c] hover:bg-[#333333] text-[#d4d4d4] hover:text-white text-xs font-medium transition-colors border border-[#191919]"
                    >
                      <Settings size={14} />
                      Settings
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsWorkspaceMenuOpen(false);
                        setTimeout(() => setIsWorkspaceInviteOpen(true), 100);
                      }}
                      className="relative flex items-center justify-center gap-2 py-1.5 px-3 rounded-md bg-[#2c2c2c] hover:bg-[#333333] text-[#d4d4d4] hover:text-white text-xs font-medium transition-colors border border-[#191919]"
                    >
                      <UserPlus size={14} />
                      {hasPendingInvites && (
                        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                      )}
                      Invite members
                    </button>
                  </div>
                </div>

                <Separator className="bg-[#191919]" />

                {/* Bloco 2: Lista de Workspaces */}
                <div className="p-1">
                  {workspaces.length > 0 ? workspaces.map(ws => (
                    <DropdownMenu.Item
                      key={ws.id}
                      onClick={() => handleWorkspaceSwitch(ws.id)}
                      className="flex items-center justify-between w-full px-2 py-1.5 cursor-pointer outline-none hover:bg-[#2c2c2c] rounded-md focus:bg-[#2c2c2c] group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gray-600 text-[10px] font-semibold shrink-0 text-white">
                          {ws.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-white truncate text-[13px]">{ws.name}</span>
                      </div>
                      {activeWorkspaceId === ws.id && <span className="text-white text-sm">✓</span>}
                    </DropdownMenu.Item>
                  )) : (
                    <DropdownMenu.Item
                      className="flex items-center justify-between w-full px-2 py-1.5 cursor-pointer outline-none hover:bg-[#2c2c2c] rounded-md focus:bg-[#2c2c2c] group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gray-600 text-[10px] font-semibold shrink-0 text-white">
                    {isWorkspacesLoading ? 'L' : 'W'}
                  </div>
                  <span className="font-medium text-white truncate text-[13px]">{isWorkspacesLoading ? 'Loading...' : 'Workspace'}</span>
                </div>
                {isWorkspacesLoading ? null : <span className="text-white text-sm">✓</span>}
              </DropdownMenu.Item>
            )}
                  
                  <DropdownMenu.Item 
                    onClick={() => setIsCreateWorkspaceOpen(true)}
                    className="flex items-center px-2 py-1.5 cursor-pointer outline-none hover:bg-[#2c2c2c] rounded-md focus:bg-[#2c2c2c] text-[13px] text-[#8a8a8a] hover:text-white transition-colors mt-1"
                  >
                    <Plus size={14} className="mr-2" />
                    New workspace
                  </DropdownMenu.Item>
                </div>

                <Separator className="bg-[#191919]" />

                {/* Bloco 3: Contas & Logout */}
                <div className="p-1">
                  <DropdownMenu.Item 
                    onClick={() => { addTab({ id: '/profile', title: 'Profile' }); router.push('/profile'); }}
                    className="flex items-center px-2 py-1.5 cursor-pointer outline-none hover:bg-[#2c2c2c] rounded-md focus:bg-[#2c2c2c] text-[13px] text-[#8a8a8a] hover:text-white transition-colors"
                  >
                    Profile & Password
                  </DropdownMenu.Item>
                  <DropdownMenu.Item 
                    className="flex items-center px-2 py-1.5 cursor-pointer outline-none hover:bg-[#2c2c2c] rounded-md focus:bg-[#2c2c2c] text-[13px] text-[#8a8a8a] hover:text-white transition-colors"
                  >
                    Add another account
                  </DropdownMenu.Item>
                  <DropdownMenu.Item 
                    onClick={handleLogout}
                    className="flex items-center px-2 py-1.5 cursor-pointer outline-none hover:bg-[#2c2c2c] rounded-md focus:bg-[#2c2c2c] text-[13px] text-[#8a8a8a] hover:text-white transition-colors"
                  >
                    Log out
                  </DropdownMenu.Item>
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          
          <button 
            type="button" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsWorkspaceSettingsOpen(true);
            }}
            className="absolute right-7 top-1/2 -translate-y-1/2 p-1 hover:bg-[#3f3f3f] rounded text-[#8a8a8a] hover:text-white transition-colors cursor-pointer border-none bg-transparent opacity-0 group-hover/switcher:opacity-100 z-10" 
            title="Settings"
          >
            <Settings size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 text-[14px]">
          <div className="space-y-0.5">
            <SidebarItem 
              icon={<Search size={18} className="text-[#a3a3a3]" />} 
              label="Search" 
              onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
              rightElement={<span className="text-[10px] text-[#a3a3a3] border border-[#2c2c2c] rounded px-1.5 py-0.5">⌘ K</span>}
            />
            <SidebarItem icon={<Home size={18} className="text-[#a3a3a3]" />} label="Home" onClick={() => { addTab({ id: '/', title: 'Home' }); router.push('/'); onSelectDocument(null); }} active={pathname === '/' && !selectedDocId} />
            <SidebarItem icon={<Briefcase size={18} className="text-[#a3a3a3]" />} label="Projects" onClick={() => { addTab({ id: '/projects', title: 'Projects' }); router.push('/projects'); }} active={pathname.startsWith('/projects')} />
            <SidebarItem icon={<Book size={18} className="text-[#a3a3a3]" />} label="Library" onClick={() => { addTab({ id: '/library', title: 'Library' }); router.push('/library'); }} active={pathname === '/library'} />
          </div>

          <div className="mt-4">
            <DroppableSection 
              id="section-favorites"
              title="Favorites" 
              expanded={favoritesExpanded} 
              onToggle={() => setFavoritesExpanded(!favoritesExpanded)}
            />
            <div className={`grid transition-all duration-200 ease-in-out ${favoritesExpanded ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden space-y-0.5">
                {renderDocs(favoriteDocs, null, 0)}
                {favoriteDocs.length === 0 && (
                  <div className="px-6 py-1 text-xs text-gray-500">No favorites yet</div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <DroppableSection 
              id="section-recent"
              title="Recent" 
              expanded={recentExpanded} 
              onToggle={() => setRecentExpanded(!recentExpanded)}
            />
            <div className={`grid transition-all duration-200 ease-in-out ${recentExpanded ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden space-y-0.5">
                {recentDocs.length === 0 ? (
                  <div className="px-6 py-1 text-xs text-gray-500">No recent docs</div>
                ) : (
                  recentDocs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => {
                        addTab({ id: `/documents/${doc.id}`, title: doc.title || 'Untitled', icon: doc.icon || undefined });
                        router.push(`/documents/${doc.id}`);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${String(selectedDocId) === String(doc.id) ? 'bg-[#2c2c2c] text-white' : 'hover:bg-[#2c2c2c] text-[#a3a3a3]'}`}
                    >
                      <FileText size={14} className="shrink-0 text-[#a3a3a3]" />
                      <span className={`truncate text-[13px] ${hasVisibleTitle(doc.title) ? 'text-[#d4d4d4]' : 'text-[#8a8a8a]'}`}>
                        {hasVisibleTitle(doc.title) ? doc.title : 'Untitled'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <TeamspaceSectionDropZone
              isDragSuggestionActive={isDraggingPrivateDoc}
              showEmptyDropState={showEmptyTeamspaceDropCard}
              isHoveringDropZone={isHoveringTeamspaceSection}
            >
              <DroppableSection 
                id="section-teamspaces"
                title="Teamspaces" 
                expanded={teamspacesExpanded} 
                onToggle={() => setTeamspacesExpanded(!teamspacesExpanded)}
                rightElement={
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCreateTeamspaceOpen(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 hover:bg-[#3f3f3f] rounded p-0.5 text-[#a3a3a3] hover:text-white transition-all"
                  >
                    <Plus size={16} />
                  </button>
                }
              />

              <div className={`grid transition-all duration-200 ease-in-out ${teamspacesExpanded ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden space-y-0.5">
                  {teamspaces.map(ts => {
                    const tsDocs = documentsByTeamspace.get(String(ts.id)) || [];
                    return (
                      <TeamspaceItem 
                        key={ts.id}
                        teamspace={ts}
                        docs={tsDocs}
                        isActiveDropTarget={overId === ts.id}
                        selectedDocId={selectedDocId}
                        onSelectDocument={onSelectDocument}
                        onDeleteDocument={onDeleteDocument}
                        onUpdateDocument={onUpdateDocument}
                        onDuplicateDocument={onDuplicateDocument}
                        onCreatePage={() => { void handleCreatePage(true, ts.id, null); }}
                        onDeleteTeamspace={() => handleDeleteTeamspace(ts.id)}
                        onSettings={() => setSettingsTeamspace(ts)}
                        renderDocs={renderDocs}
                      />
                    );
                  })}
                </div>
              </div>
            </TeamspaceSectionDropZone>
          </div>

          <div className="mt-4 mb-4">
            <DroppableSection 
              id="section-private"
              title="Private" 
              expanded={privateExpanded} 
              onToggle={() => setPrivateExpanded(!privateExpanded)}
              onCreatePage={() => { void handleCreatePage(false, null, null); }}
            />
            <div className={`grid transition-all duration-200 ease-in-out ${privateExpanded ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden space-y-0.5">
                {renderDocs(privateDocs, null, 0, 'draggable')}
                {privateDocs.length === 0 && (
                  <div className="px-6 py-1 text-xs text-gray-500">No private docs yet</div>
                )}
              </div>
            </div>
          </div>

          {sharedWithMeDocs.length > 0 && (
            <div className="mt-4 mb-4">
              <DroppableSection 
                id="section-shared-with-me"
                title="Shared with me" 
                expanded={sharedExpanded} 
                onToggle={() => setSharedExpanded(!sharedExpanded)}
              />
              <div className={`grid transition-all duration-200 ease-in-out ${sharedExpanded ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden space-y-0.5">
                  {renderDocs(sharedWithMeDocs, null, 0)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto border-t border-white/5 p-2 text-sm">
          <SidebarItem 
            icon={<Trash size={16} className="text-[#a3a3a3]" />} 
            label="Trash" 
            onClick={() => setIsTrashOpen(true)}
          />
          <SidebarItem icon={<Users size={16} className="text-[#a3a3a3]" />} label="Members" onClick={() => { addTab({ id: '/settings/members', title: 'Members' }); router.push('/settings/members'); }} active={pathname === '/settings/members'} />
          <SidebarItem icon={<Link size={16} className="text-[#a3a3a3]" />} label="Connections" onClick={() => { addTab({ id: '/connections', title: 'Connections' }); router.push('/connections'); }} active={pathname === '/connections'} />
        </div>
      </aside>
      
      <TrashModal isOpen={isTrashOpen} onClose={() => setIsTrashOpen(false)} />
      <TeamspaceSettingsModal 
        isOpen={!!settingsTeamspace} 
        onClose={() => setSettingsTeamspace(null)} 
        teamspace={settingsTeamspace} 
        onArchive={() => {
          if (settingsTeamspace) {
            handleDeleteTeamspace(settingsTeamspace.id);
            setSettingsTeamspace(null);
          }
        }}
      />
      
      <WorkspaceSettingsModal 
        isOpen={isWorkspaceSettingsOpen} 
        onClose={() => setIsWorkspaceSettingsOpen(false)} 
        workspace={selectedWorkspace} 
        workspaces={workspaces}
        mutateWorkspaces={mutateWorkspaces}
        onWorkspaceUpdated={() => mutateWorkspaces()}
        onWorkspaceDeleted={handleWorkspaceDeleted}
      />
      
      <WorkspaceInviteModal
        isOpen={isWorkspaceInviteOpen}
        onClose={() => setIsWorkspaceInviteOpen(false)}
        workspaceId={activeWorkspaceId || ''}
        workspaceName={workspaceDisplayName}
      />

      <WorkspaceCreateModal
        isOpen={isCreateWorkspaceOpen}
        onClose={() => setIsCreateWorkspaceOpen(false)}
        onWorkspaceCreated={(newId) => {
          mutateWorkspaces();
          handleWorkspaceSwitch(newId);
        }}
      />

      <Dialog
        open={isCreateTeamspaceOpen}
        onOpenChange={(open) => {
          setIsCreateTeamspaceOpen(open);
          if (!open && !isCreatingTeamspace) {
            setPendingTeamspaceDropDocId(null);
          }
        }}
      >
        <DialogContent className="bg-[#191919] border-white/5 text-[#d4d4d4] sm:max-w-[425px]">
          <form onSubmit={handleCreateTeamspace}>
            <DialogHeader>
              <DialogTitle className="text-white">Create Teamspace</DialogTitle>
              <DialogDescription className="text-[#9b9b9b]">
                {pendingTeamspaceDropDoc
                  ? `Create a Teamspace to share "${pendingTeamspaceDropDoc.title?.trim() || 'Untitled'}" with the team.`
                  : 'Add a new teamspace to organize your documents.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <span className="text-sm font-medium text-white">Name</span>
                <Input
                  value={newTeamspaceName}
                  onChange={(e) => setNewTeamspaceName(e.target.value)}
                  placeholder="e.g. Engineering, Marketing..."
                  className="bg-[#2c2c2c] border-white/5 text-white placeholder:text-[#9b9b9b]"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsCreateTeamspaceOpen(false);
                  setPendingTeamspaceDropDocId(null);
                }}
                className="bg-transparent border-white/5 text-white hover:bg-white/5 hover:text-white"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={!newTeamspaceName.trim() || isCreatingTeamspace}
                className="bg-[#2383e2] hover:bg-[#2383e2]/90 text-white"
              >
                {isCreatingTeamspace ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Drag Overlay para o "Fantasma" acompanhando o mouse */}
      <DragOverlay dropAnimation={{
        duration: 250,
        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
      }}>
        {activeDoc ? (
          <div className="bg-[#2c2c2c] text-[#ffffff] shadow-2xl ring-1 ring-white/10 rounded flex items-center gap-2 pl-6 pr-2 py-1.5 w-64 opacity-90 cursor-grabbing scale-105">
            {activeDoc.icon ? (
              <span className="shrink-0 mr-1 text-sm leading-none">{activeDoc.icon}</span>
            ) : (
              <FileText size={16} className="shrink-0 text-[#a3a3a3]" />
            )}
            <span className={`truncate ${hasVisibleTitle(activeDoc.title) ? '' : 'text-[#a3a3a3]'}`}>
              {hasVisibleTitle(activeDoc.title) ? activeDoc.title : 'Untitled'}
            </span>
          </div>
        ) : null}
      </DragOverlay>
      <div
        className={`pointer-events-none fixed z-[130] rounded-xl border border-[#3f3f3f] bg-[#202020] px-3 py-1.5 text-xs font-medium text-[#f0f0f0] shadow-2xl transition-opacity duration-200 ${
          showTeamspaceSuggestionTooltip ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          left: `${(dragPointer?.x || 0) + 18}px`,
          top: `${(dragPointer?.y || 0) + 18}px`
        }}
      >
        Compartilhar com a equipe?
      </div>
    </DndContext>
  );
}

function SidebarItem({ icon, label, active, onClick, rightElement }: { icon: React.ReactNode; label: React.ReactNode; active?: boolean; onClick?: () => void; rightElement?: React.ReactNode }) {
  return (
    <button 
      type="button"
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 transition text-[#a3a3a3] border-l-2 ${
        active ? 'bg-white/5 text-[#ffffff] border-[#32ff7e] shadow-[inset_2px_0_10px_rgba(50,255,126,0.1)]' : 'border-transparent hover:bg-white/5 hover:text-[#ffffff]'
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="font-medium text-[14px]">{label}</span>
      </div>
      {rightElement && <div>{rightElement}</div>}
    </button>
  );
}

function DroppableSection({ id, title, expanded, onToggle, onCreatePage, rightElement, hideChevron = false }: { id: string; title: string; expanded: boolean; onToggle: () => void; onCreatePage?: () => void; rightElement?: React.ReactNode; hideChevron?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div ref={setNodeRef} className={`group flex cursor-pointer items-center justify-between px-3 py-1 text-[12px] font-semibold transition-colors rounded ${isOver ? 'bg-[#2eaadc]/20 text-white ring-1 ring-[#2eaadc]/50' : 'hover:bg-[#2c2c2c] text-[#a3a3a3]'}`}>
      <button type="button" className="flex items-center gap-1.5 flex-1 text-left" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}>
        {!hideChevron && (
          <ChevronRight size={14} className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''} ${isOver ? 'text-white' : 'text-[#a3a3a3]'}`} />
        )}
        <span className={`font-medium text-[11px] ${isOver ? 'text-white' : 'text-[#9b9b9b]'}`}>{title}</span>
      </button>
      <div className="flex items-center gap-1">
        {rightElement}
        {onCreatePage && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCreatePage(); }}
            className="opacity-0 group-hover:opacity-100 hover:bg-[#3f3f3f] rounded p-0.5 text-[#a3a3a3] hover:text-white transition-all"
          >
            <Plus size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function TeamspaceSectionDropZone({ children, isDragSuggestionActive, showEmptyDropState, isHoveringDropZone }: { children: React.ReactNode; isDragSuggestionActive: boolean; showEmptyDropState: boolean; isHoveringDropZone: boolean }) {
  const { setNodeRef } = useDroppable({
    id: 'teamspace-section-drop'
  });
  const isHighlighted = isHoveringDropZone && isDragSuggestionActive;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl transition-all duration-200 ${isHighlighted ? 'bg-[#2eaadc]/10 ring-1 ring-[#2eaadc]/45' : ''}`}
    >
      <div
        className={`transition-opacity duration-200 ${showEmptyDropState ? 'opacity-100 mt-1' : 'opacity-0 h-0 overflow-hidden'}`}
      >
        <div className="mx-1 min-h-[76px] rounded-xl border border-dashed border-[#4f4f4f] bg-[#212121] px-4 py-4 text-center">
          <span className="text-[12px] font-medium text-[#d4d4d4]">
            Drop here to create a Teamspace for this file
          </span>
        </div>
      </div>
      <div className={`transition-opacity duration-200 ${showEmptyDropState ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
        {children}
      </div>
    </div>
  );
}

function TeamspaceItem({ 
  teamspace, 
  docs, 
  isActiveDropTarget,
  selectedDocId, 
  onSelectDocument, 
  onDeleteDocument,
  onUpdateDocument,
  onDuplicateDocument,
  onCreatePage,
  onDeleteTeamspace,
  onSettings,
  renderDocs 
}: { 
  teamspace: Teamspace; 
  docs: Document[]; 
  isActiveDropTarget: boolean;
  selectedDocId?: string; 
  onSelectDocument: (doc: Document) => void;
  onDeleteDocument: (id: string) => void;
  onUpdateDocument: (id: string, updates: Partial<Document>) => void;
  onDuplicateDocument: (id: string) => void;
  onCreatePage: () => void;
  onDeleteTeamspace: () => void;
  onSettings: () => void;
  renderDocs: (docs: Document[], parentId: string | null, depth: number, dragMode?: 'sortable' | 'draggable') => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const { setNodeRef, isOver } = useDroppable({
    id: teamspace.id,
    data: {
      type: 'teamspace',
      teamspaceId: teamspace.id
    }
  });
  const router = useRouter();

  // Renderizar o ícone de forma dinâmica (se for string válida do Lucide) ou fallback para Users
  const renderIcon = () => {
    if (teamspace.icon && typeof teamspace.icon === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const IconComponent = (LucideIcons as any)[teamspace.icon];
      if (IconComponent) {
        return <IconComponent size={14} className="text-[#a3a3a3]" />;
      }
    }
    return <Users size={14} className="text-[#a3a3a3]" />;
  };

  return (
    <div ref={setNodeRef} className="w-full">
      <TeamspaceContextMenu 
        teamspaceId={teamspace.id}
        teamspaceName={teamspace.name}
        onDelete={onDeleteTeamspace} 
        onSettings={onSettings}
        plusTrigger={
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCreatePage(); }}
            className="p-1 hover:bg-[#3f3f3f] rounded text-[#a3a3a3] hover:text-white transition-all"
          >
            <Plus size={14} />
          </button>
        }
        dropdownTrigger={
          <button 
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="p-1 hover:bg-[#3f3f3f] rounded text-[#a3a3a3] hover:text-white"
          >
            <MoreHorizontal size={14} />
          </button>
        }
      >
        <div className={`group/ts flex items-center justify-between px-3 py-1.5 transition-colors rounded text-sm cursor-pointer pr-14 ${
          isOver || isActiveDropTarget ? 'bg-[#2eaadc]/20 text-white ring-1 ring-[#2eaadc]/50' : 'text-[#a3a3a3] group-hover/ts-context-trigger:bg-[#2c2c2c]'
        }`}>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <button 
              type="button" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="p-0.5 hover:bg-[#3f3f3f] rounded transition-colors text-[#a3a3a3]"
            >
              <ChevronRight size={14} className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''} ${isOver || isActiveDropTarget ? 'text-white' : ''}`} />
            </button>
            
            <button 
              type="button"
              className="flex items-center gap-2 flex-1 min-w-0 text-left"
              onClick={() => router.push('/')}
            >
              <span className="shrink-0">{renderIcon()}</span>
              <span className="truncate font-medium">{teamspace.name}</span>
            </button>
          </div>
        </div>
      </TeamspaceContextMenu>
      
      <div className={`grid transition-all duration-200 ease-in-out ${expanded ? 'grid-rows-[1fr] opacity-100 mt-0.5' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          {docs.length > 0 ? renderDocs(docs, null, 1, 'draggable') : (
            <div className="pl-9 pr-3 py-1 text-xs text-gray-500">No pages inside</div>
          )}
        </div>
      </div>
    </div>
  );
}

import { DocumentContextMenu } from '@/components/DocumentContextMenu';

const DocumentItem = memo(({ 
  doc, 
  active, 
  isDropTarget,
  dragMode = 'sortable',
  onClick, 
  onDelete, 
  onUpdate,
  onToggleFavorite,
  onDuplicate,
  depth = 0,
  hasChildren = false,
  isExpanded = false,
  onToggleExpand,
  shouldAutoRename = false,
  onAutoRenameHandled
}: { 
  doc: Document; 
  active: boolean; 
  isDropTarget?: boolean;
  dragMode?: 'sortable' | 'draggable';
  onClick: () => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Document>) => void;
  onToggleFavorite: (id: string) => void;
  onDuplicate: (id: string) => void;
  depth?: number;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (e: React.MouseEvent) => void;
  shouldAutoRename?: boolean;
  onAutoRenameHandled?: (id: string) => void;
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [title, setTitle] = useState(doc.title || '');
  const inputRef = useRef<HTMLInputElement>(null);

  const sortable = useSortable({
    id: doc.id,
    data: doc,
    disabled: dragMode === 'draggable'
  });

  const draggable = useDraggable({
    id: doc.id,
    data: {
      type: 'document',
      documentId: doc.id
    },
    disabled: dragMode !== 'draggable'
  });

  const dragAttributes = dragMode === 'draggable' ? draggable.attributes : sortable.attributes;
  const dragListeners = dragMode === 'draggable' ? draggable.listeners : sortable.listeners;
  const dragSetNodeRef = dragMode === 'draggable' ? draggable.setNodeRef : sortable.setNodeRef;
  const dragTransform = dragMode === 'draggable' ? draggable.transform : sortable.transform;
  const dragTransition = dragMode === 'draggable' ? undefined : sortable.transition;
  const isDragging = dragMode === 'draggable' ? draggable.isDragging : sortable.isDragging;

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRenaming]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    // Optimistic update em tempo real enquanto digita
    onUpdate(doc.id, { title: newTitle });
  };

  const handleRenameSubmit = () => {
    setIsRenaming(false);
    if (title !== doc.title) {
      onUpdate(doc.id, { title });
    }
  };

  const startRenaming = () => {
    setTitle(hasVisibleTitle(doc.title) ? (doc.title || '') : '');
    setIsRenaming(true);
  };

  useEffect(() => {
    if (!shouldAutoRename) {
      return;
    }
    const timer = window.setTimeout(() => {
      setTitle(hasVisibleTitle(doc.title) ? (doc.title || '') : '');
      setIsRenaming(true);
      onAutoRenameHandled?.(doc.id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [shouldAutoRename, doc.id, doc.title, onAutoRenameHandled]);

  const style = {
    transform: CSS.Transform.toString(dragTransform),
    transition: dragTransition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={dragSetNodeRef}
      style={style}
      className="w-full"
    >
      <DocumentContextMenu 
        doc={doc}
        onUpdate={onUpdate}
        onToggleFavorite={onToggleFavorite}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onRename={startRenaming}
        deleteTrigger={
          <button 
            type="button" 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(doc.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 rounded text-red-400 hover:bg-[#3f3f3f] hover:text-red-300 transition-colors"
            aria-label="Delete document"
          >
            <Trash size={14} />
          </button>
        }
        dropdownTrigger={
          <button 
            type="button" 
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded text-[#a3a3a3] hover:bg-[#3f3f3f] hover:text-white transition-colors"
            aria-label="Document options"
          >
            <MoreHorizontal size={14} />
          </button>
        }
      >
        <button
          type="button"
          {...dragAttributes}
          {...dragListeners}
          style={{ paddingLeft: `${24 + depth * 16}px` }}
          className={`group/item flex w-full cursor-pointer items-center justify-between gap-2 rounded pr-2 py-1.5 transition-colors text-left outline-none ${
            isDropTarget 
              ? 'bg-[#2eaadc]/20 ring-1 ring-[#2eaadc]' 
              : active 
                ? 'bg-[#2c2c2c] text-[#ffffff]' 
                : 'hover:bg-[#2c2c2c] hover:text-[#ffffff]'
          }`}
          onDoubleClick={startRenaming}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick();
            } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
              e.preventDefault();
              onDuplicate(doc.id);
            } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
              e.preventDefault();
              startRenaming();
            }
          }}
        >
          <div className="flex items-center gap-2 flex-1 overflow-hidden pr-10">
            {hasChildren && (
              <button
                type="button"
                onClick={onToggleExpand}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-0.5 hover:bg-[#3f3f3f] rounded transition-colors text-[#a3a3a3] shrink-0"
              >
                <ChevronRight size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
              </button>
            )}
            {!hasChildren && <div className="w-4 shrink-0" />}
            
            {doc.icon ? (
              <span className="shrink-0 mr-1 text-sm leading-none">{doc.icon}</span>
            ) : (
              doc.type === 'database' ? <Database size={16} className="shrink-0 text-purple-400" /> :
              <FileText size={16} className="shrink-0 text-[#a3a3a3]" />
            )}
            {isRenaming ? (
              <input
                ref={inputRef}
                value={title}
                onChange={handleTitleChange}
                onBlur={handleRenameSubmit}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') {
                    const restoredTitle = hasVisibleTitle(doc.title) ? (doc.title || '') : '';
                    setTitle(restoredTitle);
                    onUpdate(doc.id, { title: restoredTitle });
                    setIsRenaming(false);
                  }
                }}
                className="flex-1 bg-[#3f3f3f] text-white outline-none px-1 rounded text-sm min-w-0"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className={`truncate ${hasVisibleTitle(doc.title) ? '' : 'text-[#a3a3a3]'}`}>
                  {hasVisibleTitle(doc.title) ? doc.title : 'Untitled'}
                </span>
              </div>
            )}
          </div>
        </button>
      </DocumentContextMenu>
    </div>
  );
});

DocumentItem.displayName = 'DocumentItem';
