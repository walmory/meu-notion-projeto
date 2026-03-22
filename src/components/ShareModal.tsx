'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, UserPlus, ShieldAlert, Trash2 } from 'lucide-react';
import { api, getAuthHeaders } from '@/lib/api';
import useSWR from 'swr';

interface User {
  name: string;
  email: string;
}

interface Permission {
  document_id: string;
  user_email: string;
  role: 'editor' | 'viewer';
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
}

const fetcher = async (url: string) => {
  const headers = getAuthHeaders();
  const res = await api.get(url, { headers });
  return res.data;
};

export function ShareModal({ isOpen, onClose, documentId }: ShareModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'editor' | 'viewer'>('editor');
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: permissions, mutate } = useSWR<Permission[]>(
    isOpen ? `/documents/${documentId}/permissions` : null,
    fetcher
  );

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await api.get(`/users/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: getAuthHeaders()
        });
        setSearchResults(response.data);
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  const handleShare = async (email: string) => {
    try {
      await api.post(`/documents/${documentId}/share`, { email, role: selectedRole }, {
        headers: getAuthHeaders()
      });
      setSearchQuery('');
      setSearchResults([]);
      mutate();
    } catch (error) {
      console.error('Failed to share document:', error);
      alert('Failed to share document. You might not have permission.');
    }
  };

  const handleRemoveAccess = async (email: string) => {
    try {
      await api.delete(`/documents/${documentId}/share/${encodeURIComponent(email)}`, {
        headers: getAuthHeaders()
      });
      mutate();
    } catch (error) {
      console.error('Failed to remove access:', error);
      alert('Failed to remove access.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] border border-[#2c2c2c] w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2c2c2c]">
          <h2 className="text-lg font-semibold text-white">Share Document</h2>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-[#2c2c2c] rounded text-[#a3a3a3] hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Search Section */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]" />
                <input 
                  type="text" 
                  placeholder="Invite by email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#2c2c2c] text-white rounded-lg pl-9 pr-4 py-2 outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>
              <select 
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as 'editor' | 'viewer')}
                className="bg-[#2c2c2c] text-white rounded-lg px-3 py-2 text-sm outline-none border border-[#3f3f3f]"
              >
                <option value="editor">Can Edit</option>
                <option value="viewer">Can View</option>
              </select>
            </div>

            {/* Search Results */}
            {searchQuery && (
              <div className="bg-[#222222] border border-[#2c2c2c] rounded-lg overflow-hidden mt-2 max-h-48 overflow-y-auto">
                {isSearching ? (
                  <div className="p-3 text-sm text-[#a3a3a3] text-center">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-sm text-[#a3a3a3] text-center">No users found.</div>
                ) : (
                  searchResults.map(user => (
                    <div key={user.email} className="flex items-center justify-between p-2 hover:bg-[#2c2c2c] transition">
                      <div>
                        <div className="text-sm text-white font-medium">{user.name}</div>
                        <div className="text-xs text-[#a3a3a3]">{user.email}</div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleShare(user.email)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition"
                      >
                        Invite
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Current Permissions */}
          <div>
            <h3 className="text-sm font-medium text-[#a3a3a3] mb-3 uppercase tracking-wider">People with access</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                    <ShieldAlert size={16} />
                  </div>
                  <div>
                    <div className="text-sm text-white font-medium">Owner</div>
                    <div className="text-xs text-[#a3a3a3]">Has full control</div>
                  </div>
                </div>
                <span className="text-xs text-[#a3a3a3] italic">Owner</span>
              </div>

              {permissions?.map(perm => (
                <div key={perm.user_email} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#3f3f3f] flex items-center justify-center text-white font-bold text-sm uppercase">
                      {perm.user_email[0]}
                    </div>
                    <div>
                      <div className="text-sm text-white font-medium">{perm.user_email}</div>
                      <div className="text-xs text-[#a3a3a3] capitalize">{perm.role}</div>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleRemoveAccess(perm.user_email)}
                    className="p-1.5 text-[#a3a3a3] hover:text-red-400 hover:bg-red-500/10 rounded transition opacity-0 group-hover:opacity-100"
                    title="Remove access"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {(!permissions || permissions.length === 0) && (
                <div className="text-sm text-[#a3a3a3] text-center py-4 border border-dashed border-[#2c2c2c] rounded-lg">
                  This document is private.
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-[#2c2c2c] bg-[#1a1a1a] flex justify-between items-center text-xs text-[#a3a3a3]">
          <span className="flex items-center gap-1.5"><UserPlus size={14} /> Anyone with access can view this page.</span>
          <button type="button" onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert('Link copied to clipboard!');
          }} className="hover:text-white underline">
            Copy link
          </button>
        </div>
      </div>
    </div>
  );
}