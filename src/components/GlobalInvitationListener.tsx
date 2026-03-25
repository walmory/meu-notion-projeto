'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import useSWR from 'swr';
import { api, getAuthHeaders } from '@/lib/api';
import { X, Check, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Invite {
  id: string;
  workspace_id: string;
  workspace_name: string;
  inviter_name: string;
  inviter_email: string;
  inviter_avatar?: string;
}

const fetcher = async (url: string) => {
  const response = await api.get(url, { headers: getAuthHeaders() });
  return response.data;
};

const getSocketUrl = () => {
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost) {
      return 'https://apinotion.andrekehrer.com';
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'https://apinotion.andrekehrer.com';
};

export function GlobalInvitationListener() {
  const [activeInvite, setActiveInvite] = useState<Invite | null>(null);
  const { data: pendingInvites, mutate } = useSWR<Invite[]>('/invitations/pending', fetcher, {
    revalidateOnFocus: false
  });

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('notion_token') : null;
    if (!token) return;

    const socketUrl = getSocketUrl();
    const socketInstance = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketInstance.on('new-invitation', (invite: Invite) => {
      setActiveInvite(invite);
      mutate(); // Refresh the list in the background
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [mutate]);

  const handleAction = async (action: 'accept' | 'decline' | 'dismiss') => {
    if (!activeInvite) return;
    
    try {
      await api.post(`/invitations/${activeInvite.id}/respond`, { action }, { headers: getAuthHeaders() });
      if (action === 'accept') {
        toast.success('Convite aceito com sucesso!');
        // Se aceitou, pode recarregar a página para atualizar os workspaces ou chamar um mutate global
        setTimeout(() => window.location.reload(), 1500);
      } else if (action === 'decline') {
        toast.success('Convite recusado.');
      } else {
        toast.info('Convite ocultado. Você pode responder depois na área de Membros.');
      }
      setActiveInvite(null);
      mutate();
    } catch (error) {
      console.error('Failed to respond to invite', error);
      toast.error('Erro ao processar o convite.');
    }
  };

  if (!activeInvite) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1e1e1e] border border-white/10 shadow-2xl rounded-2xl p-6 max-w-sm w-full relative scale-100 animate-in zoom-in-95 duration-200">
        <button 
          type="button"
          onClick={() => handleAction('dismiss')}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center mt-2">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#2383e2] mb-4 shadow-[0_0_15px_rgba(35,131,226,0.5)]">
            {activeInvite.inviter_avatar ? (
              <img src={activeInvite.inviter_avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#2c2c2c] flex items-center justify-center text-xl font-semibold text-white">
                {activeInvite.inviter_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          
          <h3 className="text-xl font-semibold text-white mb-1">Novo Convite</h3>
          <p className="text-[#a3a3a3] text-sm mb-6">
            <strong className="text-white">{activeInvite.inviter_name || activeInvite.inviter_email}</strong> convidou você para o workspace <strong className="text-white">{activeInvite.workspace_name}</strong>.
          </p>

          <div className="flex w-full gap-3">
            <button 
              type="button"
              onClick={() => handleAction('decline')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition font-medium"
            >
              <XCircle size={18} />
              Recusar
            </button>
            <button 
              type="button"
              onClick={() => handleAction('accept')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#2383e2] text-white hover:bg-[#2383e2]/90 shadow-[0_0_10px_rgba(35,131,226,0.3)] transition font-medium"
            >
              <Check size={18} />
              Aceitar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
