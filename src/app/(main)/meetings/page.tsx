'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDocuments } from '@/hooks/useDocuments';
import { Video, Plus, Clock, Users, FileText, X, Maximize2, Minimize2, MoreVertical, Trash2, Edit2, PhoneOff, Copy } from 'lucide-react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { Editor } from '@/components/Editor';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import useSWR from 'swr';
import { api, getAuthHeaders, getUserFromToken } from '@/lib/api';

interface Meeting {
  id: string;
  title: string;
  roomName: string;
  date: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'past';
  participants: string[];
}

const fetcher = async (url: string) => {
  const headers = getAuthHeaders();
  const response = await api.get(url, { headers });
  return response.data;
};

export default function MeetingsPage() {
  const router = useRouter();
  const { documents, createDocument, updateDocument, refetch } = useDocuments();
  const [activeCall, setActiveCall] = useState<string | null>(null);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [isSidebarMode, setIsSidebarMode] = useState(true);
  const editTitleRef = useRef<HTMLInputElement>(null);

  const { data: meetings = [], mutate: mutateMeetings } = useSWR<Meeting[]>('/meetings', fetcher);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const meetingDocs = documents?.filter(d => d.is_meeting_note === true || d.is_meeting_note === 1) || [];

  useEffect(() => {
    if (editingMeetingId && editTitleRef.current) {
      editTitleRef.current.focus();
    }
  }, [editingMeetingId]);

  const handleStartCall = async () => {
    const roomName = 'notion-meeting-' + Date.now();
    try {
      await api.post('/meetings', {
        title: 'Instant Meeting',
        roomName,
        status: 'ongoing',
        participants: ['You']
      }, { headers: getAuthHeaders() });
      mutateMeetings();
      setActiveCall(roomName);
    } catch (e) {
      console.error('Failed to create meeting', e);
    }
  };

  const handleJoinCall = async (roomName: string) => {
    setActiveCall(roomName);
  };

  const handleEndCall = async (meetingId: string) => {
    console.log('Finalizando reunião:', meetingId);
    try {
      await api.patch(`/meetings/${meetingId}`, { status: 'past' }, { headers: getAuthHeaders() });
      mutateMeetings();
      if (meetings.find(m => m.id === meetingId)?.roomName === activeCall) {
        setActiveCall(null);
      }
    } catch (e) {
      console.error('Failed to end meeting', e);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      await api.delete(`/meetings/${meetingId}`, { headers: getAuthHeaders() });
      mutateMeetings();
    } catch (e) {
      console.error('Failed to delete meeting', e);
    }
  };

  const handleSaveTitle = async (meetingId: string) => {
    if (!editTitle.trim()) {
      setEditingMeetingId(null);
      return;
    }
    try {
      await api.patch(`/meetings/${meetingId}`, { title: editTitle }, { headers: getAuthHeaders() });
      mutateMeetings();
    } catch (e) {
      console.error('Failed to update title', e);
    } finally {
      setEditingMeetingId(null);
    }
  };

  const handleCreateMeetingNote = async (meetingTitle: string = 'New Meeting') => {
    const templateContent = JSON.stringify([
      { type: 'heading', props: { level: 2 }, content: 'Agenda' },
      { type: 'bulletListItem', content: 'Topic 1' },
      { type: 'heading', props: { level: 2 }, content: 'Notes' },
      { type: 'paragraph', content: '' },
      { type: 'heading', props: { level: 2 }, content: 'Action Items' },
      { type: 'checkListItem', content: 'Action 1' }
    ]);

    const newDoc = await createDocument({ title: meetingTitle + ' Notes', is_shared: false, is_meeting_note: true });
    
    // We update the content with the template
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://meu-notion-projeto.onrender.com'}/documents/${newDoc.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('notion_token')}`,
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ content: templateContent, emoji: '📝' })
      });
      refetch();
      setActiveDocId(newDoc.id);
    } catch (e) {
      console.error(e);
    }
  };

  const activeDocument = documents?.find(d => d.id === activeDocId) || null;

  return (
    <div className="flex flex-1 h-screen overflow-hidden bg-[#191919] text-white">
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col overflow-y-auto transition-all duration-300 ${activeCall && isSidebarMode ? 'w-1/2 border-r border-[#2c2c2c]' : 'w-full'}`}>
        <div className="max-w-5xl mx-auto w-full p-8 md:p-12">
          {/* Header */}
          <div className="flex items-center justify-between mb-12">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <Video className="text-blue-500" size={36} />
                Meetings
              </h1>
              <p className="text-[#a3a3a3]">Manage your calls and meeting notes in one place.</p>
            </div>
            <button
              type="button"
              onClick={handleStartCall}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Video size={20} />
              Start a Call
            </button>
          </div>

          {/* Upcoming Meetings */}
          <div className="mb-12">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Clock className="text-[#a3a3a3]" size={20} />
              Upcoming Meetings
            </h2>
            {meetings.filter(m => m.status !== 'past').length === 0 ? (
              <div className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-xl p-8 text-center text-[#a3a3a3] flex flex-col items-center justify-center">
                <Video size={32} className="mb-3 text-[#3f3f3f]" />
                <p className="text-sm">Your schedule is clear. How about starting a call now?</p>
              </div>
            ) : (
              <div className={`grid grid-cols-1 ${activeCall && isSidebarMode ? 'xl:grid-cols-2' : 'md:grid-cols-2'} gap-4`}>
                {meetings.filter(m => m.status !== 'past').map((meeting) => (
                  <div 
                    key={meeting.id} 
                    className={`bg-[#1a1a1a] border ${activeCall === meeting.roomName ? 'border-blue-500 shadow-blue-500/20' : 'border-[#2c2c2c] hover:border-[#3f3f3f]'} rounded-xl p-5 hover:bg-[#222222] transition-all duration-200 group relative hover:scale-[1.01] hover:shadow-xl hover:shadow-black/50`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 mr-4">
                        {editingMeetingId === meeting.id ? (
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => handleSaveTitle(meeting.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveTitle(meeting.id);
                              if (e.key === 'Escape') setEditingMeetingId(null);
                            }}
                            ref={editTitleRef}
                            className="bg-[#2c2c2c] text-white px-2 py-1 rounded text-lg font-semibold w-full outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          <button
                            type="button"
                            className="font-semibold text-lg text-left cursor-pointer hover:text-blue-400 transition"
                            onClick={() => {
                              setEditTitle(meeting.title);
                              setEditingMeetingId(meeting.id);
                            }}
                          >
                            {meeting.title}
                          </button>
                        )}
                        <p className="text-sm text-[#a3a3a3] mt-1">
                          {new Date(meeting.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {new Date(meeting.date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {meeting.status === 'ongoing' && (
                          <span className="bg-red-500/10 text-red-500 text-xs px-2 py-1 rounded-full font-medium animate-pulse">
                            LIVE
                          </span>
                        )}
                        
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button type="button" className="p-1 hover:bg-[#3f3f3f] rounded text-[#a3a3a3] transition opacity-0 group-hover:opacity-100">
                              <MoreVertical size={16} />
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content className="min-w-[160px] bg-[#1a1a1a] border border-[#2d2d2d] rounded-md shadow-2xl p-1 text-sm text-[#a3a3a3] z-[100]" sideOffset={5} align="end">
                              <DropdownMenu.Item 
                                className="flex items-center gap-2 px-2 py-1.5 outline-none cursor-pointer hover:bg-[#2c2c2c] hover:text-white rounded"
                                onClick={() => {
                                  setEditTitle(meeting.title);
                                  setEditingMeetingId(meeting.id);
                                }}
                              >
                                <Edit2 size={14} /> Rename
                              </DropdownMenu.Item>
                              {meeting.status === 'ongoing' && (
                                <DropdownMenu.Item 
                                  className="flex items-center gap-2 px-2 py-1.5 outline-none cursor-pointer hover:bg-[#2c2c2c] text-red-400 hover:text-red-300 rounded"
                                  onClick={() => handleEndCall(meeting.id)}
                                >
                                  <PhoneOff size={14} /> End Meeting
                                </DropdownMenu.Item>
                              )}
                              <DropdownMenu.Separator className="h-px bg-[#2d2d2d] my-1" />
                              <DropdownMenu.Item 
                                className="flex items-center gap-2 px-2 py-1.5 outline-none cursor-pointer hover:bg-[#2c2c2c] text-red-400 hover:text-red-300 rounded"
                                onClick={() => handleDeleteMeeting(meeting.id)}
                              >
                                <Trash2 size={14} /> Delete
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </div>
                    </div>
                    
                    <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between mt-6 gap-4">
                      <div className="flex -space-x-2 shrink-0">
                        {meeting.participants.map((p) => (
                          <div key={`${meeting.id}-participant-${p}`} className="w-8 h-8 rounded-full bg-[#3f3f3f] border-2 border-[#1a1a1a] flex items-center justify-center text-xs font-medium text-white shadow-sm">
                            {p}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-start xl:justify-end w-full xl:w-auto">
                        {meeting.status === 'ongoing' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const inviteLink = `${window.location.origin}/meetings?join=${meeting.roomName}`;
                                navigator.clipboard.writeText(inviteLink);
                                alert('Link copied! Send it to your guests.');
                              }}
                              className="flex items-center gap-1.5 p-1.5 px-3 rounded-md transition bg-[#2c2c2c] hover:bg-[#3f3f3f] text-[#a3a3a3] hover:text-white border border-[#3f3f3f]"
                              title="Copiar Link"
                            >
                              <Copy size={14} />
                              <span className="text-xs">Copiar Link</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEndCall(meeting.id)}
                              className="px-3 py-1.5 rounded-md text-xs font-medium transition border border-red-500/50 text-red-400 hover:bg-red-500/10 whitespace-nowrap"
                            >
                              End Call
                            </button>
                            <button
                              type="button"
                              onClick={() => handleJoinCall(meeting.roomName)}
                              className="px-4 py-1.5 rounded-md text-xs font-medium transition bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 whitespace-nowrap"
                            >
                              {activeCall === meeting.roomName ? 'Retornar' : (meeting.participants[0] === 'You' ? 'Abrir Reunião' : 'Participar')}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleJoinCall(meeting.roomName)}
                            className="px-4 py-1.5 rounded-md text-sm font-medium transition bg-[#2c2c2c] hover:bg-[#3f3f3f] text-white whitespace-nowrap"
                          >
                            Join Call
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History / Past Meetings */}
          {meetings.filter(m => m.status === 'past').length > 0 && (
            <div className="mb-12">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Clock className="text-[#a3a3a3]" size={20} />
                Histórico
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-75">
                {meetings.filter(m => m.status === 'past').map((meeting) => (
                  <div key={meeting.id} className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-xl p-5 hover:bg-[#222222] transition-all duration-200 group relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 mr-4">
                        <h3 className="font-semibold text-lg">{meeting.title}</h3>
                        <p className="text-sm text-[#a3a3a3] mt-1">
                          {new Date(meeting.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {new Date(meeting.date).toLocaleDateString()}
                        </p>
                      </div>
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button type="button" className="p-1 hover:bg-[#3f3f3f] rounded text-[#a3a3a3] transition opacity-0 group-hover:opacity-100">
                            <MoreVertical size={16} />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content className="min-w-[160px] bg-[#1a1a1a] border border-[#2d2d2d] rounded-md shadow-2xl p-1 text-sm text-[#a3a3a3] z-[100]" sideOffset={5} align="end">
                            <DropdownMenu.Item 
                              className="flex items-center gap-2 px-2 py-1.5 outline-none cursor-pointer hover:bg-[#2c2c2c] text-red-400 hover:text-red-300 rounded"
                              onClick={() => handleDeleteMeeting(meeting.id)}
                            >
                              <Trash2 size={14} /> Delete
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Meeting Notes */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <FileText className="text-[#a3a3a3]" size={20} />
                AI Meeting Notes
              </h2>
              <button
                type="button"
                onClick={() => handleCreateMeetingNote()}
                className="text-sm text-[#a3a3a3] hover:text-white flex items-center gap-1 bg-[#1a1a1a] border border-[#2c2c2c] px-3 py-1.5 rounded-lg transition"
              >
                <Plus size={16} />
                New Note
              </button>
            </div>
            
            <div className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 gap-4 p-4 border-b border-[#2c2c2c] text-sm font-medium text-[#a3a3a3]">
                <div className="col-span-6">Name</div>
                <div className="col-span-3">Date</div>
                <div className="col-span-3">Participants</div>
              </div>
              <div className="divide-y divide-[#2c2c2c]">
                {meetingDocs.length === 0 ? (
                  <div className="p-8 text-center text-[#a3a3a3] text-sm">
                    No meeting notes yet. Start a call or create a new note!
                  </div>
                ) : (
                  meetingDocs.map((doc) => (
                    <button 
                      type="button"
                      key={doc.id} 
                      onClick={() => router.push(`/documents/${doc.id}`)}
                      className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-[#252525] cursor-pointer transition text-sm w-full text-left"
                    >
                      <div className="col-span-6 flex items-center gap-2 font-medium">
                        <span>{doc.icon || '📝'}</span>
                        <span className={!doc.title ? 'text-[#a3a3a3]' : ''}>{doc.title || 'Untitled'}</span>
                      </div>
                      <div className="col-span-3 text-[#a3a3a3]">
                        {doc.updated_at ? new Date(doc.updated_at).toLocaleDateString() : 'N/A'}
                      </div>
                      <div className="col-span-3 flex items-center gap-2 text-[#a3a3a3]">
                        <Users size={14} />
                        Team
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video Call & Active Note Sidebar/Modal */}
      {activeCall && (
        <div className={`${isSidebarMode ? 'w-1/2 flex flex-col h-full bg-[#121212]' : 'fixed inset-0 z-[9999] bg-[#000] flex flex-col'}`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-[#1a1a1a] border-b border-[#2c2c2c]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="font-medium text-sm">Ongoing Call: {activeCall}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSidebarMode(!isSidebarMode)}
                className="p-1.5 hover:bg-[#2c2c2c] rounded text-[#a3a3a3] hover:text-white transition"
                title={isSidebarMode ? "Fullscreen Video" : "Split View"}
              >
                {isSidebarMode ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  const activeMeeting = meetings.find(m => m.roomName === activeCall);
                  if (activeMeeting && activeMeeting.participants[0] === 'You') {
                    handleEndCall(activeMeeting.id);
                  } else {
                    setActiveCall(null);
                  }
                }}
                className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded text-red-400 transition"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Jitsi Video */}
          <div className={`${activeDocId && isSidebarMode ? 'h-1/2' : 'flex-1'} w-full bg-black relative`}>
            <JitsiMeeting
                domain="meet.jit.si"
                roomName={activeCall}
                configOverwrite={{
                  startWithAudioMuted: true,
                  disableModeratorIndicator: true,
                  startScreenSharing: true,
                  enableEmailInStats: false,
                  prejoinPageEnabled: false,
                  requireDisplayName: false,
                  prejoinConfig: {
                    enabled: false,
                    hideDisplayName: true
                  }
                }}
                interfaceConfigOverwrite={{
                  DISABLE_JOIN_LEAVE_NOTIFICATIONS: true
                }}
                userInfo={{
                  displayName: getUserFromToken()?.name || 'User',
                  email: getUserFromToken()?.email || 'user@example.com'
                }}
                onApiReady={(api) => {
                  // Entra automaticamente e pula as telas de boas vindas
                  api.executeCommand('subject', 'Notion Workspace Meeting');

                  api.addListener('readyToClose', () => {
                    const activeMeeting = meetings.find(m => m.roomName === activeCall);
                    if (activeMeeting && activeMeeting.participants[0] === 'You') {
                      handleEndCall(activeMeeting.id);
                    } else {
                      setActiveCall(null);
                    }
                  });
                }}
                getIFrameRef={(iframeRef) => {
                  iframeRef.style.height = '100%';
                  iframeRef.style.width = '100%';
                  // O componente JitsiMeeting lida com o allow internamente
                  // Apenas garantimos o tamanho aqui
                }}
              />
          </div>

          {/* Connected Editor in Split View */}
          {activeDocId && isSidebarMode && (
            <div className="h-1/2 border-t border-[#2c2c2c] flex flex-col bg-[#191919]">
              <div className="p-2 bg-[#1a1a1a] border-b border-[#2c2c2c] flex justify-between items-center text-xs font-medium text-[#a3a3a3]">
                <span>Meeting Notes</span>
                <button type="button" onClick={() => setActiveDocId(null)} className="hover:text-white"><X size={14} /></button>
              </div>
              <div className="flex-1 overflow-hidden">
                {activeDocument ? (
                  <Editor document={activeDocument} onUpdate={refetch} onUpdateDocument={updateDocument} hideHeader />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#a3a3a3] text-sm">
                    Loading note...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick actions when no doc is active in split view */}
          {!activeDocId && isSidebarMode && (
            <div className="p-4 bg-[#1a1a1a] border-t border-[#2c2c2c] flex justify-center">
              <button
                type="button"
                onClick={() => handleCreateMeetingNote(activeCall)}
                className="text-sm bg-[#2c2c2c] hover:bg-[#3f3f3f] text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
              >
                <Plus size={16} />
                Create Meeting Note
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
