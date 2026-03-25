'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, getAuthHeaders } from '@/lib/api';

export default function SetupInicialPage() {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('notion_token');
    if (!token) {
      router.replace('/login');
    }
  }, [router]);

  const handleCreateWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workspaceName.trim() || isCreating) {
      return;
    }

    setIsCreating(true);

    try {
      const response = await api.post(
        '/workspaces',
        { name: workspaceName.trim() },
        { headers: getAuthHeaders() }
      );
      const createdWorkspaceId = response.data?.id ? String(response.data.id) : null;
      if (!createdWorkspaceId) {
        throw new Error('Invalid workspace');
      }
      localStorage.setItem('activeWorkspaceId', createdWorkspaceId);
      router.push(`/workspace/${createdWorkspaceId}`);
    } catch (error) {
      console.error('Failed to create workspace', error);
      alert('Could not create the workspace.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#191919] text-[#d4d4d4] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/5 bg-[#202020] p-6 shadow-2xl">
        <h1 className="text-xl font-semibold text-white">Welcome!</h1>
        <p className="mt-2 text-sm text-[#9b9b9b]">
          You don&apos;t have any active workspaces. Create a new one to continue.
        </p>
        <form onSubmit={handleCreateWorkspace} className="mt-6 space-y-3">
          <Input
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="Workspace Name"
            className="bg-[#2c2c2c] border-white/10 text-white placeholder:text-[#8a8a8a]"
          />
          <Button
            type="submit"
            disabled={!workspaceName.trim() || isCreating}
            className="w-full bg-[#2383e2] hover:bg-[#2383e2]/90 text-white"
          >
            {isCreating ? 'Creating...' : 'Create workspace'}
          </Button>
        </form>
      </div>
    </div>
  );
}
