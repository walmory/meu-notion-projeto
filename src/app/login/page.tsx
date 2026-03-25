'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, setAuthSession } from '@/lib/api';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.data.token) {
        setAuthSession(response.data.token, response.data.workspace?.id ?? null);
        router.push('/');
      }
    } catch (error) {
      console.error('Login failed', error);
      alert('Login failed. Please check your credentials.');
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
            className="w-[112px] h-[112px] object-contain mb-4 drop-shadow-md"
          />
          <h1 className="text-2xl font-bold tracking-tight text-white">Welcome back</h1>
          <p className="text-sm font-medium text-[#8a8a8a] mt-1">Log in to your workspace</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
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
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-[#252525] border border-white/5 px-3.5 pr-11 py-2.5 text-sm text-white placeholder:text-[#525252] outline-none transition-colors focus:border-white/20 focus:bg-[#2c2c2c]"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8a8a] hover:text-white transition-colors"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-black transition-all hover:bg-gray-200 active:scale-[0.98] mt-2 shadow-sm"
          >
            Continue to Workspace
          </button>
        </form>
        <div className="mt-6 pt-6 border-t border-white/5 text-center">
          <p className="text-xs text-[#8a8a8a]">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-white hover:text-blue-400 transition-colors font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
