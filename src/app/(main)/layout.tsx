'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TabHeader } from '@/components/TabHeader';
import { useDocuments } from '@/hooks/useDocuments';
import { useParams, useRouter } from 'next/navigation';
import { SidePeekProvider } from '@/contexts/SidePeekContext';
import { TabProvider, useTabs } from '@/contexts/TabContext';
import { SidePeekDrawer } from '@/components/SidePeekDrawer';
import { GlobalWorkspaceInvites } from '@/components/GlobalWorkspaceInvites';
import { api, getAuthHeaders, getAuthToken } from '@/lib/api';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { documents, createDocument, deleteDocument, updateDocument, toggleFavorite, duplicateDocument } = useDocuments();
  const router = useRouter();
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
      <TabProvider documents={documents || []}>
        <MainLayoutShell
          documents={documents || []}
          createDocument={createDocument}
          deleteDocument={deleteDocument}
          updateDocument={updateDocument}
          toggleFavorite={toggleFavorite}
          duplicateDocument={duplicateDocument}
        >
          {children}
        </MainLayoutShell>
        <SidePeekDrawer />
        <GlobalWorkspaceInvites />
      </TabProvider>
    </SidePeekProvider>
  );
}

function MainLayoutShell({
  children,
  documents,
  createDocument,
  deleteDocument,
  updateDocument,
  toggleFavorite,
  duplicateDocument
}: {
  children: React.ReactNode;
  documents: NonNullable<ReturnType<typeof useDocuments>['documents']>;
  createDocument: ReturnType<typeof useDocuments>['createDocument'];
  deleteDocument: ReturnType<typeof useDocuments>['deleteDocument'];
  updateDocument: ReturnType<typeof useDocuments>['updateDocument'];
  toggleFavorite: ReturnType<typeof useDocuments>['toggleFavorite'];
  duplicateDocument: ReturnType<typeof useDocuments>['duplicateDocument'];
}) {
  const params = useParams();
  const router = useRouter();
  const documentId = params.documentId as string | undefined;
  const { openDocumentTab, closeTab } = useTabs();

  const handleCreateBlankPage = async () => {
    const newDoc = await createDocument({
      title: '',
      is_shared: false,
      type: 'page'
    });

    if (newDoc) {
      openDocumentTab(newDoc);
    }
  };

  return (
    <div className="flex flex-row h-screen w-full bg-[#191919] text-white">
      <Sidebar 
        documents={documents || []}
        selectedDocId={documentId}
        onSelectDocument={(doc) => {
          if (doc) {
            openDocumentTab(doc);
            return;
          }
          router.push('/');
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
            openDocumentTab(newDoc);
          }
          return newDoc;
        }}
        onDeleteDocument={async (id) => {
          closeTab(id);
          await deleteDocument(id);
        }}
        onUpdateDocument={updateDocument}
        onToggleFavorite={toggleFavorite}
        onDuplicateDocument={duplicateDocument}
      />
      <div className="flex-1 flex h-full min-h-0 flex-col overflow-hidden bg-[#191919]">
        <TabHeader documents={documents || []} onCreateBlankPage={handleCreateBlankPage} />
        <div className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
