'use client';

import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';
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
  updateTabTitle: (docId: string, newTitle: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export function TabsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [manualActiveTabId, setManualActiveTabId] = useState<string | null>(null);
  const activeTabId = useMemo(() => {
    if (pathname && tabs.some((tab) => tab.id === pathname)) {
      return pathname;
    }
    return manualActiveTabId;
  }, [pathname, tabs, manualActiveTabId]);

  const addTab = (tab: Tab) => {
    setTabs(prev => {
      const existingTab = prev.find(t => t.id === tab.id);
      if (!existingTab) {
        return [...prev, tab];
      }
      if (existingTab.title !== tab.title || existingTab.icon !== tab.icon) {
        return prev.map((currentTab) => currentTab.id === tab.id ? { ...currentTab, ...tab } : currentTab);
      }
      return prev;
    });
    setManualActiveTabId(tab.id);
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
          setManualActiveTabId(nextTab.id);
          router.push(nextTab.id);
        } else {
          setManualActiveTabId(null);
          router.push('/');
        }
      }
      return newTabs;
    });
  };

  const setActiveTab = (id: string) => {
    setManualActiveTabId(id);
    if (pathname !== id) {
      router.push(id);
    }
  };

  const updateTabTitle = (docId: string, newTitle: string) => {
    const targetTabId = docId.startsWith('/documents/') ? docId : `/documents/${docId}`;
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === targetTabId
          ? { ...tab, title: newTitle || 'Untitled' }
          : tab
      )
    );
  };

  return (
    <TabsContext.Provider value={{ tabs, activeTabId, addTab, closeTab, setActiveTab, updateTabTitle }}>
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
