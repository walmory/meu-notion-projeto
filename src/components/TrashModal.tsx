'use client';

import { useState, useEffect } from 'react';
import { Trash, RefreshCcw, X, Search, FileText } from 'lucide-react';
import { api, getAuthHeaders } from '@/lib/api';
import { Document } from '@/hooks/useDocuments';
import { useSWRConfig } from 'swr';

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TrashModal({ isOpen, onClose }: TrashModalProps) {
  const [trashedDocs, setTrashedDocs] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { mutate } = useSWRConfig();

  useEffect(() => {
    const fetchTrashedDocs = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/documents?trash=true', { headers: getAuthHeaders() });
        const normalizedDocs = Array.isArray(response.data)
          ? response.data.map((doc: Document & { name?: string }) => ({
            ...doc,
            title: doc.title ?? doc.name ?? ''
          }))
          : [];
        setTrashedDocs(normalizedDocs);
      } catch (error) {
        console.error('Failed to fetch trashed docs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchTrashedDocs();
    }
  }, [isOpen]);

  const handleRestore = async (id: string) => {
    try {
      await api.patch(`/documents/${id}`, { is_trash: 0 }, { headers: getAuthHeaders() });
      setTrashedDocs(prev => prev.filter(doc => doc.id !== id));
      mutate((key) => typeof key === 'string' && key.startsWith('/documents'));
    } catch (error) {
      console.error('Failed to restore document:', error);
    }
  };

  const handleDeletePermanently = async (id: string) => {
    try {
      await api.delete(`/documents/${id}`, { headers: getAuthHeaders() });
      setTrashedDocs(prev => prev.filter(doc => doc.id !== id));
      mutate((key) => typeof key === 'string' && key.startsWith('/documents'));
    } catch (error) {
      console.error('Failed to permanently delete document:', error);
    }
  };

  if (!isOpen) return null;

  const filteredDocs = trashedDocs.filter(doc => 
    (doc.title || 'Untitled').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] border border-[#2c2c2c] w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2c2c2c]">
          <div className="flex items-center gap-2 text-white">
            <Trash size={18} className="text-[#a3a3a3]" />
            <h2 className="font-medium">Trash</h2>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-[#2c2c2c] rounded text-[#a3a3a3] hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[#2c2c2c]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]" />
            <input 
              type="text" 
              placeholder="Search in trash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#2c2c2c] text-white rounded-lg pl-9 pr-4 py-2 outline-none focus:ring-1 focus:ring-white/20 text-sm"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="p-4 text-center text-[#a3a3a3] text-sm">Loading...</div>
          ) : filteredDocs.length === 0 ? (
            <div className="p-8 text-center text-[#a3a3a3] text-sm">
              {searchQuery ? 'No matching documents found in trash.' : 'Trash is empty.'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredDocs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between group hover:bg-[#2c2c2c] p-2 rounded-lg transition">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {doc.icon ? (
                      <span className="text-xl shrink-0">{doc.icon}</span>
                    ) : (
                      <FileText size={16} className="shrink-0 text-[#a3a3a3]" />
                    )}
                    <div className="flex flex-col truncate">
                      <span className={`text-sm truncate font-medium ${!doc.title ? 'text-[#a3a3a3]' : 'text-white'}`}>{doc.title || 'Untitled'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRestore(doc.id)}
                      className="flex items-center gap-1 px-2 py-1 bg-[#2c2c2c] hover:bg-[#3f3f3f] text-white text-xs rounded transition"
                    >
                      <RefreshCcw size={12} />
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePermanently(doc.id)}
                      className="flex items-center gap-1 px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded transition"
                    >
                      <Trash size={12} />
                      Delete Permanently
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-3 border-t border-[#2c2c2c] bg-[#1a1a1a] text-xs text-[#a3a3a3] text-center">
          Pages in Trash can be restored or permanently deleted.
        </div>
      </div>
    </div>
  );
}
