'use client';

import React, { ReactNode } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Star, Copy, Link as LinkIcon, Edit2, Trash2, PanelRightOpen, FileText, CornerUpRight } from 'lucide-react';
import { Document } from '@/hooks/useDocuments';
import { useSidePeek } from '@/contexts/SidePeekContext';
import { getUserFromToken } from '@/lib/api';

// Helper to format relative time natively
const getRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  return date.toLocaleDateString();
};

interface DocumentContextMenuProps {
  children: ReactNode;
  doc: Document;
  onUpdate: (id: string, updates: Partial<Document>) => void;
  onToggleFavorite?: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: () => void;
  dropdownTrigger?: ReactNode; // If provided, renders a DropdownMenu trigger inside the ContextMenu
  deleteTrigger?: ReactNode; // Optional delete button next to dropdown
}

export function DocumentContextMenu({
  children,
  doc,
  onUpdate,
  onToggleFavorite,
  onDelete,
  onDuplicate,
  onRename,
  dropdownTrigger,
  deleteTrigger,
}: DocumentContextMenuProps) {
  const { openSidePeek } = useSidePeek();

  const handleCopyLink = () => {
    const url = `${window.location.origin}/documents/${doc.id}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const renderMenuItems = (isDropdown = false) => {
    const Item = isDropdown ? DropdownMenuItem : ContextMenuItem;
    const Separator = isDropdown ? DropdownMenuSeparator : ContextMenuSeparator;
    const Shortcut = isDropdown ? DropdownMenuShortcut : ContextMenuShortcut;

    return (
      <>
        <Item
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onDelete(doc.id);
          }}
          className="cursor-pointer text-[#eb5757] hover:bg-[#2c2c2c] focus:bg-[#2c2c2c] focus:text-[#eb5757]"
        >
          <Trash2 size={16} className="mr-2" />
          Delete
          <Shortcut>⌘⌫</Shortcut>
        </Item>

        <Item
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onDuplicate(doc.id);
          }}
          className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c] text-[#d4d4d4] focus:text-white"
        >
          <Copy size={16} className="mr-2" />
          Duplicate
          <Shortcut>⌘D</Shortcut>
        </Item>

        <Item
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onRename();
          }}
          className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c] text-[#d4d4d4] focus:text-white"
        >
          <Edit2 size={16} className="mr-2" />
          Rename
          <Shortcut>⌘⇧R</Shortcut>
        </Item>

        <Separator className="bg-white/5" />

        <Item
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            openSidePeek(doc.id);
          }}
          className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c] text-[#d4d4d4] focus:text-white"
        >
          <PanelRightOpen size={16} className="mr-2" />
          Open in side peek
          <Shortcut>⌘⇧↩</Shortcut>
        </Item>

        <Separator className="bg-white/5" />

        <Item
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
          }}
          className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c] text-[#d4d4d4] focus:text-white"
        >
          <FileText size={16} className="mr-2" />
          Turn into
        </Item>

        <Item
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
          }}
          className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c] text-[#d4d4d4] focus:text-white"
        >
          <CornerUpRight size={16} className="mr-2" />
          Move to...
          <Shortcut>⌘⇧M</Shortcut>
        </Item>

        <Item
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            handleCopyLink();
          }}
          className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c] text-[#d4d4d4] focus:text-white"
        >
          <LinkIcon size={16} className="mr-2" />
          Copy link
          <Shortcut>⌘L</Shortcut>
        </Item>

        <Item
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            if (onToggleFavorite) {
              onToggleFavorite(doc.id);
              return;
            }
            onUpdate(doc.id, { is_favorite: !doc.is_favorite });
          }}
          className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c] text-[#d4d4d4] focus:text-white"
        >
          <Star size={16} className={`mr-2 ${doc.is_favorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
          {doc.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
          <Shortcut>⌘S</Shortcut>
        </Item>

        {doc.updated_at && (
          <div className="px-3 py-2 text-[11px] text-[#9b9b9b] font-medium border-t border-white/5 mt-1 pt-2">
            Last edited by {getUserFromToken()?.name || 'User'} {getRelativeTime(doc.updated_at)}
          </div>
        )}
      </>
    );
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="relative group/context-trigger w-full h-full flex items-center">
          <div className="flex-1 min-w-0 w-full">
            {children}
          </div>
          {(dropdownTrigger || deleteTrigger) && (
            <div className="absolute right-2 opacity-0 group-hover/context-trigger:opacity-100 transition-opacity z-20 flex items-center gap-1.5">
              {deleteTrigger}
              {dropdownTrigger && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    {dropdownTrigger}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    className="w-64 bg-[#191919] border border-white/5 shadow-2xl text-[#d4d4d4]" 
                    align="end"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    {renderMenuItems(true)}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64 bg-[#191919] border border-white/5 shadow-2xl text-[#d4d4d4]">
        {renderMenuItems(false)}
      </ContextMenuContent>
    </ContextMenu>
  );
}
