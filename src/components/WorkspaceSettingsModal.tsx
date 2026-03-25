'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { api, getAuthHeaders, getUserFromToken } from '@/lib/api';
import { AlertTriangle, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { KeyedMutator } from 'swr';

interface Workspace {
  id: string;
  name: string;
  owner: string;
  plan: string;
  member_count: number;
  description?: string;
  icon?: string;
}

interface WorkspaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace | null;
  workspaces?: Workspace[];
  mutateWorkspaces?: KeyedMutator<Workspace[]>;
  onWorkspaceUpdated: () => void;
  onWorkspaceDeleted: (workspaceId: string) => void | Promise<void>;
}

export function WorkspaceSettingsModal({ 
  isOpen, 
  onClose, 
  workspace, 
  workspaces,
  mutateWorkspaces,
  onWorkspaceUpdated, 
  onWorkspaceDeleted 
}: WorkspaceSettingsModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState('');
  const [deleteErrorMessage, setDeleteErrorMessage] = useState('');
  
  // Invite states
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  const isDeleteConfirmationValid = deleteConfirmationName === (workspace?.name ?? '');

  useEffect(() => {
    if (workspace) {
      setName(workspace.name || '');
      setDescription(workspace.description || '');
      setSuccessMessage('');
      setDeleteConfirmationName('');
      setDeleteErrorMessage('');
      setIsDeleteDialogOpen(false);
      setIsInviteOpen(false);
      setInviteEmail('');
    }
  }, [workspace]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !name.trim()) return;

    setLoading(true);
    setSuccessMessage('');

    try {
      await api.put(`/workspaces/${workspace.id}`, { name, description }, { headers: getAuthHeaders() });
      setSuccessMessage('Settings updated successfully!');
      onWorkspaceUpdated();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to update workspace', error);
      alert('Failed to update workspace');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !inviteEmail.trim()) return;

    setInviteLoading(true);
    try {
      await api.post(`/workspaces/${workspace.id}/invite`, { email: inviteEmail }, { headers: getAuthHeaders() });
      toast.success('Invite successfully sent!');
      setIsInviteOpen(false);
      setInviteEmail('');
    } catch (error) {
      const err = error as { response?: { data?: { error?: string, message?: string } } };
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to send invite';
      toast.error(msg);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!workspace) return;
    if (!isDeleteConfirmationValid) {
      setDeleteErrorMessage('Type exactly the workspace name to confirm.');
      return;
    }

    setDeleteLoading(true);
    setDeleteErrorMessage('');
    try {
      // 1. Mutação Silenciosa (Frontend)
      if (workspaces && mutateWorkspaces) {
        const newWorkspaceList = workspaces.filter(w => w.id !== workspace.id);
        mutateWorkspaces(newWorkspaceList, { revalidate: false });
      }

      // 2. Chamar o api.delete
      await api.delete(`/workspaces/${workspace.id}`, { headers: getAuthHeaders() });
      
      // 4. Delay intencional de 100ms para suavizar a transição e dar tempo ao DB (AAA+)
      await new Promise(resolve => setTimeout(resolve, 100));

      // 3. Redirecionar (onWorkspaceDeleted cuida do redirecionamento e revalidação)
      await onWorkspaceDeleted(workspace.id);
      
      onClose();
      setIsDeleteDialogOpen(false);
      setDeleteConfirmationName('');
    } catch (error) {
      console.error('Failed to delete workspace', error);
      setDeleteErrorMessage('Could not delete the workspace.');
      // Rollback cache em caso de erro
      if (workspaces && mutateWorkspaces) {
        mutateWorkspaces(workspaces, { revalidate: true });
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!workspace) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#191919] border-[#2c2c2c] text-[#d4d4d4] sm:max-w-[500px] p-0 overflow-hidden">
        <div className="flex flex-col h-full max-h-[80vh] overflow-y-auto">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-white text-lg font-semibold">Workspace Settings</DialogTitle>
          </DialogHeader>
          
          <div className="px-6 space-y-6 pb-6">
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="ws-name" className="text-xs font-medium text-[#9b9b9b]">Name</label>
                <Input 
                  id="ws-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-[#252525] border-[#2c2c2c] text-white focus-visible:ring-1 focus-visible:ring-white/20 h-9 text-sm"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="ws-desc" className="text-xs font-medium text-[#9b9b9b]">Description (optional)</label>
                <Input 
                  id="ws-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this workspace for?"
                  className="bg-[#252525] border-[#2c2c2c] text-white focus-visible:ring-1 focus-visible:ring-white/20 h-9 text-sm"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button 
                  type="submit" 
                  disabled={!name.trim() || loading || !!successMessage} 
                  className={`border h-8 text-xs px-4 transition-all ${
                    successMessage 
                      ? "bg-green-500 hover:bg-green-600 text-white border-green-500" 
                      : "bg-[#2c2c2c] hover:bg-[#3f3f3f] text-white border-[#3f3f3f]"
                  }`}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={12} className="animate-spin" />
                      Updating...
                    </span>
                  ) : successMessage ? 'Success!' : 'Update'}
                </Button>
              </div>
            </form>

            <Separator className="bg-[#2c2c2c] my-6" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Members & Invites</h3>
                  <p className="text-xs text-[#9b9b9b] leading-relaxed">
                    Manage who has access to this workspace.
                  </p>
                </div>
                <Button 
                  type="button"
                  onClick={() => setIsInviteOpen(true)}
                  className="bg-white hover:bg-gray-200 text-black h-8 text-xs px-4"
                >
                  <UserPlus size={14} className="mr-2" />
                  Invite
                </Button>
              </div>
            </div>

            <Separator className="bg-[#2c2c2c] my-6" />

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white">Danger Zone</h3>
              <p className="text-xs text-[#9b9b9b] leading-relaxed">
                This action will move all documents and settings to the trash.
              </p>
              
              <div className="flex gap-2">
                <Button 
                  type="button"
                  variant="outline"
                  className="bg-transparent border-[#2c2c2c] hover:bg-[#2c2c2c] text-white h-8 text-xs px-4"
                >
                  Leave workspace
                </Button>
                <Button 
                  type="button"
                  variant="outline"
                  className="bg-transparent border-[#2c2c2c] hover:bg-[#2c2c2c] text-white h-8 text-xs px-4"
                >
                  Archive
                </Button>
                <Button 
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setDeleteErrorMessage('');
                    setDeleteConfirmationName('');
                    setIsDeleteDialogOpen(true);
                  }}
                  disabled={deleteLoading}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 h-8 text-xs px-4"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete workspace'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-[#191919] border-[#2c2c2c] text-[#d4d4d4] sm:max-w-[460px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15 text-red-500">
                <AlertTriangle size={20} />
              </div>
              <DialogTitle className="text-white">Permanently Delete Workspace?</DialogTitle>
            </div>
            <DialogDescription className="text-[#b3b3b3] pt-2 leading-relaxed">
              Warning, {getUserFromToken()?.name || 'User'}: this action is irreversible. All documents, members, and settings linked to this workspace will be permanently deleted from the database.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-2">
              <label htmlFor="ws-delete-confirm-name" className="text-xs font-medium text-[#9b9b9b]">
                Type <span className="text-white">{workspace.name}</span> to confirm
              </label>
              <Input
                id="ws-delete-confirm-name"
                value={deleteConfirmationName}
                onChange={(e) => {
                  setDeleteConfirmationName(e.target.value);
                  if (deleteErrorMessage) {
                    setDeleteErrorMessage('');
                  }
                }}
                placeholder={workspace.name}
                className="bg-[#252525] border-[#2c2c2c] text-white focus-visible:ring-1 focus-visible:ring-white/20 h-9 text-sm"
              />
            </div>
            {deleteErrorMessage ? (
              <p className="text-xs text-red-400">{deleteErrorMessage}</p>
            ) : null}
          </div>
          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="bg-transparent border-[#2c2c2c] hover:bg-[#2c2c2c] text-white h-9 text-xs px-4"
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              className={`h-9 text-xs px-4 border transition-colors ${
                isDeleteConfirmationValid
                  ? 'bg-red-500 hover:bg-red-600 text-white border-red-500'
                  : 'bg-[#2c2c2c] text-[#8a8a8a] border-[#3a3a3a]'
              }`}
              disabled={deleteLoading || !isDeleteConfirmationValid}
            >
              {deleteLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Processando...
                </span>
              ) : 'Confirmar Exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="bg-[#191919] border-[#2c2c2c] text-[#d4d4d4] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-white">Invite to Workspace</DialogTitle>
            <DialogDescription className="text-[#b3b3b3]">
              Invite a new member to the workspace <span className="text-white font-medium">{workspace.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label htmlFor="invite-email" className="text-xs font-medium text-[#9b9b9b]">Email address</label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Ex: colega@empresa.com"
                className="bg-[#252525] border-[#2c2c2c] text-white focus-visible:ring-1 focus-visible:ring-white/20 h-9 text-sm"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInviteOpen(false)}
                className="bg-transparent border-[#2c2c2c] hover:bg-[#2c2c2c] text-white h-9 text-xs px-4"
                disabled={inviteLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!inviteEmail.trim() || inviteLoading}
                className="bg-white hover:bg-gray-200 text-black h-9 text-xs px-4"
              >
                {inviteLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Sending...
                  </span>
                ) : 'Send Invite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
