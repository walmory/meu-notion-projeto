'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Document } from '@/hooks/useDocuments';
import { Search, Clock, FileText, Sparkles, MoreHorizontal, Trash, Edit2 } from 'lucide-react';
import { Editor } from '@/components/Editor';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { api, getAuthHeaders } from '@/lib/api';
import { DocumentContextMenu } from '@/components/DocumentContextMenu';
import { useUser } from '@/contexts/UserContext';
import { DynamicInviteWidget } from '@/components/DynamicInviteWidget';

interface DashboardProps {
  documents: Document[];
  onSelectDocument: (doc: Document) => void;
  createDocument: (title: string, is_shared?: boolean, parent_id?: string | null) => Promise<Document>;
  onUpdate: () => void;
  onUpdateDocument: (id: string, updates: Partial<Document>) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteDocument: (id: string) => void;
  onDuplicateDocument: (id: string) => void;
}

export function Dashboard({ documents, onSelectDocument, createDocument, onUpdate, onUpdateDocument, onToggleFavorite, onDeleteDocument, onDuplicateDocument }: DashboardProps) {
  const [greeting, setGreeting] = useState('Bem-vindo');
  const { user } = useUser();
  const [quickNotesDoc, setQuickNotesDoc] = useState<Document | null>(null);
  const isCreatingRef = useRef(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) setGreeting('Bom dia');
    else if (hour >= 12 && hour < 18) setGreeting('Boa tarde');
    else setGreeting('Boa noite');
  }, []);

  // Recents
  const recentDocs = useMemo(() => {
    return [...documents]
      .filter(doc => doc.title !== 'Rascunhos Rápidos' && doc.is_trash !== true && doc.is_trash !== 1)
      .sort((a, b) => {
        const dateA = new Date(a.updated_at || 0).getTime();
        const dateB = new Date(b.updated_at || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 3);
  }, [documents]);

  // Quick notes document
  useEffect(() => {
    const doc = documents.find(d => d.title === 'Rascunhos Rápidos');
    if (doc) {
      setQuickNotesDoc(doc);
    } else if (quickNotesDoc) {
      // It was deleted
      setQuickNotesDoc(null);
    } else if (!isCreatingRef.current && documents.length === 0 && !localStorage.getItem('quick_notes_deleted')) {
      // Only auto-create if it's a brand new workspace
      isCreatingRef.current = true;
      const createIt = async () => {
        try {
          const newDoc = await createDocument('Rascunhos Rápidos', false);
          setQuickNotesDoc(newDoc);
        } catch(e) {
          console.error('Error creating Quick Notes', e);
        } finally {
          isCreatingRef.current = false;
        }
      };
      createIt();
    }
  }, [documents, createDocument, quickNotesDoc]);

  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const startRename = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(doc.title || '');
    setEditingDocId(doc.id);
  };

  const handleTitleChange = (docId: string, newTitle: string) => {
    setEditTitle(newTitle);
    // Optimistic update em tempo real enquanto digita
    onUpdateDocument(docId, { title: newTitle });
  };

  const handleRenameSubmit = async (docId: string) => {
    if (editTitle.trim() !== '') {
      try {
        await onUpdateDocument(docId, { title: editTitle.trim() });
      } catch (error) {
        console.error('Failed to rename', error);
      }
    } else {
      // Reverter se ficar vazio
      const doc = documents.find(d => d.id === docId);
      if (doc) {
        onUpdateDocument(docId, { title: doc.title || '' });
      }
    }
    setEditingDocId(null);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.patch(`/documents/${id}`, { is_trash: true }, { headers: getAuthHeaders() });
      onUpdate();
    } catch (error) {
      console.error('Failed to delete document', error);
    }
  };



  return (
    <main className="flex-1 overflow-y-auto bg-[#191919] relative w-full h-full flex flex-col items-center">
       <div className="w-full max-w-4xl px-8 pt-24 pb-12 flex flex-col gap-12">
          {/* Header */}
          <div className="text-center space-y-4">
             <h1 className="text-4xl md:text-5xl font-bold text-white flex items-center justify-center gap-3">
                {greeting}, {
                  !isMounted || !user?.name ? (
                    <span className="inline-block h-10 w-40 rounded-md bg-[#2c2c2c] animate-pulse" />
                  ) : (
                    user.name
                  )
                }
                <Sparkles className="text-yellow-500" size={32} />
             </h1>
             <p className="text-white text-base font-semibold tracking-wide min-h-[24px]">
               {!isMounted || !user?.name ? (
                 <span className="inline-block h-5 w-28 rounded-md bg-[#2c2c2c] animate-pulse" />
               ) : (
                 user.name
               )}
             </p>
             <p className="text-[#a3a3a3] text-lg">Ready to capture your best ideas today?</p>
          </div>

          {/* Search Input */}
          <button 
             type="button"
             className="w-full max-w-2xl mx-auto bg-[#1a1a1a] border border-[#2c2c2c] rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:bg-[#252525] transition shadow-lg group outline-none focus-visible:ring-2 focus-visible:ring-[#3f3f3f]"
             onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
          >
             <Search className="text-[#a3a3a3] group-hover:text-white transition" size={24} />
             <span className="text-[#737373] text-lg flex-1 text-left">O que vamos escrever hoje?</span>
             <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-[#a3a3a3] bg-[#2c2c2c] px-2 py-1 rounded">⌘</span>
                <span className="text-xs font-semibold text-[#a3a3a3] bg-[#2c2c2c] px-2 py-1 rounded">K</span>
             </div>
          </button>

          {/* Recent Docs */}
          {recentDocs.length > 0 && (
             <div className="space-y-4 w-full">
                <div className="flex items-center gap-2 text-[#a3a3a3] px-1">
                   <Clock size={18} />
                   <h2 className="font-medium">Continue de onde parou</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   {recentDocs.map(doc => (
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
                            {/* Clicar neste botão transparente aciona o onSelectDocument mantendo acessibilidade */}
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
                              {doc.icon || <FileText className="text-[#a3a3a3]" size={24} />}
                            </div>
                            <div className="relative z-10">
                                {editingDocId === doc.id ? (
                                  <input
                                    type="text"
                                    ref={(el) => {
                                      if (el) {
                                        el.focus();
                                        // Move cursor to the end
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
                                   Editado em {new Date(doc.updated_at || Date.now()).toLocaleDateString()}
                                </p>
                             </div>
                         </div>
                       </DocumentContextMenu>
                   ))}
                </div>
             </div>
          )}
          
          {/* Quick Notes and Invite Widget Grid */}
          <div className="mt-4 w-full grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
               <div className="flex items-center gap-2 text-[#a3a3a3] px-1">
                  <FileText size={18} />
                  <h2 className="font-medium">Rascunhos Rápidos</h2>
               </div>
               <div className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-xl p-0 min-h-[400px] flex flex-col shadow-sm overflow-hidden">
                  {quickNotesDoc ? (
                     <div className="flex-1 w-full relative">
                        <div className="absolute inset-0">
                          <Editor document={quickNotesDoc} onUpdate={onUpdate} onUpdateDocument={onUpdateDocument} hideHeader={true} />
                        </div>
                     </div>
                  ) : (
                     <div className="flex flex-col items-center justify-center flex-1 text-[#737373] gap-4 min-h-[200px]">
                        <p>The drafts block does not exist or was deleted.</p>
                        <button 
                           type="button"
                           onClick={async () => {
                             const newDoc = await createDocument('Rascunhos Rápidos', false);
                             setQuickNotesDoc(newDoc);
                           }}
                           className="px-4 py-2 bg-[#2c2c2c] hover:bg-[#3f3f3f] text-white rounded transition"
                        >
                           Create New Draft
                        </button>
                     </div>
                  )}
               </div>
            </div>
            
            <div className="md:col-span-1 pt-10">
              <DynamicInviteWidget />
            </div>
          </div>
       </div>
    </main>
  );
}
