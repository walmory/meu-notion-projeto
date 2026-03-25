'use client';

import { useEffect, useState } from 'react';
import { api, getAuthHeaders, getUserFromToken } from '@/lib/api';
import { Users, MoreHorizontal, CheckCircle2, Clock, Trash2, Mail, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { WorkspaceInviteModal } from '@/components/WorkspaceInviteModal';
import { useSWRConfig } from 'swr';

interface Connection {
  id: string; // user_id ou invite_id
  name: string;
  email: string;
  role: 'owner' | 'member' | 'pending';
  status: 'active' | 'pending';
  joinedAt?: string;
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const { mutate } = useSWRConfig();
  const currentUser = getUserFromToken();

  const fetchConnections = async () => {
    const workspaceId = localStorage.getItem('activeWorkspaceId');
    setActiveWorkspaceId(workspaceId);
    
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    try {
      // 1. Buscar membros ativos
      const membersRes = await api.get('/workspaces/members', { 
        headers: { ...getAuthHeaders(), 'x-workspace-id': workspaceId } 
      });

      // 2. Buscar convites pendentes (precisamos criar essa rota no backend se não existir, 
      // ou filtrar do getMyInvites caso o endpoint retorne os pendentes do workspace atual)
      // Como o fluxo pediu foco no Workspace Connections, vamos mockar os pendentes temporariamente 
      // ou chamar a rota real caso exista.
      
      let pendingInvites: { id: string, email: string }[] = [];
      try {
        const invitesRes = await api.get(`/workspaces/${workspaceId}/invites/pending`, {
          headers: getAuthHeaders()
        });
        pendingInvites = invitesRes.data || [];
      } catch (err) {
        console.warn('Rota de convites pendentes ainda não implementada no backend, pulando...');
      }

      const activeConnections: Connection[] = membersRes.data.map((m: { user_id: string, user_name: string, user_email: string, role: 'owner' | 'member' | 'pending' }) => ({
        id: m.user_id,
        name: m.user_name || m.user_email?.split('@')[0] || 'User',
        email: m.user_email,
        role: m.role,
        status: 'active'
      }));

      const pendingConnections: Connection[] = pendingInvites.map((inv: { id: string, email: string }) => ({
        id: inv.id,
        name: inv.email?.split('@')[0] || 'Unknown',
        email: inv.email,
        role: 'pending',
        status: 'pending'
      }));

      setConnections([...activeConnections, ...pendingConnections]);
    } catch (error) {
      console.error('Failed to fetch connections:', error);
      toast.error('Erro ao carregar conexões');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRemoveConnection = async (connection: Connection) => {
    if (!activeWorkspaceId) return;

    try {
      if (connection.status === 'pending') {
        // Rota para cancelar convite pendente
        await api.delete(`/workspaces/${activeWorkspaceId}/invites/${connection.id}`, {
          headers: getAuthHeaders()
        });
      } else {
        // Rota para remover membro
        await api.delete(`/workspaces/members/${connection.email}`, {
          headers: { ...getAuthHeaders(), 'x-workspace-id': activeWorkspaceId }
        });
      }
      
      toast.success(connection.status === 'pending' ? 'Convite cancelado' : 'Membro removido');
      fetchConnections();
      mutate('/workspaces/members');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao remover conexão');
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#191919] overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Users className="text-[#a3a3a3]" size={28} />
              Workspace Connections
            </h1>
            <p className="text-[#a3a3a3]">
              Gerencie quem tem acesso ao seu workspace atual.
            </p>
          </div>
          <Button 
            onClick={() => setIsInviteModalOpen(true)}
            className="bg-white hover:bg-gray-200 text-black h-10 px-4"
          >
            <UserPlus size={16} className="mr-2" />
            Invite Members
          </Button>
        </div>

        <div className="bg-[#252525] rounded-xl border border-[#2c2c2c] overflow-hidden">
          {connections.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-[#333333] flex items-center justify-center mb-4">
                <Users className="text-[#a3a3a3]" size={32} />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Nenhuma conexão encontrada</h3>
              <p className="text-[#a3a3a3] max-w-sm mb-6">
                Você ainda não adicionou ninguém ao seu workspace. Convide sua equipe para colaborar.
              </p>
              <Button 
                onClick={() => setIsInviteModalOpen(true)}
                variant="outline" 
                className="bg-transparent border-[#2c2c2c] text-white hover:bg-[#2c2c2c]"
              >
                Convidar agora
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-[#2c2c2c]">
              {connections.map((conn) => (
                <div key={conn.id} className="flex items-center justify-between p-4 hover:bg-[#2c2c2c]/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-600 text-white font-semibold">
                      {conn.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{conn.name}</span>
                        {conn.id === currentUser?.id && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">
                            Você
                          </span>
                        )}
                        {conn.role === 'owner' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                            Owner
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-[#8a8a8a] mt-0.5">
                        <Mail size={12} />
                        {conn.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {conn.status === 'active' ? (
                      <div className="flex items-center gap-1.5 text-sm text-green-500 bg-green-500/10 px-2.5 py-1 rounded-full">
                        <CheckCircle2 size={14} />
                        Active
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-sm text-yellow-500 bg-yellow-500/10 px-2.5 py-1 rounded-full">
                        <Clock size={14} />
                        Pending
                      </div>
                    )}

                    {conn.id !== currentUser?.id && conn.role !== 'owner' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-[#333333] text-[#a3a3a3]">
                            <MoreHorizontal size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-[#252525] border-[#2c2c2c] text-white">
                          <DropdownMenuItem 
                            onClick={() => handleRemoveConnection(conn)}
                            className="text-red-400 focus:text-red-400 focus:bg-red-400/10 cursor-pointer"
                          >
                            <Trash2 size={14} className="mr-2" />
                            {conn.status === 'pending' ? 'Cancel Invite' : 'Break Connection'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <WorkspaceInviteModal 
        isOpen={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false);
          fetchConnections();
        }}
        workspaceId={activeWorkspaceId || ''}
        workspaceName="Workspace"
      />
    </div>
  );
}