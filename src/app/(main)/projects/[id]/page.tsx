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
  Flag,
  X
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
  description?: string | null;
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
  name?: string;
  email?: string;
  user_name?: string;
  user_email?: string;
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

const STATUS_LABELS: Record<Task['status'], string> = {
  'To Do': 'To Do',
  'In Progress': 'Working on it',
  'Done': 'Done',
  'Stuck': 'Stuck'
};

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const [userName] = useState(() => {
    const user = getUserFromToken();
    return user?.name || 'User';
  });
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'members' | 'timeline'>('tasks');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [drawerDescription, setDrawerDescription] = useState('');
  const [drawerPriority, setDrawerPriority] = useState<Task['priority']>('Normal');
  const [drawerAssignee, setDrawerAssignee] = useState<string | null>(null);
  const [drawerDueDate, setDrawerDueDate] = useState('');

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('activeWorkspaceId');
  });

  useEffect(() => {
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

  const { data: workspaceMembersData } = useSWR<TeamspaceMember[]>(
    project ? `/workspace/members?workspace_id=${project.workspace_id}` : null,
    fetcher
  );

  const { data: teamspaceMembersData } = useSWR<TeamspaceMember[]>(
    project?.teamspace_id ? `/teamspaces/${project.teamspace_id}/members` : null,
    fetcher
  );

  const membersSource = project?.teamspace_id && teamspaceMembersData && teamspaceMembersData.length > 0
    ? teamspaceMembersData
    : workspaceMembersData;

  const members = (membersSource || []).map((member) => ({
    ...member,
    name: member.name || member.user_name || member.email || member.user_email || 'Unknown User',
    email: member.email || member.user_email || ''
  }));

  useEffect(() => {
    if (!project?.workspace_id) return;
    
    const socketUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin.replace('3000', '3001') : 'http://localhost:3001');
    const socket = io(socketUrl, {
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

  const handleStartInlineEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTaskTitle(task.title || '');
  };

  const handleSaveInlineEdit = async () => {
    if (!editingTaskId) return;
    const title = editingTaskTitle.trim();
    if (!title) {
      setEditingTaskId(null);
      setEditingTaskTitle('');
      return;
    }
    await handleUpdateTask(editingTaskId, { title });
    setEditingTaskId(null);
    setEditingTaskTitle('');
  };

  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) || null : null;

  const openTaskDrawer = (task: Task) => {
    setSelectedTaskId(task.id);
    setDrawerDescription(task.description || '');
    setDrawerPriority(task.priority || 'Normal');
    setDrawerAssignee(task.assigned_to || null);
    setDrawerDueDate(task.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : '');
  };

  const handleSaveDrawer = async () => {
    if (!selectedTaskId) return;
    await handleUpdateTask(selectedTaskId, {
      description: drawerDescription || null,
      priority: drawerPriority,
      assigned_to: drawerAssignee,
      due_date: drawerDueDate || null
    });
  };

  const completedTasks = tasks.filter(t => t.status === 'Done').length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  if (!projectsData || !workspaceMembersData) {
    return (
      <div className="flex items-center justify-center h-full bg-[#191919] text-[#a3a3a3]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p>Loading project data...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return <div className="p-8 text-[#a3a3a3] bg-[#191919] h-full">Project not found or you don&apos;t have access.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-[#d4d4d4] overflow-hidden w-full">
      {/* Header Fixo de Topo */}
      <div className="flex flex-col border-b border-white/10 shrink-0 bg-[#252525] w-full shadow-sm z-10 sticky top-0">
        <div className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="outline-none focus:outline-none flex items-center gap-2 hover:bg-white/5 px-2 py-1 -ml-2 rounded-md transition-colors">
                <div className="w-5 h-5 rounded-md flex items-center justify-center shadow-sm" style={{ backgroundColor: project.color || '#3b82f6' }}>
                  <span className="text-white text-xs font-bold">{project.name.charAt(0).toUpperCase()}</span>
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{project.name}</h1>
                <ChevronDown size={18} className="text-[#8a8a8a] mt-1" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="bg-[#2c2c2c] border border-white/10 rounded-md shadow-2xl p-1 min-w-[220px] z-50">
                  <div className="px-2 py-2 text-[11px] font-semibold text-[#8a8a8a] uppercase tracking-wider">
                    {project.teamspace_id ? 'Teamspace Projects' : 'My Projects'}
                  </div>
                  {projectsData?.filter(p => p.teamspace_id === project.teamspace_id).map(p => (
                    <DropdownMenu.Item
                      key={p.id}
                      onClick={() => router.push(`/projects/${p.id}`)}
                      className={`flex items-center gap-3 px-2 py-2 text-sm rounded cursor-pointer outline-none ${p.id === projectId ? 'bg-blue-500/10 text-blue-400 font-medium' : 'text-[#d4d4d4] hover:bg-white/5'}`}
                    >
                      <div className="w-4 h-4 rounded-sm shadow-sm" style={{ backgroundColor: p.color || '#3b82f6' }} />
                      <span className="truncate">{p.name}</span>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            
            <div className="h-5 w-px bg-white/10 ml-2" />
            <p className="text-[13px] font-medium text-[#8a8a8a] flex items-center gap-2 ml-2">
              <UserIcon size={14} />
              {userName}&apos;s Workspace
            </p>
          </div>
          
          {/* Progress Bar */}
          <div className="flex items-center gap-3 bg-[#191919] px-3 py-1.5 rounded-full border border-white/5">
            <div className="text-[12px] font-semibold text-[#8a8a8a]">Progress</div>
            <div className="w-32 h-1.5 bg-[#2c2c2c] rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="text-[12px] font-bold text-white min-w-[3ch]">{progressPercentage}%</div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex items-center gap-8 px-8 mt-1">
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`pb-3 text-[13px] font-semibold tracking-wide border-b-2 transition-colors ${activeTab === 'tasks' ? 'border-blue-500 text-blue-400' : 'border-transparent text-[#8a8a8a] hover:text-[#d4d4d4]'}`}
          >
            Tasks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`pb-3 text-[13px] font-semibold tracking-wide border-b-2 transition-colors ${activeTab === 'members' ? 'border-blue-500 text-blue-400' : 'border-transparent text-[#8a8a8a] hover:text-[#d4d4d4]'}`}
          >
            Members
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`pb-3 text-[13px] font-semibold tracking-wide border-b-2 transition-colors ${activeTab === 'timeline' ? 'border-blue-500 text-blue-400' : 'border-transparent text-[#8a8a8a] hover:text-[#d4d4d4]'}`}
          >
            Timeline
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8 relative">
        <div className="max-w-7xl mx-auto">
          
          {activeTab === 'tasks' ? (
            <div className="bg-[#1f1f1f] border border-white/10 rounded-lg shadow-xl overflow-hidden flex flex-col">
              
              {/* Table Global Header */}
              <div className="grid grid-cols-[minmax(350px,1fr)_140px_140px_180px_150px_50px] gap-0 border-b border-white/10 bg-[#2a2b2f] text-[11px] font-semibold text-[#8a8a8a] uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                <div className="px-6 py-3 border-r border-white/5">Task Name</div>
                <div className="px-6 py-3 border-r border-white/5 text-center">Status</div>
                <div className="px-6 py-3 border-r border-white/5 text-center">Priority</div>
                <div className="px-6 py-3 border-r border-white/5">Assignee</div>
                <div className="px-6 py-3 border-r border-white/5">Due Date</div>
                <div className="px-6 py-3"></div>
              </div>

              {/* Table Body - Single Table with Sticky Groups */}
              <div className="flex flex-col bg-[#191919]">
                {Object.entries(groupedTasks).map(([statusGroup, groupTasks]) => (
                  <div key={statusGroup} className="flex flex-col">
                    
                    {/* Group Sticky Header */}
                    <div className="sticky top-[45px] z-10 flex items-center gap-3 px-6 py-2.5 bg-[#252525] border-b border-white/5 shadow-sm group/header">
                      <div 
                        className="w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold text-white shadow-sm" 
                        style={{ backgroundColor: STATUS_CONFIG[statusGroup as Task['status']]?.color.match(/bg-\[([^\]]+)\]/)?.[1] || '#4b5563' }}
                      >
                        {groupTasks.length}
                      </div>
                      <h2 className="text-[13px] font-semibold text-white tracking-wide" style={{ color: STATUS_CONFIG[statusGroup as Task['status']]?.color.match(/bg-\[([^\]]+)\]/)?.[1] || '#ffffff' }}>
                        {STATUS_LABELS[statusGroup as Task['status']]}
                      </h2>
                      <div className="h-px flex-1 bg-white/5 ml-4 group-hover/header:bg-white/10 transition-colors" />
                    </div>

                    {/* Group Tasks */}
                    <div className="flex flex-col">
                      {groupTasks.map(task => (
                        <div key={task.id} className="grid grid-cols-[minmax(350px,1fr)_140px_140px_180px_150px_50px] gap-0 items-stretch border-b border-white/5 hover:bg-white/[0.03] transition-colors group/row bg-[#1e1e1e]">
                          
                          {/* Title */}
                          <div className="px-6 py-3 border-r border-white/5 flex items-center group-hover/row:bg-white/[0.01] transition-colors relative">
                            <div className="w-1.5 h-full absolute left-0 top-0 bottom-0 transition-opacity" style={{ backgroundColor: STATUS_CONFIG[statusGroup as Task['status']]?.color.match(/bg-\[([^\]]+)\]/)?.[1] || '#4b5563' }} />
                            {editingTaskId === task.id ? (
                              <input
                                value={editingTaskTitle}
                                onChange={(e) => setEditingTaskTitle(e.target.value)}
                                onBlur={handleSaveInlineEdit}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveInlineEdit();
                                  if (e.key === 'Escape') {
                                    setEditingTaskId(null);
                                    setEditingTaskTitle('');
                                  }
                                }}
                                className="w-full bg-transparent border-none outline-none text-[13px] font-medium text-white pl-2"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openTaskDrawer(task);
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  handleStartInlineEdit(task);
                                }}
                                className="font-medium text-[#d4d4d4] truncate text-[13px] group-hover/row:text-white transition-colors pl-2 text-left w-full"
                              >
                                {task.title}
                              </button>
                            )}
                          </div>

                          {/* Status Badge with Dropdown - Full Cell */}
                          <div className="border-r border-white/5 relative">
                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger className="outline-none focus:outline-none w-full h-full absolute inset-0">
                                <div className={`flex items-center justify-center w-full h-full text-[12px] font-semibold tracking-wide cursor-pointer transition-all hover:brightness-110 ${STATUS_CONFIG[task.status]?.color || 'bg-gray-500 text-white'}`}>
                                  <span className="font-bold">{STATUS_LABELS[task.status]}</span>
                                </div>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Portal>
                                <DropdownMenu.Content className="bg-[#2c2c2c] border border-white/10 rounded-md shadow-2xl p-1.5 min-w-[160px] z-50 animate-in fade-in zoom-in-95">
                                  {Object.entries(STATUS_CONFIG).map(([statusName, config]) => (
                                    <DropdownMenu.Item
                                      key={statusName}
                                      onClick={() => handleUpdateTask(task.id, { status: statusName as Task['status'] })}
                                      className="flex items-center gap-3 px-3 py-2 text-[13px] text-[#d4d4d4] rounded-sm hover:bg-white/10 cursor-pointer outline-none mb-0.5 last:mb-0"
                                    >
                                      <div className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: config.color.match(/bg-\[([^\]]+)\]/)?.[1] || '#4b5563' }} />
                                      {STATUS_LABELS[statusName as Task['status']]}
                                    </DropdownMenu.Item>
                                  ))}
                                </DropdownMenu.Content>
                              </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                          </div>

                          {/* Priority Badge with Dropdown - Full Cell */}
                          <div className="border-r border-white/5 relative">
                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger className="outline-none focus:outline-none w-full h-full absolute inset-0">
                                <div className={`flex items-center justify-center gap-2 w-full h-full text-[12px] font-semibold tracking-wide cursor-pointer transition-all hover:brightness-110 ${PRIORITY_CONFIG[task.priority || 'Normal']?.bg || 'bg-gray-500/10'} ${PRIORITY_CONFIG[task.priority || 'Normal']?.color || 'text-white'}`}>
                                  <Flag size={14} className="opacity-80" />
                                  <span>{task.priority || 'Normal'}</span>
                                </div>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Portal>
                                <DropdownMenu.Content className="bg-[#2c2c2c] border border-white/10 rounded-md shadow-2xl p-1.5 min-w-[160px] z-50 animate-in fade-in zoom-in-95">
                                  {Object.keys(PRIORITY_CONFIG).map((priorityName) => (
                                    <DropdownMenu.Item
                                      key={priorityName}
                                      onClick={() => handleUpdateTask(task.id, { priority: priorityName as Task['priority'] })}
                                      className="flex items-center gap-3 px-3 py-2 text-[13px] text-[#d4d4d4] rounded-sm hover:bg-white/10 cursor-pointer outline-none mb-0.5 last:mb-0"
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
                          <div className="px-4 py-2 border-r border-white/5 flex items-center justify-center">
                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger className="outline-none focus:outline-none w-full">
                                <div className="flex items-center justify-center gap-3 text-[13px] text-[#8a8a8a] hover:bg-white/5 px-3 py-1.5 rounded-full cursor-pointer transition-colors w-fit mx-auto border border-transparent hover:border-white/10">
                                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[11px] font-bold text-blue-400 shrink-0 shadow-sm ring-1 ring-blue-500/30">
                                    {task.assigned_to ? ((members.find(m => m.user_id === task.assigned_to)?.name?.charAt(0) || members.find(m => m.user_id === task.assigned_to)?.email?.charAt(0) || '?').toUpperCase()) : <UserIcon size={12} className="text-[#8a8a8a]" />}
                                  </div>
                                  <span className="truncate max-w-[100px] font-medium group-hover/row:text-[#d4d4d4] transition-colors">{task.assigned_to ? members.find(m => m.user_id === task.assigned_to)?.name || task.assigned_to : 'Assign'}</span>
                                </div>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Portal>
                                <DropdownMenu.Content className="bg-[#2c2c2c] border border-white/10 rounded-md shadow-2xl p-1.5 min-w-[200px] z-50 animate-in fade-in zoom-in-95">
                                  <DropdownMenu.Item
                                    onClick={() => handleUpdateTask(task.id, { assigned_to: null })}
                                    className="flex items-center gap-3 px-3 py-2 text-[13px] text-[#8a8a8a] rounded-sm hover:bg-white/10 cursor-pointer outline-none italic mb-1"
                                  >
                                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                                      <UserIcon size={12} />
                                    </div>
                                    Unassigned
                                  </DropdownMenu.Item>
                                  <div className="h-px w-full bg-white/5 mb-1" />
                                  {members.map((member) => (
                                    <DropdownMenu.Item
                                      key={member.user_id}
                                      onClick={() => handleUpdateTask(task.id, { assigned_to: member.user_id })}
                                      className="flex items-center gap-3 px-3 py-2 text-[13px] text-[#d4d4d4] rounded-sm hover:bg-white/10 cursor-pointer outline-none mb-0.5 last:mb-0"
                                    >
                                      <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[11px] font-bold shrink-0 shadow-sm ring-1 ring-blue-500/30">
                                        {(member?.name || '?').charAt(0).toUpperCase()}
                                      </div>
                                      <span className="truncate font-medium">{member?.name || member?.email || 'Unknown User'}</span>
                                    </DropdownMenu.Item>
                                  ))}
                                </DropdownMenu.Content>
                              </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                          </div>

                          {/* Due Date */}
                          <div className="px-6 py-3 border-r border-white/5 flex items-center justify-center gap-2 text-[13px] text-[#8a8a8a] group-hover/row:text-[#d4d4d4] transition-colors">
                            <CalendarIcon size={14} className="opacity-50" />
                            {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                          </div>

                          {/* Actions */}
                          <div className="px-2 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger className="p-1.5 rounded-md hover:bg-white/10 text-[#8a8a8a] hover:text-white transition-colors outline-none">
                                <MoreHorizontal size={16} />
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Portal>
                                <DropdownMenu.Content className="bg-[#2c2c2c] border border-white/10 rounded-md shadow-2xl p-1.5 min-w-[140px] z-50">
                                  <DropdownMenu.Item
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="flex items-center gap-3 px-3 py-2 text-[13px] text-red-400 font-medium rounded-sm hover:bg-red-500/10 cursor-pointer outline-none"
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
                      
                      {/* Add New Task Row for Group */}
                      <div className="grid grid-cols-1 border-b border-white/5 bg-[#191919]">
                        <div className="px-6 py-2">
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
                          }} className="flex items-center gap-3 w-full">
                            <Plus size={16} className="text-[#8a8a8a]" />
                            <input
                              type="text"
                              value={newTaskTitle}
                              onChange={(e) => setNewTaskTitle(e.target.value)}
                              placeholder={`+ Add task to ${statusGroup}...`}
                              className="flex-1 bg-transparent border-none text-[13px] text-white placeholder:text-[#666] focus:outline-none focus:ring-0 py-1"
                              disabled={isCreatingTask}
                            />
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
                    <p className="text-[#a3a3a3] mb-4">No members found in this workspace.</p>
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
                          {(member?.name?.charAt(0) || member?.email?.charAt(0) || '?').toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-white">{member?.name || member?.email || 'Unknown User'}</div>
                          <div className="text-sm text-[#a3a3a3]">{member.email || member.user_email || '-'}</div>
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

      {selectedTask && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
          <div className="h-full w-full max-w-md bg-[#1f1f1f] border-l border-white/10 shadow-2xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-white">Task Details</h3>
              <button
                type="button"
                onClick={() => setSelectedTaskId(null)}
                className="p-2 rounded-md text-[#a3a3a3] hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <div className="text-xs font-semibold text-[#8a8a8a] uppercase tracking-wide mb-2">Description</div>
                <textarea
                  value={drawerDescription}
                  onChange={(e) => setDrawerDescription(e.target.value)}
                  rows={5}
                  className="w-full bg-[#252525] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  placeholder="Add task description..."
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-[#8a8a8a] uppercase tracking-wide mb-2">Priority</div>
                <select
                  value={drawerPriority}
                  onChange={(e) => setDrawerPriority(e.target.value as Task['priority'])}
                  className="w-full bg-[#252525] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                >
                  {Object.keys(PRIORITY_CONFIG).map((priority) => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs font-semibold text-[#8a8a8a] uppercase tracking-wide mb-2">Assignee</div>
                <select
                  value={drawerAssignee || ''}
                  onChange={(e) => setDrawerAssignee(e.target.value || null)}
                  className="w-full bg-[#252525] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.name || member.email || 'Unknown User'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs font-semibold text-[#8a8a8a] uppercase tracking-wide mb-2">Deadline</div>
                <input
                  type="date"
                  value={drawerDueDate}
                  onChange={(e) => setDrawerDueDate(e.target.value)}
                  className="w-full bg-[#252525] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedTaskId(null)}
                className="px-3 py-2 rounded-md text-sm text-[#a3a3a3] hover:text-white hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleSaveDrawer();
                  setSelectedTaskId(null);
                }}
                className="px-4 py-2 rounded-md text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
