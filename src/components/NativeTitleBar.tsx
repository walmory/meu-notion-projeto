'use client';

import React from 'react';
import { useTabs } from '@/contexts/TabsContext';
import { PanelLeft, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface NativeTitleBarProps {
  onToggleSidebar?: () => void;
}

export function NativeTitleBar({ onToggleSidebar }: NativeTitleBarProps) {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabs();
  const router = useRouter();

  return (
    <div 
      className="flex items-center h-[34px] w-full bg-[#191919] border-b border-[#2c2c2c] shrink-0 pl-[80px] pr-2 [-webkit-app-region:drag]"
    >
      {/* Left controls */}
      <div className="flex items-center gap-1 mr-4 text-[#8a8a8a] h-full pt-1">
        <button 
          type="button"
          onClick={onToggleSidebar}
          className="p-1 hover:bg-white/5 rounded-md transition-colors [-webkit-app-region:no-drag]"
          title="Toggle Sidebar"
        >
          <PanelLeft size={16} />
        </button>
        <div className="flex items-center gap-0.5 ml-1">
          <button 
            type="button"
            onClick={() => router.back()}
            className="p-1 hover:bg-white/5 rounded-md transition-colors [-webkit-app-region:no-drag]"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            type="button"
            onClick={() => router.forward()}
            className="p-1 hover:bg-white/5 rounded-md transition-colors [-webkit-app-region:no-drag]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-end h-full flex-1 overflow-x-auto no-scrollbar gap-1 pt-1">
        {tabs.map((tab) => {
          const isActive = activeTabId === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                group flex items-center gap-2 px-3 h-full min-w-[120px] max-w-[200px] 
                rounded-t-lg border-t border-x cursor-pointer select-none [-webkit-app-region:no-drag]
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
                  p-0.5 rounded-sm hover:bg-white/10 transition-colors [-webkit-app-region:no-drag]
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
          className="p-1 mb-1 ml-1 text-[#8a8a8a] hover:text-white hover:bg-white/5 rounded-md transition-colors [-webkit-app-region:no-drag]"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
