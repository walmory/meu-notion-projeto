'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setErrorMsg('Invalid or missing password reset token. Please request a new one.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setIsSuccess(true);
      toast.success('Password successfully reset!');
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error: unknown) {
      console.error('Failed to reset password', error);
      const err = error as { response?: { data?: { error?: string } } };
      setErrorMsg(err.response?.data?.error || 'Failed to reset password. The link may have expired.');
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Create New Password</h1>
          <p className="text-sm font-medium text-[#8a8a8a] mt-1 text-center">
            Enter your new password below.
          </p>
        </div>

        {isSuccess ? (
          <div className="text-center space-y-6">
            <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-lg text-sm">
              Your password has been successfully reset. Redirecting to login...
            </div>
            <Link 
              href="/login"
              className="inline-block w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-black transition-all hover:bg-gray-200 active:scale-[0.98] shadow-sm"
            >
              Go to Login now
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs">
                {errorMsg}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#a3a3a3]" htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={!token}
                className="w-full rounded-lg bg-[#252525] border border-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-[#525252] outline-none transition-colors focus:border-white/20 focus:bg-[#2c2c2c] disabled:opacity-50"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#a3a3a3]" htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={!token}
                className="w-full rounded-lg bg-[#252525] border border-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-[#525252] outline-none transition-colors focus:border-white/20 focus:bg-[#2c2c2c] disabled:opacity-50"
                placeholder="••••••••"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !token || !newPassword || !confirmPassword}
              className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-black transition-all hover:bg-gray-200 active:scale-[0.98] mt-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
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