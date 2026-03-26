'use client';

import { Dashboard } from '@/components/Dashboard';
import { useDocuments } from '@/hooks/useDocuments';
import { useRouter } from 'next/navigation';
import { EditorSkeleton } from '@/components/EditorSkeleton';
import { useEffect, useState } from 'react';
import { getAuthToken } from '@/lib/api';
import { useTabs } from '@/contexts/TabContext';
import { Editor } from '@/components/Editor';

export default function Home() {
  const router = useRouter();
  const { documents, createDocument, updateDocument, toggleFavorite, deleteDocument, duplicateDocument, refetch, loading } = useDocuments();
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const { activeTabId, addTab } = useTabs();

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

  if (activeTabId && !activeTabId.startsWith('home')) {
    const activeDoc = documents?.find(d => d.id === activeTabId) || null;
    if (activeDoc) {
      return (
        <Editor
          document={activeDoc}
          onUpdate={refetch}
          onUpdateDocument={updateDocument}
        />
      );
    }
  }

  return (
    <Dashboard 
      documents={documents || []}
      onSelectDocument={(doc) => {
        if (doc) {
          addTab({ id: doc.id, title: doc.title || 'Untitled', icon: doc.icon, type: 'document' });
        }
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
