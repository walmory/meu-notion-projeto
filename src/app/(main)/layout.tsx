'use client';

import { Sidebar } from '@/components/Sidebar';
import { useDocuments } from '@/hooks/useDocuments';
import { useParams, useRouter } from 'next/navigation';
import { SidePeekProvider } from '@/contexts/SidePeekContext';
import { SidePeekDrawer } from '@/components/SidePeekDrawer';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { documents, createDocument, deleteDocument, updateDocument, toggleFavorite, duplicateDocument } = useDocuments();
  const params = useParams();
  const router = useRouter();
  const documentId = params.documentId as string | undefined;

  return (
    <SidePeekProvider>
      <div className="flex flex-row h-screen w-full bg-background text-white overflow-hidden">
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
            options?: { title?: string; is_meeting_note?: boolean }
          ) => {
            const newDoc = await createDocument({
              title: options?.title ?? '',
              is_shared: isShared,
              parent_id: parentId,
              workspace_id: null,
              teamspace_id: teamspaceId,
              is_meeting_note: options?.is_meeting_note
            });
            if (newDoc) {
              const targetPath = `/documents/${newDoc.id}`;
              router.prefetch(targetPath);
              router.push(targetPath);
            }
          }}
          onDeleteDocument={async (id) => {
            await deleteDocument(id);
            if (documentId === id) router.push('/');
          }}
          onUpdateDocument={updateDocument}
          onToggleFavorite={toggleFavorite}
          onDuplicateDocument={duplicateDocument}
        />
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          {children}
        </div>
        <SidePeekDrawer />
      </div>
    </SidePeekProvider>
  );
}
