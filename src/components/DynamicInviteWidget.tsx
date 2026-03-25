'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, getAuthHeaders } from '@/lib/api';
import { Clock } from 'lucide-react';

export function DynamicInviteWidget() {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    const fetchInitialCode = async () => {
      try {
        const res = await api.get('/auth/current-invite-code', { headers: getAuthHeaders() });
        if (mounted) {
          setCode(res.data.code);
          setExpiresAt(new Date(res.data.expiresAt));
        }
      } catch (e) {
        console.error('Failed to fetch dynamic invite code', e);
      }
    };
    fetchInitialCode();
    return () => { mounted = false; };
  }, []);

  const fetchCode = useCallback(async () => {
    try {
      const res = await api.get('/auth/current-invite-code', { headers: getAuthHeaders() });
      setCode(res.data.code);
      setExpiresAt(new Date(res.data.expiresAt));
    } catch (e) {
      console.error('Failed to fetch dynamic invite code', e);
    }
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = expiresAt.getTime() - now;
      
      if (distance <= 0) {
        clearInterval(interval);
        setTimeLeft('Expired');
        setTimeout(() => fetchCode(), 1000); // Auto refresh when expired, delayed to avoid immediate state update in render cycle
        return;
      }
      
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [expiresAt, fetchCode]);

  if (!code) return null;

  return (
    <div className="bg-[#1a1a1a] border border-[#2c2c2c] rounded-xl p-5 flex flex-col items-center justify-center space-y-3 shadow-lg max-w-sm w-full mx-auto relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500/40 via-emerald-400/40 to-transparent"></div>
      
      <h3 className="text-sm font-semibold text-[#a3a3a3]">Invite New Member</h3>
      
      <div className="text-4xl font-black tracking-[0.2em] text-white bg-[#141414] px-6 py-3 rounded-lg border border-[#2c2c2c] shadow-inner font-mono">
        {code}
      </div>
      
      <div className="flex items-center text-xs font-medium text-emerald-400 gap-1.5 mt-2 bg-emerald-500/10 px-3 py-1.5 rounded-full">
        <Clock size={14} className="animate-pulse" />
        <span>Expires in {timeLeft}</span>
      </div>
      
      <p className="text-[11px] text-[#525252] text-center px-4 mt-2">
        Give this code to a colleague. It is required to create a new OPTA account.
      </p>
    </div>
  );
}