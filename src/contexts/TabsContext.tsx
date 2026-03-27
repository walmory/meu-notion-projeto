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
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Sync active tab with pathname
  useEffect(() => {
    if (pathname && tabs.some(tab => tab.id === pathname)) {
      setActiveTabId(pathname);
    }
  }, [pathname, tabs]);

  const addTab = (tab: Tab) => {
    setTabs(prev => {
      if (!prev.find(t => t.id === tab.id)) {
        return [...prev, tab];
      }
      return prev;
    });
    setActiveTabId(tab.id);
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
          setActiveTabId(nextTab.id);
          router.push(nextTab.id);
        } else {
          setActiveTabId(null);
          router.push('/');
        }
      }
      return newTabs;
    });
  };

  const setActiveTab = (id: string) => {
    setActiveTabId(id);
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
