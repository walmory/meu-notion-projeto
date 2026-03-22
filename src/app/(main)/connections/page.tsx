'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Mail, UserPlus, ShieldAlert, Trash2 } from 'lucide-react';
import { api, getAuthHeaders } from '@/lib/api';
import useSWR from 'swr';

interface User {
  name: string;
  email: string;
}

interface WorkspaceMember {
  workspace_id: string;
  user_email: string;
  role: 'owner' | 'member';
  name?: string;
}

const fetcher = async (url: string) => {
  const headers = getAuthHeaders();
  const res = await api.get(url, { headers });
  return res.data;
};

export default function ConnectionsPage() {
  const router = useRouter();
  const [emailToInvite, setEmailToInvite] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const { data: members = [], mutate } = useSWR<WorkspaceMember[]>('/workspace/members', fetcher);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailToInvite.trim()) return;

    setIsInviting(true);
    try {
      await api.post('/workspace/members', { email: emailToInvite }, { headers: getAuthHeaders() });
      setEmailToInvite('');
      mutate();
      alert('Convite enviado com sucesso!');
    } catch (error) {
      console.error('Failed to invite user', error);
      alert('Falha ao convidar usuário.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (email: string) => {
    if (!confirm(`Tem certeza que deseja remover ${email} do workspace?`)) return;
    
    try {
      await api.delete(`/workspace/members/${encodeURIComponent(email)}`, { headers: getAuthHeaders() });
      mutate();
    } catch (error) {
      console.error('Failed to remove user', error);
      alert('Falha ao remover usuário.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#191919] text-white p-8 md:p-12 h-screen">
      <div className="max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Users className="text-blue-500" size={36} />
            Connections (Teamspace)
          </h1>
          <p className="text-[#a3a3a3]">Gerencie os membros do seu workspace e colabore em tempo real.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Invite Section */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <UserPlus size={18} className="text-[#a3a3a3]" />
                Convidar Membro
              </h2>
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#a3a3a3] mb-1">E-mail do usuário</label>
                  <input
                    type="email"
                    value={emailToInvite}
                    onChange={(e) => setEmailToInvite(e.target.value)}
                    placeholder="amigo@exemplo.com"
                    required
                    className="w-full bg-[#2c2c2c] border border-[#3f3f3f] text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isInviting || !emailToInvite}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition"
                >
                  {isInviting ? 'Enviando...' : 'Enviar Convite'}
                </button>
              </form>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-200">
              <p>Membros do Teamspace têm acesso a todos os documentos arrastados para a seção <strong>Teamspaces</strong> na sua barra lateral.</p>
            </div>
          </div>

          {/* Members List */}
          <div className="md:col-span-2">
            <div className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-[#2c2c2c] flex justify-between items-center bg-[#222]">
                <h2 className="font-semibold">Membros Ativos ({members.length})</h2>
              </div>
              
              <div className="divide-y divide-[#2c2c2c]">
                {members.length === 0 ? (
                  <div className="p-8 text-center text-[#a3a3a3] text-sm">
                    Carregando membros...
                  </div>
                ) : (
                  members.map((member) => (
                    <div key={member.user_email} className="p-4 flex items-center justify-between hover:bg-[#252525] transition group">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${member.role === 'owner' ? 'bg-blue-600' : 'bg-[#3f3f3f]'}`}>
                          {member.role === 'owner' ? <ShieldAlert size={18} /> : member.user_email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-white flex items-center gap-2">
                            {member.name}
                            {member.role === 'owner' && (
                              <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                                Owner
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-[#a3a3a3] flex items-center gap-1.5 mt-0.5">
                            <Mail size={12} />
                            {member.user_email}
                          </div>
                        </div>
                      </div>
                      
                      {member.role !== 'owner' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.user_email)}
                          className="p-2 text-[#a3a3a3] hover:text-red-400 hover:bg-red-500/10 rounded-md transition opacity-0 group-hover:opacity-100"
                          title="Remover do Workspace"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
