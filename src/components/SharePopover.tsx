'use client';

import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Lock, 
  Copy, 
  Check, 
  ChevronDown,
  UserPlus
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { api, getAuthHeaders } from '@/lib/api';
import { Document } from '@/hooks/useDocuments';
import { toast } from 'sonner';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface SharePopoverProps {
  document: Document;
}

interface WorkspaceMember {
  user_id: string;
  user_email: string;
  user_name: string;
  role: string;
}

export function SharePopover({ document }: SharePopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isPublic, setIsPublic] = useState(!!document.is_public);
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const workspaceId = document.workspace_id || (typeof window !== 'undefined' ? localStorage.getItem('activeWorkspaceId') : null);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const res = await api.get('/workspaces/members', {
          headers: { ...getAuthHeaders(), 'x-workspace-id': workspaceId }
        });
        setMembers(res.data || []);
      } catch (error) {
        console.error('Failed to fetch workspace members', error);
      }
    };

    if (isOpen && workspaceId) {
      fetchMembers();
    }
  }, [isOpen, workspaceId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !workspaceId) return;

    setIsInviting(true);
    try {
      await api.post(`/workspaces/${workspaceId}/invite`, { email: inviteEmail }, {
        headers: getAuthHeaders()
      });
      toast.success('Invite successfully sent!');
      setInviteEmail('');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Error sending invite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleGeneralAccessChange = async (newIsPublic: boolean) => {
    if (isUpdatingAccess) return;
    setIsUpdatingAccess(true);
    const previousState = isPublic;
    setIsPublic(newIsPublic);
    try {
      await api.patch(`/documents/${document.id}`, { is_public: newIsPublic }, {
        headers: getAuthHeaders()
      });
      toast.success(newIsPublic ? 'Link publicado na web' : 'Acesso restrito');
    } catch (error) {
      setIsPublic(previousState);
      toast.error('Error updating access');
    } finally {
      setIsUpdatingAccess(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm"
        >
          Share
        </button>
      </PopoverTrigger>
      <PopoverContent 
        align="end" 
        className="w-[380px] p-0 bg-[#1a1a1a] border-[#2c2c2c] shadow-2xl rounded-xl overflow-hidden z-[9999]"
      >
        <div className="p-3">
          {/* Invite Section */}
          <form onSubmit={handleInvite} className="flex items-center gap-2 mb-4">
            <input
              type="email"
              placeholder="Add people or emails..."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 bg-[#2c2c2c] border border-transparent focus:border-[#3f3f3f] text-sm text-white px-3 py-1.5 rounded-md outline-none transition-colors placeholder:text-[#8a8a8a]"
            />
            <button
              type="submit"
              disabled={isInviting || !inviteEmail.trim()}
              className="bg-[#2c2c2c] hover:bg-[#3f3f3f] disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
            >
              {isInviting ? 'Inviting...' : 'Invite'}
            </button>
          </form>

          {/* Members List */}
          <div className="space-y-3 mb-4 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
            {members.map(member => (
              <div key={member.user_id} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#2c2c2c] flex items-center justify-center text-[#a3a3a3] font-medium text-xs uppercase shrink-0">
                    {(member.user_name?.charAt(0) || member.user_email?.charAt(0) || '?').toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] text-white font-medium truncate">
                      {member.user_name || member.user_email.split('@')[0]}
                    </span>
                    <span className="text-[11px] text-[#8a8a8a] truncate">
                      {member.user_email}
                    </span>
                  </div>
                </div>
                <div className="text-[12px] text-[#8a8a8a] capitalize px-2 py-1 rounded hover:bg-[#2c2c2c] cursor-pointer transition-colors">
                  {member.role === 'owner' ? 'Full Access' : 'Can Edit'}
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <div className="text-center text-[#8a8a8a] text-xs py-2">
                Loading members...
              </div>
            )}
          </div>
        </div>

        <div className="h-px w-full bg-[#2c2c2c]" />

        {/* General Access */}
        <div className="p-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#2c2c2c] flex items-center justify-center shrink-0 text-[#a3a3a3]">
              {isPublic ? <Globe size={16} className="text-blue-400" /> : <Lock size={16} />}
            </div>
            <div className="flex-1 min-w-0">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button type="button" className="flex items-center gap-1.5 text-[13px] font-medium text-white hover:bg-[#2c2c2c] rounded px-1.5 py-0.5 -ml-1.5 transition-colors">
                    {isPublic ? 'Anyone with the link' : 'Restricted'}
                    <ChevronDown size={14} className="text-[#8a8a8a]" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content 
                    align="start" 
                    className="z-[10000] w-56 bg-[#252525] border border-[#3f3f3f] rounded-lg shadow-xl py-1 overflow-hidden"
                  >
                    <DropdownMenu.Item 
                      onClick={() => handleGeneralAccessChange(false)}
                      className="px-3 py-2 text-[13px] text-[#d4d4d4] hover:bg-[#3f3f3f] hover:text-white cursor-pointer outline-none flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2">
                        <Lock size={14} className="text-[#8a8a8a] group-hover:text-white transition-colors" />
                        <span>Restricted</span>
                      </div>
                      {!isPublic && <Check size={14} />}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item 
                      onClick={() => handleGeneralAccessChange(true)}
                      className="px-3 py-2 text-[13px] text-[#d4d4d4] hover:bg-[#3f3f3f] hover:text-white cursor-pointer outline-none flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2">
                        <Globe size={14} className="text-[#8a8a8a] group-hover:text-white transition-colors" />
                        <span>Anyone with the link</span>
                      </div>
                      {isPublic && <Check size={14} />}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
              <p className="text-[11px] text-[#8a8a8a] mt-0.5">
                {isPublic ? 'Anyone on the internet with the link can view' : 'Only people with access can open with the link'}
              </p>
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-[#2c2c2c]" />

        {/* Footer / Copy Link */}
        <div className="p-1.5 bg-[#1f1f1f]">
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-[#2c2c2c] transition-colors text-[13px] font-medium text-white"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-[#a3a3a3]" />}
            Copy link
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
