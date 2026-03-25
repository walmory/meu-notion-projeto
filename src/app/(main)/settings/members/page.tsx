'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, getAuthHeaders } from '@/lib/api';
import { Search, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface GlobalConnection {
  connection_id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  joined_at?: string | null;
  last_active: string | null;
  shared_workspaces?: string;
}

const fetcher = async (url: string) => {
  const response = await api.get(url, { headers: getAuthHeaders() });
  return response.data;
};

export default function MembersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<GlobalConnection | null>(null);
  const [isBreaking, setIsBreaking] = useState(false);
  
  const { data: connections = [], isLoading, mutate } = useSWR<GlobalConnection[]>('/user/connections', fetcher);
  
  const filteredConnections = connections.filter(conn => 
    (conn.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (conn.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isUserOnline = (lastActive: string | null | undefined) => {
    if (!lastActive) return false;
    try {
      const lastActiveDate = new Date(lastActive);
      if (Number.isNaN(lastActiveDate.getTime())) return false;
      const now = new Date();
      const diffMinutes = (now.getTime() - lastActiveDate.getTime()) / 1000 / 60;
      return diffMinutes < 15;
    } catch {
      return false;
    }
  };

  const handleBreakConnection = async () => {
    if (!selectedUser) return;
    
    setIsBreaking(true);
    try {
      await api.delete(`/user/connections/${selectedUser.user_id}`, {
        headers: getAuthHeaders()
      });
      toast.success('Conexão removida com sucesso');
      mutate();
      setIsBreakModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Failed to break connection', error);
      toast.error('Erro ao quebrar conexão');
    } finally {
      setIsBreaking(false);
    }
  };

  const openBreakModal = (user: GlobalConnection) => {
    setSelectedUser(user);
    setIsBreakModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full bg-[#141414] overflow-hidden">
      {/* Header */}
      <header className="shrink-0 px-8 py-6 border-b border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-white tracking-tight">Área de Membros</h1>
          <p className="text-sm text-[#a3a3a3]">
            Visão global de todos os usuários conectados aos seus projetos e workspaces.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Search and Filters */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a8a8a]" />
              <input 
                type="text" 
                placeholder="Buscar membros por nome ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1f1f1f] border border-[#2c2c2c] text-white text-sm rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:border-[#4f4f4f] transition-colors placeholder:text-[#8a8a8a]"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#1f1f1f] border border-[#2c2c2c] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#252525] border-b border-[#2c2c2c]">
                  <tr>
                    <th className="px-6 py-4 font-medium text-[#a3a3a3]">Membro</th>
                    <th className="px-6 py-4 font-medium text-[#a3a3a3]">Data de Entrada</th>
                    <th className="px-6 py-4 font-medium text-[#a3a3a3]">Workspaces em Comum</th>
                    <th className="px-6 py-4 font-medium text-[#a3a3a3] text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2c2c2c]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-[#8a8a8a] gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Carregando membros...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredConnections.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-[#8a8a8a]">
                          <p>Nenhum membro encontrado.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredConnections.map((user) => (
                      <tr key={user.user_id} className="hover:bg-[#252525] transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-semibold text-lg shrink-0">
                                {(user.name?.charAt(0) || user.email?.charAt(0) || '?').toUpperCase()}
                              </div>
                              {isUserOnline(user.last_active) && (
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#1f1f1f] rounded-full group-hover:border-[#252525] transition-colors" title="Online agora" />
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium text-white">{user.name || 'Usuário Sem Nome'}</span>
                              <span className="text-xs text-[#a3a3a3]">{user.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[#a3a3a3]">
                          {user.joined_at ? new Date(user.joined_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </td>
                        <td className="px-6 py-4 text-[#a3a3a3]">
                          <div className="max-w-[200px] truncate" title={user.shared_workspaces || '-'}>
                            {user.shared_workspaces || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openBreakModal(user)}
                            className="text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            Break Connection
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Break Connection Modal */}
      <Dialog open={isBreakModalOpen} onOpenChange={setIsBreakModalOpen}>
        <DialogContent className="bg-[#1f1f1f] border-[#2c2c2c] text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Break Connection
            </DialogTitle>
            <DialogDescription className="text-[#a3a3a3] pt-3">
              Tem certeza? Isso removerá o acesso de <strong className="text-white">{selectedUser?.name || selectedUser?.email}</strong> de <strong>todos os seus projetos e workspaces</strong> permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 sm:justify-end gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBreakModalOpen(false)}
              className="bg-transparent border-[#2c2c2c] text-white hover:bg-[#2c2c2c] hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleBreakConnection}
              disabled={isBreaking}
              className="bg-red-600 hover:bg-red-700 text-white border-0"
            >
              {isBreaking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removendo...
                </>
              ) : (
                'Sim, quebrar conexão'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
