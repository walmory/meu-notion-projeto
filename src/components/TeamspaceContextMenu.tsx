'use client';

import React, { ReactNode, useState } from 'react';
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
import { Trash2, Settings, Edit2, Copy, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, getAuthHeaders } from '@/lib/api';
import useSWR from 'swr';
import { toast } from 'sonner';

interface TeamspaceContextMenuProps {
  children: ReactNode;
  teamspaceId: string;
  teamspaceName: string;
  onDelete: (id: string) => void;
  onSettings?: (id: string) => void;
  dropdownTrigger?: ReactNode;
  plusTrigger?: ReactNode;
}

export function TeamspaceContextMenu({
  children,
  teamspaceId,
  teamspaceName,
  onDelete,
  onSettings,
  dropdownTrigger,
  plusTrigger,
}: TeamspaceContextMenuProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newName, setNewName] = useState(teamspaceName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newName === teamspaceName) return;
    
    setIsSubmitting(true);
    try {
      await api.patch(`/teamspaces/${teamspaceId}`, { name: newName.trim() }, { headers: getAuthHeaders() });
      toast.success('Teamspace renamed successfully');
      window.dispatchEvent(new Event('mutate-workspaces'));
      setShowRenameDialog(false);
    } catch (error) {
      toast.error('Failed to rename teamspace');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      await api.post(`/teamspaces/${teamspaceId}/duplicate`, {}, { headers: getAuthHeaders() });
      toast.success('Teamspace duplicated successfully');
      window.dispatchEvent(new Event('mutate-workspaces'));
    } catch (error) {
      toast.error('Failed to duplicate teamspace');
      console.error(error);
    }
  };

  const handleDeleteConfirm = () => {
    onDelete(teamspaceId);
    setShowDeleteDialog(false);
  };

  const renderMenuItems = (isDropdown = false) => {
    const Item = isDropdown ? DropdownMenuItem : ContextMenuItem;
    const Separator = isDropdown ? DropdownMenuSeparator : ContextMenuSeparator;
    const Shortcut = isDropdown ? DropdownMenuShortcut : ContextMenuShortcut;

    return (
      <>
        {onSettings && (
          <>
            <Item
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onSettings(teamspaceId);
              }}
              className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c] text-[#d4d4d4] focus:text-white"
            >
              <Settings size={16} className="mr-2" />
              Settings
            </Item>
            <Separator className="bg-white/5" />
          </>
        )}
        <Item
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            setShowRenameDialog(true);
          }}
          className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c] text-[#d4d4d4] focus:text-white"
        >
          <Edit2 size={16} className="mr-2" />
          Rename
          <Shortcut>⌘⇧R</Shortcut>
        </Item>
        <Item
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            handleDuplicate();
          }}
          className="cursor-pointer hover:bg-[#2c2c2c] focus:bg-[#2c2c2c] text-[#d4d4d4] focus:text-white"
        >
          <Copy size={16} className="mr-2" />
          Duplicate
          <Shortcut>⌘D</Shortcut>
        </Item>
        <Separator className="bg-white/5" />
        <Item
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            setShowDeleteDialog(true);
          }}
          className="cursor-pointer text-[#eb5757] hover:bg-[#2c2c2c] focus:bg-[#2c2c2c] focus:text-[#eb5757]"
        >
          <Trash2 size={16} className="mr-2" />
          Delete Teamspace
        </Item>
      </>
    );
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {(dropdownTrigger || plusTrigger) ? (
            <div className="relative group/ts-context-trigger w-full h-full flex items-center">
              <div className="flex-1 min-w-0 w-full">
                {children}
              </div>
              <div className="absolute right-2 opacity-0 group-hover/ts-context-trigger:opacity-100 transition-opacity z-20 flex items-center gap-1">
                {plusTrigger}
                {dropdownTrigger && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      {dropdownTrigger}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      className="w-48 bg-[#191919] border border-white/5 shadow-2xl text-[#d4d4d4]" 
                      align="end"
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    >
                      {renderMenuItems(true)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ) : (
            children
          )}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48 bg-[#191919] border border-white/5 shadow-2xl text-[#d4d4d4]">
          {renderMenuItems(false)}
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-[#191919] border-[#2c2c2c] text-[#d4d4d4] sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                <AlertTriangle size={20} />
              </div>
              <DialogTitle className="text-white text-xl">Delete Teamspace</DialogTitle>
            </div>
            <DialogDescription className="text-[#a3a3a3] text-sm mt-4">
              Você está prestes a excluir este Teamspace. Isso moverá todas as páginas e subpáginas para a <strong>Lixeira</strong>. 
              <br /><br />
              Esta ação afetará todos os membros do workspace que têm acesso a este teamspace.
              Tem certeza que deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex gap-2 justify-end border-t border-[#2c2c2c] pt-4 sm:space-x-0">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
              className="bg-transparent border-[#3f3f3f] text-[#d4d4d4] hover:bg-[#2c2c2c] hover:text-white"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Yes, delete teamspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="bg-[#191919] border-white/5 text-[#d4d4d4] sm:max-w-[425px]">
          <form onSubmit={handleRename}>
            <DialogHeader>
              <DialogTitle className="text-white">Rename Teamspace</DialogTitle>
              <DialogDescription className="text-[#a3a3a3] pt-3">
                Enter a new name for this teamspace.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-[#2c2c2c] border-white/5 text-white"
                placeholder="Teamspace name"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRenameDialog(false)}
                className="bg-transparent border-white/10 text-white hover:bg-white/5"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isSubmitting || !newName.trim() || newName === teamspaceName}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}