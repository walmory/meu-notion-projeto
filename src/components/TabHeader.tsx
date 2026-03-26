'use client';

import { ChevronRight, FileText, Home, Library, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Document } from '@/hooks/useDocuments';
import { useTabs } from '@/contexts/TabContext';

interface TabHeaderProps {
  documents: Document[];
  onCreateBlankPage: () => Promise<void>;
}

const getVisibleTitle = (title?: string | null) => {
  const normalized = title?.trim();
  return normalized ? normalized : 'Untitled';
};

export function TabHeader({ documents, onCreateBlankPage }: TabHeaderProps) {
  const pathname = usePathname();
  const { openTabs, activeTabId, focusTab, closeTab } = useTabs();
  const [isCreating, setIsCreating] = useState(false);

  const breadcrumbItems = useMemo(() => {
    if (pathname === '/') {
      return ['Home'];
    }

    if (pathname === '/library') {
      return ['Library'];
    }

    if (pathname === '/connections') {
      return ['Connections'];
    }

    if (pathname === '/profile') {
      return ['Profile'];
    }

    if (!pathname.startsWith('/documents/') || !activeTabId) {
      const segments = pathname.split('/').filter(Boolean);
      return segments.length > 0
        ? segments.map((segment) => segment.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()))
        : ['Home'];
    }

    const documentsById = new Map(documents.map((document) => [String(document.id), document]));
    const chain: string[] = [];
    const visited = new Set<string>();
    let currentDocument = documentsById.get(activeTabId);

    while (currentDocument && !visited.has(String(currentDocument.id))) {
      visited.add(String(currentDocument.id));
      chain.unshift(getVisibleTitle(currentDocument.title));
      currentDocument = currentDocument.parent_id
        ? documentsById.get(String(currentDocument.parent_id))
        : undefined;
    }

    return chain.length > 0 ? chain : ['Untitled'];
  }, [activeTabId, documents, pathname]);

  const handleCreateBlankPage = async () => {
    if (isCreating) {
      return;
    }

    try {
      setIsCreating(true);
      await onCreateBlankPage();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="border-b border-white/10 bg-[#191919]/95 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3 pt-3">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-2">
          {openTabs.map((tab) => {
            const isActive = tab.id === activeTabId;

            return (
              <div
                key={tab.id}
                className={`group flex h-10 shrink-0 items-center gap-2 rounded-t-lg border border-b-0 px-3 text-sm transition-colors ${
                  isActive
                    ? 'border-white/10 bg-[#202020] text-white'
                    : 'border-transparent bg-[#141414] text-[#a3a3a3] hover:bg-[#1b1b1b] hover:text-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => focusTab(tab.id)}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <span className="flex h-5 w-5 items-center justify-center text-xs">
                    {tab.icon ? tab.icon : <FileText size={14} />}
                  </span>
                  <span className="max-w-40 truncate">{getVisibleTitle(tab.title)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => closeTab(tab.id)}
                  className="flex h-5 w-5 items-center justify-center rounded text-[#8a8a8a] transition hover:bg-white/10 hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            void handleCreateBlankPage();
          }}
          disabled={isCreating}
          className="mb-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-[#141414] text-[#a3a3a3] transition hover:bg-[#1b1b1b] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 border-t border-white/5 px-4 py-2 text-xs text-[#8a8a8a]">
        <Home size={13} className={pathname === '/' ? 'text-white' : ''} />
        {breadcrumbItems.map((item, index) => {
          const breadcrumbKey = breadcrumbItems.slice(0, index + 1).join('/');
          return (
          <div key={breadcrumbKey} className="flex items-center gap-2">
            <ChevronRight size={12} className="text-[#5a5a5a]" />
            <span className={item === breadcrumbItems[breadcrumbItems.length - 1] ? 'text-[#d4d4d4]' : ''}>
              {item}
            </span>
          </div>
          );
        })}
        {pathname === '/library' && <Library size={13} className="ml-1 text-[#d4d4d4]" />}
      </div>
    </div>
  );
}
