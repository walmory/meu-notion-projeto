'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Editor } from '@/components/Editor';
import { useDocuments, Document } from '@/hooks/useDocuments';
import { EditorSkeleton } from '@/components/EditorSkeleton';
import { api, getAuthHeaders } from '@/lib/api';
import useSWR from 'swr';

export default function DocumentPage() {
  const router = useRouter();
  const params = useParams<{ documentId: string }>();
  const documentId = params.documentId;
  
  const { documents, loading, refetch, updateDocument, deleteDocument, toggleFavorite, duplicateDocument } = useDocuments();
  const [isAuthChecking] = useState(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('notion_token') : null;
    return !token;
  });
  const fetchDocumentById = async (url: string) => {
    const response = await api.get(url, {
      headers: getAuthHeaders(),
      suppressGlobalErrorLog: true
    } as { headers: Record<string, string>; suppressGlobalErrorLog: boolean });
    return response.data;
  };
  const { data, isLoading: isDocumentLoading, mutate: mutateDocument } = useSWR(
    !isAuthChecking && documentId ? `/documents/${documentId}` : null,
    fetchDocumentById,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  useEffect(() => {
    if (isAuthChecking) {
      router.push('/login');
    }
  }, [router, isAuthChecking]);

  const selectedDocument = useMemo(
    () => (documents || []).find((doc) => String(doc.id) === String(documentId)) || null,
    [documents, documentId]
  );
  const editorDocument = useMemo(() => {
    if (!data) {
      return null;
    }
    const normalizedContent = typeof data.content === 'string'
      ? data.content
      : JSON.stringify(data.content ?? []);
    return { ...data, content: normalizedContent };
  }, [data]);

  const handleUpdateDocument = useCallback((id: string, updates: Partial<Document>) => {
    if (String(id) === String(documentId)) {
      void mutateDocument((current: Document | null | undefined) => current ? { ...current, ...updates } : current, false);
    }
    void updateDocument(id, updates);
  }, [documentId, mutateDocument, updateDocument]);

  useEffect(() => {
    if (!loading && !isDocumentLoading && !data && !selectedDocument && !isAuthChecking) {
      router.push('/');
    }
  }, [loading, isDocumentLoading, data, selectedDocument, isAuthChecking, router]);

  if (isAuthChecking || isDocumentLoading || !data || (loading && !selectedDocument)) {
    return <EditorSkeleton />;
  }

  if (!loading && !selectedDocument && !editorDocument) {
    return <EditorSkeleton />;
  }

  return (
    <div className="flex h-screen w-full bg-[#191919] text-white overflow-hidden">
      <Editor 
        document={editorDocument} 
        onUpdate={() => {
          void mutateDocument();
          void refetch();
        }} 
        onUpdateDocument={handleUpdateDocument}
      />
    </div>
  );
}
