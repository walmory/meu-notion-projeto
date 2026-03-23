'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api, getAuthHeaders } from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface WorkspaceCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkspaceCreated: (workspaceId: string) => void;
}

export function WorkspaceCreateModal({ isOpen, onClose, onWorkspaceCreated }: WorkspaceCreateModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setSuccess(false);
    try {
      // Como removemos o state icon, enviaremos vazio para o backend resolver ou salvamos apenas 'W'
      const res = await api.post('/workspaces', { name, icon: name.charAt(0).toUpperCase() }, { headers: getAuthHeaders() });
      
      // Delay intencional para exibir o estado de loading e suavizar a UX (AAA+)
      await new Promise(resolve => setTimeout(resolve, 400));
      
      setSuccess(true);
      await new Promise(resolve => setTimeout(resolve, 800)); // Show success message for 800ms
      
      setName('');
      setSuccess(false);
      onWorkspaceCreated(res.data.id);
      onClose();
    } catch (error) {
      console.error('Failed to create workspace', error);
      alert('Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#191919] border-[#2c2c2c] text-[#d4d4d4] sm:max-w-[425px]">
        <form onSubmit={handleCreate}>
          <DialogHeader className="text-center pb-2">
            <div className="mx-auto bg-gray-600 text-white w-14 h-14 rounded-xl flex items-center justify-center text-2xl mb-4 font-semibold shadow-sm">
              {name ? name.charAt(0).toUpperCase() : 'W'}
            </div>
            <DialogTitle className="text-white text-xl font-semibold text-center">Create a new workspace</DialogTitle>
            <DialogDescription className="text-[#9b9b9b] text-center mt-2">
              Workspaces are home to your team&apos;s pages, projects, and documents.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 mt-2">
            <div className="grid gap-2">
              <label htmlFor="ws-name" className="text-xs font-medium text-[#9b9b9b]">Workspace name</label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="bg-[#252525] border-[#2c2c2c] text-white focus-visible:ring-1 focus-visible:ring-white/20 h-10"
                required
              />
            </div>
          </div>
          <div className="flex justify-center gap-2 pt-4 mt-4">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onClose} 
              className="hover:bg-white/5 text-[#d4d4d4] hover:text-white h-9 px-6"
              disabled={loading || success}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!name.trim() || loading || success} 
              className={`h-9 px-6 font-medium transition-all ${
                success 
                  ? "bg-green-500 hover:bg-green-600 text-white" 
                  : "bg-[#2383e2] hover:bg-[#2383e2]/90 text-white"
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </span>
              ) : success ? 'Success!' : 'Create workspace'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
