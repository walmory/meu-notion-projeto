'use client';

import { useEffect, useState, useRef } from 'react';
import { Command } from 'cmdk';
import { Search, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api, getAuthHeaders, getUserFromToken } from '@/lib/api';

interface SearchResult {
  id: string;
  title: string;
  emoji?: string;
  content?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    const handleCustomOpen = () => setOpen(true);

    document.addEventListener('keydown', down);
    window.addEventListener('open-command-palette', handleCustomOpen);
    
    return () => {
      document.removeEventListener('keydown', down);
      window.removeEventListener('open-command-palette', handleCustomOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const response = await api.get(`/documents/search?q=${encodeURIComponent(query)}`, {
          headers: getAuthHeaders()
        });
        setResults(response.data || []);
      } catch (error) {
        console.error('Search failed', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div 
        className="w-full max-w-xl bg-[#1a1a1a] rounded-xl border border-[#2c2c2c] shadow-2xl overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <Command 
          className="w-full"
          shouldFilter={false} // We filter on the backend
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        >
          <div className="flex items-center px-4 py-3 border-b border-[#2c2c2c]">
            <Search size={18} className="text-[#a3a3a3] mr-3" />
            <Command.Input
              autoFocus
              placeholder={`Search in ${getUserFromToken()?.name || 'User'} Workspace...`}
              value={query}
              onValueChange={setQuery}
              className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-[#737373]"
            />
            <div className="text-[10px] text-[#a3a3a3] bg-[#2c2c2c] rounded px-1.5 py-0.5">ESC</div>
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-[#3f3f3f] scrollbar-track-transparent">
            {loading && query && (
              <Command.Loading>
                <div className="py-6 text-center text-sm text-[#a3a3a3]">Searching...</div>
              </Command.Loading>
            )}

            {!loading && query && results.length === 0 && (
              <Command.Empty className="py-6 text-center text-sm text-[#a3a3a3]">
                No results found for &quot;{query}&quot;
              </Command.Empty>
            )}

            {!loading && results.length > 0 && (
              <Command.Group heading="Documents" className="text-xs text-[#737373] px-2 py-1.5">
                {results.map((doc) => (
                  <Command.Item
                    key={doc.id}
                    value={doc.id}
                    onSelect={() => {
                      router.push(`/documents/${doc.id}`);
                      setOpen(false);
                    }}
                    className="flex items-center gap-3 px-2 py-2 mt-1 rounded-lg cursor-pointer aria-selected:bg-[#2c2c2c] aria-selected:text-white text-[#a3a3a3] transition-colors"
                  >
                    {doc.emoji ? (
                      <span className="text-lg leading-none">{doc.emoji}</span>
                    ) : (
                      <FileText size={18} />
                    )}
                    <span className="text-[14px] font-medium truncate">{doc.title || 'Untitled'}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            
            {!query && (
              <div className="py-6 text-center text-sm text-[#737373]">
                Type a keyword to search your documents
              </div>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
