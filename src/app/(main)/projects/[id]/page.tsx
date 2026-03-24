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
  ChevronDown
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
  assigned_to: string | null;
  due_date: string | null;
  position: number;
}

interface Project {
  id: string;
  name: string;
  owner_id: string;
  workspace_id: string;
  color: string;
}

const fetcher = async (url: string) => {
  const headers = getAuthHeaders();
  const response = await api.get(url, { headers });
  return response.data;
};

const STATUS_CONFIG = {
  'To Do': { color: 'bg-[#4b5563] text-white', icon: Circle },
  'In Progress': { color: 'bg-[#eab308] text-white', icon: Clock },
  'Done': { color: 'bg-[#22c55e] text-white', icon: CheckCircle2 },
  'Stuck': { color: 'bg-[#ef4444] text-white', icon: AlertCircle },
};

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const [userName, setUserName] = useState('User');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);

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

  useEffect(() => {
    const user = getUserFromToken();
    if (user && user.name) {
      setUserName(user.name);
    }
  }, []);

  useEffect(() => {
    if (!project?.workspace_id) return;
    
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
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

  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    try {
      // Optimistic update
      mutateTasks((current = []) => current.map(t => t.id === taskId ? { ...t, status: newStatus as Task['status'] } : t), { revalidate: false });
      await api.patch(`/projects/tasks/${taskId}`, { status: newStatus });
      mutateTasks();
    } catch (error) {
      console.error('Failed to update task status:', error);
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
      <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: project.color || '#3b82f6' }} />
            {project.name}
          </h1>
          <p className="text-sm text-[#a3a3a3]">Tasks for {project.name} — {userName}&apos;s Workspace</p>
        </div>
      </div>

      {/* Task Board */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-5xl mx-auto">
          
          <div className="bg-[#1f1f1f] border border-white/5 rounded-lg shadow-sm overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[minmax(300px,1fr)_150px_150px_150px_50px] gap-4 px-6 py-3 border-b border-white/5 bg-[#252525] text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">
              <div>Task Name</div>
              <div>Status</div>
              <div>Assignee</div>
              <div>Due Date</div>
              <div></div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-white/5">
              {tasks.map(task => (
                <div key={task.id} className="grid grid-cols-[minmax(300px,1fr)_150px_150px_150px_50px] gap-4 px-6 py-3 items-center hover:bg-white/[0.02] transition-colors group">
                  
                  {/* Title */}
                  <div className="font-medium text-white truncate pr-4">
                    {task.title}
                  </div>

                  {/* Status Badge with Dropdown */}
                  <div>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger className="outline-none focus:outline-none w-full">
                        <div className={`flex items-center justify-between w-full px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-opacity hover:opacity-90 ${STATUS_CONFIG[task.status]?.color || 'bg-gray-500 text-white'}`}>
                          <span>{task.status}</span>
                          <ChevronDown size={14} className="opacity-50" />
                        </div>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content className="bg-[#2c2c2c] border border-white/10 rounded-md shadow-xl p-1 min-w-[150px] z-50 animate-in fade-in zoom-in-95">
                          {Object.entries(STATUS_CONFIG).map(([statusName, config]) => (
                            <DropdownMenu.Item
                              key={statusName}
                              onClick={() => handleUpdateStatus(task.id, statusName)}
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

                  {/* Assignee */}
                  <div className="flex items-center gap-2 text-sm text-[#a3a3a3]">
                    <div className="w-6 h-6 rounded-full bg-[#3f3f3f] flex items-center justify-center text-xs text-white shrink-0">
                      {task.assigned_to ? task.assigned_to.charAt(0).toUpperCase() : <UserIcon size={12} />}
                    </div>
                    <span className="truncate">{task.assigned_to || 'Unassigned'}</span>
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
              <div className="px-6 py-3 bg-[#191919]/50">
                <form onSubmit={handleCreateTask} className="flex items-center gap-3">
                  <Plus size={16} className="text-[#a3a3a3]" />
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Add new task..."
                    className="flex-1 bg-transparent border-none text-sm text-white placeholder:text-[#666] focus:outline-none focus:ring-0"
                    disabled={isCreatingTask}
                  />
                </form>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
