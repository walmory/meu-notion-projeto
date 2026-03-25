'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api, getAuthHeaders } from '@/lib/api';
import useSWR from 'swr';

interface WorkspaceInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
}

interface WorkspaceMember {
  workspace_id: string;
  user_email: string;
  user_id: string;
  user_name?: string;
  role: 'owner' | 'member';
}

const fetcher = async (url: string) => {
  const response = await api.get(url, { headers: getAuthHeaders() });
  return response.data;
};

export function MembersModal({ isOpen, onClose, workspaceId, workspaceName }: WorkspaceInviteModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const { data: members = [], mutate } = useSWR<WorkspaceMember[]>(
    isOpen && workspaceId ? '/workspaces/members' : null,
    fetcher
  );

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setSuccessMessage('');

    try {
      await api.post(`/workspaces/${workspaceId}/invite`, { email }, { headers: getAuthHeaders() });
      setSuccessMessage(`Invite Sent para ${email}`);
      setEmail('');
      mutate();
    } catch (error) {
      console.error('Failed to invite user', error);
      alert('Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  const handleBreakConnection = async (userId: string, email: string) => {
    if (!confirm(`Tem certeza que deseja romper a conexão com ${email}? Vocês perderão acesso aos workspaces compartilhados um do outro.`)) return;

    try {
      await api.delete(`/connections/${userId}`, { headers: getAuthHeaders() });
      mutate();
    } catch (error) {
      console.error('Erro ao romper conexão', error);
      alert('Erro ao romper conexão');
    }
  };

  const currentUserEmail = typeof window !== 'undefined' ? localStorage.getItem('user_email') : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#191919] border-[#2c2c2c] text-[#d4d4d4] sm:max-w-[560px]">
        <form onSubmit={handleInvite}>
          <DialogHeader>
            <DialogTitle className="text-white text-lg leading-tight flex items-center gap-1 flex-wrap pr-4">
              <span>Members de</span>
              <span className="truncate max-w-[200px]" title={workspaceName}>{workspaceName}</span>
            </DialogTitle>
            <DialogDescription className="text-[#9b9b9b] text-sm">
              Convide pessoas e visualize membros do workspace atual.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 mt-2">
            <div className="grid gap-2">
              <label htmlFor="email" className="text-xs font-medium text-[#9b9b9b]">Email address</label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="bg-[#252525] border-[#2c2c2c] text-white focus-visible:ring-1 focus-visible:ring-white/20 h-9 text-sm"
                required
              />
            </div>
            {successMessage && (
              <p className="text-xs text-green-500">{successMessage}</p>
            )}
            <div className="max-h-52 overflow-y-auto rounded-md border border-white/5 bg-[#151515]">
              {members.length === 0 ? (
                <div className="p-3 text-xs text-[#9b9b9b]">Nenhum membro carregado.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {members.map((member) => (
                    <div key={`${member.user_email}-${member.role}`} className="flex items-center justify-between px-3 py-2">
                      <div className="flex flex-col">
                        <span className="text-sm text-white truncate">{member.user_name || member.user_email}</span>
                        <span className="text-[11px] uppercase tracking-wide text-[#9b9b9b]">{member.role}</span>
                      </div>
                      {member.user_email !== currentUserEmail && (
                        <button
                          type="button"
                          onClick={() => handleBreakConnection(member.user_id, member.user_email)}
                          className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded transition"
                        >
                          Break Connection
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-white/5 mt-2">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onClose} 
              className="hover:bg-white/5 text-[#d4d4d4] hover:text-white h-8 text-xs px-4"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!email.trim() || loading} 
              className="bg-[#2383e2] hover:bg-[#2383e2]/90 text-white h-8 text-xs px-4"
            >
              {loading ? 'Enviando...' : 'Send invite'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const WorkspaceInviteModal = MembersModal;
