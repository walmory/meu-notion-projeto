'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, getAuthHeaders } from '@/lib/api';
import useSWR from 'swr';
import { 
  Book, 
  Search, 
  Plus, 
  Users, 
  Globe,
  Lock,
  Clock,
  Star,
  FileText,
  ChevronDown,
  LayoutGrid,
  AlignLeft,
  Network
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TeamspaceContextMenu } from '@/components/TeamspaceContextMenu';
import { IconPicker } from '@/components/IconPicker';
import * as LucideIcons from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import { useDocuments } from '@/hooks/useDocuments';

interface Teamspace {
  id: string;
  name: string;
  created_by: string;
  invite_code: string;
  description: string;
  icon: string;
  member_count: number;
}

const fetcher = async (url: string) => {
  const headers = getAuthHeaders();
  const res = await api.get(url, { headers });
  return res.data;
};

export default function LibraryPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTsName, setNewTsName] = useState('');
  const [newTsDesc, setNewTsDesc] = useState('');
  const [newTsIcon, setNewTsIcon] = useState('Users');
  const [isCreating, setIsCreating] = useState(false);
  const [expandedTeamspaces, setExpandedTeamspaces] = useState<Record<string, boolean>>({});

  const { data: teamspaces = [], mutate: mutateTeamspaces } = useSWR<Teamspace[]>('/teamspaces', fetcher);
  const { documents = [] } = useDocuments();

  const filteredTeamspaces = teamspaces.filter(ts => 
    ts.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (ts.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateTeamspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTsName.trim()) return;

    setIsCreating(true);
    
    // Optimistic UI para criação
    const tempId = `temp-${Date.now()}`;
    const newTs: Teamspace = {
      id: tempId,
      name: newTsName,
      created_by: 'me',
      invite_code: '',
      description: newTsDesc,
      icon: newTsIcon,
      member_count: 1
    };
    
    const previousTeamspaces = teamspaces || [];
    mutateTeamspaces([...previousTeamspaces, newTs], { revalidate: false });
    
    setIsCreateModalOpen(false);
    const nameToCreate = newTsName;
    const descToCreate = newTsDesc;
    const iconToCreate = newTsIcon;
    
    setNewTsName('');
    setNewTsDesc('');
    setNewTsIcon('Users');

    try {
      await api.post('/teamspaces', { 
        name: nameToCreate, 
        description: descToCreate,
        icon: iconToCreate 
      }, { headers: getAuthHeaders() });
      
      mutateTeamspaces(); // Revalida do banco
    } catch (error) {
      console.error('Error creating teamspace', error);
      alert('Failed to create teamspace');
      mutateTeamspaces(previousTeamspaces, { revalidate: false }); // Rollback
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTeamspace = async (id: string) => {
    // Optimistic UI para deleção
    const previousTeamspaces = teamspaces || [];
    const nextTeamspaces = previousTeamspaces.filter(ts => String(ts.id) !== String(id));
    
    mutateTeamspaces(nextTeamspaces, { revalidate: false });

    try {
      console.log('Tentando deletar Teamspace ID:', id);
      await api.delete(`/teamspaces/${id}`, { headers: getAuthHeaders() });
      mutateTeamspaces();
      window.dispatchEvent(new CustomEvent('mutate-documents'));
    } catch (error) {
      console.error('Failed to delete teamspace', error);
      alert('Failed to delete teamspace');
      mutateTeamspaces(previousTeamspaces, { revalidate: false }); // Rollback
    }
  };

  const handleRowClick = (tsId: string) => {
    // Navigate to the main workspace (home) for now, maybe with a query param if needed
    // The user asked to "ser levado para a view principal desse Teamspace na Sidebar"
    // Since we don't have a specific teamspace page yet, we can redirect to home.
    router.push('/');
  };

  const renderIcon = (iconName: string | undefined) => {
    if (iconName && typeof iconName === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const IconComponent = (LucideIcons as any)[iconName];
      if (IconComponent) {
        return <IconComponent size={16} className="text-[#a3a3a3]" />;
      }
    }
    return <Users size={16} className="text-[#a3a3a3]" />;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#191919] text-[#d4d4d4] p-8 md:p-12 h-screen font-sans">
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Library</h1>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#2383e2] hover:bg-[#2383e2]/90 text-white font-medium px-4 py-2 h-9 rounded-md shadow-sm">
                New teamspace
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#191919] border-white/5 text-[#d4d4d4] sm:max-w-[425px]">
              <form onSubmit={handleCreateTeamspace}>
                <DialogHeader>
                  <DialogTitle className="text-white">Create a new teamspace</DialogTitle>
                  <DialogDescription className="text-[#9b9b9b]">
                    Teamspaces are where your team organizes pages, permissions, and settings.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <span className="text-sm font-medium text-white">Icon</span>
                    <IconPicker icon={newTsIcon} onSelect={setNewTsIcon}>
                      <Button type="button" variant="outline" className="w-12 h-12 p-0 bg-[#2c2c2c] border-white/5 hover:bg-[#3f3f3f] text-white">
                        {renderIcon(newTsIcon)}
                      </Button>
                    </IconPicker>
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="name" className="text-sm font-medium text-white">Name</label>
                    <Input
                      id="name"
                      value={newTsName}
                      onChange={(e) => setNewTsName(e.target.value)}
                      placeholder="e.g. Engineering, Marketing..."
                      className="bg-[#2c2c2c] border-white/5 text-white focus-visible:ring-1 focus-visible:ring-white/20"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="description" className="text-sm font-medium text-white">Description</label>
                    <Input
                      id="description"
                      value={newTsDesc}
                      onChange={(e) => setNewTsDesc(e.target.value)}
                      placeholder="What is this teamspace for?"
                      className="bg-[#2c2c2c] border-white/5 text-white focus-visible:ring-1 focus-visible:ring-white/20"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setIsCreateModalOpen(false)}
                    className="hover:bg-white/5 text-[#d4d4d4] hover:text-white"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating || !newTsName.trim()} className="bg-[#2383e2] hover:bg-[#2383e2]/90 text-white">
                    {isCreating ? 'Creating...' : 'Create teamspace'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="teamspaces" className="w-full">
          <div className="flex items-center justify-between border-b border-white/5 mb-6 pb-2">
            <TabsList className="bg-transparent h-auto p-0 flex gap-2">
              <TabsTrigger value="teamspaces" className="data-[state=active]:bg-[#2c2c2c] data-[state=active]:text-white text-[#9b9b9b] px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                <Globe className="w-4 h-4 mr-2" />
                Teamspaces
              </TabsTrigger>
              <TabsTrigger value="recents" className="data-[state=active]:bg-[#2c2c2c] data-[state=active]:text-white text-[#9b9b9b] px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                <Clock className="w-4 h-4 mr-2" />
                Recents
              </TabsTrigger>
              <TabsTrigger value="favorites" className="data-[state=active]:bg-[#2c2c2c] data-[state=active]:text-white text-[#9b9b9b] px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                <Star className="w-4 h-4 mr-2" />
                Favorites
              </TabsTrigger>
              <TabsTrigger value="shared" className="data-[state=active]:bg-[#2c2c2c] data-[state=active]:text-white text-[#9b9b9b] px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                <Users className="w-4 h-4 mr-2" />
                Shared
              </TabsTrigger>
              <TabsTrigger value="private" className="data-[state=active]:bg-[#2c2c2c] data-[state=active]:text-white text-[#9b9b9b] px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                <Lock className="w-4 h-4 mr-2" />
                Private
              </TabsTrigger>
              <TabsTrigger value="ai-notes" className="data-[state=active]:bg-[#2c2c2c] data-[state=active]:text-white text-[#9b9b9b] px-3 py-1.5 rounded-md text-sm font-medium transition-colors">
                <FileText className="w-4 h-4 mr-2" />
                AI Meeting Notes
              </TabsTrigger>
            </TabsList>
            
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[#9b9b9b] w-4 h-4" />
              <Input 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 bg-transparent border-none text-white placeholder:text-[#9b9b9b] focus-visible:ring-0 w-32 md:w-48 h-8 text-sm"
              />
            </div>
          </div>

          <TabsContent value="teamspaces" className="m-0">
            <div className="w-full">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/5 hover:bg-transparent">
                    <TableHead className="text-[#9b9b9b] font-medium w-[40%] py-4">
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4" />
                        Name
                      </div>
                    </TableHead>
                    <TableHead className="text-[#9b9b9b] font-medium w-[30%] py-4">
                      <div className="flex items-center gap-2">
                        <AlignLeft className="w-4 h-4" />
                        Description
                      </div>
                    </TableHead>
                    <TableHead className="text-[#9b9b9b] font-medium w-[15%] py-4">
                      <div className="flex items-center gap-2">
                        <Network className="w-4 h-4" />
                        Access
                      </div>
                    </TableHead>
                    <TableHead className="text-[#9b9b9b] font-medium w-[15%] py-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Members
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-white/5">
                  {filteredTeamspaces.length === 0 ? (
                    <TableRow className="border-b-0 hover:bg-transparent">
                      <TableCell colSpan={4} className="text-center py-8 text-[#9b9b9b]">
                        Nenhum projeto encontrado aqui
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTeamspaces.map((ts) => {
                      const isExpanded = !!expandedTeamspaces[ts.id];
                      const tsDocs = documents.filter(doc => doc.teamspace_id === ts.id && !doc.is_trash && doc.parent_id !== 'meetings');

                      return (
                        <React.Fragment key={ts.id}>
                          <TeamspaceContextMenu teamspaceId={ts.id} teamspaceName={ts.name} onDelete={handleDeleteTeamspace}>
                            <TableRow 
                              className="border-b-0 hover:bg-white/5 cursor-pointer transition-colors group/row"
                              onClick={() => setExpandedTeamspaces(prev => ({ ...prev, [ts.id]: !prev[ts.id] }))}
                            >
                              <TableCell className="font-medium py-4 text-white">
                                <div className="flex items-center gap-2">
                                  <button 
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setExpandedTeamspaces(prev => ({ ...prev, [ts.id]: !prev[ts.id] }));
                                    }}
                                    className="p-1 hover:bg-[#3f3f3f] rounded transition-colors"
                                  >
                                    <ChevronDown className={`w-4 h-4 text-[#9b9b9b] transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                                  </button>
                                  <div className="flex items-center gap-2">
                                    <span>{renderIcon(ts.icon)}</span>
                                    <span className="truncate">{ts.name}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-[#9b9b9b] py-4">
                                <span className="line-clamp-1">{ts.description || '-'}</span>
                              </TableCell>
                              <TableCell className="text-[#9b9b9b] py-4">
                                <div className="flex items-center gap-2">
                                  <Network className="w-4 h-4" />
                                  Default
                                </div>
                              </TableCell>
                              <TableCell className="text-[#9b9b9b] py-4">
                                {ts.member_count}
                              </TableCell>
                            </TableRow>
                          </TeamspaceContextMenu>
                          
                          {isExpanded && tsDocs.map(doc => (
                            <TableRow 
                              key={doc.id}
                              className="border-b-0 hover:bg-[#2c2c2c] cursor-pointer transition-colors"
                              onClick={() => router.push(`/documents/${doc.id}`)}
                            >
                              <TableCell className="font-medium py-2 text-white pl-12">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-[#9b9b9b]" />
                                  <span className="truncate text-sm text-[#d4d4d4] group-hover:text-white transition-colors">{doc.title || 'Untitled'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-[#9b9b9b] py-2 text-sm">
                                Document
                              </TableCell>
                              <TableCell className="text-[#9b9b9b] py-2 text-sm">
                                Inherited
                              </TableCell>
                              <TableCell className="text-[#9b9b9b] py-2 text-sm">
                                -
                              </TableCell>
                            </TableRow>
                          ))}
                          {isExpanded && tsDocs.length === 0 && (
                            <TableRow className="border-b-0 hover:bg-transparent">
                              <TableCell colSpan={4} className="text-[#9b9b9b] py-2 text-sm pl-12">
                                No pages inside
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="recents" className="m-0">
            <div className="w-full">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/5 hover:bg-transparent">
                    <TableHead className="text-[#9b9b9b] font-medium w-[40%] py-4">Name</TableHead>
                    <TableHead className="text-[#9b9b9b] font-medium w-[30%] py-4">Last Edited</TableHead>
                    <TableHead className="text-[#9b9b9b] font-medium w-[30%] py-4">Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-white/5">
                  {documents
                    .filter(doc => !doc.is_trash)
                    .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
                    .map(doc => (
                      <TableRow 
                        key={doc.id}
                        className="border-b-0 hover:bg-[#2c2c2c] cursor-pointer transition-colors group"
                        onClick={() => router.push(`/documents/${doc.id}`)}
                      >
                        <TableCell className="font-medium py-4 text-white">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#9b9b9b]" />
                            <span className="truncate group-hover:text-white transition-colors">{doc.title || 'Untitled'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-[#9b9b9b] py-4">
                          {new Date(doc.updated_at || Date.now()).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-[#9b9b9b] py-4">
                          {doc.teamspace_id ? teamspaces.find(ts => ts.id === doc.teamspace_id)?.name || 'Teamspace' : 'Private'}
                        </TableCell>
                      </TableRow>
                    ))}
                  {documents.filter(doc => !doc.is_trash).length === 0 && (
                    <TableRow className="border-b-0 hover:bg-transparent">
                      <TableCell colSpan={3} className="text-center py-8 text-[#9b9b9b]">
                        Nenhum projeto encontrado aqui
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="favorites" className="m-0">
            <div className="w-full">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/5 hover:bg-transparent">
                    <TableHead className="text-[#9b9b9b] font-medium w-[40%] py-4">Name</TableHead>
                    <TableHead className="text-[#9b9b9b] font-medium w-[30%] py-4">Last Edited</TableHead>
                    <TableHead className="text-[#9b9b9b] font-medium w-[30%] py-4">Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-white/5">
                  {documents
                    .filter(doc => !doc.is_trash && doc.is_favorite)
                    .map(doc => (
                      <TableRow 
                        key={doc.id}
                        className="border-b-0 hover:bg-[#2c2c2c] cursor-pointer transition-colors group"
                        onClick={() => router.push(`/documents/${doc.id}`)}
                      >
                        <TableCell className="font-medium py-4 text-white">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#9b9b9b]" />
                            <span className="truncate group-hover:text-white transition-colors">{doc.title || 'Untitled'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-[#9b9b9b] py-4">
                          {new Date(doc.updated_at || Date.now()).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-[#9b9b9b] py-4">
                          {doc.teamspace_id ? teamspaces.find(ts => ts.id === doc.teamspace_id)?.name || 'Teamspace' : 'Private'}
                        </TableCell>
                      </TableRow>
                    ))}
                  {documents.filter(doc => !doc.is_trash && doc.is_favorite).length === 0 && (
                    <TableRow className="border-b-0 hover:bg-transparent">
                      <TableCell colSpan={3} className="text-center py-8 text-[#9b9b9b]">
                        Nenhum projeto encontrado aqui
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="shared" className="m-0">
            <div className="w-full">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/5 hover:bg-transparent">
                    <TableHead className="text-[#9b9b9b] font-medium w-[40%] py-4">Name</TableHead>
                    <TableHead className="text-[#9b9b9b] font-medium w-[30%] py-4">Last Edited</TableHead>
                    <TableHead className="text-[#9b9b9b] font-medium w-[30%] py-4">Owner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-white/5">
                  {documents
                    .filter(doc => !doc.is_trash && doc.is_shared_with_me)
                    .map(doc => (
                      <TableRow 
                        key={doc.id}
                        className="border-b-0 hover:bg-[#2c2c2c] cursor-pointer transition-colors group"
                        onClick={() => router.push(`/documents/${doc.id}`)}
                      >
                        <TableCell className="font-medium py-4 text-white">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#9b9b9b]" />
                            <span className="truncate group-hover:text-white transition-colors">{doc.title || 'Untitled'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-[#9b9b9b] py-4">
                          {new Date(doc.updated_at || Date.now()).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-[#9b9b9b] py-4">
                          Shared
                        </TableCell>
                      </TableRow>
                    ))}
                  {documents.filter(doc => !doc.is_trash && doc.is_shared_with_me).length === 0 && (
                    <TableRow className="border-b-0 hover:bg-transparent">
                      <TableCell colSpan={3} className="text-center py-8 text-[#9b9b9b]">
                        Nenhum projeto encontrado aqui
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="private" className="m-0">
            <div className="w-full">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/5 hover:bg-transparent">
                    <TableHead className="text-[#9b9b9b] font-medium w-[40%] py-4">Name</TableHead>
                    <TableHead className="text-[#9b9b9b] font-medium w-[30%] py-4">Last Edited</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-white/5">
                  {documents
                    .filter(doc => !doc.is_trash && !doc.teamspace_id && !doc.is_shared_with_me && doc.parent_id !== 'meetings')
                    .map(doc => (
                      <TableRow 
                        key={doc.id}
                        className="border-b-0 hover:bg-[#2c2c2c] cursor-pointer transition-colors group"
                        onClick={() => router.push(`/documents/${doc.id}`)}
                      >
                        <TableCell className="font-medium py-4 text-white">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#9b9b9b]" />
                            <span className="truncate group-hover:text-white transition-colors">{doc.title || 'Untitled'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-[#9b9b9b] py-4">
                          {new Date(doc.updated_at || Date.now()).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  {documents.filter(doc => !doc.is_trash && !doc.teamspace_id && !doc.is_shared_with_me && doc.parent_id !== 'meetings').length === 0 && (
                    <TableRow className="border-b-0 hover:bg-transparent">
                      <TableCell colSpan={2} className="text-center py-8 text-[#9b9b9b]">
                        Nenhum projeto encontrado aqui
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="ai-notes" className="m-0">
            <div className="w-full">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-white/5 hover:bg-transparent">
                    <TableHead className="text-[#9b9b9b] font-medium w-[40%] py-4">Name</TableHead>
                    <TableHead className="text-[#9b9b9b] font-medium w-[30%] py-4">Last Edited</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-white/5">
                  {documents
                    .filter(doc => !doc.is_trash && doc.parent_id === 'meetings')
                    .map(doc => (
                      <TableRow 
                        key={doc.id}
                        className="border-b-0 hover:bg-[#2c2c2c] cursor-pointer transition-colors group"
                        onClick={() => router.push(`/documents/${doc.id}`)}
                      >
                        <TableCell className="font-medium py-4 text-white">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#9b9b9b]" />
                            <span className="truncate group-hover:text-white transition-colors">{doc.title || 'Untitled'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-[#9b9b9b] py-4">
                          {new Date(doc.updated_at || Date.now()).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  {documents.filter(doc => !doc.is_trash && doc.parent_id === 'meetings').length === 0 && (
                    <TableRow className="border-b-0 hover:bg-transparent">
                      <TableCell colSpan={2} className="text-center py-8 text-[#9b9b9b]">
                        Nenhum projeto encontrado aqui
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
