'use client';

import React, { useEffect } from 'react';
import { useSidePeek } from '@/contexts/SidePeekContext';
import { useDocuments } from '@/hooks/useDocuments';
import { Editor } from '@/components/Editor';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function SidePeekDrawer() {
  const { sidePeekDocId, closeSidePeek } = useSidePeek();
  const { documents, refetch, updateDocument } = useDocuments();

  const document = documents?.find(d => String(d.id) === String(sidePeekDocId)) || null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidePeekDocId) {
        closeSidePeek();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidePeekDocId, closeSidePeek]);

  return (
    <AnimatePresence>
      {sidePeekDocId && document && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[90]"
            onClick={closeSidePeek}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-screen w-[600px] max-w-[90vw] bg-[#191919] border-l border-[#2c2c2c] z-[100] flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2c2c2c] bg-[#1a1a1a]">
              <span className="text-sm font-medium text-[#a3a3a3]">Side Peek</span>
              <button
                type="button"
                onClick={closeSidePeek}
                className="p-1 rounded-md hover:bg-[#2c2c2c] text-[#a3a3a3] hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Editor document={document} onUpdate={refetch} onUpdateDocument={updateDocument} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
