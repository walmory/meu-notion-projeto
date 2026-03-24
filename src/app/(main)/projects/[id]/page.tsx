'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Plus, 
  Circle, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  MoreHorizontal,
  Trash2,
  Calendar as CalendarIcon,
  User as UserIcon,
  ChevronDown,
  Flag
} from 'lucide-react';
import useSWR from 'swr';
import { api, getAuthHeaders, getUserFromToken } from '@/lib/api';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { io } from 'socket.io-client';

interface Task {
  id: string;
  project_id: string;
  title: string;
  status: 'To Do' | 'In Progress' | 'Done' | 'Stuck';
  priority: 'High' | 'Medium' | 'Low' | 'Normal';
  assigned_to: string | null;
  due_date: string | null;
  position: number;
}

interface Project {
  id: string;
  name: string;
  owner_id: string;
  workspace_id: string;
  teamspace_id?: string;
  color: string;
}

interface TeamspaceMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

const fetcher = async (url: string) => {
  const headers = getAuthHeaders();
  const response = await api.get(url, { headers });
  return response.data;
};

const STATUS_CONFIG = {
  'To Do': { color: 'bg-[#e2e2e2] text-[#333333]', icon: Circle },
  'In Progress': { color: 'bg-[#fdab3d] text-white', icon: Clock },
  'Done': { color: 'bg-[#00c875] text-white', icon: CheckCircle2 },
  'Stuck': { color: 'bg-[#e2445c] text-white', icon: AlertCircle },
};

const PRIORITY_CONFIG = {
  'High': { color: 'text-[#e2445c]', bg: 'bg-[#e2445c]/10' },
  'Medium': { color: 'text-[#fdab3d]', bg: 'bg-[#fdab3d]/10' },
  'Low': { color: 'text-[#00c875]', bg: 'bg-[#00c875]/10' },
  'Normal': { color: 'text-[#a3a3a3]', bg: 'bg-[#a3a3a3]/10' },
};

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const [userName, setUserName] = useState('User');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'members' | 'timeline'>('tasks');

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

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

  const { data: projectsData } = useSWR<Project[]>(activeWorkspaceId ? `/projects?workspace_id=${activeWorkspaceId}` : null, fetcher);
  const project = projectsData?.find(p => p.id === projectId);
  
  const { data: tasksData, mutate: mutateTasks } = useSWR<Task[]>(`/projects/${projectId}/tasks`, fetcher);
  const tasks = tasksData || [];

  // Group tasks by status
  const groupedTasks = {
    'In Progress': tasks.filter(t => t.status === 'In Progress'),
    'To Do': tasks.filter(t => t.status === 'To Do'),
    'Stuck': tasks.filter(t => t.status === 'Stuck'),
    'Done': tasks.filter(t => t.status === 'Done')
  };

  const { data: membersData } = useSWR<TeamspaceMember[]>(activeWorkspaceId ? `/workspaces/members?workspace_id=${activeWorkspaceId}` : null, fetcher);
  const members = membersData || [];

  useEffect(() => {
    const user = getUserFromToken();
    if (user && user.name) {
      setUserName(user.name);
    }
  }, []);

  useEffect(() => {
    if (!project?.workspace_id) return;
    
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
      transports: ['websocket'],
      upgrade: false
    });
    socket.emit('join-workspace', project.workspace_id);
    
    socket.on('task-updated', (updatedTask: Task) => {
      if (updatedTask.project_id === projectId) {
        mutateTasks((currentTasks = []) => {
          const exists = currentTasks.find(t => t.id === updatedTask.id);
          if (exists) {
            return currentTasks.map(t => t.id === updatedTask.id ? updatedTask : t);
          } else {
            return [...currentTasks, updatedTask];
          }
        }, { revalidate: false });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [project?.workspace_id, projectId, mutateTasks]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || isCreatingTask) return;
    
    try {
      setIsCreatingTask(true);
      await api.post(`/projects/${projectId}/tasks`, {
        title: newTaskTitle.trim()
      });
      setNewTaskTitle('');
      mutateTasks();
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      mutateTasks((current = []) => current.map(t => t.id === taskId ? { ...t, ...updates } : t), { revalidate: false });
      await api.patch(`/projects/tasks/${taskId}`, updates);
      mutateTasks();
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      mutateTasks((current = []) => current.filter(t => t.id !== taskId), { revalidate: false });
      await api.delete(`/projects/tasks/${taskId}`);
      mutateTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  if (!project) {
    return <div className="p-8 text-[#a3a3a3]">Loading project...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#191919] text-[#d4d4d4] overflow-hidden">
      {/* Header */}
      <div className="flex flex-col border-b border-white/5 shrink-0 bg-[#1f1f1f]">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-4">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="outline-none focus:outline-none flex items-center gap-2 hover:bg-white/5 px-2 py-1 -ml-2 rounded-md transition-colors">
                <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: project.color || '#3b82f6' }} />
                <h1 className="text-xl font-semibold text-white">{project.name}</h1>
                <ChevronDown size={16} className="text-[#a3a3a3]" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="bg-[#2c2c2c] border border-white/10 rounded-md shadow-xl p-1 min-w-[200px] z-50">
                  <div className="px-2 py-1.5 text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">
                    {project.teamspace_id ? 'Teamspace Projects' : 'My Projects'}
                  </div>
                  {projectsData?.filter(p => p.teamspace_id === project.teamspace_id).map(p => (
                    <DropdownMenu.Item
                      key={p.id}
                      onClick={() => router.push(`/projects/${p.id}`)}
                      className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer outline-none ${p.id === projectId ? 'bg-white/10 text-white' : 'text-[#d4d4d4] hover:bg-white/5'}`}
                    >
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color || '#3b82f6' }} />
                      <span className="truncate">{p.name}</span>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            
            <div className="h-4 w-px bg-white/10" />
            <p className="text-sm text-[#a3a3a3] flex items-center gap-2">
              <UserIcon size={14} />
              {userName}&apos;s Workspace
            </p>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex items-center gap-6 px-8 mt-2">
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'tasks' ? 'border-blue-500 text-white' : 'border-transparent text-[#a3a3a3] hover:text-[#d4d4d4]'}`}
          >
            Table
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'members' ? 'border-blue-500 text-white' : 'border-transparent text-[#a3a3a3] hover:text-[#d4d4d4]'}`}
          >
            Members
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'timeline' ? 'border-blue-500 text-white' : 'border-transparent text-[#a3a3a3] hover:text-[#d4d4d4]'}`}
          >
            Timeline
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          
          {activeTab === 'tasks' ? (
            <div className="space-y-8">
              {Object.entries(groupedTasks).map(([statusGroup, groupTasks]) => (
                <div key={statusGroup} className="bg-[#1f1f1f] border border-white/5 rounded-lg shadow-sm overflow-hidden">
                  {/* Group Header */}
                  <div className="flex items-center gap-2 px-6 py-4 bg-[#252525] border-b border-white/5">
                    <div 
                      className="w-4 h-4 rounded-sm flex items-center justify-center text-[10px] text-white" 
                      style={{ backgroundColor: STATUS_CONFIG[statusGroup as Task['status']]?.color.match(/bg-\[([^\]]+)\]/)?.[1] || '#4b5563' }}
                    >
                      {groupTasks.length}
                    </div>
                    <h2 className="text-sm font-semibold text-white">{statusGroup}</h2>
                  </div>

                  {/* Table Header */}
                  <div className="grid grid-cols-[minmax(300px,1fr)_120px_120px_150px_150px_50px] gap-2 px-6 py-2 border-b border-white/5 bg-[#2a2b2f] text-[11px] font-semibold text-[#a3a3a3] uppercase tracking-wider">
                    <div>Task Name</div>
                    <div className="text-center">Status</div>
                    <div className="text-center">Priority</div>
                    <div>Assignee</div>
                    <div>Due Date</div>
                    <div></div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-white/5">
                    {groupTasks.map(task => (
                      <div key={task.id} className="grid grid-cols-[minmax(300px,1fr)_120px_120px_150px_150px_50px] gap-2 px-6 py-1.5 items-center hover:bg-white/[0.02] transition-colors group">
                        
                        {/* Title */}
                        <div className="font-medium text-white truncate pr-4 text-sm">
                          {task.title}
                        </div>

                        {/* Status Badge with Dropdown */}
                        <div className="h-full flex items-center -mx-2">
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger className="outline-none focus:outline-none w-full h-full">
                              <div className={`flex items-center justify-center w-full h-full min-h-[36px] text-xs font-medium cursor-pointer transition-opacity hover:opacity-90 ${STATUS_CONFIG[task.status]?.color || 'bg-gray-500 text-white'}`}>
                                <span>{task.status}</span>
                              </div>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content className="bg-[#2c2c2c] border border-white/10 rounded-md shadow-xl p-1 min-w-[150px] z-50 animate-in fade-in zoom-in-95">
                                {Object.entries(STATUS_CONFIG).map(([statusName, config]) => (
                                  <DropdownMenu.Item
                                    key={statusName}
                                    onClick={() => handleUpdateTask(task.id, { status: statusName as Task['status'] })}
                                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-[#d4d4d4] rounded hover:bg-white/10 cursor-pointer outline-none"
                                  >
                                    <config.icon size={14} className={config.color.replace('bg-', 'text-').split(' ')[0]} />
                                    {statusName}
                                  </DropdownMenu.Item>
                                ))}
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        </div>

                        {/* Priority Badge with Dropdown */}
                        <div className="h-full flex items-center -mx-2">
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger className="outline-none focus:outline-none w-full h-full">
                              <div className={`flex items-center justify-center gap-1.5 w-full h-full min-h-[36px] text-xs font-medium cursor-pointer transition-opacity hover:opacity-90 ${PRIORITY_CONFIG[task.priority || 'Normal']?.bg || 'bg-gray-500/10'} ${PRIORITY_CONFIG[task.priority || 'Normal']?.color || 'text-white'}`}>
                                <Flag size={12} className={PRIORITY_CONFIG[task.priority || 'Normal']?.color} />
                                <span>{task.priority || 'Normal'}</span>
                              </div>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content className="bg-[#2c2c2c] border border-white/10 rounded-md shadow-xl p-1 min-w-[120px] z-50 animate-in fade-in zoom-in-95">
                                {Object.keys(PRIORITY_CONFIG).map((priorityName) => (
                                  <DropdownMenu.Item
                                    key={priorityName}
                                    onClick={() => handleUpdateTask(task.id, { priority: priorityName as Task['priority'] })}
                                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-[#d4d4d4] rounded hover:bg-white/10 cursor-pointer outline-none"
                                  >
                                    <Flag size={14} className={PRIORITY_CONFIG[priorityName as Task['priority']]?.color} />
                                    {priorityName}
                                  </DropdownMenu.Item>
                                ))}
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        </div>

                        {/* Assignee */}
                        <div className="h-full flex items-center">
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger className="outline-none focus:outline-none w-full h-full">
                              <div className="flex items-center gap-2 text-sm text-[#a3a3a3] hover:bg-white/5 px-2 py-1.5 rounded cursor-pointer transition-colors w-full">
                                <div className="w-6 h-6 rounded-full bg-[#3f3f3f] flex items-center justify-center text-xs text-white shrink-0">
                                  {task.assigned_to ? (members.find(m => m.user_id === task.assigned_to)?.name || task.assigned_to || 'U').charAt(0).toUpperCase() : <UserIcon size={12} />}
                                </div>
                                <span className="truncate">{task.assigned_to ? members.find(m => m.user_id === task.assigned_to)?.name || task.assigned_to : 'Unassigned'}</span>
                              </div>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content className="bg-[#2c2c2c] border border-white/10 rounded-md shadow-xl p-1 min-w-[180px] z-50 animate-in fade-in zoom-in-95">
                                <DropdownMenu.Item
                                  onClick={() => handleUpdateTask(task.id, { assigned_to: null })}
                                  className="flex items-center gap-2 px-2 py-1.5 text-sm text-[#a3a3a3] rounded hover:bg-white/10 cursor-pointer outline-none italic"
                                >
                                  <UserIcon size={14} />
                                  Unassigned
                                </DropdownMenu.Item>
                                {members.map((member) => (
                                  <DropdownMenu.Item
                                    key={member.user_id}
                                    onClick={() => handleUpdateTask(task.id, { assigned_to: member.user_id })}
                                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-[#d4d4d4] rounded hover:bg-white/10 cursor-pointer outline-none"
                                  >
                                    <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] shrink-0">
                                      {(member?.name || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <span className="truncate">{member?.name || 'Unknown User'}</span>
                                  </DropdownMenu.Item>
                                ))}
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        </div>

                        {/* Due Date */}
                        <div className="flex items-center gap-2 text-sm text-[#a3a3a3]">
                          <CalendarIcon size={14} className="opacity-50" />
                          {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger className="p-1 rounded hover:bg-white/10 text-[#a3a3a3] transition-colors outline-none">
                              <MoreHorizontal size={16} />
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content className="bg-[#2c2c2c] border border-white/10 rounded-md shadow-xl p-1 min-w-[120px] z-50">
                                <DropdownMenu.Item
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="flex items-center gap-2 px-2 py-1.5 text-sm text-red-400 rounded hover:bg-red-400/10 cursor-pointer outline-none"
                                >
                                  <Trash2 size={14} />
                                  Delete Task
                                </DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
                        </div>
                      </div>
                    ))}
                    
                    {/* Add New Task Row */}
                    <div className="px-6 py-2 bg-[#191919]/50">
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        if (!newTaskTitle.trim() || isCreatingTask) return;
                        
                        setIsCreatingTask(true);
                        api.post(`/projects/${projectId}/tasks`, {
                          title: newTaskTitle.trim(),
                          status: statusGroup
                        }).then(() => {
                          setNewTaskTitle('');
                          mutateTasks();
                        }).catch(error => {
                          console.error('Failed to create task:', error);
                        }).finally(() => {
                          setIsCreatingTask(false);
                        });
                      }} className="flex items-center gap-3">
                        <Plus size={16} className="text-[#a3a3a3]" />
                        <input
                          type="text"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder={`Add new task to ${statusGroup}...`}
                          className="flex-1 bg-transparent border-none text-sm text-white placeholder:text-[#666] focus:outline-none focus:ring-0"
                          disabled={isCreatingTask}
                        />
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === 'members' ? (
            <div className="bg-[#1f1f1f] border border-white/5 rounded-lg shadow-sm overflow-hidden p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Project Members</h2>
              <p className="text-sm text-[#a3a3a3] mb-6">
                These are the members of the {project.teamspace_id ? 'Teamspace' : 'Workspace'} who have access to this project.
              </p>
              
              <div className="grid gap-4">
                {members.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[#a3a3a3] mb-4">No members found in this teamspace.</p>
                    <button 
                      type="button"
                      onClick={() => router.push('/settings/members')}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
                    >
                      Invite Partner
                    </button>
                  </div>
                ) : (
                  members.map(member => (
                    <div key={member.user_id} className="flex items-center justify-between p-4 rounded-lg border border-white/5 bg-[#252525]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-semibold text-lg shrink-0">
                          {(member?.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-white">{member?.name || 'Unknown User'}</div>
                          <div className="text-sm text-[#a3a3a3]">{member.email}</div>
                        </div>
                      </div>
                      <div className="px-3 py-1 rounded-full bg-white/5 text-xs text-[#a3a3a3] capitalize">
                        {member.role}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#1f1f1f] border border-white/5 rounded-lg shadow-sm overflow-hidden p-6 text-center text-[#a3a3a3]">
              Timeline view coming soon...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
