'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { useDocuments } from '@/hooks/useDocuments';
import { useParams, useRouter } from 'next/navigation';
import { SidePeekProvider } from '@/contexts/SidePeekContext';
import { SidePeekDrawer } from '@/components/SidePeekDrawer';
import { GlobalWorkspaceInvites } from '@/components/GlobalWorkspaceInvites';
import { api, getAuthHeaders, getAuthToken } from '@/lib/api';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { documents, createDocument, deleteDocument, updateDocument, toggleFavorite, duplicateDocument } = useDocuments();
  const params = useParams();
  const router = useRouter();
  const documentId = params.documentId as string | undefined;

  useEffect(() => {
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
  }, []);

  return (
    <SidePeekProvider>
      <div className="flex flex-row h-screen w-full bg-[#191919] text-white">
        <Sidebar 
          documents={documents || []}
          selectedDocId={documentId}
          onSelectDocument={(doc) => {
            if (doc) {
              const targetPath = `/documents/${doc.id}`;
              router.prefetch(targetPath);
              router.push(targetPath);
            }
            else router.push('/');
          }}
          onCreateDocument={async (
            isShared: boolean,
            parentId?: string | null,
            teamspaceId?: string | null,
            options?: { title?: string; is_meeting_note?: boolean; type?: 'page' | 'database'; skipNavigation?: boolean }
          ) => {
            const newDoc = await createDocument({
              title: options?.title ?? '',
              is_shared: isShared,
              parent_id: parentId,
              teamspace_id: teamspaceId,
              is_meeting_note: options?.is_meeting_note,
              type: options?.type
            });
            if (newDoc && !options?.skipNavigation) {
              const targetPath = `/documents/${newDoc.id}`;
              router.prefetch(targetPath);
              router.push(targetPath);
            }
            return newDoc;
          }}
          onDeleteDocument={async (id) => {
            deleteDocument(id);
            if (documentId === id) {
              router.push('/');
            }
          }}
          onUpdateDocument={updateDocument}
          onToggleFavorite={toggleFavorite}
          onDuplicateDocument={duplicateDocument}
        />
        <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#191919]">
          {children}
        </div>
        <SidePeekDrawer />
        <GlobalWorkspaceInvites />
      </div>
    </SidePeekProvider>
  );
}
