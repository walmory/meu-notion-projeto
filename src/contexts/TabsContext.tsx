'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

  const addTab = (tab: Tab) => {
    setTabs(prev => {
      if (!prev.find(t => t.id === tab.id)) {
        return [...prev, tab];
      }
      return prev;
    });
    if (pathname !== tab.id) {
      router.push(tab.id);
    }
  };

  const closeTab = (id: string) => {
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
  };

  const setActiveTab = (id: string) => {
    if (pathname !== id) {
      router.push(id);
    }
  };

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
