'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getAuthHeaders } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user, refreshUser, setUser } = useUser();
  
  // Profile states
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Email states
  const [newEmail, setNewEmail] = useState('');
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || '');
      setAvatarUrl(user.avatar_url || '');
    }
    
    const fetchProfile = async () => {
      setFetching(true);
      try {
        const response = await axios.get('https://apinotion.andrekehrer.com/user/profile', {
          headers: getAuthHeaders()
        });
        const data = response.data;
        if (data.name) setName(data.name);
        if (data.bio) setBio(data.bio);
        if (data.avatar_url) setAvatarUrl(data.avatar_url);
      } catch (error) {
        console.error('Failed to fetch profile', error);
        if (user?.name) setName(user.name);
      } finally {
        setFetching(false);
      }
    };
    
    fetchProfile();
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);

    try {
      const optimisticUser = { ...user, name, bio, avatar_url: avatarUrl };
      setUser(optimisticUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_profile_cache', JSON.stringify(optimisticUser));
      }

      await axios.put(
        'https://apinotion.andrekehrer.com/user/profile',
        { name, bio, avatar_url: avatarUrl },
        { headers: getAuthHeaders() }
      );
      
      await refreshUser(); 
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile', error);
      if (user) setUser(user);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !currentPasswordForEmail) return;

    setEmailLoading(true);

    try {
      await axios.put(
        'https://apinotion.andrekehrer.com/user/update-email',
        { newEmail, currentPassword: currentPasswordForEmail },
        { headers: getAuthHeaders() }
      );
      
      await refreshUser();
      toast.success('Email updated successfully!');
      setNewEmail('');
      setCurrentPasswordForEmail('');
    } catch (error) {
      console.error('Failed to update email', error);
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || 'Failed to update email.');
      } else {
        toast.error('Failed to update email.');
      }
    } finally {
      setEmailLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) return;

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    setPasswordLoading(true);

    try {
      await axios.put(
        'https://apinotion.andrekehrer.com/user/update-password',
        { currentPassword, newPassword },
        { headers: getAuthHeaders() }
      );
      
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Failed to update password', error);
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || 'Failed to update password.');
      } else {
        toast.error('Failed to update password.');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#191919] overflow-y-auto">
      <div className="flex-1 max-w-[800px] w-full mx-auto p-8 sm:p-12 md:p-16 lg:p-24">
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Settings</h1>
          <p className="text-[#a3a3a3] text-lg">
            Manage your profile, email, and password.
          </p>
        </header>

        <div className="space-y-16">
          {/* Profile Form */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-6">Public Profile</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-6 max-w-xl">
              <div className="space-y-3">
                <label htmlFor="name" className="text-sm font-medium text-[#a3a3a3]">Name</label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="bg-[#262626] border-white/10 text-white placeholder:text-[#525252] h-12 text-base"
                  required
                />
              </div>
              
              <div className="space-y-3">
                <label htmlFor="bio" className="text-sm font-medium text-[#a3a3a3]">Bio</label>
                <Input
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us a little about yourself"
                  className="bg-[#262626] border-white/10 text-white placeholder:text-[#525252] h-12 text-base"
                />
              </div>

              <div className="space-y-3">
                <label htmlFor="avatarUrl" className="text-sm font-medium text-[#a3a3a3]">Avatar URL</label>
                <Input
                  id="avatarUrl"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="bg-[#262626] border-white/10 text-white placeholder:text-[#525252] h-12 text-base"
                />
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={loading || fetching || !name.trim()}
                  className="bg-white hover:bg-gray-200 text-black transition-all px-6 py-2 h-auto text-sm font-medium"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Update Profile
                </Button>
              </div>
            </form>
          </section>

          <div className="h-px bg-white/10 w-full" />

          {/* Email Form */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-2">Email</h2>
            <p className="text-[#a3a3a3] mb-6 text-sm">
              Confirm your identity using your current password to change your email.
            </p>
            <form onSubmit={handleUpdateEmail} className="space-y-6 max-w-xl">
              <div className="space-y-3">
                <label htmlFor="newEmail" className="text-sm font-medium text-[#a3a3a3]">New Email</label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="bg-[#262626] border-white/10 text-white placeholder:text-[#525252] h-12 text-base"
                  required
                />
              </div>
              
              <div className="space-y-3">
                <label htmlFor="currentPasswordForEmail" className="text-sm font-medium text-[#a3a3a3]">Current Password</label>
                <Input
                  id="currentPasswordForEmail"
                  type="password"
                  value={currentPasswordForEmail}
                  onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
                  placeholder="Your current password"
                  className="bg-[#262626] border-white/10 text-white placeholder:text-[#525252] h-12 text-base"
                  required
                />
              </div>
              
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={emailLoading || !newEmail.trim() || !currentPasswordForEmail}
                  className="bg-white hover:bg-gray-200 text-black transition-all px-6 py-2 h-auto text-sm font-medium"
                >
                  {emailLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Update Email
                </Button>
              </div>
            </form>
          </section>

          <div className="h-px bg-white/10 w-full" />

          {/* Password Form */}
          <section className="pb-24">
            <h2 className="text-2xl font-semibold text-white mb-2">Password</h2>
            <p className="text-[#a3a3a3] mb-6 text-sm">
              Change your account password. Confirm your current password for security.
            </p>
            <form onSubmit={handleUpdatePassword} className="space-y-6 max-w-xl">
              <div className="space-y-3">
                <label htmlFor="currentPassword" className="text-sm font-medium text-[#a3a3a3]">Current Password</label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Your current password"
                  className="bg-[#262626] border-white/10 text-white placeholder:text-[#525252] h-12 text-base"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label htmlFor="newPassword" className="text-sm font-medium text-[#a3a3a3]">New Password</label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Your new password"
                    className="bg-[#262626] border-white/10 text-white placeholder:text-[#525252] h-12 text-base"
                    required
                  />
                </div>

                <div className="space-y-3">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-[#a3a3a3]">Confirm Password</label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="bg-[#262626] border-white/10 text-white placeholder:text-[#525252] h-12 text-base"
                    required
                  />
                </div>
              </div>
              
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                  className="bg-white hover:bg-gray-200 text-black transition-all px-6 py-2 h-auto text-sm font-medium"
                >
                  {passwordLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Update Password
                </Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}