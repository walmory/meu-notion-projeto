import { useCallback, useEffect } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useRouter } from 'next/navigation';
import { api, getAuthHeaders } from '@/lib/api';
import { toast } from 'sonner';

export interface Document {
  id: string;
  title: string;
  is_shared: boolean;
  content: string;
  cover?: string | null;
  icon?: string | null;
  parent_id?: string | null;
  is_favorite?: boolean;
  updated_at?: string;
  is_trash?: boolean | 0 | 1;
  is_shared_with_me?: boolean;
  owner?: string;
  workspace_id?: string | null;
  teamspace_id?: string | null;
  last_edited_by?: string;
  is_private?: boolean;
  is_meeting_note?: boolean | 0 | 1;
  type?: string;
}

const fetcher = async (url: string) => {
  const headers = getAuthHeaders();
  if (!headers.Authorization) {
    throw new Error('Unauthorized');
  }
  if (url.startsWith('/documents') && !url.includes('workspace_id=') && !headers['x-workspace-id']) {
    return [];
  }
  const response = await api.get(
    url,
    { headers, suppressGlobalErrorLog: true } as { headers: Record<string, string>; suppressGlobalErrorLog: boolean }
  );
  return Array.isArray(response.data) ? response.data : [];
};

export function useDocuments(workspaceId?: string) {
  const router = useRouter();
  const { mutate: mutateGlobal } = useSWRConfig();

  const getDocumentsCacheKey = useCallback(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    const activeWorkspaceId = workspaceId || localStorage.getItem('activeWorkspaceId') || 'default';
    return `documents-cache:${activeWorkspaceId}`;
  }, [workspaceId]);

  const url = workspaceId ? `/documents?workspace_id=${workspaceId}` : '/documents';

  const { data: documents, isLoading, mutate } = useSWR<Document[]>(url, fetcher, {
    fallbackData: [],
    shouldRetryOnError: false,
    revalidateOnFocus: true,
    revalidateIfStale: true,
    keepPreviousData: true,
    dedupingInterval: 2000,
    onError: (err) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (err.message === 'Unauthorized' || (err as any).response?.status === 401) {
        router.push('/login');
      }
      // Se der 403, não faz push pra login para não piscar a tela, deixa o axios interceptor resolver
    },
    onSuccess: (data) => {
      const cacheKey = getDocumentsCacheKey();
      if (!cacheKey || typeof window === 'undefined') {
        return;
      }
      try {
        localStorage.setItem(cacheKey, JSON.stringify(Array.isArray(data) ? data : []));
      } catch {
        return;
      }
    }
  });

  useEffect(() => {
    const cacheKey = getDocumentsCacheKey();
    if (!cacheKey || typeof window === 'undefined') {
      return;
    }
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        mutate(parsed as Document[], false);
      }
    } catch {
      return;
    }
  }, [getDocumentsCacheKey, mutate]);

  useEffect(() => {
    const handleMutateDocuments = () => {
      mutate();
    };

    const handleLiveTitleUpdate = (e: Event) => {
      const { docId, title } = (e as CustomEvent<{ docId: string; title: string }>).detail;
      if (!docId || typeof title !== 'string') return;
      mutate(
        (current) =>
          Array.isArray(current)
            ? current.map((d) => (String(d.id) === String(docId) ? { ...d, title } : d))
            : current,
        false
      );
    };

    window.addEventListener('mutate-documents', handleMutateDocuments);
    window.addEventListener('live-title-update', handleLiveTitleUpdate);
    return () => {
      window.removeEventListener('mutate-documents', handleMutateDocuments);
      window.removeEventListener('live-title-update', handleLiveTitleUpdate);
    };
  }, [mutate]);

  const getRecentKey = () => {
    if (typeof window === 'undefined') {
      return '/documents/recent';
    }
    const activeWorkspaceId = localStorage.getItem('activeWorkspaceId');
    return activeWorkspaceId ? `/documents/recent?workspace_id=${activeWorkspaceId}` : '/documents/recent';
  };

  type CreateDocumentInput = {
    title?: string;
    is_shared?: boolean;
    parent_id?: string | null;
    workspace_id?: string | null;
    teamspace_id?: string | null;
    is_meeting_note?: boolean;
    type?: 'page' | 'database';
  };

  const createDocument = async (
    titleOrInput: string | CreateDocumentInput,
    is_shared: boolean = false,
    parent_id?: string | null,
    workspace_id?: string | null,
    teamspace_id?: string | null
  ) => {
    try {
      const activeWorkspaceId = localStorage.getItem('activeWorkspaceId');
      const tempId = crypto.randomUUID();
      const resolvedWorkspaceId = workspace_id
        || (typeof titleOrInput === 'string' ? undefined : titleOrInput.workspace_id)
        || activeWorkspaceId;

      if (!resolvedWorkspaceId) {
        throw new Error('workspace_id ausente ao criar documento');
      }
      
      const payload = typeof titleOrInput === 'string'
        ? { id: tempId, title: titleOrInput, is_shared, content: '[]', parent_id, workspace_id: resolvedWorkspaceId, teamspace_id, content_version: 0 }
        : { id: tempId, title: titleOrInput.title ?? '', is_shared: titleOrInput.is_shared ?? false, content: '[]', parent_id: titleOrInput.parent_id, workspace_id: resolvedWorkspaceId, teamspace_id: titleOrInput.teamspace_id, is_meeting_note: titleOrInput.is_meeting_note, type: titleOrInput.type ?? 'page', content_version: 0 };

      const optimisticDoc: Document = {
        id: tempId,
        title: payload.title ?? '',
        content: payload.content || '[]',
        parent_id: payload.parent_id || null,
        workspace_id: payload.workspace_id || resolvedWorkspaceId,
        teamspace_id: payload.teamspace_id || null,
        is_private: payload.teamspace_id ? false : true,
        is_shared: payload.is_shared,
        is_meeting_note: payload.is_meeting_note ? true : false,
        is_trash: false,
        is_favorite: false,
        is_shared_with_me: false,
        icon: undefined,
        cover: undefined,
        type: (typeof titleOrInput === 'string' ? 'page' : (titleOrInput.type ?? 'page')),
        owner: 'me',
        updated_at: new Date().toISOString()
      };

      const previousDocuments = documents || [];
      const nextDocuments = [...previousDocuments, optimisticDoc];
      
      const cacheKey = getDocumentsCacheKey();
      if (cacheKey && typeof window !== 'undefined') {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(nextDocuments));
        } catch {
          // no-op
        }
      }

      const recentKey = getRecentKey();
      
      // Async call awaited using SWR's promise-based mutation
      // This tells SWR to hold off background revalidations until the promise resolves
      const createPromise = async () => {
        const response = await api.post('/documents', payload, { headers: getAuthHeaders() });
        const newDoc = response.data;
        const returnedChild = newDoc.child;
        
        const updatedDocs = nextDocuments.map(d => d.id === tempId ? newDoc : d);
        if (returnedChild) {
           updatedDocs.push(returnedChild);
        }
        
        // Return updated list
        return updatedDocs;
      };

      // Dispara a mutação assíncrona e aguarda a conclusão para garantir que o backend salvou (AAA+)
      const finalDocs = await mutate(createPromise(), {
        optimisticData: nextDocuments,
        rollbackOnError: true,
        populateCache: true,
        revalidate: false
      });
      
      // Also update global recent if needed
      void mutateGlobal(
        recentKey,
        (current: Document[] | undefined) => {
          const list = Array.isArray(current) ? current : [];
          return [optimisticDoc, ...list].slice(0, 5);
        },
        false
      );

      // Return the real document se encontrado, senão o otimista
      return finalDocs?.find(d => d.id === tempId) || optimisticDoc;
    } catch (error) {
      console.error('Error creating document sync', error);
      throw error;
    }
  };

  const duplicateDocument = async (id: string) => {
    try {
      const response = await api.post(`/documents/duplicate/${id}`, {}, { headers: getAuthHeaders() });
      const newDoc = response.data;
      const nextDocuments = [...(documents || []), newDoc];
      mutate(nextDocuments, false);
      const cacheKey = getDocumentsCacheKey();
      if (cacheKey && typeof window !== 'undefined') {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(nextDocuments));
        } catch {
          // no-op
        }
      }
      return newDoc;
    } catch (error) {
      console.error('Error duplicating document', error);
      throw error;
    }
  };

  const deleteDocument = async (id: string) => {
    if (!id || id === 'undefined') {
      console.error('Tentativa de deletar documento com ID inválido');
      return;
    }

    const previousDocuments = documents || [];
    const deletedDoc = previousDocuments.find((doc) => String(doc.id) === String(id));
    if (deletedDoc?.title === 'Rascunhos Rápidos') {
      localStorage.setItem('quick_notes_deleted', 'true');
    }

    const nextDocuments = previousDocuments.filter((doc) => String(doc.id) !== String(id));
    
    // Atualiza o cache de forma síncrona para evitar que SWR dê rollback durante a requisição
    mutate(nextDocuments, { revalidate: false });
    
    const cacheKey = getDocumentsCacheKey();
    if (cacheKey && typeof window !== 'undefined') {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(nextDocuments));
      } catch {
        // no-op
      }
    }

    const recentKey = getRecentKey();
    let previousRecent: Document[] | undefined = undefined;
    mutateGlobal(
      recentKey,
      (current: Document[] | undefined) => {
        previousRecent = current;
        const list = Array.isArray(current) ? current : [];
        return list.filter((doc) => String(doc.id) !== String(id)).slice(0, 5);
      },
      false
    );

    try {
      await api.patch(
        `/documents/${id}`,
        { is_trash: 1 },
        { headers: getAuthHeaders(), suppressGlobalErrorLog: true } as { headers: Record<string, string>; suppressGlobalErrorLog: boolean }
      );
      // Removed re-fetch to maintain optimistic state smoothly
      // await mutate();
    } catch (error) {
      console.error('Error deleting document', error);
      toast.error('Failed to delete. Please try again.');
      // Reverte em caso de falha
      mutate(previousDocuments, false);
      if (previousRecent !== undefined) {
        mutateGlobal(recentKey, previousRecent, false);
      }
      if (cacheKey && typeof window !== 'undefined') {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(previousDocuments));
        } catch {
          // no-op
        }
      }
    }
  };

  const updateDocument = async (id: string, updates: Partial<Document>) => {
    const previousDocuments = documents || [];
    const nowIso = new Date().toISOString();
    const optimisticUpdates: Partial<Document> = { ...updates, updated_at: updates.updated_at ?? nowIso };
    const optimisticDocuments = previousDocuments.map((doc) => String(doc.id) === String(id) ? { ...doc, ...optimisticUpdates } : doc);
    mutate(optimisticDocuments, false);
    const cacheKey = getDocumentsCacheKey();
    if (cacheKey && typeof window !== 'undefined') {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(optimisticDocuments));
      } catch {
        // no-op
      }
    }

    const recentKey = getRecentKey();
    let previousRecent: Document[] | undefined = undefined;
    mutateGlobal(
      recentKey,
      (current: Document[] | undefined) => {
        previousRecent = current;
        const list = Array.isArray(current) ? current : [];
        const base = previousDocuments.find((doc) => String(doc.id) === String(id));
        if (!base) {
          return list;
        }
        const updatedDoc = { ...base, ...optimisticUpdates };
        if (updatedDoc.is_trash === true || updatedDoc.is_trash === 1) {
          return list.filter((d) => String(d.id) !== String(id)).slice(0, 5);
        }
        return [updatedDoc, ...list.filter((d) => String(d.id) !== String(id))]
          .filter((d) => d.is_trash !== true && d.is_trash !== 1)
          .slice(0, 5);
      },
      false
    );
    
    try {
      await api.patch(`/documents/${id}`, updates, { headers: getAuthHeaders() });
      void mutateGlobal(recentKey);
    } catch (error) {
      console.error('Error updating document', error);
      mutate(previousDocuments, false);
      if (cacheKey && typeof window !== 'undefined') {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(previousDocuments));
        } catch {
          // no-op
        }
      }
      if (previousRecent !== undefined) {
        mutateGlobal(recentKey, previousRecent, false);
      }
    }
  };

  const updateDocumentContentVersion = (id: string, version: number) => {
    if (!documents) return;
    const nextDocuments = documents.map(doc => 
      String(doc.id) === String(id) ? { ...doc, content_version: version } : doc
    );
    mutate(nextDocuments, false);
    const cacheKey = getDocumentsCacheKey();
    if (cacheKey && typeof window !== 'undefined') {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(nextDocuments));
      } catch {
        // no-op
      }
    }
  };

  const toggleFavorite = async (id: string) => {
    const previousDocuments = documents || [];
    const targetDoc = previousDocuments.find((doc) => String(doc.id) === String(id));
    if (!targetDoc) {
      return;
    }

    const nextFavorite = !Boolean(targetDoc.is_favorite);
    mutate(
      previousDocuments.map((doc) => (
        String(doc.id) === String(id)
          ? { ...doc, is_favorite: nextFavorite }
          : doc
      )),
      false
    );

    try {
      await api.patch(`/documents/${id}/toggle-favorite`, {}, { headers: getAuthHeaders() });
    } catch (error) {
      console.error('Error toggling favorite', error);
      mutate(previousDocuments, false);
    }
  };

  return { 
    documents, 
    loading: isLoading && !documents?.length, 
    createDocument, 
    duplicateDocument, 
    deleteDocument, 
    updateDocument, 
    toggleFavorite,
    refetch: mutate,
    updateDocumentContentVersion
  };
}
