'use client';

import React, { useEffect, useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { getAuthHeaders } from '@/lib/api';
import axios from 'axios';
import { Edit, Mail, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface ProfileData {
  name: string;
  email: string;
  bio: string;
  avatar_url: string;
}

export default function ProfilePage() {
  const { user, refreshUser, setUser } = useUser();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // UI State - Removido pois vamos mostrar tudo de uma vez

  // Edit Profile States
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Email states
  const [newEmail, setNewEmail] = useState('');
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const fetchProfile = async () => {
    try {
      const response = await axios.get('https://apinotion.andrekehrer.com/user/profile', {
        headers: getAuthHeaders()
      });
      setProfile(response.data);
      
      // Populate forms
      if (response.data.name) setName(response.data.name);
      if (response.data.bio) setBio(response.data.bio);
      if (response.data.avatar_url) setAvatarUrl(response.data.avatar_url);
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (user?.name) setName(user.name);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setProfileLoading(true);

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
      await fetchProfile();
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile', error);
      if (user) setUser(user);
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setProfileLoading(false);
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
      await fetchProfile();
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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#191919] min-h-0">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  const displayData = profile || user;
  const initial = displayData?.name ? displayData.name.charAt(0).toUpperCase() : 'U';

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#191919] overflow-y-auto">
      {/* Banner/Header */}
      <div className="w-full h-48 bg-gradient-to-r from-[#2a2a2a] to-[#1f1f1f] border-b border-white/5 relative">
        <div className="absolute top-6 left-8 sm:left-12 md:left-24">
          <span className="text-xs font-semibold tracking-wider text-[#a3a3a3] uppercase">
            Public Profile of {displayData?.name?.split(' ')[0] || 'User'}
          </span>
        </div>
      </div>

      <div className="flex-1 max-w-[1000px] w-full mx-auto px-6 sm:px-10 md:px-16 relative pb-24">
        {/* Avatar Section */}
        <div className="relative -mt-16 sm:-mt-20 mb-4 sm:mb-6 flex items-end">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[#262626] border-4 border-[#191919] flex items-center justify-center overflow-hidden shadow-xl shrink-0 z-10">
            {displayData?.avatar_url ? (
              <img 
                src={displayData.avatar_url} 
                alt={displayData.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-4xl sm:text-5xl font-medium text-white">{initial}</span>
            )}
          </div>
        </div>

        {/* Layout Integrado: View (Esquerda) e Edit (Direita/Abaixo) */}
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-start mt-2">
          
          {/* Coluna da Esquerda: Info e Activity */}
          <div className="w-full lg:w-[40%] xl:w-[35%] shrink-0">
            <div className="mb-10">
              <h1 className="text-4xl font-bold text-white mb-2 leading-tight">
                {displayData?.name || 'User'}
              </h1>
              <div className="flex items-center text-[#a3a3a3] mb-6">
                <Mail className="w-4 h-4 mr-2 shrink-0" />
                <span className="text-sm truncate">{displayData?.email || 'No email provided'}</span>
              </div>
              
              <div className="prose prose-invert max-w-none">
                {displayData?.bio ? (
                  <p className="text-[#d4d4d4] text-[15px] leading-relaxed whitespace-pre-wrap">
                    {displayData.bio}
                  </p>
                ) : (
                  <p className="text-[#525252] text-[15px] italic">
                    No bio yet.
                  </p>
                )}
              </div>
            </div>

            <div className="h-px bg-white/10 w-full mb-8" />

            {/* Recent Activity Skeleton */}
            <section>
              <h2 className="text-sm font-semibold text-[#8a8a8a] uppercase tracking-wider mb-4">Recent Activity</h2>
              
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-white/5 bg-[#262626]/50 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded bg-[#333333] animate-pulse shrink-0" />
                    <div className="space-y-1.5">
                      <div className="h-3 w-32 bg-[#333333] rounded animate-pulse" />
                      <div className="h-2 w-16 bg-[#333333] rounded animate-pulse" />
                    </div>
                  </div>
                </div>
                
                <div className="p-3 rounded-lg border border-white/5 bg-[#262626]/50 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded bg-[#333333] animate-pulse shrink-0" />
                    <div className="space-y-1.5">
                      <div className="h-3 w-24 bg-[#333333] rounded animate-pulse" />
                      <div className="h-2 w-12 bg-[#333333] rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Divisor Vertical (Apenas Desktop) */}
          <div className="hidden lg:block w-px bg-white/5 self-stretch" />

          {/* Coluna da Direita: Settings / Forms */}
          <div className="w-full lg:flex-1 space-y-12">
            
            {/* Profile Form */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                <Edit className="w-5 h-5 mr-2 text-[#a3a3a3]" />
                Profile Settings
              </h2>
              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div className="space-y-2.5">
                  <label htmlFor="name" className="text-xs font-medium text-[#a3a3a3]">Name</label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="bg-[#262626] border-white/10 text-white placeholder:text-[#525252] h-10 text-sm focus-visible:ring-1 focus-visible:ring-white/20"
                    required
                  />
                </div>
                
                <div className="space-y-2.5">
                  <label htmlFor="bio" className="text-xs font-medium text-[#a3a3a3]">Bio</label>
                  <Input
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us a little about yourself"
                    className="bg-[#262626] border-white/10 text-white placeholder:text-[#525252] h-10 text-sm focus-visible:ring-1 focus-visible:ring-white/20"
                  />
                </div>

                <div className="space-y-2.5">
                  <label htmlFor="avatarUrl" className="text-xs font-medium text-[#a3a3a3]">Avatar URL</label>
                  <Input
                    id="avatarUrl"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="bg-[#262626] border-white/10 text-white placeholder:text-[#525252] h-10 text-sm focus-visible:ring-1 focus-visible:ring-white/20"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={profileLoading || !name.trim()}
                    className="bg-white hover:bg-gray-200 text-black transition-all px-4 py-2 h-auto text-xs font-medium rounded-md"
                  >
                    {profileLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                    Save Profile
                  </Button>
                </div>
              </form>
            </section>

            <div className="h-px bg-white/5 w-full" />

            {/* Email Form */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-2">Account Email</h2>
              <p className="text-[#8a8a8a] mb-6 text-xs">
                Confirm your identity using your current password to change your email.
              </p>
              <form onSubmit={handleUpdateEmail} className="space-y-5">
                <div className="space-y-2.5">
                  <label htmlFor="newEmail" className="text-xs font-medium text-[#a3a3a3]">New Email</label>
                  <Input
                    id="newEmail"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="bg-[#262626] border-white/10 text-white placeholder:text-[#525252] h-10 text-sm focus-visible:ring-1 focus-visible:ring-white/20"
                    required
                  />
                </div>
                
                <div className="space-y-2.5">
                  <label htmlFor="currentPasswordForEmail" className="text-xs font-medium text-[#a3a3a3]">Current Password</label>
                  <Input
                    id="currentPasswordForEmail"
                    type="password"
                    value={currentPasswordForEmail}
                    onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
                    placeholder="Your current password"
                    className="bg-[#262626] border-white/10 text-white placeholder:text-[#525252] h-10 text-sm focus-visible:ring-1 focus-visible:ring-white/20"
                    required
                  />
                </div>
                
                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={emailLoading || !newEmail.trim() || !currentPasswordForEmail}
                    className="bg-white hover:bg-gray-200 text-black transition-all px-4 py-2 h-auto text-xs font-medium rounded-md"
                  >
                    {emailLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                    Update Email
                  </Button>
                </div>
              </form>
            </section>

            <div className="h-px bg-white/5 w-full" />

            {/* Password Form */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-2">Security</h2>
              <p className="text-[#8a8a8a] mb-6 text-xs">
                Change your account password. Confirm your current password for security.
              </p>
              <form onSubmit={handleUpdatePassword} className="space-y-5">
                <div className="space-y-2.5">
                  <label htmlFor="currentPassword" className="text-xs font-medium text-[#a3a3a3]">Current Password</label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Your current password"
                    className="bg-[#262626] border-white/10 text-white placeholder:text-[#525252] h-10 text-sm focus-visible:ring-1 focus-visible:ring-white/20"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2.5">
                    <label htmlFor="newPassword" className="text-xs font-medium text-[#a3a3a3]">New Password</label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Your new password"
                      className="bg-[#262626] border-white/10 text-white placeholder:text-[#525252] h-10 text-sm focus-visible:ring-1 focus-visible:ring-white/20"
                      required
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label htmlFor="confirmPassword" className="text-xs font-medium text-[#a3a3a3]">Confirm Password</label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="bg-[#262626] border-white/10 text-white placeholder:text-[#525252] h-10 text-sm focus-visible:ring-1 focus-visible:ring-white/20"
                      required
                    />
                  </div>
                </div>
                
                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                    className="bg-white hover:bg-gray-200 text-black transition-all px-4 py-2 h-auto text-xs font-medium rounded-md"
                  >
                    {passwordLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                    Update Password
                  </Button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
