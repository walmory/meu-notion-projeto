'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setIsSuccess(true);
      toast.success('Reset link sent to your email.');
    } catch (error) {
      console.error('Failed to request password reset', error);
      toast.error('Failed to send reset link. Please try again.');
    } finally {
      setIsLoading(false);
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Reset Password</h1>
          <p className="text-sm font-medium text-[#8a8a8a] mt-1 text-center">
            Enter your email to receive a password reset link.
          </p>
        </div>

        {isSuccess ? (
          <div className="text-center space-y-6">
            <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-lg text-sm">
              If an account with that email exists, we&apos;ve sent you a password reset link.
            </div>
            <Link 
              href="/login"
              className="inline-block w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-black transition-all hover:bg-gray-200 active:scale-[0.98] shadow-sm"
            >
              Return to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
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
            
            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-black transition-all hover:bg-gray-200 active:scale-[0.98] mt-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
        
        <div className="mt-6 pt-6 border-t border-white/5 text-center">
          <Link href="/login" className="text-xs font-medium text-[#8a8a8a] hover:text-white transition-colors">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}