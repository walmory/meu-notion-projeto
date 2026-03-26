'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Document } from '@/hooks/useDocuments';

export interface OpenTab {
  id: string;
  title: string;
  icon?: string | null;
  path: string;
}

interface TabContextValue {
  openTabs: OpenTab[];
  activeTabId: string | null;
  openDocumentTab: (document: Pick<Document, 'id' | 'title' | 'icon'>) => void;
  focusTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
}

const TabContext = createContext<TabContextValue | null>(null);

const getDocumentTabTitle = (document?: Pick<Document, 'title'> | null) => {
  const rawTitle = document?.title?.trim();
  return rawTitle ? rawTitle : 'Untitled';
};

const createDocumentTab = (document: Pick<Document, 'id' | 'title' | 'icon'>): OpenTab => ({
  id: String(document.id),
  title: getDocumentTabTitle(document),
  icon: document.icon ?? null,
  path: `/documents/${document.id}`
});

interface TabProviderProps {
  children: ReactNode;
  documents: Document[];
}

export function TabProvider({ children, documents }: TabProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [storedTabs, setStoredTabs] = useState<OpenTab[]>([]);

  const openTabs = useMemo(() => {
    const activeDocuments = new Map(
      documents
        .filter((document) => document.is_trash !== true && document.is_trash !== 1)
        .map((document) => [String(document.id), document])
    );

    const syncedTabs = storedTabs.flatMap((tab) => {
      const matchingDocument = activeDocuments.get(tab.id);
      if (!matchingDocument) {
        return [];
      }

      return [{
        ...tab,
        title: getDocumentTabTitle(matchingDocument),
        icon: matchingDocument.icon ?? null,
        path: `/documents/${matchingDocument.id}`
      }];
    });

    if (!pathname.startsWith('/documents/')) {
      return syncedTabs;
    }

    const documentId = pathname.split('/documents/')[1]?.split('/')[0];
    if (!documentId || syncedTabs.some((tab) => tab.id === documentId)) {
      return syncedTabs;
    }

    const matchingDocument = activeDocuments.get(documentId);
    return [
      ...syncedTabs,
      createDocumentTab({
        id: documentId,
        title: matchingDocument?.title ?? '',
        icon: matchingDocument?.icon ?? null
      })
    ];
  }, [documents, pathname, storedTabs]);

  const activeTabId = useMemo(() => {
    if (!pathname.startsWith('/documents/')) {
      return null;
    }
    const documentId = pathname.split('/documents/')[1]?.split('/')[0];
    return documentId || null;
  }, [pathname]);

  const focusTab = useCallback((tabId: string) => {
    const matchingTab = openTabs.find((tab) => tab.id === tabId);
    if (!matchingTab) {
      return;
    }

    router.prefetch(matchingTab.path);
    router.push(matchingTab.path);
  }, [openTabs, router]);

  const openDocumentTab = useCallback((document: Pick<Document, 'id' | 'title' | 'icon'>) => {
    const nextTab = createDocumentTab(document);

    setStoredTabs((currentTabs) => {
      const existingIndex = currentTabs.findIndex((tab) => tab.id === nextTab.id);
      if (existingIndex === -1) {
        return [...currentTabs, nextTab];
      }

      const nextTabs = [...currentTabs];
      nextTabs[existingIndex] = { ...nextTabs[existingIndex], ...nextTab };
      return nextTabs;
    });

    router.prefetch(nextTab.path);
    router.push(nextTab.path);
  }, [router]);

  const closeTab = useCallback((tabId: string) => {
    const currentIndex = openTabs.findIndex((tab) => tab.id === tabId);
    if (currentIndex === -1) {
      if (pathname.startsWith('/documents/') && activeTabId === tabId) {
        router.push('/');
      }
      return;
    }

    const nextTabs = openTabs.filter((tab) => tab.id !== tabId);
    setStoredTabs((currentTabs) => currentTabs.filter((tab) => tab.id !== tabId));

    if (pathname.startsWith('/documents/') && activeTabId === tabId) {
      const fallbackTab = nextTabs[currentIndex] || nextTabs[currentIndex - 1] || null;
      router.push(fallbackTab?.path ?? '/');
      return;
    }
  }, [activeTabId, openTabs, pathname, router]);

  const value = useMemo<TabContextValue>(() => ({
    openTabs,
    activeTabId,
    openDocumentTab,
    focusTab,
    closeTab
  }), [activeTabId, closeTab, focusTab, openDocumentTab, openTabs]);

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

export function useTabs() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTabs must be used within TabProvider');
  }
  return context;
}
