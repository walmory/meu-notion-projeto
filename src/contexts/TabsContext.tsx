'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface Tab {
  id: string; // Usually the path, e.g. /documents/123
  title: string;
  icon?: string; // Optional icon name
}

interface TabsContextType {
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export function TabsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setIsMounted(true);
    const saved = localStorage.getItem('opta_tabs');
    if (saved) {
      try {
        const parsedTabs = JSON.parse(saved);
        if (Array.isArray(parsedTabs)) {
          // eslint-disable-next-line react-hooks/exhaustive-deps
          setTabs(parsedTabs);
        }
      } catch (e) {
        console.error('Failed to parse tabs from local storage', e);
      }
    }
  }, []);

  // Save to local storage when tabs change
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('opta_tabs', JSON.stringify(tabs));
    }
  }, [tabs, isMounted]);

  // Ensure current pathname is in tabs if it's a valid route
  useEffect(() => {
    if (!isMounted || !pathname) return;
    
    // Only auto-add specific routes
    const isDocumentRoute = pathname.startsWith('/documents/');
    const isLibraryRoute = pathname === '/library';
    const isConnectionsRoute = pathname === '/connections';
    const isSettingsRoute = pathname === '/settings';

    if (isDocumentRoute || isLibraryRoute || isConnectionsRoute || isSettingsRoute) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      setTabs(prev => {
        if (!prev.find(t => t.id === pathname)) {
          let title = 'Loading...';
          if (isLibraryRoute) title = 'Library';
          if (isConnectionsRoute) title = 'Connections';
          if (isSettingsRoute) title = 'Settings';
          
          return [...prev, { id: pathname, title }];
        }
        return prev;
      });
    }
  }, [pathname, isMounted]);

  // Derived active tab
  const activeTabId = pathname && tabs.some(tab => tab.id === pathname) ? pathname : null;

  // Listen to live title updates
  useEffect(() => {
    const handleLiveTitleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ docId: string; title: string }>;
      const { docId, title } = customEvent.detail;
      const targetPath = `/documents/${docId}`;
      setTabs(prev => 
        prev.map(tab => 
          tab.id === targetPath ? { ...tab, title: title || 'Untitled' } : tab
        )
      );
    };

    window.addEventListener('live-title-update', handleLiveTitleUpdate);
    return () => window.removeEventListener('live-title-update', handleLiveTitleUpdate);
  }, []);

  const addTab = useCallback((tab: Tab) => {
    setTabs(prev => {
      const existing = prev.find(t => t.id === tab.id);
      if (!existing) {
        return [...prev, tab];
      }
      if (existing.title !== tab.title || existing.icon !== tab.icon) {
        return prev.map(t => t.id === tab.id ? { ...t, ...tab } : t);
      }
      return prev;
    });
    if (pathname !== tab.id) {
      router.push(tab.id);
    }
  }, [pathname, router]);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== id);
      if (activeTabId === id) {
        // If closing the active tab, navigate to the next available one
        const index = prev.findIndex(t => t.id === id);
        const nextTab = newTabs[Math.max(0, index - 1)];
        if (nextTab) {
          router.push(nextTab.id);
        } else {
          router.push('/');
        }
      }
      return newTabs;
    });
  }, [activeTabId, router]);

  const setActiveTab = useCallback((id: string) => {
    if (pathname !== id) {
      router.push(id);
    }
  }, [pathname, router]);

  return (
    <TabsContext.Provider value={{ tabs, activeTabId, addTab, closeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  );
}

export function useTabs() {
  const context = useContext(TabsContext);
  if (context === undefined) {
    throw new Error('useTabs must be used within a TabsProvider');
  }
  return context;
}
