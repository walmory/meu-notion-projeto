'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, getAuthHeaders } from '@/lib/api';
import { Users, Mail, Check, XCircle, UserMinus } from 'lucide-react';
import { toast } from 'sonner';

interface Connection {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  isOnline?: boolean; // Mock para status
}

interface PendingInvite {
  id: string;
  workspace_id: string;
  workspace_name: string;
  inviter_name: string;
  inviter_email: string;
  inviter_avatar?: string;
  status: string;
}

const fetcher = async (url: string) => {
  const response = await api.get(url, { headers: getAuthHeaders() });
  return response.data;
};

export default function MembersPage() {
  const { data: connections, mutate: mutateConnections, isLoading: isLoadingConnections } = useSWR<Connection[]>('/connections', fetcher);
  const { data: invites, mutate: mutateInvites, isLoading: isLoadingInvites } = useSWR<PendingInvite[]>('/invitations/pending', fetcher);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleInviteResponse = async (id: string, action: 'accept' | 'decline') => {
    setLoadingAction(id);
    try {
      await api.post(`/invitations/${id}/respond`, { action }, { headers: getAuthHeaders() });
      if (action === 'accept') {
        toast.success('Convite aceito!');
        mutateConnections();
      } else {
        toast.success('Convite recusado.');
      }
      mutateInvites();
    } catch (error) {
      toast.error('Erro ao responder o convite');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBreakConnection = async (userId: string, name: string) => {
    if (!confirm(`Tem certeza que deseja romper a conexão com ${name}? Vocês perderão acesso aos workspaces compartilhados um do outro.`)) return;

    try {
      await api.delete(`/connections/${userId}`, { headers: getAuthHeaders() });
      toast.success(`Conexão com ${name} rompida com sucesso.`);
      mutateConnections();
    } catch (error) {
      toast.error('Erro ao romper conexão');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 w-full animate-in fade-in duration-300">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-white mb-3">Members & Connections</h1>
        <p className="text-[#a3a3a3]">
          Gerencie as pessoas conectadas a você através de Workspaces e convites pendentes.
        </p>
      </div>

      {/* Pending Invitations Section */}
      {invites && invites.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Mail className="text-[#2383e2]" size={24} />
            <h2 className="text-2xl font-semibold text-white">Pending Invitations</h2>
            <span className="bg-[#2383e2]/20 text-[#2383e2] text-xs font-bold px-2 py-0.5 rounded-full">
              {invites.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {invites.map((invite) => (
              <div key={invite.id} className="bg-[#1e1e1e] border border-white/5 rounded-xl p-5 flex items-center justify-between hover:bg-[#252525] transition shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-[#2c2c2c] bg-[#2c2c2c] flex-shrink-0">
                    {invite.inviter_avatar ? (
                      <img src={invite.inviter_avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg font-semibold text-white">
                        {invite.inviter_name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{invite.workspace_name}</h3>
                    <p className="text-sm text-[#a3a3a3]">
                      Convidado por <span className="text-white">{invite.inviter_name || invite.inviter_email}</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleInviteResponse(invite.id, 'decline')}
                    disabled={loadingAction === invite.id}
                    className="p-2 rounded-lg text-[#a3a3a3] hover:text-red-400 hover:bg-red-500/10 transition"
                    title="Recusar"
                  >
                    <XCircle size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInviteResponse(invite.id, 'accept')}
                    disabled={loadingAction === invite.id}
                    className="p-2 rounded-lg text-[#2383e2] hover:text-white bg-[#2383e2]/10 hover:bg-[#2383e2] transition"
                    title="Aceitar"
                  >
                    <Check size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connections Section */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Users className="text-white" size={24} />
          <h2 className="text-2xl font-semibold text-white">Your Connections</h2>
        </div>

        {isLoadingConnections ? (
          <div className="text-[#a3a3a3] text-sm">Carregando conexões...</div>
        ) : connections && connections.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connections.map((conn) => (
              <div key={conn.id} className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-xl p-5 flex flex-col gap-4 hover:border-white/20 transition group">
                <div className="flex items-center gap-4">
                  <div className="relative w-12 h-12">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-[#2c2c2c] bg-[#2c2c2c]">
                      {conn.avatar_url ? (
                        <img src={conn.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg font-semibold text-white">
                          {conn.name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    {/* Status Indicator Mock */}
                    <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-[#1a1a1a] rounded-full ${Math.random() > 0.5 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate">{conn.name}</h3>
                    <p className="text-xs text-[#a3a3a3] truncate">{conn.email}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleBreakConnection(conn.id, conn.name)}
                  className="w-full py-2 flex items-center justify-center gap-2 rounded-lg text-sm font-medium text-[#a3a3a3] bg-[#252525] hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/30 transition"
                >
                  <UserMinus size={16} />
                  Break Connection
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-xl p-10 flex flex-col items-center justify-center text-center">
            <Users className="text-[#3c3c3c] mb-4" size={48} />
            <h3 className="text-white font-medium mb-2">Nenhuma conexão ainda</h3>
            <p className="text-[#a3a3a3] text-sm max-w-sm">
              Quando você convidar pessoas para seus Workspaces ou aceitar convites, elas aparecerão aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}