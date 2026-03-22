'use client';

import { useEffect, use } from 'react';
import { motion } from 'framer-motion';

export default function WorkspaceRedirect({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  
  useEffect(() => {
    localStorage.setItem('activeWorkspaceId', unwrappedParams.id);
    
    // Animação AAA+ e delay antes do hard reload
    const timer = setTimeout(() => {
      window.location.href = '/';
    }, 1200);

    return () => clearTimeout(timer);
  }, [unwrappedParams.id]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#191919] text-white">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="flex flex-col items-center gap-8"
      >
        <div className="relative flex h-20 w-20 items-center justify-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute h-full w-full rounded-full border-[3px] border-[#2c2c2c] border-t-[#2eaadc]"
          />
          <motion.div 
            animate={{ rotate: -360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute h-14 w-14 rounded-full border-[3px] border-transparent border-t-[#2eaadc]/40"
          />
          <motion.div 
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
            className="h-6 w-6 rounded-sm bg-[#2eaadc] shadow-[0_0_15px_rgba(46,170,220,0.5)]"
          />
        </div>
        
        <div className="flex flex-col items-center gap-2">
          <motion.h2 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-2xl font-semibold text-white tracking-tight"
          >
            Conectando ao Workspace
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-sm text-[#8a8a8a]"
          >
            Preparando seu ambiente de trabalho...
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
