'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export interface Tab {
  id: string; // "home" ou document.id
  title: string;
  icon?: string | null;
  type: 'home' | 'document';
}

interface TabContextType {
  openTabs: Tab[];
  activeTabId: string;
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  setActiveTabId: (id: string) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export function TabProvider({ children }: { children: ReactNode }) {
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('home');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const storedTabs = localStorage.getItem('opta_openTabs');
    const storedActiveTab = localStorage.getItem('opta_activeTabId');
    if (storedTabs) {
      try {
        const parsed = JSON.parse(storedTabs);
        if (parsed.length > 0) {
          setOpenTabs(parsed);
        } else {
          setOpenTabs([{ id: 'home', title: 'Home', type: 'home' }]);
        }
      } catch {
        setOpenTabs([{ id: 'home', title: 'Home', type: 'home' }]);
      }
    } else {
      setOpenTabs([{ id: 'home', title: 'Home', type: 'home' }]);
    }
    
    if (storedActiveTab) {
      setActiveTabId(storedActiveTab);
    } else {
      setActiveTabId('home');
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('opta_openTabs', JSON.stringify(openTabs));
      localStorage.setItem('opta_activeTabId', activeTabId);
    }
  }, [openTabs, activeTabId, isLoaded]);

  const addTab = (tab: Tab) => {
    setOpenTabs((prev) => {
      if (prev.find((t) => t.id === tab.id)) {
        return prev;
      }
      return [...prev, tab];
    });
    setActiveTabId(tab.id);
  };

  const removeTab = (id: string) => {
    setOpenTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== id);
      if (newTabs.length === 0) {
        newTabs.push({ id: 'home', title: 'Home', type: 'home' });
      }
      if (activeTabId === id) {
        // Ativar a última aba disponível
        setActiveTabId(newTabs[newTabs.length - 1].id);
      }
      return newTabs;
    });
  };

  return (
    <TabContext.Provider value={{ openTabs, activeTabId, addTab, removeTab, setActiveTabId }}>
      {children}
    </TabContext.Provider>
  );
}

export function useTabs() {
  const context = useContext(TabContext);
  if (context === undefined) {
    throw new Error('useTabs must be used within a TabProvider');
  }
  return context;
}
