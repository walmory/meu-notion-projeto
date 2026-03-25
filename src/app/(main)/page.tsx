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

  // Se estiver checando auth, não renderiza nada para evitar o flash/flicker da home antes do login
  if (isAuthChecking) {
    return null;
  }

  if (loading) {
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
