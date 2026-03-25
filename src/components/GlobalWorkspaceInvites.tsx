'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { api, getAuthHeaders, getUserFromToken } from '@/lib/api';
import { toast } from 'sonner';
import { useGlobalSocket } from '@/hooks/useSocket';

interface Invite {
  id: string;
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
  email: string;
}

export function GlobalWorkspaceInvites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [currentInvite, setCurrentInvite] = useState<Invite | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { socket } = useGlobalSocket();

  useEffect(() => {
    const fetchInvites = async () => {
      try {
        const res = await api.get('/workspaces/my-invites', { headers: getAuthHeaders() });
        if (res.data && res.data.length > 0) {
          const formattedInvites = res.data.map((inv: { id: string, workspace_id: string, workspace_name: string, inviter_name: string }) => ({
            id: inv.id,
            workspaceId: inv.workspace_id,
            workspaceName: inv.workspace_name,
            inviterName: inv.inviter_name,
            email: getUserFromToken()?.email || ''
          }));
          setInvites(formattedInvites);
        }
      } catch (error) {
        console.error('Failed to fetch invites', error);
      }
    };

    fetchInvites();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleWorkspaceInvite = (payload: Invite) => {
      setInvites((prev) => [...prev, payload]);
    };

    socket.on('workspace_invite', handleWorkspaceInvite);

    return () => {
      socket.off('workspace_invite', handleWorkspaceInvite);
    };
  }, [socket]);

  useEffect(() => {
    if (invites.length > 0 && !currentInvite) {
      setCurrentInvite(invites[0]);
    } else if (invites.length === 0) {
      setCurrentInvite(null);
    }
  }, [invites, currentInvite]);

  const handleAccept = async () => {
    if (!currentInvite) return;
    setIsProcessing(true);
    try {
      await api.post(`/workspaces/invites/${currentInvite.id}/accept`, {}, { headers: getAuthHeaders() });
      toast.success('Workspace successfully accepted!');
      setInvites((prev) => prev.filter(inv => inv.id !== currentInvite.id));
      setCurrentInvite(null);
      window.location.reload();
    } catch (error) {
      const err = error as { response?: { data?: { error?: string, message?: string } } };
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Error accepting invite');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!currentInvite) return;
    setIsProcessing(true);
    try {
      await api.post(`/workspaces/invites/${currentInvite.id}/decline`, {}, { headers: getAuthHeaders() });
      toast.success('Invite declined.');
      setInvites((prev) => prev.filter(inv => inv.id !== currentInvite.id));
      setCurrentInvite(null);
    } catch (error) {
      const err = error as { response?: { data?: { error?: string, message?: string } } };
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Error declining invite');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!currentInvite) return null;

  return (
    <Dialog open={!!currentInvite} onOpenChange={() => {}}>
      <DialogContent className="bg-[#191919] border-[#2c2c2c] text-[#d4d4d4] sm:max-w-[420px] [&>button]:hidden">
        <DialogHeader className="pt-4">
          <DialogTitle className="text-white text-lg text-center font-medium">You received an invite!</DialogTitle>
          <DialogDescription className="text-center pt-4 pb-2 text-[#b3b3b3] text-[15px]">
            <span className="text-white font-semibold">{currentInvite.inviterName}</span> invited you to{' '}
            <span className="text-white font-semibold">{currentInvite.workspaceName}</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-3 sm:justify-center pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleDecline}
            disabled={isProcessing}
            className="flex-1 bg-transparent border-[#2c2c2c] hover:bg-[#2c2c2c] text-white h-10 text-sm"
          >
            Decline
          </Button>
          <Button
            type="button"
            onClick={handleAccept}
            disabled={isProcessing}
            className="flex-1 bg-white hover:bg-gray-200 text-black h-10 text-sm"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Processando...
              </span>
            ) : (
              'Accept'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}