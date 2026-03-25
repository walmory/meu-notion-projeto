'use client';

import { Dashboard } from '@/components/Dashboard';
import { useDocuments } from '@/hooks/useDocuments';
import { useRouter } from 'next/navigation';
import { EditorSkeleton } from '@/components/EditorSkeleton';
import { useEffect, useState } from 'react';
import { getAuthToken } from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const { documents, createDocument, updateDocument, toggleFavorite, deleteDocument, duplicateDocument, refetch, loading } = useDocuments();
  const [isAuthChecking] = useState(() => {
    const token = getAuthToken();
    return !token;
  });

  useEffect(() => {
    if (isAuthChecking) {
      router.push('/login');
    }
  }, [router, isAuthChecking]);

  if (isAuthChecking || loading) {
    return <EditorSkeleton />;
  }

  return (
    <Dashboard 
      documents={documents || []}
      onSelectDocument={(doc) => {
        router.push(`/documents/${doc.id}`);
      }}
      createDocument={createDocument}
      onUpdate={refetch}
      onUpdateDocument={updateDocument}
      onToggleFavorite={toggleFavorite}
      onDeleteDocument={deleteDocument}
      onDuplicateDocument={duplicateDocument}
    />
  );
}
