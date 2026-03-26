'use client';

import React, { useMemo } from 'react';
import { useTabs } from '@/contexts/TabContext';
import { Plus, X, Home, FileText, ChevronRight } from 'lucide-react';
import { useDocuments, Document } from '@/hooks/useDocuments';

export function TabBarHeader() {
  const { openTabs, activeTabId, setActiveTabId, removeTab, addTab } = useTabs();
  const { documents } = useDocuments();

  const handleNewTab = () => {
    // Para simplificar, abre uma nova aba "Home" que depois pode ser usada para navegar
    addTab({ id: `home-${Date.now()}`, title: 'Home', type: 'home' });
  };

  const activeDoc = useMemo(() => {
    if (activeTabId.startsWith('home')) return null;
    return documents?.find((d) => d.id === activeTabId);
  }, [activeTabId, documents]);

  // Construir breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (!activeDoc) return [{ id: 'home', title: 'Home', icon: <Home size={14} /> }];
    
    const crumbs = [];
    let current: Document | null | undefined = activeDoc;
    while (current) {
      crumbs.unshift({
        id: current.id,
        title: current.title || 'Untitled',
        icon: current.icon ? <span>{current.icon}</span> : <FileText size={14} />
      });
      if (current?.parent_id) {
        current = documents?.find((d) => d.id === current?.parent_id);
      } else {
        current = null;
      }
    }
    return crumbs;
  }, [activeDoc, documents]);

  return (
    <div className="flex flex-col w-full bg-[#191919]/80 backdrop-blur-[10px] border-b border-white/5 sticky top-0 z-40">
      {/* Linha de Abas */}
      <div className="flex items-center px-2 pt-2 gap-1 overflow-x-auto no-scrollbar">
        {openTabs.map((tab) => (
          <div
            key={tab.id}
            role="button"
            tabIndex={0}
            onClick={() => setActiveTabId(tab.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTabId(tab.id); }}
            className={`group flex items-center gap-2 px-3 py-1.5 min-w-[120px] max-w-[200px] rounded-t-lg border border-b-0 cursor-pointer transition-colors text-sm ${
              activeTabId === tab.id
                ? 'bg-[#2c2c2c] border-white/10 text-white'
                : 'bg-transparent border-transparent text-[#8a8a8a] hover:bg-[#2c2c2c]/50'
            }`}
          >
            <span className="shrink-0 flex items-center justify-center w-4 h-4">
              {tab.type === 'home' ? (
                <Home size={14} />
              ) : tab.icon ? (
                <span>{tab.icon}</span>
              ) : (
                <FileText size={14} />
              )}
            </span>
            <span className="truncate flex-1 select-none">
              {tab.title || 'Untitled'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTab(tab.id);
              }}
              className={`p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all ${
                activeTabId === tab.id ? 'opacity-100' : ''
              }`}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        
        <button
          type="button"
          onClick={handleNewTab}
          className="p-1.5 ml-1 rounded-md text-[#8a8a8a] hover:bg-[#2c2c2c] hover:text-white transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center px-4 py-2 gap-1 text-xs text-[#8a8a8a] bg-[#191919]">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.id}>
            {index > 0 && <ChevronRight size={14} className="text-[#4f4f4f] shrink-0 mx-1" />}
            <div className="flex items-center gap-1.5 hover:text-white hover:bg-[#2c2c2c] px-1.5 py-0.5 rounded cursor-pointer transition-colors max-w-[200px]">
              {crumb.icon}
              <span className="truncate">{crumb.title}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
