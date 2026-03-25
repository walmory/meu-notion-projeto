'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/register', { name, email, password });
      if (response.data.token) {
        localStorage.setItem('notion_token', response.data.token);
        if (response.data.workspace && response.data.workspace.id) {
          localStorage.setItem('activeWorkspaceId', response.data.workspace.id);
        }
        router.push('/');
      } else {
        router.push('/login');
      }
    } catch (error) {
      console.error('Registration failed', error);
      alert('Registration failed. Please try again.');
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#191919] text-white p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1a1a] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600/40 via-blue-500/40 to-transparent"></div>
        
        <div className="flex flex-col items-center mb-8">
          <img 
            src="/logo.png" 
            alt="OPTA Logo" 
            className="w-16 h-16 object-contain mb-4 drop-shadow-md"
          />
          <h1 className="text-2xl font-bold tracking-tight text-white">Create an account</h1>
          <p className="text-sm font-medium text-[#8a8a8a] mt-1">Join the OPTA workspace</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#a3a3a3]" htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-[#252525] border border-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-[#525252] outline-none transition-colors focus:border-white/20 focus:bg-[#2c2c2c]"
              placeholder="John Doe"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#a3a3a3]" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-[#252525] border border-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-[#525252] outline-none transition-colors focus:border-white/20 focus:bg-[#2c2c2c]"
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#a3a3a3]" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-[#252525] border border-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-[#525252] outline-none transition-colors focus:border-white/20 focus:bg-[#2c2c2c]"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-black transition-all hover:bg-gray-200 active:scale-[0.98] mt-2 shadow-sm"
          >
            Create Account
          </button>
        </form>
        <div className="mt-6 pt-6 border-t border-white/5 text-center">
          <p className="text-xs text-[#8a8a8a]">
            Already have an account?{' '}
            <Link href="/login" className="text-white hover:text-blue-400 transition-colors font-medium">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
