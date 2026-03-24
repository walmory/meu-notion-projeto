'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Mail, UserX, Check, X, Bell } from 'lucide-react';
import { api, getAuthHeaders } from '@/lib/api';
import useSWR from 'swr';
import { toast } from 'sonner';

interface Connection {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  isOnline?: boolean; // Mocked for now unless we implement global presence
}

interface Invitation {
  id: string;
  workspace_id: string;
  workspace_name: string;
  status: string;
  inviter_name: string;
  inviter_avatar: string | null;
}

const fetcher = async (url: string) => {
  const headers = getAuthHeaders();
  const res = await api.get(url, { headers });
  return res.data;
};

export default function MembersPage() {
  const { data: connections = [], mutate: mutateConnections } = useSWR<Connection[]>('/user/connections', fetcher);
  const { data: invitations = [], mutate: mutateInvitations } = useSWR<Invitation[]>('/user/invitations', fetcher);

  const handleBreakConnection = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja romper a conexão com ${userName}? Isso removerá o acesso mútuo a workspaces compartilhados.`)) return;
    
    try {
      await api.delete(`/user/connections/${userId}`, { headers: getAuthHeaders() });
      toast.success('Conexão rompida com sucesso');
      mutateConnections();
    } catch (error) {
      console.error('Failed to break connection', error);
      toast.error('Falha ao romper conexão');
    }
  };

  const handleInvitationAction = async (id: string, action: 'accepted' | 'declined' | 'dismissed') => {
    try {
      await api.patch(`/user/invitations/${id}`, { status: action }, { headers: getAuthHeaders() });
      if (action === 'accepted') {
        toast.success('Convite aceito!');
        mutateConnections();
      } else if (action === 'declined') {
        toast.success('Convite recusado');
      }
      mutateInvitations();
    } catch (error) {
      console.error('Failed to update invitation', error);
      toast.error('Falha ao atualizar convite');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#191919] text-white p-8 md:p-12 h-screen">
      <div className="max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Users className="text-[#2eaadc]" size={36} />
            Members & Connections
          </h1>
          <p className="text-[#a3a3a3]">Gerencie suas conexões de rede e convites pendentes.</p>
        </div>

        <div className="space-y-12">
          {/* Pending Invitations Section */}
          {invitations.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 border-b border-[#2c2c2c] pb-3">
                <Bell size={20} className="text-yellow-500" />
                Pending Invitations ({invitations.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {invitations.map((inv) => (
                  <div key={inv.id} className="bg-[#1a1a1a] border border-[#2c2c2c] p-5 rounded-xl shadow-lg hover:border-[#3f3f3f] transition-all flex flex-col justify-between">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-12 h-12 rounded-full bg-[#2c2c2c] flex items-center justify-center shrink-0 overflow-hidden">
                        {inv.inviter_avatar ? (
                          <img src={inv.inviter_avatar} alt="avatar" className="w-full h-full object-cover" />
                        ) : (
                          <Users size={20} className="text-[#a3a3a3]" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-[15px]">{inv.inviter_name}</h3>
                        <p className="text-sm text-[#a3a3a3] mt-0.5">
                          convidou você para o workspace <span className="text-white font-medium">&quot;{inv.workspace_name}&quot;</span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleInvitationAction(inv.id, 'accepted')}
                        className="flex-1 flex items-center justify-center gap-2 bg-[#2eaadc]/10 text-[#2eaadc] hover:bg-[#2eaadc]/20 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Check size={16} /> Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInvitationAction(inv.id, 'declined')}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <X size={16} /> Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Active Connections Section */}
          <section>
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 border-b border-[#2c2c2c] pb-3">
              <Users size={20} className="text-white" />
              Active Connections ({connections.length})
            </h2>
            
            {connections.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[#2c2c2c] rounded-xl text-[#a3a3a3]">
                Você ainda não possui conexões.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {connections.map((conn) => (
                  <div key={conn.id} className="bg-[#1a1a1a] border border-[#2c2c2c] p-4 rounded-xl flex items-center justify-between group hover:border-[#3f3f3f] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-[#3f3f3f] overflow-hidden ${conn.isOnline ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-[#1a1a1a]' : ''}`}>
                          {conn.avatar_url ? (
                            <img src={conn.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                          ) : (
                            conn.name ? conn.name[0].toUpperCase() : <Users size={16} />
                          )}
                        </div>
                        {/* Status Indicator */}
                        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#1a1a1a] ${conn.isOnline ? 'bg-green-500' : 'bg-[#555]'}`} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm text-white truncate max-w-[120px]">{conn.name}</span>
                        <span className="text-xs text-[#a3a3a3] flex items-center gap-1 truncate max-w-[120px]">
                          <Mail size={10} />
                          {conn.email}
                        </span>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleBreakConnection(conn.id, conn.name)}
                      className="p-2 text-[#a3a3a3] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Break Connection"
                    >
                      <UserX size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}