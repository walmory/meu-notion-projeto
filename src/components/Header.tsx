'use client';

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Star, MoreHorizontal, FileText, Lock, Globe } from 'lucide-react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { useDocuments } from '@/hooks/useDocuments';
import { SharePopover } from '@/components/SharePopover';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useUser } from '@/contexts/UserContext';
import { api, getAuthHeaders } from '@/lib/api';
import useSWR from 'swr';

const fetcher = (url: string) => api.get(url, { headers: getAuthHeaders() }).then(res => res.data);

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const documentId = params.documentId as string | undefined;
  const { documents, toggleFavorite, createDocument } = useDocuments();

  const activeWorkspaceId = typeof window !== 'undefined' ? localStorage.getItem('activeWorkspaceId') : null;
  const { data: teamspaces } = useSWR(
    activeWorkspaceId ? `/teamspaces?workspace_id=${activeWorkspaceId}` : null,
    fetcher
  );

  const currentDoc = useMemo(() => {
    if (!documentId || !documents) return null;
    return documents.find(d => String(d.id) === documentId);
  }, [documentId, documents]);

  // Breadcrumbs logic: Workspace -> Teamspace/Private -> Parents -> Document
  const breadcrumbs = useMemo(() => {
    if (!currentDoc || !documents) return [];
    
    const path: typeof documents = [];
    let current: typeof documents[0] | null | undefined = currentDoc;
    
    while (current) {
      path.unshift(current);
      if (current.parent_id) {
        const nextParentId: string = current.parent_id;
        current = documents.find(d => d.id === nextParentId);
      } else {
        current = null;
      }
    }

    const breadcrumbItems: Array<{ id: string; title: string; icon: React.ReactNode; isDoc?: boolean }> = [];

    // Add root (Workspace or Teamspace)
    if (currentDoc.teamspace_id && teamspaces) {
      const ts = teamspaces.find((t: { id: string; name: string }) => String(t.id) === String(currentDoc.teamspace_id));
      if (ts) {
        breadcrumbItems.push({ id: 'ts', title: ts.name, icon: <Globe size={14} /> });
      }
    } else {
      breadcrumbItems.push({ id: 'private', title: 'Private', icon: <Lock size={14} /> });
    }

    // Add path documents
    path.forEach(doc => {
      breadcrumbItems.push({
        id: doc.id,
        title: doc.title || 'Untitled',
        icon: doc.icon ? <span>{doc.icon}</span> : <FileText size={14} />,
        isDoc: true
      });
    });

    return breadcrumbItems;
  }, [currentDoc, documents, teamspaces]);

  return (
    <div className="absolute top-0 left-0 right-0 z-50 flex flex-col bg-[#191919]/80 backdrop-blur-[10px] border-b border-white/5 transition-all">
      {/* Top Row: Navigation and Tabs */}
      <div className="flex items-center h-10 w-full pl-2 pr-4">
        {/* Left Controls */}
        <div className="flex items-center gap-1 text-[#a3a3a3] mr-2">
          <button type="button" onClick={() => router.back()} className="p-1 hover:bg-white/10 rounded transition-colors" title="Go back">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => router.forward()} className="p-1 hover:bg-white/10 rounded transition-colors" title="Go forward">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Tabs Area */}
        <div className="flex-1 flex items-end h-full overflow-x-auto custom-scrollbar pt-1.5 gap-1">
          {currentDoc && (
            <div className="flex items-center h-full px-3 gap-2 bg-[#2c2c2c] rounded-t-lg border-t border-x border-white/5 min-w-[120px] max-w-[240px] cursor-pointer">
              <span className="text-sm shrink-0">
                {currentDoc.icon ? currentDoc.icon : <FileText size={14} className="text-[#a3a3a3]" />}
              </span>
              <span className="text-[13px] text-white truncate font-medium">
                {currentDoc.title || 'Untitled'}
              </span>
            </div>
          )}
          
          {/* New Tab Button */}
          <button 
            type="button"
            onClick={() => createDocument({ title: '', is_shared: false })}
            className="p-1.5 mb-1 text-[#a3a3a3] hover:bg-white/10 hover:text-white rounded-md transition-colors"
            title="New tab"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Bottom Row: Breadcrumbs and Actions */}
      <div className="flex items-center justify-between h-11 px-4 w-full">
        {/* Left: Breadcrumbs */}
        <div className="flex items-center text-[14px] text-[#a3a3a3] overflow-hidden">
          {currentDoc ? (
            breadcrumbs.map((item, idx) => (
              <React.Fragment key={item.id}>
                <button 
                  type="button"
                  onClick={() => item.isDoc ? router.push(`/documents/${item.id}`) : null}
                  className={`hover:bg-white/5 hover:text-white px-1.5 py-1 rounded transition-colors flex items-center gap-1.5 ${idx === breadcrumbs.length - 1 ? 'text-white' : ''}`}
                >
                  {item.icon && <span className="text-[#a3a3a3]">{item.icon}</span>}
                  <span className="truncate max-w-[150px] font-medium">{item.title}</span>
                </button>
                {idx < breadcrumbs.length - 1 && (
                  <span className="px-0.5 text-[#555] font-light">/</span>
                )}
              </React.Fragment>
            ))
          ) : (
            <div className="flex items-center text-[14px] text-[#a3a3a3]">
              <span className="px-1.5 py-1 font-medium text-white capitalize">
                {pathname === '/' ? 'Home' : pathname.replace('/', '')}
              </span>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 text-[#a3a3a3] shrink-0">
          {currentDoc && (
            <>
              <SharePopover document={currentDoc} />
              
              <button 
                type="button"
                onClick={() => toggleFavorite(currentDoc.id)}
                className="p-1.5 hover:bg-white/10 hover:text-white rounded-md transition-colors"
                title="Favorite"
              >
                <Star 
                  size={18} 
                  className={currentDoc.is_favorite ? "fill-yellow-500 text-yellow-500" : ""} 
                />
              </button>
            </>
          )}

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="p-1.5 hover:bg-white/10 hover:text-white rounded-md transition-colors">
                <MoreHorizontal size={18} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
               <DropdownMenu.Content align="end" className="z-[9999] min-w-[180px] bg-[#252525] border border-[#3f3f3f] rounded-lg shadow-xl p-1">
                 <DropdownMenu.Item className="px-3 py-2 text-[13px] text-[#d4d4d4] hover:bg-[#3f3f3f] hover:text-white rounded cursor-pointer outline-none">
                    Page options
                 </DropdownMenu.Item>
               </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </div>
  );
}
