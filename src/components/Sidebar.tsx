'use client';

import { 
  Search, 
  Home, 
  CalendarCheck, 
  Inbox, 
  Users, 
  Plus, 
  FileText,
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
  MonitorSmartphone
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
import { api, getAuthHeaders, getUserFromToken } from '@/lib/api';
import * as LucideIcons from 'lucide-react';
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
    options?: { title?: string; is_meeting_note?: boolean }
  ) => void;
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
  const { mutate: globalMutate } = useSWRConfig();
  const [favoritesExpanded, setFavoritesExpanded] = useState(true);
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [agentsExpanded, setAgentsExpanded] = useState(true);
  const [teamspacesExpanded, setTeamspacesExpanded] = useState(true);
  const [sharedExpanded, setSharedExpanded] = useState(true);
  const [privateExpanded, setPrivateExpanded] = useState(true);
  const [meetingsExpanded, setMeetingsExpanded] = useState(true);
  
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [settingsTeamspace, setSettingsTeamspace] = useState<Teamspace | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('activeWorkspaceId');
  });
  
  // Modals state for Workspace
  const [isWorkspaceSettingsOpen, setIsWorkspaceSettingsOpen] = useState(false);
  const [isWorkspaceInviteOpen, setIsWorkspaceInviteOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [isCreateTeamspaceOpen, setIsCreateTeamspaceOpen] = useState(false);
  const [newTeamspaceName, setNewTeamspaceName] = useState('');
  const [isCreatingTeamspace, setIsCreatingTeamspace] = useState(false);
  
  const { data: workspacesData, isLoading: isWorkspacesLoading, mutate: mutateWorkspaces } = useSWR<Workspace[]>('/workspaces', fetcher);
  const workspaces = useMemo(() => workspacesData || [], [workspacesData]);
  const activeWorkspaceId = selectedWorkspaceId || (workspaces.length > 0 ? workspaces[0].id : null);
  const selectedWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
  const user = getUserFromToken();
  const rawWorkspaceName = selectedWorkspace?.name || `Workspace do ${user?.name || 'User'}`;
  const workspaceDisplayName = isWorkspacesLoading 
    ? 'Loading...' 
    : (rawWorkspaceName.includes('João Victor') ? `Workspace do ${user?.name || 'User'}` : rawWorkspaceName);
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
    router.push(`/workspace/${id}`);
  };

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
    localStorage.removeItem('notion_token');
    router.push('/login');
  };

  // Socket instance para PRESENCE
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const socketRef = useRef<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('notion_token');
    if (!token || !activeWorkspaceId) {
      return;
    }

    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'https://meu-notion-projeto.onrender.com', { auth: { token } });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-workspace', activeWorkspaceId);
    });

    socket.on('document_moved', () => {
      window.dispatchEvent(new CustomEvent('mutate-documents'));
    });
    socket.on('document-updated', () => {
      window.dispatchEvent(new CustomEvent('mutate-documents'));
    });
    socket.on('document_updated', () => {
      window.dispatchEvent(new CustomEvent('mutate-documents'));
    });

    socket.on('document-moving', (payload) => {
      // Apenas PRESENCE: log para não encher a UI, mas evita loops de re-render com socket real.
      console.log('User moving document:', payload);
    });

    return () => {
      socket.off('document_moved');
      socket.off('document-updated');
      socket.off('document_updated');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeWorkspaceId]);

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

  const isMeetingNoteDoc = useCallback((doc: Document) => doc.is_meeting_note === true || doc.is_meeting_note === 1, []);
  const isActiveDoc = useCallback((doc: Document) => doc.is_trash !== true && doc.is_trash !== 1, []);

  const visibleDocuments = useMemo(() => documents.filter((doc) => doc.is_trash !== true && doc.is_trash !== 1), [documents]);
  const privateDocs = useMemo(
    () => visibleDocuments.filter((doc) => !doc.teamspace_id && !isMeetingNoteDoc(doc) && !doc.is_shared_with_me),
    [visibleDocuments, isMeetingNoteDoc]
  );
  const favoriteDocs = useMemo(
    () => visibleDocuments.filter((doc) => doc.is_favorite),
    [visibleDocuments]
  );
  const meetingDocs = useMemo(
    () => visibleDocuments.filter((doc) => isMeetingNoteDoc(doc) && !doc.is_shared_with_me),
    [visibleDocuments, isMeetingNoteDoc]
  );
  const sharedWithMeDocs = useMemo(
    () => visibleDocuments.filter((doc) => doc.is_shared_with_me),
    [visibleDocuments]
  );
  const documentsByTeamspace = useMemo(() => {
    const grouped = new Map<string, Document[]>();
    visibleDocuments.forEach((doc) => {
      if (!doc.teamspace_id || isMeetingNoteDoc(doc) || doc.is_shared_with_me) {
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
  }, [visibleDocuments, isMeetingNoteDoc]);
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
  const { data: recentDocsData } = useSWR<RecentDocument[]>(recentKey, recentFetcher, { fallbackData: recentFallback });
  const recentDocs = recentDocsData || recentFallback;

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
    return !activeDoc.teamspace_id && !isMeetingNoteDoc(activeDoc) && !activeDoc.is_shared_with_me;
  }, [activeDoc, isMeetingNoteDoc]);
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
      // Dispara evento para limpar documentos do teamspace
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
        onUpdateDocument(pendingTeamspaceDropDocId, {
          is_meeting_note: false,
          teamspace_id: createdTeamspaceId,
          parent_id: null,
          is_private: false
        });
        setPendingTeamspaceDropDocId(null);
      }
      mutateTeamspaces(); // Revalida buscando o ID real do banco
    } catch (error) {
      console.error('Erro ao criar teamspace:', error);
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
    const isDraggedFromPrivate = !doc.teamspace_id && !isMeetingNoteDoc(doc) && !doc.is_shared_with_me;

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
        onUpdateDocument(documentId, { 
          is_meeting_note: false,
          teamspace_id: targetTeamspaceId, 
          parent_id: null,
          is_private: false
        });
      }
      return;
    }

    // Dropped into Meeting Notes section
    if (dropTargetId === 'meeting-notes-section') {
      if (!isMeetingNoteDoc(doc) || doc.teamspace_id || doc.parent_id !== null || doc.is_private) {
        onUpdateDocument(documentId, {
          is_meeting_note: true,
          teamspace_id: null,
          parent_id: null,
          is_private: false
        });
      }
      return;
    }

    // Dropped into Private section
    if (dropTargetId === 'section-private') {
      if (doc.teamspace_id || doc.parent_id !== null || isMeetingNoteDoc(doc)) {
        onUpdateDocument(documentId, { 
          is_meeting_note: false,
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
        onUpdateDocument(documentId, { 
          parent_id: targetDoc.id,
          teamspace_id: targetDoc.teamspace_id,
          is_private: targetDoc.teamspace_id ? false : true,
          is_meeting_note: isMeetingNoteDoc(targetDoc)
        });
      }
    }
  };

  const renderDocs = (
    docs: Document[],
    parentId: string | null = null,
    depth = 0,
    dragMode: 'sortable' | 'draggable' = 'sortable'
  ): React.ReactNode => {
    const currentLevelDocs = docs.filter(d => (d.parent_id || null) === parentId);
    
    return (
      <SortableContext 
        items={currentLevelDocs.map(d => d.id)} 
        strategy={verticalListSortingStrategy}
      >
        {currentLevelDocs.filter((doc) => !doc.is_trash).map(doc => {
          if (!doc.id) {
            console.error('Documento sem id na Sidebar', doc);
            return null;
          }

          return (
            <div key={doc.id}>
              <DocumentItem 
                doc={doc} 
                active={doc.id === selectedDocId} 
                isDropTarget={doc.id === overId && doc.id !== activeId}
                onClick={() => onSelectDocument(doc)}
                onDelete={onDeleteDocument}
                onUpdate={onUpdateDocument}
                onToggleFavorite={handleToggleFavorite}
                onDuplicate={onDuplicateDocument}
                depth={depth}
                dragMode={dragMode}
              />
              {renderDocs(docs, doc.id, depth + 1, dragMode)}
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
        className="flex h-screen flex-col bg-[#191919] text-[#a3a3a3] relative group/sidebar transition-[width] duration-0 shrink-0"
      >
        {/* Resize Handle */}
        <button 
          className="absolute right-0 top-0 h-full w-[10px] cursor-col-resize z-50 flex justify-center group/resizer border-none outline-none bg-transparent"
          onMouseDown={() => setIsResizing(true)}
          aria-label="Resize sidebar"
          type="button"
        >
          <div className={`h-full w-[2px] transition-colors ${isResizing ? 'bg-[#4f4f4f]' : 'group-hover/resizer:bg-[#3f3f3f]'}`} />
        </button>
        
        <div className="relative group/switcher m-2">
          <DropdownMenu.Root>
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
                  
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsWorkspaceSettingsOpen(true)}
                      className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-md bg-[#2c2c2c] hover:bg-[#333333] text-[#d4d4d4] hover:text-white text-xs font-medium transition-colors border border-[#191919]"
                    >
                      <Settings size={14} />
                      Settings
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setIsWorkspaceInviteOpen(true)}
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
            <SidebarItem icon={<Home size={18} className="text-[#a3a3a3]" />} label="Home" onClick={() => { router.push('/'); onSelectDocument(null); }} active={pathname === '/' && !selectedDocId} />
            <SidebarItem icon={<CalendarCheck size={18} className="text-[#a3a3a3]" />} label="Meetings" onClick={() => router.push('/meetings')} active={pathname === '/meetings'} />
            <SidebarItem icon={<Sparkles size={18} className="text-[#a3a3a3]" />} label={<span className="font-medium">Opta AI</span>} />
            <SidebarItem icon={<Inbox size={18} className="text-[#a3a3a3]" />} label="Inbox" />
            <SidebarItem icon={<Book size={18} className="text-[#a3a3a3]" />} label="Library" onClick={() => router.push('/library')} active={pathname === '/library'} />
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
                      onClick={() => router.push(`/documents/${doc.id}`)}
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
            <DroppableSection 
              id="section-agents"
              title="Agents" 
              expanded={agentsExpanded} 
              onToggle={() => setAgentsExpanded(!agentsExpanded)}
              rightElement={<span className="text-[9px] font-bold bg-[#3f3f3f] text-[#ffffff] px-1.5 py-0.5 rounded uppercase tracking-wider">BETA</span>}
            />
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
                onAdd={() => setIsCreateTeamspaceOpen(true)}
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
                        onCreateDocument={() => onCreateDocument(true, null, ts.id)}
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
              onAdd={() => onCreateDocument(false, null)}
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

          <div className="mt-4 mb-4">
            <DroppableSection 
              id="meeting-notes-section"
              title="Meeting Notes" 
              expanded={meetingsExpanded} 
              onToggle={() => setMeetingsExpanded(!meetingsExpanded)}
              onAdd={() => onCreateDocument(false, null, null, { title: 'Nova Reunião', is_meeting_note: true })}
            />
            <div className={`grid transition-all duration-200 ease-in-out ${meetingsExpanded ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden space-y-0.5">
                {renderDocs(meetingDocs, null, 0, 'draggable')}
                {meetingDocs.length === 0 && (
                  <div className="px-6 py-1 text-xs text-gray-500">No meeting notes yet</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto border-t border-white/5 p-2 text-sm">
          <SidebarItem 
            icon={<Trash size={16} className="text-[#a3a3a3]" />} 
            label="Trash" 
            onClick={() => setIsTrashOpen(true)}
          />
          <SidebarItem icon={<Settings size={16} className="text-[#a3a3a3]" />} label="Settings" />
          <SidebarItem icon={<Users size={16} className="text-[#a3a3a3]" />} label="Members" />
          <SidebarItem icon={<Link size={16} className="text-[#a3a3a3]" />} label="Connections" onClick={() => router.push('/connections')} active={pathname === '/connections'} />
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
                  ? `Crie um Teamspace para compartilhar "${pendingTeamspaceDropDoc.title?.trim() || 'Untitled'}" com a equipe.`
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
      className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded px-3 py-1.5 transition text-[#a3a3a3] ${
        active ? 'bg-[#2c2c2c] text-[#ffffff]' : 'hover:bg-[#2c2c2c] hover:text-[#ffffff]'
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

function DroppableSection({ id, title, expanded, onToggle, onAdd, rightElement }: { id: string; title: string; expanded: boolean; onToggle: () => void; onAdd?: () => void; rightElement?: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div ref={setNodeRef} className={`group flex cursor-pointer items-center justify-between px-3 py-1 text-[12px] font-semibold transition-colors rounded ${isOver ? 'bg-[#2eaadc]/20 text-white ring-1 ring-[#2eaadc]/50' : 'hover:bg-[#2c2c2c] text-[#a3a3a3]'}`}>
      <button type="button" className="flex items-center gap-1.5 flex-1 text-left" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}>
        <ChevronRight size={14} className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''} ${isOver ? 'text-white' : 'text-[#a3a3a3]'}`} />
        <span className={`font-medium text-[11px] ${isOver ? 'text-white' : 'text-[#9b9b9b]'}`}>{title}</span>
      </button>
      <div className="flex items-center gap-1">
        {rightElement}
        {onAdd && (
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onAdd(); }} 
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
            Solte aqui para criar um Teamspace para este arquivo
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
  onCreateDocument,
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
  onCreateDocument: () => void;
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
        onDelete={onDeleteTeamspace} 
        onSettings={onSettings}
        plusTrigger={
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCreateDocument();
            }}
            className="p-1 hover:bg-[#3f3f3f] rounded text-[#a3a3a3] hover:text-white"
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
  depth = 0
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
            {doc.icon ? (
              <span className="shrink-0 mr-1 text-sm leading-none">{doc.icon}</span>
            ) : (
              <FileText size={16} className="shrink-0" />
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
