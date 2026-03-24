'use client';

import { useEffect, useState, type ReactNode } from 'react';
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
  X,
  ArrowLeft,
} from 'lucide-react';
import useSWR from 'swr';
import { api, getAuthHeaders, getUserFromToken } from '@/lib/api';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { io } from 'socket.io-client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
  'To Do': { color: 'bg-[#6b7280] text-white', icon: Circle },
  'In Progress': { color: 'bg-[#3b82f6] text-white', icon: Clock },
  'Done': { color: 'bg-[#22c55e] text-white', icon: CheckCircle2 },
  'Stuck': { color: 'bg-[#ef4444] text-white', icon: AlertCircle },
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

const STATUS_ORDER: Task['status'][] = ['To Do', 'In Progress', 'Done'];

const getStatusDropId = (status: Task['status']) => `status:${status}`;

interface KanbanCardProps {
  task: Task;
  members: TeamspaceMember[];
  statusGroup: string;
  handleUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  handleDeleteTask: (taskId: string) => void;
  openTaskDrawer: (task: Task) => void;
}

function KanbanCard({ task, members, handleUpdateTask, handleDeleteTask, openTaskDrawer }: KanbanCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(task.title);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    position: 'relative' as const,
  };

  const handleSaveInlineEdit = () => {
    const title = localTitle.trim();
    if (!title) {
      setIsEditing(false);
      setLocalTitle(task.title || '');
      return;
    }
    if (title !== task.title) {
      handleUpdateTask(task.id, { title });
    }
    setIsEditing(false);
  };

  if (isDragging) {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className="w-full bg-[#1e1e1e]/50 border-dashed border-2 border-[#4f4f4f] rounded-xl opacity-50 min-h-[100px] mb-3"
      />
    );
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes}
      {...listeners}
      className="group/card w-full bg-white text-[#333333] rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 mb-3 cursor-grab active:cursor-grabbing border border-gray-200 flex flex-col gap-3 relative"
    >
      <div className="flex justify-between items-start gap-2">
        {isEditing ? (
          <input
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={handleSaveInlineEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveInlineEdit();
              if (e.key === 'Escape') {
                setIsEditing(false);
                setLocalTitle(task.title || '');
              }
            }}
            ref={(input) => { if (input) input.focus(); }}
            className="flex-1 bg-gray-50 border border-blue-300 rounded outline-none text-[14px] font-semibold text-gray-800 px-2 py-1"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            onClick={(e) => {
              e.stopPropagation();
              openTaskDrawer(task);
            }}
            className="flex-1 font-semibold text-gray-800 text-[14px] leading-tight break-words cursor-pointer hover:text-blue-600 transition-colors text-left"
          >
            {task.title}
          </button>
        )}
        
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 opacity-0 group-hover/card:opacity-100 transition-opacity">
            <MoreHorizontal size={16} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="bg-white border border-gray-200 rounded-md shadow-lg p-1 min-w-[140px] z-50">
              <DropdownMenu.Item
                onClick={() => handleDeleteTask(task.id)}
                className="flex items-center gap-2 px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded cursor-pointer outline-none"
              >
                <Trash2 size={14} />
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-auto">
        <div className={`text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${PRIORITY_CONFIG[task.priority || 'Normal']?.bg.replace('/10', '/20')} ${PRIORITY_CONFIG[task.priority || 'Normal']?.color}`}>
          <Flag size={12} />
          {task.priority || 'Normal'}
        </div>
        
        <div className="flex items-center gap-2">
          {task.due_date && (
            <div className="flex items-center gap-1 text-[11px] text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-md">
              <CalendarIcon size={12} />
              {new Date(task.due_date).toLocaleDateString()}
            </div>
          )}
          {task.assigned_to && (
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 ring-2 ring-white shadow-sm" title={members.find((m) => m.user_id === task.assigned_to)?.name || task.assigned_to}>
              {(members.find((m) => m.user_id === task.assigned_to)?.name?.charAt(0) || members.find((m) => m.user_id === task.assigned_to)?.email?.charAt(0) || '?').toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanCardOverlay({ task, members }: { task: Task, members: TeamspaceMember[] }) {
  return (
    <div 
      className="w-[320px] bg-white text-[#333333] rounded-xl p-4 shadow-[0_20px_40px_rgba(0,0,0,0.15)] border border-gray-200 flex flex-col gap-3 rotate-[3deg] scale-[1.05] cursor-grabbing z-[9999]"
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 font-semibold text-gray-800 text-[14px] leading-tight break-words">
          {task.title}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-auto">
        <div className={`text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${PRIORITY_CONFIG[task.priority || 'Normal']?.bg.replace('/10', '/20')} ${PRIORITY_CONFIG[task.priority || 'Normal']?.color}`}>
          <Flag size={12} />
          {task.priority || 'Normal'}
        </div>
        
        <div className="flex items-center gap-2">
          {task.due_date && (
            <div className="flex items-center gap-1 text-[11px] text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-md">
              <CalendarIcon size={12} />
              {new Date(task.due_date).toLocaleDateString()}
            </div>
          )}
          {task.assigned_to && (
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 ring-2 ring-white shadow-sm">
              {(members.find((m) => m.user_id === task.assigned_to)?.name?.charAt(0) || members.find((m) => m.user_id === task.assigned_to)?.email?.charAt(0) || '?').toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface NewTaskRowProps {
  projectId: string;
  statusGroup: string;
  mutateTasks: () => void;
}

function NewTaskButton({ projectId, statusGroup, mutateTasks }: NewTaskRowProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isInputMode, setIsInputMode] = useState(false);
  const [title, setTitle] = useState('');

  if (isInputMode) {
    return (
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || isCreating) return;
        
        setIsCreating(true);
        api.post(`/projects/${projectId}/tasks`, {
          title: title.trim(),
          status: statusGroup
        }).then(() => {
          setTitle('');
          setIsInputMode(false);
          mutateTasks();
        }).catch(error => {
          console.error('Failed to create task:', error);
        }).finally(() => {
          setIsCreating(false);
        });
      }} className="w-full bg-[#1e1e1e] rounded-xl p-3 border border-white/10 mt-1 shrink-0">
        <input
          ref={(input) => { if (input) input.focus(); }}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (!title.trim()) setIsInputMode(false);
          }}
          placeholder="What needs to be done?"
          className="w-full bg-transparent border-none text-[13px] text-white placeholder:text-[#666] focus:outline-none focus:ring-0 mb-2"
          disabled={isCreating}
        />
        <div className="flex items-center gap-2">
          <button type="submit" disabled={isCreating} className="bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors">
            Add
          </button>
          <button type="button" onClick={() => setIsInputMode(false)} className="text-[#8a8a8a] hover:text-white text-[12px] font-medium px-2 py-1.5 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsInputMode(true)}
      className="w-full flex items-center gap-2 text-[#8a8a8a] hover:text-white hover:bg-white/5 px-3 py-2 rounded-lg transition-colors mt-1 text-[13px] font-medium shrink-0"
    >
      <Plus size={16} />
      Add a card
    </button>
  );
}

function KanbanColumn({
  statusGroup,
  taskCount,
  children
}: {
  statusGroup: Task['status'];
  taskCount: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: getStatusDropId(statusGroup),
    data: {
      type: 'status-group',
      status: statusGroup
    }
  });

  const config = STATUS_CONFIG[statusGroup as keyof typeof STATUS_CONFIG];

  return (
    <div ref={setNodeRef} className={`flex flex-col min-w-[320px] w-[320px] shrink-0 bg-[#252525] rounded-xl transition-colors duration-200 ${isOver ? 'bg-[#2a2a2a] ring-2 ring-blue-500/30' : ''} p-3 max-h-full`}>
      <div className="flex items-center justify-between mb-4 px-1 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: config?.color.match(/bg-\[([^\]]+)\]/)?.[1] || '#4b5563' }}
          />
          <h2 className="text-[14px] font-bold text-white tracking-wide">
            {STATUS_LABELS[statusGroup]} <span className="text-[#8a8a8a] ml-1 font-medium">{taskCount}</span>
          </h2>
        </div>
        <button type="button" className="text-[#8a8a8a] hover:text-white transition-colors">
           <MoreHorizontal size={18} />
         </button>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-2 custom-scrollbar">
        {children}
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  
  const [userName] = useState(() => {
    const user = getUserFromToken();
    return user?.name || 'User';
  });
  const [activeTab, setActiveTab] = useState<'tasks' | 'members' | 'timeline'>('tasks');
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

  const groupedTasks = {
    'To Do': tasks.filter(t => t.status === 'To Do').sort((a, b) => a.position - b.position),
    'In Progress': tasks.filter(t => t.status === 'In Progress').sort((a, b) => a.position - b.position),
    'Done': tasks.filter(t => t.status === 'Done').sort((a, b) => a.position - b.position),
    'Stuck': tasks.filter(t => t.status === 'Stuck').sort((a, b) => a.position - b.position)
  };

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTaskForOverlay = tasks.find(t => t.id === activeId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    
    if (!over) return;

    const activeId = active.id as string;
    const activeTask = tasks.find((task) => task.id === activeId);

    if (!activeTask) return;

    const overTask = tasks.find((task) => task.id === String(over.id));
    const destinationStatus =
      over.data.current?.type === 'status-group'
        ? over.data.current.status as Task['status']
        : overTask?.status;

    if (!destinationStatus || destinationStatus === activeTask.status) return;

    const destinationTasks = tasks.filter(
      (task) => task.status === destinationStatus && task.id !== activeTask.id
    );
    const nextPosition = destinationTasks.length > 0
      ? Math.max(...destinationTasks.map((task) => task.position ?? 0)) + 1
      : 0;
    const previousTasks = tasks;

    mutateTasks(
      (current = []) => current.map((task) => (
        task.id === activeId
          ? { ...task, status: destinationStatus, position: nextPosition }
          : task
      )),
      { revalidate: false }
    );

    try {
      await api.patch(`/tasks/${activeId}`, {
        status: destinationStatus,
        position: nextPosition
      });
      await mutateTasks();
    } catch (error) {
      console.error('Failed to update task status:', error);
      await mutateTasks(previousTasks, { revalidate: false });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
      mutateTasks((current = []) => current.map((t) => t.id === taskId ? { ...t, ...updates } : t), { revalidate: false });
      await api.patch(`/tasks/${taskId}`, updates);
      mutateTasks();
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      mutateTasks((current = []) => current.filter((t) => t.id !== taskId), { revalidate: false });
      await api.delete(`/projects/tasks/${taskId}`);
      mutateTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
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

  const completedTasks = tasks.filter((t) => t.status === 'Done').length;
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
            <button 
              type="button"
              onClick={() => router.push('/projects')}
              className="p-1.5 rounded-md text-[#8a8a8a] hover:text-white hover:bg-white/10 transition-all duration-200 active:scale-95 mr-2"
              title="Back to Projects"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-1">
              <div className="w-6 h-6 rounded-md flex items-center justify-center shadow-sm" style={{ backgroundColor: project.color || '#3b82f6' }}>
                <span className="text-white text-xs font-bold">{project.name.charAt(0).toUpperCase()}</span>
              </div>
              
              <div className="relative group/title flex items-center">
                <input
                  defaultValue={project.name}
                  onBlur={(e) => {
                    const newName = e.target.value.trim();
                    if (newName && newName !== project.name) {
                      api.patch(`/projects/${project.id}`, { name: newName }).then(() => {
                        window.dispatchEvent(new Event('projectsChanged'));
                      });
                    } else {
                      e.target.value = project.name;
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                    if (e.key === 'Escape') {
                      e.currentTarget.value = project.name;
                      e.currentTarget.blur();
                    }
                  }}
                  className="bg-transparent border border-transparent hover:bg-white/5 focus:bg-[#1f1f1f] focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 rounded-md px-2 py-1 outline-none text-2xl font-bold text-white tracking-tight w-auto transition-all text-ellipsis"
                  style={{ width: `${Math.max(project.name.length + 2, 10)}ch` }}
                  onChange={(e) => {
                    e.target.style.width = `${Math.max(e.target.value.length + 2, 10)}ch`;
                  }}
                />
              </div>

              <DropdownMenu.Root>
                <DropdownMenu.Trigger className="outline-none focus:outline-none p-1.5 rounded-md hover:bg-white/10 text-[#8a8a8a] hover:text-white transition-all duration-200 active:scale-95 ml-1">
                  <ChevronDown size={18} />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="bg-[#2c2c2c] border border-white/10 rounded-md shadow-2xl p-1 min-w-[220px] z-50">
                    <div className="px-2 py-2 text-[11px] font-semibold text-[#8a8a8a] uppercase tracking-wider">
                      {project.teamspace_id ? 'Teamspace Projects' : 'My Projects'}
                    </div>
                    {projectsData?.filter((p) => p.teamspace_id === project.teamspace_id).map((p) => (
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
            </div>
            
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
                className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
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
            className={`pb-3 text-[13px] font-semibold tracking-wide border-b-2 transition-all duration-200 ease-out ${activeTab === 'tasks' ? 'border-blue-500 text-blue-400' : 'border-transparent text-[#8a8a8a] hover:text-[#d4d4d4]'}`}
          >
            Tasks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`pb-3 text-[13px] font-semibold tracking-wide border-b-2 transition-all duration-200 ease-out ${activeTab === 'members' ? 'border-blue-500 text-blue-400' : 'border-transparent text-[#8a8a8a] hover:text-[#d4d4d4]'}`}
          >
            Members
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`pb-3 text-[13px] font-semibold tracking-wide border-b-2 transition-all duration-200 ease-out ${activeTab === 'timeline' ? 'border-blue-500 text-blue-400' : 'border-transparent text-[#8a8a8a] hover:text-[#d4d4d4]'}`}
          >
            Timeline
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8 relative">
        <div className="max-w-7xl mx-auto">
          
          {activeTab === 'tasks' ? (
            <div className="h-full flex flex-col">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="flex gap-6 overflow-x-auto pb-4 h-full items-start custom-scrollbar">
                  {STATUS_ORDER.map((statusGroup) => {
                    const groupTasks = groupedTasks[statusGroup];
                    return (
                      <KanbanColumn key={statusGroup} statusGroup={statusGroup} taskCount={groupTasks.length}>
                        <SortableContext items={groupTasks.map((t) => t.id)} strategy={rectSortingStrategy}>
                          <div className="flex flex-col min-h-[10px]">
                            {groupTasks.map((task) => (
                              <KanbanCard
                                key={task.id}
                                task={task}
                                members={members}
                                statusGroup={statusGroup}
                                handleUpdateTask={handleUpdateTask}
                                handleDeleteTask={handleDeleteTask}
                                openTaskDrawer={openTaskDrawer}
                              />
                            ))}
                          </div>
                        </SortableContext>
                        <NewTaskButton 
                          projectId={projectId} 
                          statusGroup={statusGroup} 
                          mutateTasks={mutateTasks} 
                        />
                      </KanbanColumn>
                    );
                  })}
                </div>
                <DragOverlay>
                  {activeTaskForOverlay ? (
                    <KanbanCardOverlay 
                      task={activeTaskForOverlay} 
                      members={members} 
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          ) : activeTab === 'members' ? (
            <div className="bg-[#1f1f1f] border border-white/5 rounded-lg shadow-sm overflow-hidden p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white mb-1">Project Members</h2>
                  <p className="text-sm text-[#a3a3a3]">
                    These are the members of the {project.teamspace_id ? 'Teamspace' : 'Workspace'} who have access to this project.
                  </p>
                </div>
                {project.teamspace_id && (
                  <button 
                    type="button"
                    onClick={() => router.push('/settings/members')}
                    className="bg-white/5 hover:bg-white/10 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
                  >
                    Manage Teamspace
                  </button>
                )}
              </div>
              
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
