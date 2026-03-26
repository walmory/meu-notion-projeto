'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { useDocuments } from '@/hooks/useDocuments';
import { useParams, useRouter } from 'next/navigation';
import { SidePeekProvider } from '@/contexts/SidePeekContext';
import { SidePeekDrawer } from '@/components/SidePeekDrawer';
import { GlobalWorkspaceInvites } from '@/components/GlobalWorkspaceInvites';
import { api, getAuthHeaders, getAuthToken } from '@/lib/api';
import { useTabs } from '@/contexts/TabContext';
import { TabBarHeader } from '@/components/TabBarHeader';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { documents, createDocument, deleteDocument, updateDocument, toggleFavorite, duplicateDocument } = useDocuments();
  const { activeTabId, addTab, removeTab, setActiveTabId } = useTabs();
  const params = useParams();
  const router = useRouter();
  const documentId = params.documentId as string | undefined;
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      const token = getAuthToken();
      if (!token) {
        router.replace('/login');
      } else if (isMounted) {
        setIsAuthChecking(false);
      }
    };
    checkAuth();
    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (isAuthChecking) return;
    
    let cancelled = false;

    const ensureWorkspaceForLoggedUser = async () => {
      const token = getAuthToken();
      if (!token) {
        return;
      }

      try {
        const headers = getAuthHeaders();
        const response = await api.get('/workspaces', {
          headers,
          suppressGlobalErrorLog: true
        } as { headers: Record<string, string>; suppressGlobalErrorLog: boolean });
        const workspaces = Array.isArray(response.data) ? response.data : [];
        const activeWorkspaceId = localStorage.getItem('activeWorkspaceId');
        const activeWorkspaceIsValid = Boolean(
          activeWorkspaceId && workspaces.some((workspace: { id?: string }) => String(workspace.id) === String(activeWorkspaceId))
        );

        if (workspaces.length > 0 && !activeWorkspaceIsValid) {
          const fallbackWorkspaceId = workspaces[0]?.id ? String(workspaces[0].id) : null;
          if (fallbackWorkspaceId && !cancelled) {
            localStorage.setItem('activeWorkspaceId', fallbackWorkspaceId);
            window.dispatchEvent(new Event('workspace-changed'));
          }
        }
      } catch (error) {
        console.error('Failed to ensure active workspace for logged user', error);
      }
    };

    void ensureWorkspaceForLoggedUser();

    return () => {
      cancelled = true;
    };
  }, [isAuthChecking]);

  if (isAuthChecking) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#191919] min-h-screen">
      </div>
    );
  }

  return (
    <SidePeekProvider>
      <div className="flex flex-row h-screen w-full bg-[#191919] text-white">
          <Sidebar 
            documents={documents || []}
            selectedDocId={activeTabId.startsWith('home') ? undefined : activeTabId}
            onSelectDocument={(doc) => {
              if (doc) {
                addTab({ id: doc.id, title: doc.title || 'Untitled', icon: doc.icon, type: 'document' });
                router.push('/');
              }
              else {
                addTab({ id: 'home', title: 'Home', type: 'home' });
                router.push('/');
              }
            }}
            onCreateDocument={async (
              isShared: boolean,
              parentId?: string | null,
              teamspaceId?: string | null,
              options?: { title?: string; type?: 'page' | 'database'; skipNavigation?: boolean }
            ) => {
              const newDoc = await createDocument({
                title: options?.title ?? '',
                is_shared: isShared,
                parent_id: parentId,
                teamspace_id: teamspaceId,
                type: options?.type
              });
              if (newDoc && !options?.skipNavigation) {
                addTab({ id: newDoc.id, title: newDoc.title || 'Untitled', icon: newDoc.icon, type: 'document' });
                router.push('/');
              }
              return newDoc;
            }}
          onDeleteDocument={async (id) => {
              deleteDocument(id);
              removeTab(id);
              router.push('/');
            }}
          onUpdateDocument={updateDocument}
          onToggleFavorite={toggleFavorite}
          onDuplicateDocument={duplicateDocument}
        />
        <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#191919]">
          <TabBarHeader />
          {children}
        </div>
        <SidePeekDrawer />
        <GlobalWorkspaceInvites />
      </div>
    </SidePeekProvider>
  );
}
