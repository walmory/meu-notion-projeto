'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { useDocuments } from '@/hooks/useDocuments';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { SidePeekProvider } from '@/contexts/SidePeekContext';
import { SidePeekDrawer } from '@/components/SidePeekDrawer';
import { GlobalWorkspaceInvites } from '@/components/GlobalWorkspaceInvites';
import { api, getAuthHeaders, getAuthToken } from '@/lib/api';
import { TabsProvider, useTabs } from '@/contexts/TabsContext';
import { NativeTitleBar } from '@/components/NativeTitleBar';

function MainLayoutInner({ children }: { children: React.ReactNode }) {
  const { documents, createDocument, deleteDocument, updateDocument, toggleFavorite, duplicateDocument } = useDocuments();
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const documentId = params.documentId as string | undefined;
  const { addTab, closeTab } = useTabs();
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
      <div className="flex flex-col h-screen w-full bg-[#191919] text-white">
        <NativeTitleBar onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
        <div className="flex flex-row flex-1 overflow-hidden">
          {!isSidebarCollapsed && (
            <Sidebar 
              documents={documents || []}
              selectedDocId={documentId}
              onSelectDocument={(doc) => {
                if (doc) {
                  const targetPath = `/documents/${doc.id}`;
                  addTab({ id: targetPath, title: doc.title || 'Untitled', icon: doc.icon || undefined });
                  router.prefetch(targetPath);
                  router.push(targetPath);
                }
                else router.push('/');
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
                  const targetPath = `/documents/${newDoc.id}`;
                  addTab({ id: targetPath, title: newDoc.title || 'Untitled', icon: newDoc.icon || undefined });
                  router.prefetch(targetPath);
                  router.push(targetPath);
                }
                return newDoc;
              }}
              onDeleteDocument={async (id) => {
                await deleteDocument(id);
                closeTab(`/documents/${id}`);
                if (documentId === id) {
                  router.push('/');
                }
              }}
              onUpdateDocument={updateDocument}
              onToggleFavorite={toggleFavorite}
              onDuplicateDocument={duplicateDocument}
            />
          )}
          <div className="flex-1 flex flex-col h-full bg-[#191919]">
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          </div>
        </div>
        <SidePeekDrawer />
        <GlobalWorkspaceInvites />
      </div>
    </SidePeekProvider>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <TabsProvider>
      <MainLayoutInner>{children}</MainLayoutInner>
    </TabsProvider>
  );
}
