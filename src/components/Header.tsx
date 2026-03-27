'use client';

import React from 'react';
import { useTabs } from '@/contexts/TabsContext';
import { PanelLeft, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { tabs, activeTabId, setActiveTab, closeTab, addTab } = useTabs();
  const router = useRouter();

  return (
    <div className="flex items-center h-12 w-full bg-[#191919] border-b border-[#2c2c2c] shrink-0 px-2 pt-2">
      {/* Left controls */}
      <div className="flex items-center gap-1 mr-4 text-[#8a8a8a]">
        <button 
          type="button"
          onClick={onToggleSidebar}
          className="p-1.5 hover:bg-white/5 rounded-md transition-colors"
          title="Toggle Sidebar"
        >
          <PanelLeft size={18} />
        </button>
        <div className="flex items-center gap-0.5 ml-1">
          <button 
            type="button"
            onClick={() => router.back()}
            className="p-1 hover:bg-white/5 rounded-md transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button 
            type="button"
            onClick={() => router.forward()}
            className="p-1 hover:bg-white/5 rounded-md transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-end h-full flex-1 overflow-x-auto no-scrollbar gap-1">
        {tabs.map((tab) => {
          const isActive = activeTabId === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                group flex items-center gap-2 px-3 h-8 min-w-[120px] max-w-[200px] 
                rounded-t-lg border-t border-x cursor-pointer select-none
                ${isActive 
                  ? 'bg-[#252525] border-[#2c2c2c] text-white' 
                  : 'bg-transparent border-transparent text-[#8a8a8a] hover:bg-white/5'
                }
              `}
            >
              <span className="truncate flex-1 text-[13px] font-medium text-left">
                {tab.title}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className={`
                  p-0.5 rounded-sm hover:bg-white/10 transition-colors
                  ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                `}
              >
                <X size={14} />
              </button>
            </button>
          );
        })}

        <button 
          type="button"
          onClick={() => {
            // Optional: Action for new tab button
          }}
          className="p-1.5 mb-1 ml-1 text-[#8a8a8a] hover:text-white hover:bg-white/5 rounded-md transition-colors"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}
