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
    <div className="flex h-screen items-center justify-center bg-[#191919] text-white">
      <div className="w-full max-w-sm rounded-lg border border-[#2d2d2d] bg-[#1a1a1a] p-8">
        <h1 className="mb-6 text-center text-2xl font-semibold">Sign up</h1>
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#a3a3a3]" htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded bg-[#2d2d2d] px-3 py-2 text-white placeholder-[#a3a3a3] outline-none focus:border-[#a3a3a3] focus:ring-1 focus:ring-[#a3a3a3]"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#a3a3a3]" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded bg-[#2d2d2d] px-3 py-2 text-white placeholder-[#a3a3a3] outline-none focus:border-[#a3a3a3] focus:ring-1 focus:ring-[#a3a3a3]"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#a3a3a3]" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded bg-[#2d2d2d] px-3 py-2 text-white placeholder-[#a3a3a3] outline-none focus:border-[#a3a3a3] focus:ring-1 focus:ring-[#a3a3a3]"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-white py-2 font-medium text-black transition hover:bg-gray-200"
          >
            Continue
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-[#a3a3a3]">
          Already have an account?{' '}
          <Link href="/login" className="text-white hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
