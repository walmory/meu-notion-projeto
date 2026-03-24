'use client';

import React, { ReactNode } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { Star, Copy, Link as LinkIcon, Edit2, Trash2, PanelRightOpen, FileText, CornerUpRight, Briefcase } from 'lucide-react';
import { Document } from '@/hooks/useDocuments';
import { useSidePeek } from '@/contexts/SidePeekContext';
import { getUserFromToken, api, getAuthHeaders } from '@/lib/api';
import { toast } from 'sonner';
import useSWR from 'swr';

interface Workspace {
  id: string;
  name: string;
}

interface Teamspace {
  id: string;
  name: string;
}

const fetcher = (url: string) => api.get(url, { headers: getAuthHeaders() }).then(res => res.data);

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
  const activeWorkspaceId = typeof window !== 'undefined' ? localStorage.getItem('activeWorkspaceId') : null;
  
  const { data: teamspaces } = useSWR<Teamspace[]>(
    activeWorkspaceId ? `/teamspaces?workspace_id=${activeWorkspaceId}` : null,
    fetcher
  );

  const handleCopyLink = () => {
    let baseUrl = window.location.origin;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost && window.location.hostname.includes('vercel.app')) {
      // Se estiver no Vercel, o link base será mantido no Vercel (Frontend),
      // a menos que você queira o link do backend. Geralmente o link de cópia é do frontend.
      // Caso seja necessário, altere aqui.
      baseUrl = window.location.origin; 
    }
    const url = `${baseUrl}/documents/${doc.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard', {
      icon: '✅',
      position: 'bottom-center',
      style: {
        background: '#191919',
        color: '#fff',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '12px 16px',
        fontSize: '14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      }
    });
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

        {isDropdown ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c] text-[#d4d4d4] focus:text-white">
              <FileText size={16} className="mr-2" />
              Turn into
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48 bg-[#191919] border border-white/5 shadow-2xl text-[#d4d4d4]">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdate(doc.id, { type: 'page' }); }} className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c]">Page</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdate(doc.id, { type: 'folder' }); }} className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c]">Folder</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdate(doc.id, { type: 'database' }); }} className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c]">Database</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c] text-[#d4d4d4] focus:text-white">
              <FileText size={16} className="mr-2" />
              Turn into
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48 bg-[#191919] border border-white/5 shadow-2xl text-[#d4d4d4]">
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onUpdate(doc.id, { type: 'page' }); }} className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c]">Page</ContextMenuItem>
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onUpdate(doc.id, { type: 'folder' }); }} className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c]">Folder</ContextMenuItem>
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onUpdate(doc.id, { type: 'database' }); }} className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c]">Database</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        {isDropdown ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c] text-[#d4d4d4] focus:text-white">
              <CornerUpRight size={16} className="mr-2" />
              Move to...
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48 bg-[#191919] border border-white/5 shadow-2xl text-[#d4d4d4] max-h-64 overflow-y-auto">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdate(doc.id, { teamspace_id: null, is_private: true, parent_id: null }); }} className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c]">
                Private
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">Teamspaces</div>
              {teamspaces?.map(ts => (
                <DropdownMenuItem key={ts.id} onClick={(e) => { e.stopPropagation(); onUpdate(doc.id, { teamspace_id: ts.id, is_private: false, parent_id: null }); }} className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c]">
                  <Briefcase size={14} className="mr-2 text-gray-400" />
                  <span className="truncate">{ts.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c] text-[#d4d4d4] focus:text-white">
              <CornerUpRight size={16} className="mr-2" />
              Move to...
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48 bg-[#191919] border border-white/5 shadow-2xl text-[#d4d4d4] max-h-64 overflow-y-auto">
              <ContextMenuItem onClick={(e) => { e.stopPropagation(); onUpdate(doc.id, { teamspace_id: null, is_private: true, parent_id: null }); }} className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c]">
                Private
              </ContextMenuItem>
              <ContextMenuSeparator className="bg-white/5" />
              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">Teamspaces</div>
              {teamspaces?.map(ts => (
                <ContextMenuItem key={ts.id} onClick={(e) => { e.stopPropagation(); onUpdate(doc.id, { teamspace_id: ts.id, is_private: false, parent_id: null }); }} className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c]">
                  <Briefcase size={14} className="mr-2 text-gray-400" />
                  <span className="truncate">{ts.name}</span>
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

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
