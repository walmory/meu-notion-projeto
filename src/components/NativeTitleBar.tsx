'use client';

import React from 'react';
import { useTabs } from '@/contexts/TabsContext';
import { PanelLeft, ChevronLeft, ChevronRight, Plus, X, ChevronDown, Circle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';

interface NativeTitleBarProps {
  onToggleSidebar?: () => void;
}

export function NativeTitleBar({ onToggleSidebar }: NativeTitleBarProps) {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabs();
  const router = useRouter();
  const { user } = useUser();
  const displayName = user?.name || 'User';
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const currentTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0] || null;
  const activeTabTitle = currentTab?.title || 'tela do chat';

  return (
    <div className="flex items-center h-[34px] w-full bg-[#191919] border-b border-[#2c2c2c] shrink-0 text-[#8a8a8a] [-webkit-app-region:drag]">
      <div className="w-[80px] shrink-0" />
      <div className="h-5 w-px bg-white/10 shrink-0" />
      <button
        type="button"
        className="h-full px-3 flex items-center gap-2 text-left [-webkit-app-region:no-drag] hover:bg-white/[0.03] transition-colors"
      >
        <div className="h-[18px] w-[18px] rounded-full bg-[#4b5563] flex items-center justify-center text-[10px] font-semibold text-white">
          {avatarInitial}
        </div>
        <span className="text-[13px] text-white leading-none">{displayName}</span>
        <ChevronDown size={12} className="text-[#8a8a8a]" />
      </button>
      <div className="h-5 w-px bg-white/10 shrink-0" />
      <div className="flex items-center gap-0.5 px-2 shrink-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-1 rounded text-[#8a8a8a] hover:text-white hover:bg-white/5 transition-colors [-webkit-app-region:no-drag]"
        >
          <PanelLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="p-1 rounded text-[#8a8a8a] hover:text-white hover:bg-white/5 transition-colors [-webkit-app-region:no-drag]"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => router.forward()}
          className="p-1 rounded text-[#8a8a8a] hover:text-white hover:bg-white/5 transition-colors [-webkit-app-region:no-drag]"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="h-5 w-px bg-white/10 shrink-0" />
      <div className="flex items-center h-full shrink-0">
        <div className="h-[26px] px-2 mx-1 bg-[#2c2c2c] border border-white/10 rounded-[4px] flex items-center gap-2 min-w-[168px] max-w-[220px] text-[13px] text-white [-webkit-app-region:no-drag]">
          <button
            type="button"
            onClick={() => currentTab?.id && setActiveTab(currentTab.id)}
            className="truncate flex-1 text-left"
          >
            {activeTabTitle}
          </button>
          <button
            type="button"
            onClick={() => {
              if (currentTab?.id) {
                closeTab(currentTab.id);
              }
            }}
            className="p-0.5 rounded hover:bg-white/10 transition-colors text-[#a3a3a3] hover:text-white"
          >
            <X size={12} />
          </button>
        </div>
        <div className="h-5 w-px bg-white/10 shrink-0" />
        <button
          type="button"
          className="h-[26px] px-3 mx-1 rounded-[4px] flex items-center gap-2 min-w-[128px] max-w-[180px] text-[13px] text-[#b4b4b4] hover:bg-white/[0.03] transition-colors [-webkit-app-region:no-drag]"
        >
          <Circle size={12} className="text-white fill-white" />
          <span className="truncate">Notion AI</span>
        </button>
        <button
          type="button"
          className="p-1 ml-1 rounded text-[#8a8a8a] hover:text-white hover:bg-white/5 transition-colors [-webkit-app-region:no-drag]"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 h-full" />
    </div>
  );
}
