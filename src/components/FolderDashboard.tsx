'use client';

import { useMemo, useState } from 'react';
import { Document } from '@/hooks/useDocuments';
import { FileText, Folder, MoreHorizontal } from 'lucide-react';
import { DocumentContextMenu } from '@/components/DocumentContextMenu';
import { useRouter } from 'next/navigation';

interface FolderDashboardProps {
  folder: Document;
  documents: Document[];
  onUpdateDocument: (id: string, updates: Partial<Document>) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteDocument: (id: string) => void;
  onDuplicateDocument: (id: string) => void;
}

export function FolderDashboard({ 
  folder, 
  documents, 
  onUpdateDocument, 
  onToggleFavorite, 
  onDeleteDocument, 
  onDuplicateDocument 
}: FolderDashboardProps) {
  const router = useRouter();
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const children = useMemo(() => {
    return documents.filter(doc => doc.parent_id === folder.id && doc.is_trash !== true && doc.is_trash !== 1)
      .sort((a, b) => {
        const dateA = new Date(a.updated_at || 0).getTime();
        const dateB = new Date(b.updated_at || 0).getTime();
        return dateB - dateA;
      });
  }, [documents, folder.id]);

  const startRename = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(doc.title || '');
    setEditingDocId(doc.id);
  };

  const handleTitleChange = (id: string, newTitle: string) => {
    setEditTitle(newTitle);
  };

  const handleRenameSubmit = (id: string) => {
    setEditingDocId(null);
    const doc = documents.find(d => d.id === id);
    if (doc && editTitle !== doc.title) {
      onUpdateDocument(id, { title: editTitle });
    }
  };

  const onSelectDocument = (doc: Document) => {
    if (doc.type === 'folder') {
      router.push(`/documents/${doc.id}`);
    } else {
      router.push(`/documents/${doc.id}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#191919] relative w-full h-full flex flex-col items-center">
      <div className="w-full max-w-5xl px-8 pt-24 pb-12 flex flex-col gap-12">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-white/10 pb-6">
          <div className="text-5xl bg-[#252525] w-20 h-20 flex items-center justify-center rounded-xl shadow-lg">
            {folder.icon || <Folder className="text-blue-400" size={40} />}
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight">
              {folder.title || 'Untitled Folder'}
            </h1>
            <p className="text-[#a3a3a3] mt-2">
              {children.length} {children.length === 1 ? 'item' : 'items'} in this folder
            </p>
          </div>
        </div>

        {/* Children Grid */}
        {children.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {children.map(doc => (
              <DocumentContextMenu
                key={doc.id}
                doc={doc}
                onUpdate={onUpdateDocument}
                onToggleFavorite={onToggleFavorite}
                onDelete={onDeleteDocument}
                onDuplicate={onDuplicateDocument}
                onRename={() => startRename(doc, { stopPropagation: () => {} } as React.MouseEvent)}
                dropdownTrigger={
                  <button 
                    type="button" 
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="p-1 hover:bg-[#3f3f3f] rounded text-[#a3a3a3] hover:text-white transition"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                }
              >
                <div 
                  className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-xl p-5 cursor-pointer hover:bg-[#252525] hover:border-[#3f3f3f] transition flex flex-col gap-3 group/card text-left outline-none focus-visible:ring-2 focus-visible:ring-[#3f3f3f] relative h-full w-full"
                >
                  <button 
                    type="button" 
                    onClick={() => onSelectDocument(doc)} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectDocument(doc);
                      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
                        e.preventDefault();
                        onDuplicateDocument(doc.id);
                      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
                        e.preventDefault();
                        startRename(doc, { stopPropagation: () => {} } as React.MouseEvent);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 z-0" 
                    aria-label={`Open document ${doc.title || 'Untitled'}`}
                  />
                  
                  <div className="text-3xl bg-[#252525] w-12 h-12 flex items-center justify-center rounded-lg group-hover/card:scale-105 transition-transform shrink-0">
                    {doc.icon || (doc.type === 'folder' ? <Folder className="text-blue-400" size={24} /> : <FileText className="text-[#a3a3a3]" size={24} />)}
                  </div>
                  <div className="relative z-10">
                    {editingDocId === doc.id ? (
                      <input
                        type="text"
                        ref={(el) => {
                          if (el) {
                            el.focus();
                            el.selectionStart = el.value.length;
                            el.selectionEnd = el.value.length;
                          }
                        }}
                        value={editTitle}
                        onChange={(e) => handleTitleChange(doc.id, e.target.value)}
                        onBlur={() => handleRenameSubmit(doc.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSubmit(doc.id);
                          if (e.key === 'Escape') {
                            const originalDoc = documents.find(d => d.id === doc.id);
                            if (originalDoc) {
                              onUpdateDocument(doc.id, { title: originalDoc.title || '' });
                            }
                            setEditingDocId(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-[#2c2c2c] text-white px-1.5 py-0.5 rounded text-[15px] font-medium w-full outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <h3 className={`font-medium truncate text-[15px] pr-6 ${!doc.title ? 'text-[#a3a3a3]' : 'text-white'}`}>
                          {doc.title || 'Untitled'}
                      </h3>
                    )}
                    <p className="text-xs text-[#737373] mt-1.5">
                        Editado em {doc.updated_at ? new Date(doc.updated_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </DocumentContextMenu>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-[#a3a3a3] border-2 border-dashed border-[#2c2c2c] rounded-2xl bg-[#1a1a1a]/50">
            <Folder size={48} className="text-[#3f3f3f] mb-4" />
            <h2 className="text-xl font-medium text-white mb-2">This folder is empty</h2>
            <p className="text-sm">Add pages or subfolders to organize your content.</p>
          </div>
        )}
      </div>
    </div>
  );
}
