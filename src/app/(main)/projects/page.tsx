'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, MoreHorizontal, Trash2, Edit2, Briefcase, Layers, FolderKanban } from 'lucide-react';
import useSWR from 'swr';
import { api, getAuthHeaders } from '@/lib/api';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Project {
  id: string;
  name: string;
  owner_id: string;
  teamspace_id?: string;
  color: string;
  progress?: number;
}

const fetcher = async (url: string) => {
  const headers = getAuthHeaders();
  const response = await api.get(url, { headers });
  return response.data;
};

export default function ProjectsDashboard() {
  const router = useRouter();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [projectToRename, setProjectToRename] = useState<{id: string, name: string} | null>(null);
  const [renameProjectName, setRenameProjectName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    const wsId = localStorage.getItem('activeWorkspaceId');
    if (wsId) setActiveWorkspaceId(wsId);
    
    const handleWorkspaceChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setActiveWorkspaceId(customEvent.detail);
    };
    
    window.addEventListener('workspaceChanged', handleWorkspaceChange);
    return () => window.removeEventListener('workspaceChanged', handleWorkspaceChange);
  }, []);

  const { data: projectsData, mutate: mutateProjects } = useSWR<Project[]>(activeWorkspaceId ? `/projects?workspace_id=${activeWorkspaceId}` : null, fetcher);
  const projects = projectsData || [];

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || isCreating) return;

    try {
      setIsCreating(true);
      await api.post('/projects', {
        name: newProjectName.trim(),
        workspace_id: activeWorkspaceId
      });
      mutateProjects();
      setNewProjectName('');
      setIsCreateOpen(false);
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? All its tasks will be permanently removed.`)) {
      try {
        await api.delete(`/projects/${id}`);
        mutateProjects();
      } catch (error) {
        console.error('Failed to delete project:', error);
      }
    }
  };

  const handleRenameProjectClick = (id: string, currentName: string) => {
    setProjectToRename({ id, name: currentName });
    setRenameProjectName(currentName);
    setIsRenameOpen(true);
  };

  const handleRenameProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectToRename || !renameProjectName.trim() || isRenaming || renameProjectName.trim() === projectToRename.name) {
        setIsRenameOpen(false);
        return;
    }

    try {
      setIsRenaming(true);
      await api.patch(`/projects/${projectToRename.id}`, { name: renameProjectName.trim() });
      mutateProjects();
      setIsRenameOpen(false);
    } catch (error) {
      console.error('Failed to rename project:', error);
    } finally {
      setIsRenaming(false);
      setProjectToRename(null);
    }
  };

  if (!projectsData) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-[#a3a3a3]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p>Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#d4d4d4] overflow-hidden w-full">
      {/* Header Fixo */}
      <div className="flex flex-col border-b border-white/10 shrink-0 bg-[#252525] w-full shadow-sm z-10 sticky top-0">
        <div className="flex items-center justify-between px-10 py-8">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Briefcase size={20} className="text-blue-500" />
              </div>
              Projects Dashboard
            </h1>
            <p className="text-sm text-[#8a8a8a] mt-2">Manage all your task boards and workflows in one place.</p>
          </div>
          
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-all duration-200 shadow-sm shadow-blue-900/20 active:scale-95"
          >
            <Plus size={18} />
            New Project
          </button>
        </div>
      </div>

      {/* Content - Cards Grid */}
      <div className="flex-1 overflow-auto p-10">
        <div className="max-w-7xl mx-auto">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] border-2 border-dashed border-white/10 rounded-2xl bg-[#252525]/50">
              <Briefcase size={48} className="text-[#4f4f4f] mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No projects found</h3>
              <p className="text-[#8a8a8a] mb-6 text-center max-w-md">Create your first project to start organizing your tasks, assigning members, and tracking progress.</p>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="bg-white text-black hover:bg-gray-200 px-6 py-2.5 rounded-lg font-medium transition-all duration-200 active:scale-95 shadow-sm hover:shadow-md"
              >
                Create First Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {projects.map((project) => (
                <div 
                  key={project.id}
                  onClick={() => router.push(`/projects/${project.id}`)}
                  className="group flex flex-col bg-[#1f242d] border border-[#30363d] rounded-xl p-5 hover:bg-[#252a36] hover:border-white/10 transition-all duration-300 ease-out cursor-pointer shadow-sm hover:shadow-xl hover:shadow-black/40 hover:-translate-y-1 active:scale-[0.98] relative"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(`/projects/${project.id}`);
                    }
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm bg-white/5 border border-white/10 text-[#a3a3a3]"
                    >
                      <FolderKanban size={24} />
                    </div>
                    
                    <div onClick={(e) => e.stopPropagation()} role="presentation">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger className="p-1.5 rounded-md text-[#8a8a8a] hover:text-white hover:bg-white/10 transition-colors outline-none opacity-0 group-hover:opacity-100 focus:opacity-100">
                          <MoreHorizontal size={18} />
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content className="bg-[#1f242d] border border-white/10 rounded-md shadow-2xl p-1.5 min-w-[160px] z-50">
                            <DropdownMenu.Item 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRenameProjectClick(project.id, project.name);
                              }}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-[#d4d4d4] hover:bg-white/5 rounded-sm cursor-pointer outline-none mb-1"
                            >
                              <Edit2 size={14} />
                              Rename
                            </DropdownMenu.Item>
                            <DropdownMenu.Item 
                              onClick={() => handleDeleteProject(project.id, project.name)}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 font-medium hover:bg-red-500/10 rounded-sm cursor-pointer outline-none"
                            >
                              <Trash2 size={14} />
                              Delete Project
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1 tracking-tight truncate pr-2">{project.name}</h3>
                  <div className="text-xs font-medium text-[#8a8a8a] uppercase tracking-wider pt-4 border-t border-white/5">
                    {project.teamspace_id ? 'Teamspace Project' : 'Workspace Project'}
                  </div>

                  <div className="mt-auto pt-4 flex flex-col gap-2">
                    <div className="flex justify-between text-xs text-[#8a8a8a]">
                      <span>Progress</span>
                      <span>{project.progress || 0}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#0b0e14] rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="h-full bg-gradient-to-r from-[#32ff7e] to-[#7efff5] rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(50,255,126,0.3)]"
                        style={{ width: `${project.progress || 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-[#191919] border-white/5 text-[#d4d4d4] sm:max-w-[425px]">
          <form onSubmit={handleCreateProject}>
            <DialogHeader>
              <DialogTitle className="text-white">Create New Project</DialogTitle>
              <DialogDescription className="text-[#9b9b9b]">
                A project is a central place to track all your tasks.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <span className="text-sm font-medium text-white">Project Name</span>
                <Input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Q4 Marketing Campaign..."
                  className="bg-[#2c2c2c] border-white/5 text-white placeholder:text-[#666]"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsCreateOpen(false)}
                className="bg-transparent border-white/10 text-white hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={!newProjectName.trim() || isCreating}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isCreating ? 'Creating...' : 'Create Project'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename Modal */}
      <Dialog open={isRenameOpen} onOpenChange={(open) => {
        setIsRenameOpen(open);
        if (!open) setProjectToRename(null);
      }}>
        <DialogContent className="bg-[#191919] border-white/5 text-[#d4d4d4] sm:max-w-[425px]">
          <form onSubmit={handleRenameProjectSubmit}>
            <DialogHeader>
              <DialogTitle className="text-white">Rename Project</DialogTitle>
              <DialogDescription className="text-[#9b9b9b]">
                Enter a new name for your project.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <span className="text-sm font-medium text-white">Project Name</span>
                <Input
                  value={renameProjectName}
                  onChange={(e) => setRenameProjectName(e.target.value)}
                  placeholder="e.g. Q4 Marketing Campaign..."
                  className="bg-[#2c2c2c] border-white/5 text-white placeholder:text-[#666]"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsRenameOpen(false)}
                className="bg-transparent border-white/10 text-white hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={!renameProjectName.trim() || isRenaming || (projectToRename ? renameProjectName.trim() === projectToRename.name : false)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isRenaming ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
