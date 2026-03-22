'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SidePeekContextType {
  sidePeekDocId: string | null;
  openSidePeek: (docId: string) => void;
  closeSidePeek: () => void;
}

const SidePeekContext = createContext<SidePeekContextType | undefined>(undefined);

export function SidePeekProvider({ children }: { children: ReactNode }) {
  const [sidePeekDocId, setSidePeekDocId] = useState<string | null>(null);

  const openSidePeek = (docId: string) => {
    setSidePeekDocId(docId);
  };

  const closeSidePeek = () => {
    setSidePeekDocId(null);
  };

  return (
    <SidePeekContext.Provider value={{ sidePeekDocId, openSidePeek, closeSidePeek }}>
      {children}
    </SidePeekContext.Provider>
  );
}

export function useSidePeek() {
  const context = useContext(SidePeekContext);
  if (context === undefined) {
    throw new Error('useSidePeek must be used within a SidePeekProvider');
  }
  return context;
}
